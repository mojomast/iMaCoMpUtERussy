#!/usr/bin/env node

/**
 * iMaCoMpUtERussy MCP Server
 *
 * Express.js REST API server providing MCP (Model Context Protocol) endpoints
 * for interacting with the iMaCoMpUtERussy emulator.
 */

import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';
import PromptQueue from '../agent/queue-manager.js';
import { fileURLToPath } from 'url';
import { createDeveloperAdapters } from './mcp_developer_adapter.js';
import MultiModelMCPServer from './multi_model_mcp_server.js';
// Winston structured logging setup
// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import winston from 'winston';
// import { resolvePort } from '../lib/port-utils.js';

// Create winston logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mcp-server' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File transport for production logging
    new winston.transports.File({
      filename: 'logs/mcp-server.log',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    // Error log file
    new winston.transports.File({
      filename: 'logs/mcp-server-error.log',
      level: 'error',
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5,
      tailable: true
    })
  ]
});

// Create data directory for logs if it doesn't exist
const dataDir = path.join(__dirname, '..', 'data');
const logsDir = path.join(dataDir, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}
import { MCPError, MCP_ERROR_CODES, formatError } from './mcp_errors.js';
import ErrorHandler from '../lib/ErrorHandler.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 8001;

// Server instance for graceful shutdown
let server = null;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Configure rate limiting middleware
const intenseLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 requests per window
  message: {
    error: 'Too many intense operations',
    message: 'Rate limit exceeded for CPU-intensive operations (10 requests per 15 minutes). Please try again later.',
    retryAfter: '15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const moderateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 25, // 25 requests per window
  message: {
    error: 'Too many requests',
    message: 'Rate limit exceeded for operations (25 requests per 5 minutes). Please slow down.',
    retryAfter: '5 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const lenientLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per window
  message: {
    error: 'Rate limit exceeded',
    message: 'Too many health check requests. Please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// ============================================================================
// API KEY AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Middleware to authenticate requests using API key
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
function authenticateAPIKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization'];
  const expectedApiKey = process.env.MCP_API_KEY || 'default-api-key-change-in-production';

  if (!apiKey) {
    throw new MCPError('UNAUTHORIZED', 'API key required', null, 401);
  }

  // Support both Bearer token and direct API key
  const providedKey = apiKey.startsWith('Bearer ') ? apiKey.slice(7) : apiKey;

  if (providedKey !== expectedApiKey) {
    throw new MCPError('UNAUTHORIZED', 'Invalid API key', null, 401);
  }

  next();
}

// Initialize AJV validator - disable remote schema resolution
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'all',
  addUsedSchema: false // Don't fetch remote schemas
});

// Load and compile JSON schemas
const schemasDir = path.join(__dirname, '../docs/mcp_schemas');
const compiledValidators = {};

function loadSchemas() {
  try {
    logger.info('Loading MCP schemas', { schemasDir, count: 'unknown' });

    // Load individual schema files
    const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json'));
    logger.debug('Found schema files', {
      count: files.length,
      schemaNames: files.map(f => f.replace('.json', ''))
    });

    for (const file of files) {
      const schemaPath = path.join(schemasDir, file);
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      const schema = JSON.parse(schemaContent);

      const key = file.replace('.json', '');
      try {
        compiledValidators[key] = ajv.compile(schema);
        logger.debug('Schema loaded successfully', { schema: key });
      } catch (compileError) {
        logger.warn('Schema compilation failed', {
          schema: key,
          error: compileError.message,
          stack: compileError.stack
        });
      }
    }

    logger.info('Schemas loaded', {
      count: Object.keys(compiledValidators).length,
      schemasDir
    });

    // Debug: Check if our memory schemas are loaded
    const memorySchemas = ['memory.read.request', 'memory.write.request', 'memory.loadProgram.request'];
    let missingMemorySchemas = [];
    let loadedMemorySchemas = [];

    memorySchemas.forEach(schemaKey => {
      if (compiledValidators[schemaKey]) {
        loadedMemorySchemas.push(schemaKey);
      } else {
        missingMemorySchemas.push(schemaKey);
      }
    });

    logger.debug('Memory schema status', {
      loaded: loadedMemorySchemas,
      missing: missingMemorySchemas
    });

    // Check if our debug schemas are loaded
    const debugSchemas = ['debug.trace.request', 'debug.trace.response', 'debug.memoryView.request', 'debug.memoryView.response', 'debug.breakpoints.request', 'debug.breakpoints.response'];
    let missingDebugSchemas = [];
    let loadedDebugSchemas = [];

    debugSchemas.forEach(schemaKey => {
      if (compiledValidators[schemaKey]) {
        loadedDebugSchemas.push(schemaKey);
      } else {
        missingDebugSchemas.push(schemaKey);
      }
    });

    logger.debug('Debug schema status', {
      loaded: loadedDebugSchemas,
      missing: missingDebugSchemas
    });
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::loadSchemas');
    throw error;
  }
}
// Initialize prompt queue system
let queueManager;

