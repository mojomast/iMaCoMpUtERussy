#!/usr/bin/env node

/* global broadcastEvent, checkBreakpoint */

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
import { fileURLToPath, pathToFileURL } from 'url';
import { createDeveloperAdapters } from './mcp_developer_adapter.js';
import MultiModelMCPServer from './multi_model_mcp_server.js';
import WebSocket from 'ws';
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
import { MCPError, MCP_ERROR_CODES, formatError, retryHandler, circuitBreaker } from './mcp_errors.js';
import ErrorHandler from '../lib/ErrorHandler.js';
import { sanitizeProgramName, sanitizeProgramSource, validateMemoryAddress, validateMemorySize, validatePixelCoordinates, validateColor, sanitizeTerminalText, validateTimeout, validateBoolean, validateStringLength, VALIDATION_CONFIG } from '../lib/validators.js';

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

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

// Initialize AJV validator with remote schema resolution enabled
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'all',
  addUsedSchema: true, // Allow fetching remote schemas
  strict: false, // Disable strict mode to avoid type warnings
  formats: {
    date: true,
    'date-time': true
  }
});

// Add custom date-time format validator if needed
ajv.addFormat('date-time', {
  type: 'string',
  validate: (str) => {
    const date = new Date(str);
    return !isNaN(date.getTime()) && date.toISOString() === str;
  }
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
        // Remove $schema reference to avoid remote resolution issues
        if (schema.$schema) {
          delete schema.$schema;
          logger.debug('Removed $schema reference from schema', { schema: key });
        }
        
        compiledValidators[key] = ajv.compile(schema);
        logger.debug('Schema loaded successfully', { schema: key });
      } catch (compileError) {
        logger.warn('Schema compilation failed', {
          schema: key,
          error: compileError.message,
          stack: compileError.stack
        });
      }

      // Add memory.write endpoint broadcasting if schema exists
      if (key === 'memory.write.request') {
        app.post('/mcp/memory/write', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
          const validation = validate('memory.write.request', req.body);
          if (!validation.success) {
            throw MCPError.fromAJVValidation(validation.errors);
          }

          try {
            const { address, value, size } = req.body;
            const validatedAddress = validateMemoryAddress(address);
            const validatedValue = validateColor(value);
            const validatedSize = validateMemorySize(size || 1);

            logger.info('Memory write request processed', {
              endpoint: 'POST /mcp/memory/write',
              address: `0x${validatedAddress.toString(16)}`,
              value: `0x${validatedValue.toString(16)}`,
              size: validatedSize
            });

            adapters.memory.write(validatedAddress, validatedValue, validatedSize);

            // Broadcast memory write event
            if (typeof broadcastEvent === 'function') {
              broadcastEvent('memory.write', { address: validatedAddress, value: validatedValue, size: validatedSize });
            }

            const result = { address: validatedAddress, value: validatedValue, size: validatedSize };
            res.json(successResponse(result));
          } catch (error) {
            const stdError = ErrorHandler.standardizeError(error, 'mcp_server::memory_write');
            if (error instanceof MCPError) {
              throw error;
            }
            throw new MCPError('INTERNAL_ERROR', 'Memory write failed', stdError.message, 500);
          }
        }));
        logger.info('Memory write endpoint with broadcasting added');
      }

      // Add memory.saveState endpoint if schema exists
      if (key === 'memory.saveState.request') {
        app.post('/mcp/memory/saveState', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
          const validation = validate('memory.saveState.request', req.body);
          if (!validation.success) {
            throw MCPError.fromAJVValidation(validation.errors);
          }

          try {
            const { name, range, overwrite } = req.body;
            
            // Sanitize state name (similar to program name)
            const sanitizedName = sanitizeProgramName(name);
            if (sanitizedName.length === 0) {
              throw new MCPError('INVALID_REQUEST', 'State name must be a non-empty string with valid characters');
            }

            // Determine range (default full memory)
            const startAddr = range?.start || 0x0000;
            const endAddr = range?.end || 0xFFFF;
            const validatedStart = validateMemoryAddress(startAddr);
            const validatedEnd = validateMemoryAddress(endAddr);
            if (validatedEnd < validatedStart) {
              throw new MCPError('INVALID_REQUEST', 'End address must be >= start address');
            }

            const bytesToSave = validatedEnd - validatedStart + 1;
            if (bytesToSave > 65536) {
              throw new MCPError('PAYLOAD_TOO_LARGE', 'Memory range too large');
            }

            // Create states directory if needed
            const statesDir = path.join(dataDir, 'ram_states');
            if (!fs.existsSync(statesDir)) {
              fs.mkdirSync(statesDir, { recursive: true });
            }

            // Check if state exists and handle overwrite
            const stateFile = path.join(statesDir, `${sanitizedName}.json`);
            if (fs.existsSync(stateFile) && !overwrite) {
              throw new MCPError('STATE_EXISTS', `State '${sanitizedName}' already exists`, null, 409);
            }

            // Read memory contents
            const memoryBuffer = new Uint8Array(bytesToSave);
            for (let i = 0; i < bytesToSave; i++) {
              const addr = (validatedStart + i) & 0xFFFF;
              memoryBuffer[i] = adapters.memory.read(addr, 1).data.value & 0xFF;
            }

            // Save to file
            const stateData = {
              name: sanitizedName,
              range: { start: validatedStart, end: validatedEnd },
              bytes: Array.from(memoryBuffer),
              savedAt: new Date().toISOString(),
              version: '1.0'
            };

            fs.writeFileSync(stateFile, JSON.stringify(stateData, null, 2));

            logger.info('Memory state saved successfully', {
              endpoint: 'POST /mcp/memory/saveState',
              stateName: sanitizedName,
              bytesSaved: bytesToSave,
              range: `0x${validatedStart.toString(16)}-0x${validatedEnd.toString(16)}`
            });

            // Broadcast save event
            if (typeof broadcastEvent === 'function') {
              broadcastEvent('memory.saveState', { name: sanitizedName, bytesSaved: bytesToSave, range: { start: validatedStart, end: validatedEnd } });
            }

            const result = {
              name: sanitizedName,
              bytesSaved: bytesToSave,
              range: { start: validatedStart, end: validatedEnd },
              savedAt: stateData.savedAt
            };

            res.json(successResponse(result));
          } catch (error) {
            const stdError = ErrorHandler.standardizeError(error, 'mcp_server::memory_saveState');
            if (error instanceof MCPError) {
              throw error;
            }
            throw new MCPError('INTERNAL_ERROR', 'Memory save state failed', stdError.message, 500);
          }
        }));
        logger.info('Memory saveState endpoint added');
      }

      // Add memory.loadState endpoint if schema exists
      if (key === 'memory.loadState.request') {
        app.post('/mcp/memory/loadState', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
          const validation = validate('memory.loadState.request', req.body);
          if (!validation.success) {
            throw MCPError.fromAJVValidation(validation.errors);
          }

          try {
            const { name, targetAddress, range } = req.body;
            
            // Sanitize state name
            const sanitizedName = sanitizeProgramName(name);
            if (sanitizedName.length === 0) {
              throw new MCPError('INVALID_REQUEST', 'State name must be a non-empty string with valid characters');
            }

            // Validate target address
            const validatedTarget = validateMemoryAddress(targetAddress || 0x0000);

            // Load state file
            const statesDir = path.join(dataDir, 'ram_states');
            const stateFile = path.join(statesDir, `${sanitizedName}.json`);
            
            if (!fs.existsSync(stateFile)) {
              throw new MCPError('STATE_NOT_FOUND', `State '${sanitizedName}' not found`, null, 404);
            }

            const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
            if (!stateData.bytes || !Array.isArray(stateData.bytes)) {
              throw new MCPError('INVALID_STATE_FILE', 'State file contains invalid data', null, 422);
            }

            // Determine load range (use saved range if not specified)
            const loadStart = range?.start !== undefined ? validateMemoryAddress(range.start) : stateData.range.start;
            const loadEnd = range?.end !== undefined ? validateMemoryAddress(range.end) : stateData.range.end;
            const bytesToLoad = loadEnd - loadStart + 1;

            if (bytesToLoad > stateData.bytes.length) {
              throw new MCPError('INVALID_RANGE', 'Specified range exceeds saved state size', null, 422);
            }

            // Check target range doesn't exceed memory bounds
            const finalEnd = validatedTarget + bytesToLoad - 1;
            if (finalEnd > 0xFFFF) {
              throw new MCPError('MEMORY_OUT_OF_BOUNDS', `Load would exceed memory bounds at target 0x${validatedTarget.toString(16)}`, null, 422);
            }

            // Load bytes to memory
            let bytesLoaded = 0;
            for (let i = 0; i < bytesToLoad; i++) {
              const sourceByte = stateData.bytes[loadStart + i];
              const targetAddr = (validatedTarget + i) & 0xFFFF;
              try {
                adapters.memory.write(targetAddr, sourceByte, 1);
                bytesLoaded++;
              } catch (writeError) {
                logger.warn('Failed to load state byte', { targetAddr, sourceByte, error: writeError.message });
                break; // Stop on write error
              }
            }

            logger.info('Memory state loaded successfully', {
              endpoint: 'POST /mcp/memory/loadState',
              stateName: sanitizedName,
              bytesLoaded,
              targetAddress: `0x${validatedTarget.toString(16)}`,
              range: `0x${loadStart.toString(16)}-0x${loadEnd.toString(16)}`
            });

            // Broadcast load event
            if (typeof broadcastEvent === 'function') {
              broadcastEvent('memory.loadState', { name: sanitizedName, bytesLoaded, targetAddress: validatedTarget, range: { start: loadStart, end: loadEnd } });
            }

            const result = {
              name: sanitizedName,
              bytesLoaded,
              targetAddress: validatedTarget,
              range: { start: loadStart, end: loadEnd },
              loadedAt: new Date().toISOString()
            };

            res.json(successResponse(result));
          } catch (error) {
            const stdError = ErrorHandler.standardizeError(error, 'mcp_server::memory_loadState');
            if (error instanceof MCPError) {
              throw error;
            }
            throw new MCPError('INTERNAL_ERROR', 'Memory load state failed', stdError.message, 500);
          }
        }));
        logger.info('Memory loadState endpoint added');
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