function initializeQueue() {
  try {
    queueManager = new PromptQueue({
      queueFile: path.join(__dirname, '..', 'data', 'queue.json'),
      backupDir: path.join(__dirname, '..', 'data', 'backups'),
      aiProcessor: multiModelServer
    });
    logger.info('Prompt queue system initialized');
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::initializeQueue');
    throw error;
  }
}

// Initialize developer API adapters
let adapters;
// Initialize multi-model server
let multiModelServer;
function initializeAdapters() {
  try {
    adapters = createDeveloperAdapters();
    logger.info('Developer adapters initialized');
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::initializeAdapters');
    throw error;
  }
}

// Utility function to validate request/response
function validate(schemaKey, data, type = 'request') {
  const validator = compiledValidators[schemaKey];
  if (!validator) {
    throw new MCPError('INTERNAL_ERROR', `Schema not found: ${schemaKey}`);
  }

  const valid = validator(data);
  if (!valid) {
    return { success: false, data, errors: validator.errors };
  }

  return { success: true, data };
}

// Success response helper
function successResponse(data) {
  return {
    success: true,
    data
  };
}

// ============================================================================
// INPUT VALIDATION AND SANITIZATION UTILITIES
// ============================================================================

const VALIDATION_CONFIG = {
  MAX_PROGRAM_NAME_LENGTH: 50,
  MAX_PROGRAM_SOURCE_LENGTH: 10000, // 10KB limit for program source
  MAX_FILE_PATH_LENGTH: 255,
  MAX_MEMORY_SIZE: 65536, // 64KB address space
  MAX_PIXEL_COORDINATE: 31,
  MAX_COLOR_VALUE: 255,
  MAX_TERMINAL_TEXT_LENGTH: 1000,
  MAX_TIMEOUT_MS: 30000,
  MIN_TIMEOUT_MS: 100
};

/**
 * Sanitize and validate program name
 * @param {string} name - Program name to validate
 * @returns {string} Sanitized program name
 * @throws {MCPError} If name is invalid
 */
function sanitizeProgramName(name) {
  if (!name || typeof name !== 'string') {
    throw new MCPError('INVALID_REQUEST', 'Program name must be a non-empty string');
  }

  const sanitized = name.trim().replace(/[^a-zA-Z0-9\-_\.]/g, '').substring(0, VALIDATION_CONFIG.MAX_PROGRAM_NAME_LENGTH);

  if (sanitized.length === 0) {
    throw new MCPError('INVALID_REQUEST', 'Program name contains no valid characters');
  }

  // Prevent directory traversal
  if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
    throw new MCPError('INVALID_REQUEST', 'Program name contains invalid path characters');
  }

  return sanitized;
}

/**
 * Sanitize and validate program source code
 * @param {string} source - Program source code to validate
 * @returns {string} Sanitized source code
 * @throws {MCPError} If source is invalid
 */
function sanitizeProgramSource(source) {
  if (!source || typeof source !== 'string') {
    throw new MCPError('INVALID_REQUEST', 'Program source must be a non-empty string');
  }

  if (source.length > VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH) {
    throw new MCPError('PAYLOAD_TOO_LARGE', `Program source too large. Maximum size is ${VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH} characters`);
  }

  // Basic sanitization - remove any potentially harmful patterns in assembly
  const sanitized = source.replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // Remove control characters

  return sanitized;
}

/**
 * Validate memory address
 * @param {number} address - Memory address to validate
 * @returns {number} Validated address
 * @throws {MCPError} If address is invalid
 */
function validateMemoryAddress(address) {
  if (typeof address !== 'number' || isNaN(address)) {
    throw new MCPError('INVALID_REQUEST', 'Address must be a valid number');
  }

  if (address < 0 || address > 0xFFFF) {
    throw new MCPError('MEMORY_OUT_OF_BOUNDS', 'Address must be between 0x0000 and 0xFFFF');
  }

  return parseInt(address, 10);
}

/**
 * Validate memory size
 * @param {number} size - Memory size to validate
 * @returns {number} Validated size
 * @throws {MCPError} If size is invalid
 */
function validateMemorySize(size) {
  if (typeof size !== 'number' || isNaN(size)) {
    throw new MCPError('INVALID_REQUEST', 'Size must be a valid number');
  }

  if (size < 1 || size > 65536) {
    throw new MCPError('INVALID_REQUEST', 'Size must be between 1 and 65536 bytes');
  }

  return parseInt(size, 10);
}

/**
 * Validate pixel coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @throws {MCPError} If coordinates are invalid
 */
function validatePixelCoordinates(x, y) {
  if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
    throw new MCPError('INVALID_REQUEST', 'Coordinates must be valid numbers');
  }

  if (x < 0 || x > VALIDATION_CONFIG.MAX_PIXEL_COORDINATE ||
      y < 0 || y > VALIDATION_CONFIG.MAX_PIXEL_COORDINATE) {
    throw new MCPError('VIDEO_OUT_OF_BOUNDS', `Coordinates must be between 0 and ${VALIDATION_CONFIG.MAX_PIXEL_COORDINATE}`);
  }
}

/**
 * Validate color value
 * @param {number} color - Color value to validate
 * @returns {number} Validated color
 * @throws {MCPError} If color is invalid
 */
function validateColor(color) {
  if (typeof color !== 'number' || isNaN(color)) {
    throw new MCPError('INVALID_REQUEST', 'Color must be a valid number');
  }

  if (color < 0 || color > VALIDATION_CONFIG.MAX_COLOR_VALUE) {
    throw new MCPError('INVALID_REQUEST', `Color must be between 0 and ${VALIDATION_CONFIG.MAX_COLOR_VALUE}`);
  }

  return parseInt(color, 10);
}

/**
 * Validate and sanitize terminal text
 * @param {string} text - Terminal text to validate
 * @returns {string} Sanitized text
 * @throws {MCPError} If text is invalid
 */
function sanitizeTerminalText(text) {
  if (typeof text !== 'string') {
    throw new MCPError('INVALID_REQUEST', 'Terminal text must be a string');
  }

  if (text.length > VALIDATION_CONFIG.MAX_TERMINAL_TEXT_LENGTH) {
    throw new MCPError('PAYLOAD_TOO_LARGE', `Terminal text too long. Maximum length is ${VALIDATION_CONFIG.MAX_TERMINAL_TEXT_LENGTH} characters`);
  }

  // Sanitize control characters but preserve line breaks and tabs
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
}

/**
 * Validate timeout value
 * @param {number} timeout - Timeout value to validate
 * @returns {number} Validated timeout
 * @throws {MCPError} If timeout is invalid
 */
function validateTimeout(timeout) {
  if (timeout === undefined) return VALIDATION_CONFIG.MIN_TIMEOUT_MS;

  if (typeof timeout !== 'number' || isNaN(timeout)) {
    throw new MCPError('INVALID_REQUEST', 'Timeout must be a valid number');
  }

  if (timeout < VALIDATION_CONFIG.MIN_TIMEOUT_MS || timeout > VALIDATION_CONFIG.MAX_TIMEOUT_MS) {
    throw new MCPError('INVALID_REQUEST', `Timeout must be between ${VALIDATION_CONFIG.MIN_TIMEOUT_MS} and ${VALIDATION_CONFIG.MAX_TIMEOUT_MS} milliseconds`);
  }

  return parseInt(timeout, 10);
}

/**
 * Validate boolean values
 * @param {*} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {MCPError} If value is not a valid boolean
 */
function validateBoolean(value, fieldName = 'boolean') {
  if (typeof value !== 'boolean') {
    throw new MCPError('INVALID_REQUEST', `${fieldName} must be a boolean value`);
  }
}