// Async route wrapper for error handling
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// CPU Endpoints
app.post('/mcp/cpu/reset', retryHandler(3, 1000, 'cpu'), moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('cpu.reset.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const result = adapters.cpu.reset(req.body.hardReset);
    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::cpu_reset');
    throw new MCPError('CPU_NOT_READY', 'CPU operation failed', { originalError: stdError.message }, 500, true, 3, 1000, 'cpu', 5000);
  }
}));

// Memory read endpoint
app.post('/mcp/memory/read', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('memory.read.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { address, size } = req.body;
    const validatedAddress = validateMemoryAddress(address);
    const validatedSize = validateMemorySize(size || 1);

    // Check bounds
    if (validatedAddress + validatedSize - 1 > 0xFFFF) {
      throw new MCPError('MEMORY_OUT_OF_BOUNDS', `Read would exceed memory bounds at 0x${validatedAddress.toString(16)}`, null, 422);
    }

    logger.info('Memory read request processed', {
      endpoint: 'POST /mcp/memory/read',
      address: `0x${validatedAddress.toString(16)}`,
      size: validatedSize
    });

    const bytes = [];
    for (let i = 0; i < validatedSize; i++) {
      const addr = (validatedAddress + i) & 0xFFFF;
      const readResult = adapters.memory.read(addr, 1);
      bytes.push(readResult.data.value & 0xFF);
    }

    const result = {
      address: validatedAddress,
      size: validatedSize,
      bytes: bytes,
      endAddress: validatedAddress + validatedSize - 1
    };

    // Validate response
    const responseValidation = validate('memory.read.response', result);
    if (!responseValidation.success) {
      logger.warn('Memory read response validation failed', { errors: responseValidation.errors });
    }

    // Broadcast memory read event (optional for logging)
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('memory.read', { address: validatedAddress, size: validatedSize });
    }

    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::memory_read');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'Memory read failed', stdError.message, 500);
  }
}));