/**
 * Validate string length
 * @param {string} str - String to validate
 * @param {number} maxLength - Maximum allowed length
 * @param {string} fieldName - Name of the field for error messages
 * @throws {MCPError} If string is invalid
 */
function validateStringLength(str, maxLength, fieldName = 'string') {
  if (typeof str !== 'string') {
    throw new MCPError('INVALID_REQUEST', `${fieldName} must be a string`);
  }

  if (str.length > maxLength) {
    throw new MCPError('PAYLOAD_TOO_LARGE', `${fieldName} too long. Maximum length is ${maxLength} characters`);
  }
}

// Async route wrapper for error handling
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// CPU Endpoints
app.post('/mcp/cpu/reset', moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('cpu.reset.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const result = adapters.cpu.reset(req.body.hardReset);
    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::cpu_reset');
    throw new MCPError('CPU_NOT_READY', 'CPU operation failed', { originalError: stdError.message });
  }
}));

app.post('/mcp/cpu/step', authenticateAPIKey, intenseLimiter, asyncHandler(async (req, res) => {
  const validation = validate('cpu.step.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const validatedTimeout = validateTimeout(req.body.timeout);
    const result = adapters.cpu.step(validatedTimeout);

    logger.info('CPU step executed successfully', {
      endpoint: 'POST /mcp/cpu/step',
      pc: `0x${result.pc.toString(16)}`,
      instruction: result.instruction,
      timeoutMs: validatedTimeout
    });

    // Validate response against schema
    const responseValidation = validate('cpu.step.response', { data: result });
    if (!responseValidation.success) {
      throw new MCPError('INTERNAL_ERROR', 'Response validation failed', { validationErrors: responseValidation.errors }, 500);
    }

    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::cpu_step');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'CPU step operation failed', stdError.message, 500);
  }
}));

// Program Endpoints
app.get('/mcp/programs/list', moderateLimiter, asyncHandler(async (req, res) => {
  try {
    const result = await adapters.programs.list();
    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::programs_list');
    throw new MCPError('SYSTEM_ERROR', 'Program list failed', stdError.message, 500);
  }
}));

app.post('/mcp/programs/load-sample', moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('programs.load.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { sampleName, assembled, resetCPU } = req.body;

    // Additional validation and sanitization
    const sanitizedName = sanitizeProgramName(sampleName);
    validateBoolean(assembled, 'assembled');
    validateBoolean(resetCPU, 'resetCPU');

    logger.info('Program load-sample request initiated', {
      endpoint: 'POST /mcp/programs/load-sample',
      programName: sanitizedName,
      assembled,
      resetCPU
    });

    const result = await adapters.programs.load(sanitizedName, assembled, resetCPU);
    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::programs_load_sample');
    if (error.message.includes('not found') || error.message.includes('PROGRAM_NOT_FOUND')) {
      throw new MCPError('RESOURCE_NOT_FOUND', stdError.message, null, 404);
    } else {
      throw new MCPError('SYSTEM_ERROR', 'Program load-sample failed', stdError.message, 500);
    }
  }
}));

// POST /mcp/programs/load - Load program from samples/ by name
app.post('/mcp/programs/load', moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('programs.load.request.new', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { name, startAddress } = req.body;

    // Additional validation and sanitization
    const sanitizedName = sanitizeProgramName(name);
    const validatedAddress = validateMemoryAddress(startAddress || 0x0600);

    logger.info('Program load request initiated', {
      endpoint: 'POST /mcp/programs/load',
      programName: sanitizedName,
      startAddress: `0x${validatedAddress?.toString(16)}`
    });

    const result = await adapters.programs.loadProgramFromSource(sanitizedName, validatedAddress);
    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::programs_load');
    if (error.message.includes('PROGRAM_NOT_FOUND')) {
      throw new MCPError('PROGRAM_NOT_FOUND', 'Program not found', null, 422);
    } else if (error.message.includes('INVALID_ASSEMBLY')) {
      throw new MCPError('INVALID_ASSEMBLY', 'Invalid assembly code', null, 422);
    } else if (error.message.includes('MEMORY_OUT_OF_RANGE')) {
      throw new MCPError('MEMORY_OUT_OF_RANGE', 'Memory address out of range', null, 422);
    } else {
      throw new MCPError('INTERNAL_ERROR', 'Program load failed', stdError.message, 500);
    }
  }
}));

// POST /mcp/programs/save - Save program to samples/
app.post('/mcp/programs/save', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('programs.save.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { name, source, overwrite } = req.body;

    // Additional validation and sanitization
    const sanitizedName = sanitizeProgramName(name);
    const sanitizedSource = sanitizeProgramSource(source);
    validateBoolean(overwrite, 'overwrite');

    logger.info('Program save request initiated', {
      endpoint: 'POST /mcp/programs/save',
      programName: sanitizedName,
      overwrite,
      sourceLength: sanitizedSource.length
    });

    const result = await adapters.programs.saveProgram(sanitizedName, sanitizedSource, overwrite);
    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::programs_save');
    if (error.message.includes('PROGRAM_EXISTS')) {
      throw new MCPError('PROGRAM_EXISTS', 'Program already exists', null, 422);
    } else if (error.message.includes('Invalid program name')) {
      throw new MCPError('INVALID_REQUEST', 'Invalid program name', null, 400);
    } else if (error instanceof MCPError) {
      // Re-throw our validation errors
      throw error;
    } else {
      throw new MCPError('INTERNAL_ERROR', 'Program save failed', stdError.message, 500);
    }
  }
}));

// Video Endpoints
const WIDTH = 32; // Assume 32 columns for video display

app.post('/mcp/video/setPixel', moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('video.setPixel.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { x, y, color } = req.body;

    // Additional validation using our sanitization functions
    validatePixelCoordinates(x, y);
    const validatedColor = validateColor(color);

    // Calculate address after validation
    const address = 0x0200 + (y * WIDTH) + x;

    // Add request logging
    logger.info('Video setPixel request processed', {
      endpoint: 'POST /mcp/video/setPixel',
      coordinates: { x, y },
      color: `0x${validatedColor.toString(16)}`,
      address: `0x${address.toString(16)}`
    });

    adapters.memory.write(address, validatedColor, 1);

    const result = { address };

    // Validate response against schema
    const responseValidation = validate('video.setPixel.response', result);

    if (!responseValidation.success) {
      throw new MCPError('INTERNAL_ERROR', 'Response validation failed', { validationErrors: responseValidation.errors }, 500);
    }

    res.json(successResponse(result));
  } catch (error) {
    error.context = { coordinates: { x, y } };
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::video_setPixel');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'Video setPixel failed', stdError.message, 500);
  }
}));

app.post('/mcp/video/update', moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('video.update.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { flush, timeout } = req.body;

    // Additional validation
    validateBoolean(flush, 'flush');
    const validatedTimeout = validateTimeout(timeout);

    logger.info('Video update request processed', {
      endpoint: 'POST /mcp/video/update',
      timeoutMs: validatedTimeout,
      flush
    });

    const startTime = Date.now();

    // Handle timeout with Promise.race
    const updatePromise = (async () => {
      try {
        // Try video.update() first, fall back to adapter.update() if not available
        if (adapters.video.update) {
          return adapters.video.update(flush);
        } else {
          // TODO: Fall back to memory-based update or CPU instruction
          logger.debug('Video update adapter not fully implemented, using fallback');
          return { displayUpdated: true };
        }
      } catch (error) {
        logger.warn('Video update adapter error, falling back', {
          error: error.message,
          errorType: error.constructor.name,
          stack: error.stack
        });
        return { displayUpdated: false };
      }
    })();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('VIDEO_UPDATE_TIMEOUT')), validatedTimeout);
    });

    const result = await Promise.race([updatePromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;

    const responseData = { durationMs, status: result.displayUpdated ? 'updated' : 'failed' };

    // Validate response against schema
    const responseValidation = validate('video.update.response', responseData);

    if (!responseValidation.success) {
      throw new MCPError('INTERNAL_ERROR', 'Response validation failed', { validationErrors: responseValidation.errors }, 500);
    }

    res.json(successResponse(responseData));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::video_update');
    if (error.message === 'VIDEO_UPDATE_TIMEOUT') {
      throw new MCPError('VIDEO_UPDATE_TIMEOUT', 'Video update operation timed out', null, 422);
    } else if (error instanceof MCPError) {
      throw error;
    } else {
      throw new MCPError('INTERNAL_ERROR', 'Video update failed', stdError.message, 500);
    }
  }
}));