// Memory loadProgram endpoint
app.post('/mcp/memory/loadProgram', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('memory.loadProgram.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { programName, startAddress, assembled } = req.body;
    const sanitizedName = sanitizeProgramName(programName);
    const validatedAddress = validateMemoryAddress(startAddress || 0x0600);
    validateBoolean(assembled, 'assembled');

    logger.info('Memory loadProgram request processed', {
      endpoint: 'POST /mcp/memory/loadProgram',
      programName: sanitizedName,
      startAddress: `0x${validatedAddress.toString(16)}`,
      assembled
    });

    const result = await adapters.programs.loadProgramFromSource(sanitizedName, validatedAddress, assembled);

    // Validate response
    const responseValidation = validate('memory.loadProgram.response', result);
    if (!responseValidation.success) {
      logger.warn('Memory loadProgram response validation failed', { errors: responseValidation.errors });
    }

    // Broadcast load event
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('memory.loadProgram', {
        programName: sanitizedName,
        bytesLoaded: result.bytesLoaded || 0,
        startAddress: validatedAddress
      });
    }

    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::memory_loadProgram');
    if (error.message.includes('PROGRAM_NOT_FOUND')) {
      throw new MCPError('PROGRAM_NOT_FOUND', 'Program not found', null, 404);
    } else if (error.message.includes('INVALID_ASSEMBLY')) {
      throw new MCPError('INVALID_ASSEMBLY', 'Invalid assembly code', null, 422);
    } else if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'Memory loadProgram failed', stdError.message, 500);
  }
}));

app.post('/mcp/cpu/step', retryHandler(3, 1000, 'cpu'), authenticateAPIKey, intenseLimiter, asyncHandler(async (req, res) => {
  const validation = validate('cpu.step.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const validatedTimeout = validateTimeout(req.body.timeout);
    const result = adapters.cpu.step(validatedTimeout);

    // Broadcast CPU step event
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('cpu.step', { pc: result.pc, instruction: result.instruction, registers: result.registers });
    }

    logger.info('CPU step executed successfully', {
      endpoint: 'POST /mcp/cpu/step',
      pc: `0x${result.pc.toString(16)}`,
      instruction: result.instruction,
      timeoutMs: validatedTimeout,
      circuitState: circuitBreaker.getServiceBreaker('cpu').state
    });

    // Validate response against schema
    const responseValidation = validate('cpu.step.response', { data: result });
    if (!responseValidation.success) {
      throw new MCPError('INTERNAL_ERROR', 'Response validation failed', { validationErrors: responseValidation.errors }, 500, false, 0, 0, 'cpu', 5000);
    }

    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::cpu_step');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'CPU step operation failed', stdError.message, 500, true, 3, 1000, 'cpu', 5000);
  }
}));

// CPU run endpoint
app.post('/mcp/cpu/run', retryHandler(3, 1000, 'cpu'), authenticateAPIKey, intenseLimiter, asyncHandler(async (req, res) => {
  const validation = validate('cpu.run.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { maxSteps = 1000, stepDelay = 1, breakOnHalt = true } = req.body;
    const validatedMaxSteps = Math.min(Math.max(parseInt(maxSteps), 1), 10000);
    const validatedStepDelay = Math.min(Math.max(parseInt(stepDelay), 0), 100);
    validateBoolean(breakOnHalt, 'breakOnHalt');

    logger.info('CPU run request processed', {
      endpoint: 'POST /mcp/cpu/run',
      maxSteps: validatedMaxSteps,
      stepDelay: validatedStepDelay,
      breakOnHalt,
      circuitState: circuitBreaker.getServiceBreaker('cpu').state
    });

    const result = await adapters.cpu.run(validatedMaxSteps, validatedStepDelay, breakOnHalt);

    // Broadcast CPU run event
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('cpu.run', { stepsExecuted: result.stepsExecuted, halted: result.halted, finalPC: result.finalPC });
    }

    // Validate response against schema
    const responseValidation = validate('cpu.run.response', { data: result });
    if (!responseValidation.success) {
      logger.warn('CPU run response validation failed', { errors: responseValidation.errors });
    }

    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::cpu_run');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'CPU run operation failed', stdError.message, 500, true, 3, 1000, 'cpu', 5000);
  }
}));