app.post('/mcp/video/clear', moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('video.clear.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { color } = req.body;
    const validatedColor = validateColor(color !== undefined ? color : 0);

    console.log(`Video clear - method:POST, path:/mcp/video/clear, validatedColor:0x${validatedColor.toString(16)}`);

    // Clear framebuffer region 0x0200-0x05FF using efficient bulk write
    if (adapters.video.clear) {
      adapters.video.clear(validatedColor);
    } else {
      // Fallback to efficient bulk memory clear
      const framebufferSize = 1024; // 0x05FF - 0x0200 + 1 = 1024 bytes
      const clearBuffer = Array(framebufferSize).fill(validatedColor);
      // Clear memory in chunks to avoid overloading
      for (let addr = 0x0200; addr <= 0x05FF; addr++) {
        adapters.memory.write(addr, validatedColor, 1);
      }
    }

    const result = { cleared: true };

    // Validate response against schema
    const responseValidation = validate('video.clear.response', result);

    if (!responseValidation.success) {
      throw new MCPError('INTERNAL_ERROR', 'Response validation failed', { validationErrors: responseValidation.errors }, 500);
    }

    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::video_clear');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'Video clear failed', stdError.message, 500);
  }
}));

// Debug Endpoints
app.post('/mcp/debug/trace', authenticateAPIKey, intenseLimiter, asyncHandler(async (req, res) => {
   const validation = validate('debug.trace.request', req.body);
   if (!validation.success) {
     throw MCPError.fromAJVValidation(validation.errors);
   }

   try {
     const { steps, until } = req.body;
     const effectiveSteps = Math.min(steps || 100, 10000); // Cap at sensible default

     console.log(`Debug trace - method:POST, path:/mcp/debug/trace, steps:${effectiveSteps}, until:${until || 'default'}`);

     const traceResult = await adapters.debug.trace(effectiveSteps, { until });

     // Validate response against schema
     const responseValidation = validate('debug.trace.response', traceResult);
     if (!responseValidation.success) {
       throw new MCPError('INTERNAL_ERROR', 'Response validation failed', { validationErrors: responseValidation.errors }, 500);
     }

     res.json(successResponse(traceResult));
   } catch (error) {
     const stdError = ErrorHandler.standardizeError(error, 'mcp_server::debug_trace');
     if (error.message.includes('BREAKPOINT')) {
       throw new MCPError('BREAKPOINT_HIT', 'Breakpoint hit', null, 422);
     } else if (error.message.includes('CPU_HALTED')) {
       throw new MCPError('CPU_HALTED', 'CPU halted', null, 422);
     } else {
       throw new MCPError('INTERNAL_ERROR', 'Debug trace failed', stdError.message, 500);
     }
   }
}));

app.post('/mcp/debug/memoryView', authenticateAPIKey, intenseLimiter, asyncHandler(async (req, res) => {
    const validation = validate('debug.memoryView.request', req.body);
    if (!validation.success) {
      throw MCPError.fromAJVValidation(validation.errors);
    }

    try {
      const { address, size } = req.body;

      // Use our validation functions
      const validatedAddress = validateMemoryAddress(address);
      const validatedSize = validateMemorySize(size || 256);

      // Check if range would exceed address space
      if (validatedAddress + validatedSize - 1 > 0xFFFF) {
        throw new MCPError('MEMORY_OUT_OF_BOUNDS', `Memory range (0x${validatedAddress.toString(16)} to 0x${(validatedAddress + validatedSize - 1).toString(16)}) would exceed address space`, null, 400);
      }

      console.log(`Debug memoryView - method:POST, path:/mcp/debug/memoryView, validatedAddress:0x${validatedAddress.toString(16)}, validatedSize:${validatedSize}`);

      // Read the memory range using the adapter functions
      const bytes = [];
      for (let i = 0; i < validatedSize; i++) {
        const addr = validatedAddress + i;
        const result = await adapters.memory.read(addr, 1);
        bytes.push(result.data.value);
      }

      const response = {
        address: validatedAddress,
        size: validatedSize,
        bytes,
        format: 'numeric',
        endAddress: validatedAddress + validatedSize - 1
      };

      // Validate response against schema
      const responseValidation = validate('debug.memoryView.response', response);
      if (!responseValidation.success) {
        throw new MCPError('INTERNAL_ERROR', 'Response validation failed', { validationErrors: responseValidation.errors }, 500);
      }

      res.json(successResponse(response));
    } catch (error) {
      const stdError = ErrorHandler.standardizeError(error, 'mcp_server::debug_memoryView');
      if (error instanceof MCPError) {
        throw error;
      } else if (error.message.includes('out of bounds') || error.message.includes('invalid address')) {
        throw new MCPError('MEMORY_OUT_OF_RANGE', 'Memory address out of range', null, 422);
      } else {
        throw new MCPError('INTERNAL_ERROR', 'Debug memory view failed', stdError.message, 500);
      }
    }
}));