// CPU state endpoint
app.get('/mcp/cpu/state', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
  try {
    const result = await adapters.cpu.status();

    logger.debug('CPU state retrieved successfully', {
      endpoint: 'GET /mcp/cpu/state',
      pc: `0x${result.data.pc.toString(16)}`,
      running: result.data.running
    });

    // Broadcast CPU state event
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('cpu.state', { pc: result.data.pc, registers: { a: result.data.a, x: result.data.x, y: result.data.y }, running: result.data.running });
    }

    // Validate response against schema
    const responseValidation = validate('cpu.state.response', result);
    if (!responseValidation.success) {
      logger.warn('CPU state response validation failed', { errors: responseValidation.errors });
    }

    res.json(successResponse(result.data));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::cpu_state');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'CPU state retrieval failed', stdError.message, 500);
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

        // Load program file with version-controlled persistence
        const programsDir = path.join(__dirname, '..', 'samples');
        const programFile = path.join(programsDir, `${sanitizedName}.asm`);
        
        if (!fs.existsSync(programFile)) {
          throw new MCPError('PROGRAM_NOT_FOUND', `Program '${sanitizedName}' not found`, null, 404);
        }

        // Read and parse program data
        const fileContent = fs.readFileSync(programFile, 'utf8');
        let programData;
        try {
          programData = JSON.parse(fileContent);
        } catch (parseError) {
          // Legacy .asm file - treat as plain source
          programData = {
            name: sanitizedName,
            source: fileContent,
            metadata: {},
            savedAt: new Date().toISOString(),
            version: '1.0'
          };
        }

        // Validate version and metadata
        const version = programData.version || '1.0';
        if (version !== '1.1') {
          logger.warn('Loading legacy program version', { programName: sanitizedName, version });
          // Handle version upgrade if needed (future-proofing)
          if (version === '1.0') {
            // Calculate checksum for legacy upgrade
            const crypto = await import('crypto');
            const checksum = crypto.createHash('sha256').update(programData.source).digest('hex');
            programData.metadata.checksum = checksum;
            programData.metadata.integrity = 'sha256';
            programData.version = '1.1';
            // Save upgraded version
            fs.writeFileSync(programFile, JSON.stringify(programData, null, 2));
            logger.info('Upgraded legacy program to version 1.1', { programName: sanitizedName });
          }
        }

        // Verify checksum if present
        if (programData.metadata && programData.metadata.checksum) {
          const crypto = await import('crypto');
          const currentChecksum = crypto.createHash('sha256').update(programData.source).digest('hex');
          if (currentChecksum !== programData.metadata.checksum) {
            throw new MCPError('INTEGRITY_CHECK_FAILED', `Program integrity check failed for '${sanitizedName}'`, null, 422);
          }
          logger.debug('Program integrity verified', { programName: sanitizedName, checksum: programData.metadata.checksum });
        }

        // Load the program using adapter
        const result = await adapters.programs.loadProgramFromSource(sanitizedName, validatedAddress, false, programData.source);

        // Enhance result with metadata
        result.metadata = programData.metadata;
        result.version = programData.version;
        result.savedAt = programData.savedAt;
        result.checksum = programData.metadata?.checksum;

        // Broadcast load event with metadata
        if (typeof broadcastEvent === 'function') {
          broadcastEvent('programs.load', {
            name: sanitizedName,
            version: programData.version,
            metadata: Object.keys(programData.metadata),
            checksum: programData.metadata?.checksum
          });
        }

        res.json(successResponse(result));
      } catch (error) {
        const stdError = ErrorHandler.standardizeError(error, 'mcp_server::programs_load');
        if (error.message.includes('PROGRAM_NOT_FOUND')) {
          throw new MCPError('PROGRAM_NOT_FOUND', 'Program not found', null, 422);
        } else if (error.message.includes('INVALID_ASSEMBLY')) {
          throw new MCPError('INVALID_ASSEMBLY', 'Invalid assembly code', null, 422);
        } else if (error.message.includes('MEMORY_OUT_OF_RANGE')) {
          throw new MCPError('MEMORY_OUT_OF_RANGE', 'Memory address out of range', null, 422);
        } else if (error.message.includes('INTEGRITY_CHECK_FAILED')) {
          throw new MCPError('INTEGRITY_CHECK_FAILED', 'Program integrity check failed', null, 422);
        } else {
          throw new MCPError('INTERNAL_ERROR', 'Program load failed', stdError.message, 500);
        }
      }
    }));

    // POST /mcp/assemble/source - Assemble source code and return bytes
    app.post('/mcp/assemble/source', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
      const validation = validate('assemble.source.request', req.body);
      if (!validation.success) {
        throw MCPError.fromAJVValidation(validation.errors);
      }

      try {
        const { source, origin } = req.body;
        
        // Sanitize and validate input
        const sanitizedSource = sanitizeProgramSource(source);
        const validatedOrigin = validateMemoryAddress(origin || 0x0600);
        
        // Check if origin + estimated program size would overflow
        if (sanitizedSource.length > VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH) {
          throw new MCPError('PAYLOAD_TOO_LARGE', 'Assembly source too large', null, 413);
        }

        logger.info('Assembly source request processed', {
          endpoint: 'POST /mcp/assemble/source',
          sourceLength: sanitizedSource.length,
          origin: `0x${validatedOrigin.toString(16)}`
        });

        // Import assembler dynamically
        const { assemble } = await import('../js/assembler.js');
        
        // Assemble the source
        const assembledBytes = assemble(sanitizedSource, { origin: validatedOrigin });
        
        if (!assembledBytes || assembledBytes.length === 0) {
          throw new MCPError('ASSEMBLY_FAILED', 'Assembly produced no output', null, 422);
        }

        // Check for memory overflow
        if (validatedOrigin + assembledBytes.length > 0xFFFF) {
          throw new MCPError('MEMORY_OUT_OF_RANGE', `Program would overflow memory at origin 0x${validatedOrigin.toString(16)}`, null, 422);
        }

        // Broadcast assembly event
        if (typeof broadcastEvent === 'function') {
          broadcastEvent('assemble.source', {
            origin: validatedOrigin,
            bytes: assembledBytes.length,
            sourceLength: sanitizedSource.length
          });
        }

        const result = {
          origin: validatedOrigin,
          bytes: Array.from(assembledBytes),
          byteCount: assembledBytes.length,
          sourceLength: sanitizedSource.length
        };

        // Validate response
        const responseValidation = validate('assemble.source.response', result);
        if (!responseValidation.success) {
          logger.warn('Assembly response validation failed', { errors: responseValidation.errors });
        }

        res.json(successResponse(result));
        
      } catch (error) {
        const stdError = ErrorHandler.standardizeError(error, 'mcp_server::assemble_source');
        if (error.message.includes('ASSEMBLY_FAILED')) {
          throw new MCPError('ASSEMBLY_FAILED', 'Assembly compilation failed', stdError.message, 422);
        } else if (error.message.includes('MEMORY_OUT_OF_RANGE')) {
          throw new MCPError('MEMORY_OUT_OF_RANGE', 'Program would exceed memory bounds', stdError.message, 422);
        } else if (error instanceof MCPError) {
          throw error;
        } else {
          throw new MCPError('INTERNAL_ERROR', 'Assembly processing failed', stdError.message, 500);
        }
      }
    }));

    // POST /mcp/assemble/loadAndRun - Assemble, load, and optionally run program
    app.post('/mcp/assemble/loadAndRun', authenticateAPIKey, intenseLimiter, asyncHandler(async (req, res) => {
      const validation = validate('assemble.loadAndRun.request', req.body);
      if (!validation.success) {
        throw MCPError.fromAJVValidation(validation.errors);
      }

      try {
        const { source, origin, run = false, maxSteps = 1000 } = req.body;
        
        // Sanitize and validate input
        const sanitizedSource = sanitizeProgramSource(source);
        const validatedOrigin = validateMemoryAddress(origin || 0x0600);
        validateBoolean(run, 'run');
        const validatedMaxSteps = Math.min(Math.max(parseInt(maxSteps) || 1000, 1), 10000); // Cap at 10k steps
        
        if (sanitizedSource.length > VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH) {
          throw new MCPError('PAYLOAD_TOO_LARGE', 'Assembly source too large', null, 413);
        }

        logger.info('Assembly loadAndRun request processed', {
          endpoint: 'POST /mcp/assemble/loadAndRun',
          sourceLength: sanitizedSource.length,
          origin: `0x${validatedOrigin.toString(16)}`,
          run,
          maxSteps: validatedMaxSteps
        });

        // Import assembler
        const { assemble } = await import('../js/assembler.js');
        
        // Assemble the source
        const assembledBytes = assemble(sanitizedSource, { origin: validatedOrigin });
        
        if (!assembledBytes || assembledBytes.length === 0) {
          throw new MCPError('ASSEMBLY_FAILED', 'Assembly produced no output', null, 422);
        }

        // Check memory bounds
        if (validatedOrigin + assembledBytes.length > 0xFFFF) {
          throw new MCPError('MEMORY_OUT_OF_RANGE', `Program would overflow memory at origin 0x${validatedOrigin.toString(16)}`, null, 422);
        }

        // Load to memory via adapter
        for (let i = 0; i < assembledBytes.length; i++) {
          const address = validatedOrigin + i;
          adapters.memory.write(address, assembledBytes[i], 1);
        }

        // Reset CPU
        adapters.cpu.reset(true);
        
        let executionResult = null;
        if (run) {
          // Run for maxSteps or until HLT
          let stepsExecuted = 0;
          const startPC = validatedOrigin;
          
          while (stepsExecuted < validatedMaxSteps) {
            const instruction = adapters.cpu.step(1);
            stepsExecuted++;
            
            // Check for HLT instruction (opcode 0x3A)
            if (instruction.opcode === 0x3A) {
              logger.debug('Assembly execution stopped at HLT', { stepsExecuted, finalPC: adapters.cpu.PC });
              break;
            }
            
            // Check for breakpoint if debug system active
            if (typeof checkBreakpoint === 'function' && checkBreakpoint()) {
              logger.debug('Assembly execution stopped at breakpoint', { stepsExecuted, pc: adapters.cpu.PC });
              break;
            }
          }
          
          executionResult = {
            stepsExecuted,
            startPC,
            finalPC: adapters.cpu.PC,
            halted: stepsExecuted < validatedMaxSteps
          };
        }

        // Broadcast events
        if (typeof broadcastEvent === 'function') {
          broadcastEvent('assemble.loadAndRun', {
            origin: validatedOrigin,
            bytesLoaded: assembledBytes.length,
            run,
            stepsExecuted: executionResult ? executionResult.stepsExecuted : 0,
            sourceLength: sanitizedSource.length
          });
        }

        const result = {
          origin: validatedOrigin,
          bytesLoaded: assembledBytes.length,
          sourceLength: sanitizedSource.length,
          execution: run ? executionResult : null,
          run,
          maxSteps: validatedMaxSteps
        };

        // Validate response
        const responseValidation = validate('assemble.loadAndRun.response', result);
        if (!responseValidation.success) {
          logger.warn('Assembly loadAndRun response validation failed', { errors: responseValidation.errors });
        }

        res.json(successResponse(result));
        
      } catch (error) {
        const stdError = ErrorHandler.standardizeError(error, 'mcp_server::assemble_loadAndRun');
        if (error.message.includes('ASSEMBLY_FAILED')) {
          throw new MCPError('ASSEMBLY_FAILED', 'Assembly compilation failed', stdError.message, 422);
        } else if (error.message.includes('MEMORY_OUT_OF_RANGE')) {
          throw new MCPError('MEMORY_OUT_OF_RANGE', 'Program would exceed memory bounds', stdError.message, 422);
        } else if (error instanceof MCPError) {
          throw error;
        } else {
          throw new MCPError('INTERNAL_ERROR', 'Assembly load and run failed', stdError.message, 500);
        }
      }
    }));