app.post('/mcp/debug/breakpoints', authenticateAPIKey, intenseLimiter, asyncHandler(async (req, res) => {
   const validation = validate('debug.breakpoints.request', req.body);
   if (!validation.success) {
     throw MCPError.fromAJVValidation(validation.errors);
   }

   try {
     const { action, address, id } = req.body;

     console.log(`Debug breakpoints - method:POST, path:/mcp/debug/breakpoints, action:${action}, address:0x${(address || 0).toString(16)}, id:${id || 'N/A'}`);

     let operationResult;

     switch (action) {
       case 'set':
         const breakpointId = await adapters.debug.setBreakpoint(address);
         operationResult = {
           action: 'set',
           success: true,
           id: breakpointId,
           address
         };
         break;

       case 'list':
         const breakpoints = await adapters.debug.listBreakpoints();
         operationResult = {
           action: 'list',
           success: true
         };
         // Breakpoints are included in the outer response
         break;

       case 'remove':
         const removeResult = await adapters.debug.removeBreakpoint(id || address);
         operationResult = {
           action: 'remove',
           success: removeResult.removed,
           address: address || removeResult.address,
           id: id || removeResult.id,
           removed: removeResult.removed
         };
         if (!removeResult.removed) {
           operationResult.error = 'Breakpoint not found';
         }
         break;

       default:
         throw new Error(`INVALID_BREAKPOINT: Unknown action '${action}'`);
     }

     const response = {
       breakpoints: action === 'list' ? await adapters.debug.listBreakpoints() : undefined,
       operationResult
     };

     // Validate response against schema
     const responseValidation = validate('debug.breakpoints.response', response);
     if (!responseValidation.success) {
       throw new MCPError('INTERNAL_ERROR', 'Response validation failed', { validationErrors: responseValidation.errors }, 500);
     }

     res.json(successResponse(response));
   } catch (error) {
     const stdError = ErrorHandler.standardizeError(error, 'mcp_server::debug_breakpoints');
     if (error.message.includes('INVALID_BREAKPOINT') || error.message.includes('breakpoint already exists')) {
       throw new MCPError('INVALID_BREAKPOINT', 'Invalid breakpoint operation', null, 422);
     } else if (error.message.includes('NOT_FOUND')) {
       throw new MCPError('NOT_FOUND', 'Breakpoint not found', null, 404);
     } else {
       throw new MCPError('INTERNAL_ERROR', 'Debug breakpoints failed', stdError.message, 500);
     }
   }
 }));

// ============================================================================
// AI MODEL ENDPOINTS
// ============================================================================

app.post('/mcp/ai/generate', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
 try {
   const { prompt, task, options } = req.body;

   // Additional validation and sanitization
   if (!prompt || typeof prompt !== 'string') {
     throw new MCPError('INVALID_REQUEST', 'Prompt must be a non-empty string');
   }

   const sanitizedPrompt = prompt.trim();
   const taskType = task || 'generation';

   if (sanitizedPrompt.length === 0 || sanitizedPrompt.length > 10000) {
     throw new MCPError('INVALID_REQUEST', 'Prompt length must be between 1 and 10000 characters');
   }

   logger.info('AI generation request initiated', {
     endpoint: 'POST /mcp/ai/generate',
     task: taskType,
     promptLength: sanitizedPrompt.length
   });

   const result = await multiModelServer.generateWithBestModel(sanitizedPrompt, taskType);

   if (!result.success) {
     throw new MCPError('AI_GENERATION_FAILED', result.error, result, 422);
   }

   res.json(successResponse(result));
 } catch (error) {
   const stdError = ErrorHandler.standardizeError(error, 'mcp_server::ai_generate');
   if (error instanceof MCPError) {
     throw error;
   } else {
     throw new MCPError('INTERNAL_ERROR', 'AI generation failed', stdError.message, 500);
   }
 }
}));