// POST /mcp/programs/save - Save program with atomic backup and metadata
app.post('/mcp/programs/save', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
  const validation = validate('programs.save.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

  try {
    const { name, source, metadata = {}, overwrite = false } = req.body;

    // Additional validation and sanitization
    const sanitizedName = sanitizeProgramName(name);
    const sanitizedSource = sanitizeProgramSource(source);
    validateBoolean(overwrite, 'overwrite');
    validateStringLength(JSON.stringify(metadata), 1000, 'metadata');

    logger.info('Program save request initiated', {
      endpoint: 'POST /mcp/programs/save',
      programName: sanitizedName,
      overwrite,
      sourceLength: sanitizedSource.length,
      metadataKeys: Object.keys(metadata)
    });

    // Create programs directory if needed
    const programsDir = path.join(__dirname, '..', 'samples');
    if (!fs.existsSync(programsDir)) {
      fs.mkdirSync(programsDir, { recursive: true });
    }

    const programFile = path.join(programsDir, `${sanitizedName}.asm`);
    const backupDir = path.join(__dirname, '..', 'data', 'backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Check if program exists and handle overwrite
    if (fs.existsSync(programFile) && !overwrite) {
      throw new MCPError('PROGRAM_EXISTS', `Program '${sanitizedName}' already exists`, null, 409);
    }

    // Create backup of existing program if it exists
    if (fs.existsSync(programFile)) {
      const timestamp = Date.now();
      const backupPath = path.join(backupDir, `program_${sanitizedName}_backup_${timestamp}.json`);
      let existingMetadata = {};
      try {
        const existingData = JSON.parse(fs.readFileSync(programFile, 'utf8'));
        existingMetadata = existingData.metadata || {};
      } catch (parseError) {
        // Legacy .asm file without JSON structure
        existingMetadata = {};
      }
      const programData = {
        name: sanitizedName,
        source: fs.readFileSync(programFile, 'utf8'),
        metadata: existingMetadata,
        savedAt: new Date().toISOString(),
        version: '1.0'
      };
      fs.writeFileSync(backupPath, JSON.stringify(programData, null, 2));
      logger.debug('Backup created for existing program', { backupPath, programName: sanitizedName });
    }

    // Calculate checksum for integrity
    const crypto = await import('crypto');
    const checksum = crypto.createHash('sha256').update(sanitizedSource).digest('hex');

    // Prepare program data with metadata including checksum
    const programData = {
      name: sanitizedName,
      source: sanitizedSource,
      metadata: {
        ...metadata,
        checksum: checksum,
        integrity: 'sha256'
      },
      savedAt: new Date().toISOString(),
      version: '1.1' // Updated version with metadata support
    };

    // Atomic write: temp file first
    const tempFile = `${programFile}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(programData, null, 2));

    // Atomic rename
    fs.renameSync(tempFile, programFile);

    // Clean old backups (keep last 10)
    const backupFiles = fs.readdirSync(backupDir)
      .filter(f => f.startsWith(`program_${sanitizedName}_backup_`))
      .map(f => path.join(backupDir, f))
      .sort((a, b) => fs.statSync(b).mtime.getTime() - fs.statSync(a).mtime.getTime());

    if (backupFiles.length > 10) {
      for (let i = 10; i < backupFiles.length; i++) {
        try {
          fs.unlinkSync(backupFiles[i]);
        } catch (unlinkError) {
          logger.warn('Failed to delete old backup', { file: backupFiles[i], error: unlinkError.message });
        }
      }
    }

    const result = {
      name: sanitizedName,
      size: sanitizedSource.length,
      path: programFile,
      version: programData.version,
      metadata: programData.metadata,
      savedAt: programData.savedAt,
      backupCreated: true,
      checksum: checksum
    };

    // Broadcast program save event
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('programs.save', { name: sanitizedName, size: sanitizedSource.length, version: programData.version, checksum });
    }

    // Validate response
    const responseValidation = validate('programs.save.response', result);
    if (!responseValidation.success) {
      logger.warn('Program save response validation failed', { errors: responseValidation.errors });
    }

    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::programs_save');
    if (error.message.includes('PROGRAM_EXISTS')) {
      throw new MCPError('PROGRAM_EXISTS', 'Program already exists', null, 422);
    } else if (error.message.includes('Invalid program name')) {
      throw new MCPError('INVALID_REQUEST', 'Invalid program name', null, 400);
    } else if (error instanceof MCPError) {
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

    // Broadcast video pixel change event
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('video.setPixel', { x, y, color: validatedColor, address });
    }

    const result = { address };

    // Broadcast memory write for video pixel (since it writes to memory)
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('memory.write', { address, value: validatedColor, size: 1 });
    }

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

        // Broadcast video clear event (bulk, so just one event)
        if (addr === 0x0200 && typeof broadcastEvent === 'function') {
          broadcastEvent('video.clear', { color: validatedColor, range: '0x0200-0x05FF' });
        }
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

        // Broadcast memory read event for debug view (optional, for logging)
        if (i === 0 && typeof broadcastEvent === 'function') {
          broadcastEvent('debug.memoryView', { address: validatedAddress, size: validatedSize });
        }
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
// QUEUE MANAGEMENT ENDPOINTS
// ============================================================================

// POST /mcp/queue/add - Add AI prompt to queue
app.post('/mcp/queue/add', retryHandler(3, 1000, 'queue'), authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
  try {
    const { prompt, type = 'generation', priority = 'normal', metadata = {} } = req.body;

    // Manual validation
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new MCPError('INVALID_REQUEST', 'Prompt is required and must be a non-empty string', null, 400, false, 0, 0, 'queue', 10000);
    }
    validateStringLength(prompt, 5000, 'prompt');
    if (!['generation', 'optimization', 'testing', 'debugging', 'custom'].includes(type)) {
      throw new MCPError('INVALID_REQUEST', 'Invalid type. Must be one of: generation, optimization, testing, debugging, custom', null, 400, false, 0, 0, 'queue', 10000);
    }
    if (!['high', 'normal', 'low'].includes(priority)) {
      throw new MCPError('INVALID_REQUEST', 'Invalid priority. Must be one of: high, normal, low', null, 400, false, 0, 0, 'queue', 10000);
    }
    validateStringLength(JSON.stringify(metadata), 2000, 'metadata');

    const sanitizedPrompt = prompt.trim();

    logger.info('Queue add request processed', {
      endpoint: 'POST /mcp/queue/add',
      type,
      priority,
      promptLength: sanitizedPrompt.length,
      metadataKeys: Object.keys(metadata),
      circuitState: circuitBreaker.getServiceBreaker('queue').state
    });

    if (!queueManager) {
      throw new MCPError('SERVICE_UNAVAILABLE', 'Queue manager not initialized', null, 503, true, 3, 1000, 'queue', 10000);
    }

    const taskId = await queueManager.addPrompt(sanitizedPrompt, { type, priority, metadata });

    // Broadcast queue add event
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('queue.add', { taskId, type, priority, promptLength: sanitizedPrompt.length });
    }

    const result = { taskId, message: 'Task added to queue successfully', type, priority };

    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::queue_add');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'Failed to add task to queue', stdError.message, 500, true, 3, 1000, 'queue', 10000);
  }
}));

// GET /mcp/queue/list - List queue items with filtering
app.get('/mcp/queue/list', authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
  try {
    const { status, type, priority, search, limit = 100 } = req.query;

    // Validate query params
    const validatedLimit = Math.min(Math.max(parseInt(limit), 1), 1000);
    if (search && typeof search !== 'string') {
      throw new MCPError('INVALID_REQUEST', 'Search parameter must be a string', null, 400);
    }

    const filter = {};
    if (status) filter.status = status.split(',').filter(s => ['queued', 'processing', 'completed', 'failed', 'cancelled'].includes(s));
    if (type) filter.type = type.split(',').filter(t => ['generation', 'optimization', 'testing', 'debugging', 'custom'].includes(t));
    if (priority) filter.priority = priority.split(',').filter(p => ['high', 'normal', 'low'].includes(p));
    if (search) filter.search = search;

    logger.info('Queue list request processed', {
      endpoint: 'GET /mcp/queue/list',
      filter,
      limit: validatedLimit
    });

    if (!queueManager) {
      throw new MCPError('SERVICE_UNAVAILABLE', 'Queue manager not initialized', null, 503);
    }

    const tasks = await queueManager.listPrompts(filter);
    const limitedTasks = tasks.slice(0, validatedLimit);

    // Broadcast queue list event
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('queue.list', { count: limitedTasks.length, filter, limit: validatedLimit });
    }

    const result = {
      tasks: limitedTasks,
      count: limitedTasks.length,
      total: tasks.length,
      filter,
      limit: validatedLimit
    };

    res.json(successResponse(result));
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::queue_list');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'Failed to list queue tasks', stdError.message, 500);
  }
}));

// ============================================================================
// AI MODEL ENDPOINTS
// ============================================================================

app.post('/mcp/ai/generate', retryHandler(3, 1000, 'ai'), authenticateAPIKey, moderateLimiter, asyncHandler(async (req, res) => {
  // Validate request against schema
  const requestValidation = validate('ai.generate.request', req.body);
  if (!requestValidation.success) {
    throw MCPError.fromAJVValidation(requestValidation.errors);
  }

  const { prompt, task, options } = req.body;
  const sanitizedPrompt = prompt.trim();
  const taskType = task || 'generation';

  logger.info('AI generation request processed', {
    endpoint: 'POST /mcp/ai/generate',
    task: taskType,
    promptLength: sanitizedPrompt.length,
    modelOptions: options,
    circuitState: circuitBreaker.getServiceBreaker('ai').state
  });

  try {
    logger.debug('Selecting best model for AI generation', { task: taskType, promptPreview: sanitizedPrompt.substring(0, 50) + '...' });
    const aiResult = await multiModelServer.generateWithBestModel(sanitizedPrompt, taskType, options);
    logger.debug('AI model generation completed', { modelUsed: aiResult.model || 'unknown', success: aiResult.success, tokensUsed: aiResult.tokensUsed || 0 });
    
    // Format response according to schema
    let responseData;
    if (aiResult.success) {
      responseData = {
        content: aiResult.content || aiResult.generatedText || '',
        model: aiResult.model || 'unknown',
        tokensUsed: aiResult.tokensUsed || 0,
        generatedAt: new Date().toISOString()
      };
    } else {
      responseData = {
        code: aiResult.errorCode || 'AI_GENERATION_FAILED',
        message: aiResult.error || 'AI generation failed'
      };
      logger.warn('AI generation failed from model', { model: aiResult.model, errorCode: responseData.code, errorMessage: responseData.message });
      throw new MCPError('AI_GENERATION_FAILED', responseData.message, responseData, 422, true, 3, 1000, 'ai', 30000);
    }

    // Validate response against schema
    const responseValidation = validate('ai.generate.response', { success: true, data: responseData });
    if (!responseValidation.success) {
      logger.warn('AI generate response validation failed', { errors: responseValidation.errors });
      throw new MCPError('INTERNAL_ERROR', 'Response validation failed', { validationErrors: responseValidation.errors }, 500, true, 3, 1000, 'ai', 30000);
    }

    // Broadcast AI generation event
    if (typeof broadcastEvent === 'function') {
      broadcastEvent('ai.generate', {
        task: taskType,
        promptLength: sanitizedPrompt.length,
        model: responseData.model,
        tokensUsed: responseData.tokensUsed
      });
    }

    logger.info('AI generation successful', { model: responseData.model, contentLength: responseData.content.length, tokensUsed: responseData.tokensUsed });
    res.json(successResponse(responseData));
    
  } catch (error) {
    logger.error('AI generation error', {
      error: error.message,
      stack: error.stack,
      task: taskType,
      promptLength: sanitizedPrompt.length,
      circuitState: circuitBreaker.getServiceBreaker('ai').state
    });
    const stdError = ErrorHandler.standardizeError(error, 'mcp_server::ai_generate');
    if (error instanceof MCPError) {
      throw error;
    }
    throw new MCPError('INTERNAL_ERROR', 'AI generation failed', stdError.message, 500, true, 3, 1000, 'ai', 30000);
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
  // Handle MCPError instances with circuit breaker status
  if (MCPError.isMCPError(err)) {
    const errorResponse = formatError(err);
    // Add circuit breaker status to error details if applicable
    if (err.operationType) {
      errorResponse.error.circuitStatus = circuitBreaker.getServiceBreaker(err.operationType);
    }
    return res.status(err.httpStatus).json(errorResponse);
  }

  // Handle AJV validation errors that might slip through
  if (err && err.message && err.message.includes('validation failed')) {
    const mcpError = MCPError.fromValidationError(err);
    const errorResponse = formatError(mcpError);
    errorResponse.error.circuitStatus = circuitBreaker.getStatus();
    return res.status(mcpError.httpStatus).json(errorResponse);
  }

  // Handle other errors as internal errors
  console.error('Unhandled error:', err);
  const internalError = new MCPError(
    'INTERNAL_ERROR',
    'Internal server error',
    {
      originalError: err?.message,
      stack: err?.stack,
      circuitStatus: circuitBreaker.getStatus()
    },
    500,
    true,
    3,
    1000,
    'server',
    10000
  );
  return res.status(500).json(formatError(internalError));
});

// Health check endpoint with circuit breaker status
app.get('/health', lenientLimiter, (req, res) => {
  const cbStatus = circuitBreaker.getStatus();
  const servicesAvailable = Object.values(cbStatus).every(s => s.available);
  res.json({
    status: servicesAvailable ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    circuitBreaker: cbStatus,
    queueManager: !!queueManager,
    adapters: !!adapters
  });
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

    // Bind to localhost explicitly in development to avoid OS-level permission errors
    // when attempting to listen on 0.0.0.0 on some Windows setups.
    server = app.listen(PORT, '127.0.0.1', async () => {
      console.log(`iMaCoMpUtERussy MCP Server running on http://127.0.0.1:${PORT}`);
      console.log(`Health check: http://127.0.0.1:${PORT}/health`);
      console.log(`API base URL: http://127.0.0.1:${PORT}/mcp`);

      // WebSocket server initialization temporarily disabled due to ESM import issues
      // TODO: Fix WebSocket server setup for production
      console.log('WebSocket server disabled - using direct HTTP endpoints for MCP events');
      
      // Define broadcastEvent as a no-op function for now
      globalThis.broadcastEvent = (eventType, data) => {
        logger.info('Broadcast event (disabled)', { eventType, data });
        // In production, this would broadcast via WebSocket
      };
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

// Start server when run directly. Use pathToFileURL to correctly compare ESM import.meta.url
// with the executed script path (works across platforms and handles absolute paths).
if (process.argv && process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}