app.post('/mcp/ai/models', authenticateAPIKey, lenientLimiter, asyncHandler(async (req, res) => {
 try {
   const { task } = req.body;
   const availableModels = multiModelServer.getAvailableModels(task);
   const configStatus = multiModelServer.getConfigStatus();

   res.json(successResponse({
     availableModels: availableModels.map(m => ({
       name: m.name,
       provider: m.provider,
       capabilities: m.capabilities
     })),
     configStatus
   }));
 } catch (error) {
   const stdError = ErrorHandler.standardizeError(error, 'mcp_server::ai_models');
   if (error instanceof MCPError) {
     throw error;
   } else {
     throw new MCPError('INTERNAL_ERROR', 'Failed to get AI models', stdError.message, 500);
   }
 }
}));

// Health check endpoint
app.get('/health', lenientLimiter, (req, res) => {
 res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MCP Error handling middleware
app.use((err, req, res, next) => {
  // Handle MCPError instances
  if (MCPError.isMCPError(err)) {
    return res.status(err.httpStatus).json(formatError(err));
  }

  // Handle AJV validation errors that might slip through
  if (err && err.message && err.message.includes('validation failed')) {
    const mcpError = MCPError.fromValidationError(err);
    return res.status(mcpError.httpStatus).json(formatError(mcpError));
  }

  // Handle other errors as internal errors
  console.error('Unhandled error:', err);
  const internalError = new MCPError(
    'INTERNAL_ERROR',
    'Internal server error',
    {
      originalError: err?.message,
      stack: err?.stack
    },
    500
  );
  return res.status(500).json(formatError(internalError));
});

// Default route handler
app.use('/mcp/*', (req, res) => {
  const error = new MCPError('NOT_FOUND', `Endpoint ${req.path} not found`);
  return res.status(404).json(formatError(error));
});

/**
 * Perform graceful shutdown of MCP server
 */
async function shutdown() {
  console.log('Performing graceful shutdown of MCP Server...');

  try {
    // Stop accepting new connections
    if (server) {
      server.close(() => {
        console.log('HTTP server closed successfully');
      });
    }

    // Clean up queue manager resources
    if (queueManager) {
      // Save any pending queue state
      await queueManager.saveQueue();
      console.log('Queue state saved');
    }

    // Close database connections (if any)
    if (adapters && adapters.memory && adapters.memory.close) {
      try {
        await adapters.memory.close();
        console.log('Memory adapter closed');
      } catch (err) {
        logger.warn('Error closing memory adapter:', err);
      }
    }

    // Clean up other adapter resources
    if (adapters && adapters.programs && adapters.programs.close) {
      try {
        await adapters.programs.close();
        console.log('Programs adapter closed');
      } catch (err) {
        logger.warn('Error closing programs adapter:', err);
      }
    }

    // Wait a moment for cleanup
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::shutdown');
  }

  console.log('MCP Server shutdown complete');
}

// Handle shutdown signals
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT signal');
  try {
    await shutdown();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM signal');
  try {
    await shutdown();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Initialize and start server
async function startServer() {
  try {
    console.log('Starting MCP server initialization...');

    loadSchemas();
    console.log('Schemas loaded successfully');

    initializeAdapters();
    console.log('Adapters initialized successfully');

    multiModelServer = new MultiModelMCPServer();
    console.log('MultiModelMCPServer initialized successfully');

    initializeQueue();
    console.log('Queue initialized successfully');

    server = app.listen(PORT, () => {
      console.log(`iMaCoMpUtERussy MCP Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API base URL: http://localhost:${PORT}/mcp`);
    });

    // Handle server-level errors
    server.on('error', (error) => {
      console.error('Server error:', error.message, error.stack);
      process.exit(1);
    });

  } catch (error) {
    console.error('Failed to start MCP server:', error.message, error.stack);
    process.exit(1);
  }
}

// Export app for testing
export { app };

// Start server when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}