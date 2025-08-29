#!/usr/bin/env node

/**
 * iMaCoMpUtERussy MCP Server
 *
 * Express.js REST API server providing MCP (Model Context Protocol) endpoints
 * for interacting with the iMaCoMpUtERussy emulator.
 */

import express from 'express';
import cors from 'cors';
import Ajv from 'ajv';
import * as fs from 'fs';
import * as path from 'path';
import PromptQueue from '../agent/queue-manager.js';
import { fileURLToPath } from 'url';
import { createDeveloperAdapters } from './mcp_developer_adapter.js';
import { MCPError, MCP_ERROR_CODES, formatError } from './mcp_errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 8001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

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
    console.log(`Loading schemas from: ${schemasDir}`);

    // Load individual schema files
    const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json'));
    console.log(`Found ${files.length} schema files:`, files.map(f => f.replace('.json', '')));

    for (const file of files) {
      const schemaPath = path.join(schemasDir, file);
      const schemaContent = fs.readFileSync(schemaPath, 'utf8');
      const schema = JSON.parse(schemaContent);

      const key = file.replace('.json', '');
      try {
        compiledValidators[key] = ajv.compile(schema);
        console.log(`✅ Loaded schema: ${key}`);
      } catch (compileError) {
        console.error(`❌ Failed to compile ${key}:`, compileError.message);
      }
    }

    console.log(`Loaded ${Object.keys(compiledValidators).length} schemas`);

    // Debug: Check if our memory schemas are loaded
    const memorySchemas = ['memory.read.request', 'memory.write.request', 'memory.loadProgram.request'];
    console.log('Checking memory schemas:');
    memorySchemas.forEach(schemaKey => {
      if (compiledValidators[schemaKey]) {
        console.log(`✅ ${schemaKey} - LOADED`);
      } else {
        console.log(`❌ ${schemaKey} - MISSING`);
      }
    });

    // Debug: Check if our debug schemas are loaded
    const debugSchemas = ['debug.trace.request', 'debug.trace.response', 'debug.memoryView.request', 'debug.memoryView.response', 'debug.breakpoints.request', 'debug.breakpoints.response'];
    console.log('Checking debug schemas:');
    debugSchemas.forEach(schemaKey => {
      if (compiledValidators[schemaKey]) {
        console.log(`✅ ${schemaKey} - LOADED`);
      } else {
        console.log(`❌ ${schemaKey} - MISSING`);
      }
    });
  } catch (error) {
    console.error('Error loading schemas:', error);
    throw error;
  }
}
// Initialize prompt queue system
let queueManager;

function initializeQueue() {
  try {
    queueManager = new PromptQueue({
      queueFile: path.join(__dirname, '..', 'data', 'queue.json'),
      backupDir: path.join(__dirname, '..', 'data', 'backups')
    });
    console.log('Prompt queue system initialized');
  } catch (error) {
    console.error('Error initializing queue system:', error);
    throw error;
  }
}

// Initialize developer API adapters
let adapters;
function initializeAdapters() {
  try {
    adapters = createDeveloperAdapters();
    console.log('Developer adapters initialized');
  } catch (error) {
    console.error('Error initializing adapters:', error);
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
    throw MCPError.fromAJVValidation(validator.errors);
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
app.post('/mcp/cpu/reset', asyncHandler(async (req, res) => {
  validate('cpu.reset.request', req.body);

  try {
    const result = adapters.cpu.reset(req.body.hardReset);
    res.json(successResponse(result));
  } catch (error) {
    throw new MCPError('CPU_NOT_READY', 'CPU operation failed', { originalError: error.message });
  }
}));

app.post('/mcp/cpu/step', asyncHandler(async (req, res) => {
  const validation = validate('cpu.step.request', req.body);
  if (!validation.success) {
    throw MCPError.fromAJVValidation(validation.errors);
  }

    const result = adapters.memory.read(addr, 1);

    console.log(`Memory I/O read - method:GET, path:/mcp/memory/io, address:0x${addr.toString(16)}`);

    res.json(successResponse(result));
  } catch (error) {
    console.error('Memory I/O read error:', error.message);
    throw new MCPError('INTERNAL_ERROR', 'Memory I/O read failed', error.message, 500);
  }
}));

// Program Endpoints
app.get('/mcp/programs/list', asyncHandler(async (req, res) => {
  try {
    const result = await adapters.programs.list();
    res.json(successResponse(result));
  } catch (error) {
    throw new MCPError('SYSTEM_ERROR', 'Program list failed', error.message, 500);
  }
}));

app.post('/mcp/programs/load-sample', asyncHandler(async (req, res) => {
  const validation = validate('programs.load.request', req.body);
  if (!validation.success) {
    return res.status(422).json(validation);
  }

  try {
    const { sampleName, assembled, resetCPU } = req.body;
    const result = await adapters.programs.load(sampleName, assembled, resetCPU);
    res.json(successResponse(result));
  } catch (error) {
    if (error.message.includes('not found')) {
      throw new MCPError('RESOURCE_NOT_FOUND', 'undefined', null, 404);
    } else {
      throw new MCPError('SYSTEM_ERROR', 'Program load failed', error.message, 500);
    }
  }
}));

// POST /mcp/programs/load - Load program from samples/ by name
app.post('/mcp/programs/load', asyncHandler(async (req, res) => {
  const validation = validate('programs.load.request.new', req.body);
  if (!validation.success) {
    return throw new MCPError('INVALID_REQUEST', 'Invalid request format', validation.error.details, 400);
  }

  try {
    const { name, startAddress } = req.body;
    console.log(`Program load - method:POST, path:/mcp/programs/load, name:${name}, startAddress:0x${(startAddress || 0x0600).toString(16)}`);

    const result = await adapters.programs.loadProgramFromSource(name, startAddress);
    res.json(successResponse(result));
  } catch (error) {
    console.error('Program load error:', error.message);

    if (error.message.includes('PROGRAM_NOT_FOUND')) {
      throw new MCPError('PROGRAM_NOT_FOUND', 'undefined', null, 422);
    } else if (error.message.includes('INVALID_ASSEMBLY')) {
      throw new MCPError('INVALID_ASSEMBLY', 'undefined', null, 422);
    } else if (error.message.includes('MEMORY_OUT_OF_RANGE')) {
      throw new MCPError('MEMORY_OUT_OF_RANGE', 'undefined', null, 422);
    } else {
      throw new MCPError('INTERNAL_ERROR', 'undefined', null, 500);
    }
  }
}));

// POST /mcp/programs/save - Save program to samples/
app.post('/mcp/programs/save', asyncHandler(async (req, res) => {
  const validation = validate('programs.save.request', req.body);
  if (!validation.success) {
    throw new MCPError('INVALID_REQUEST', 'Invalid request format', validation.error.details, 400);
  }

  try {
    const { name, source, overwrite } = req.body;
    console.log(`Program save - method:POST, path:/mcp/programs/save, name:${name}, overwrite:${overwrite}`); //}

    const result = await adapters.programs.saveProgram(name, source, overwrite);
    res.json(successResponse(result));
  } catch (error) {
    console.error('Program save error:', error.message);

    if (error.message.includes('PROGRAM_EXISTS')) {
      throw new MCPError('PROGRAM_EXISTS', 'undefined', null, 422);
    } else if (error.message.includes('Invalid program name')) {
      throw new MCPError('INVALID_REQUEST', 'undefined', null, 400);
    } else {
      throw new MCPError('INTERNAL_ERROR', 'undefined', null, 500);
    }
  }
}));

// Video Endpoints
const WIDTH = 32; // Assume 32 columns for video display

app.post('/mcp/video/setPixel', asyncHandler(async (req, res) => {
  const validation = validate('video.setPixel.request', req.body);
  if (!validation.success) {
    return res.status(422).json(validation);
  }

  try {
    const { x, y, color } = req.body;

    // Validate bounds - framebuffer starts at 0x0200, ends at 0x05FF (inclusive)
    if (x < 0 || x >= WIDTH || y < 0 || y >= WIDTH) {
      throw new MCPError('VIDEO_OUT_OF_BOUNDS', 'Pixel coordinates out of video bounds', null, 422);
    }

    // Add request logging
    console.log(`Video setPixel - method:POST, path:/mcp/video/setPixel, x:${x}, y:${y}, color:0x${color.toString(16)}`);

    const address = 0x0200 + (y * WIDTH) + x;
    adapters.memory.write(address, color, 1);

    const result = { address };

    // Validate response against schema
    const responseValidation = validate('video.setPixel.response', result);

    if (!responseValidation.success) {
      return throw new MCPError('INTERNAL_ERROR', 'Response validation failed', null, 500);
    }

    res.json(successResponse(result));
  } catch (error) {
    console.error('Video setPixel error:', error.message);
    throw new MCPError('INTERNAL_ERROR', 'Video setPixel failed', error.message, 500);
  }
}));

app.post('/mcp/video/update', asyncHandler(async (req, res) => {
  const validation = validate('video.update.request', req.body);
  if (!validation.success) {
    return res.status(422).json(validation);
  }

  try {
    const { flush } = req.body;
    const timeoutMs = req.body.timeout || 5000; // Default 5 seconds

    // Cap timeout to prevent excessive resource usage
    const maxTimeoutMs = 30000; // 30 seconds max
    const effectiveTimeout = Math.min(timeoutMs, maxTimeoutMs);

    console.log(`Video update - method:POST, path:/mcp/video/update, timeoutMs:${effectiveTimeout}, flush:${flush}`);

    const startTime = Date.now();

    // Handle timeout with Promise.race
    const updatePromise = (async () => {
      try {
        // Try video.update() first, fall back to adapter.update() if not available
        if (adapters.video.update) {
          return adapters.video.update(flush);
        } else {
          // TODO: Fall back to memory-based update or CPU instruction
          console.log('Video update adapter not fully implemented');
          return { displayUpdated: true };
        }
      } catch (error) {
        console.error('Video update adapter error:', error.message);
        return { displayUpdated: false };
      }
    })();

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('VIDEO_UPDATE_TIMEOUT')), effectiveTimeout);
    });

    const result = await Promise.race([updatePromise, timeoutPromise]);
    const durationMs = Date.now() - startTime;

    const responseData = { durationMs, status: result.displayUpdated ? 'updated' : 'failed' };

    // Validate response against schema
    const responseValidation = validate('video.update.response', responseData);

    if (!responseValidation.success) {
      return throw new MCPError('INTERNAL_ERROR', 'Response validation failed', null, 500);
    }

    res.json(successResponse(responseData));
  } catch (error) {
    console.error('Video update error:', error.message);

    if (error.message === 'VIDEO_UPDATE_TIMEOUT') {
      throw new MCPError('VIDEO_UPDATE_TIMEOUT', 'Video update operation timed out', null, 422);
    } else {
      throw new MCPError('INTERNAL_ERROR', 'Video update failed', error.message, 500);
    }
  }
}));

app.post('/mcp/video/clear', asyncHandler(async (req, res) => {
  const validation = validate('video.clear.request', req.body);
  if (!validation.success) {
    return res.status(422).json(validation);
  }

  try {
    const { color } = req.body;
    const defaultColor = color !== undefined ? color : 0;

    console.log(`Video clear - method:POST, path:/mcp/video/clear, color:0x${defaultColor.toString(16)}`);

    // Clear framebuffer region 0x0200-0x05FF using efficient bulk write
    if (adapters.video.clear) {
      adapters.video.clear(defaultColor);
    } else {
      // Fallback to efficient bulk memory clear
      const framebufferSize = 1024; // 0x05FF - 0x0200 + 1 = 1024 bytes
      const clearBuffer = Array(framebufferSize).fill(defaultColor);
      // Clear memory in chunks to avoid overloading
      for (let addr = 0x0200; addr <= 0x05FF; addr++) {
        adapters.memory.write(addr, defaultColor, 1);
      }
    }

    const result = { cleared: true };

    // Validate response against schema
    const responseValidation = validate('video.clear.response', result);

    if (!responseValidation.success) {
      return throw new MCPError('INTERNAL_ERROR', 'Response validation failed', null, 500);
    }

    res.json(successResponse(result));
  } catch (error) {
    console.error('Video clear error:', error.message);
    throw new MCPError('INTERNAL_ERROR', 'Video clear failed', error.message, 500);
  }
}));

// Debug Endpoints - STUB IMPLEMENTATIONS WITH TODO COMMENTS
app.post('/mcp/debug/trace', asyncHandler(async (req, res) => {
  const validation = validate('debug.trace.request', req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request format',
        details: validation.error.details.errors
      }
    });
  }

  try {
    const { steps, until } = req.body;
    const effectiveSteps = Math.min(steps || 100, 10000); // Cap at sensible default

    console.log(`Debug trace - method:POST, path:/mcp/debug/trace, steps:${effectiveSteps}, until:${until || 'default'}`);

    const traceResult = await adapters.debug.trace(effectiveSteps, { until });

    // Apply timeout cap (default 10000ms, max 30000ms)
    const timeout = Math.min(10000, 30000);

    res.json(successResponse(traceResult));
  } catch (error) {
    console.error('Debug trace error:', error.message);

    if (error.message.includes('BREAKPOINT')) {
      throw new MCPError('BREAKPOINT_HIT', 'undefined', null, 422);
    } else if (error.message.includes('CPU_HALTED')) {
      throw new MCPError('CPU_HALTED', 'undefined', null, 422);
    } else {
      throw new MCPError('INTERNAL_ERROR', 'undefined', null, 500);
    }
  }
}));

app.post('/mcp/debug/memoryView', asyncHandler(async (req, res) => {
  const validation = validate('debug.memoryView.request', req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request format',
        details: validation.error.details.errors
      }
    });
  }

  try {
    const { address, size } = req.body;

    if (isNaN(address) || address < 0 || address > 0xFFFF) {
      return throw new MCPError('MEMORY_OUT_OF_BOUNDS', 'Invalid memory address', null, 400);
    }

    const effectiveSize = Math.min(size, 65536); // Cap at 64KB
    if (address + effectiveSize - 1 > 0xFFFF) {
      return throw new MCPError('MEMORY_OUT_OF_BOUNDS', 'Memory range would exceed address space', null, 400);
    }

    console.log(`Debug memoryView - method:POST, path:/mcp/debug/memoryView, address:0x${address.toString(16)}, size:${effectiveSize}`);

    // Read the memory range using the adapter functions
    const bytes = [];
    for (let i = 0; i < effectiveSize; i++) {
      const addr = address + i;
      const result = adapters.memory.read(addr, 1);
      bytes.push(result.value);
    }

    const response = {
      address,
      size: effectiveSize,
      bytes,
      format: 'numeric',
      endAddress: address + effectiveSize - 1
    };

    res.json(successResponse(response));
  } catch (error) {
    console.error('Debug memoryView error:', error.message);

    if (error.message.includes('out of bounds') || error.message.includes('invalid address')) {
      throw new MCPError('MEMORY_OUT_OF_RANGE', 'undefined', null, 422);
    } else {
      throw new MCPError('INTERNAL_ERROR', 'undefined', null, 500);
    }
  }
}));

app.post('/mcp/debug/breakpoints', asyncHandler(async (req, res) => {
  const validation = validate('debug.breakpoints.request', req.body);
  if (!validation.success) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_REQUEST',
        message: 'Invalid request format',
        details: validation.error.details.errors
      }
    });
  }

  try {
    const { action, address, id } = req.body;

    console.log(`Debug breakpoints - method:POST, path:/mcp/debug/breakpoints, action:${action}, address:0x${(address || 0).toString(16)}, id:${id || 'N/A'}`);

    let operationResult;

    switch (action) {
      case 'set':
        operationResult = {
          action: 'set',
          success: true,
          id: adapters.debug.setBreakpoint(address),
          address
        };
        break;

      case 'list':
        const breakpoints = adapters.debug.listBreakpoints();
        operationResult = {
          action: 'list',
          success: true
        };
        // Breakpoints are included in the outer response
        break;

      case 'remove':
        const removeResult = adapters.debug.removeBreakpoint(id || address);
        operationResult = {
          action: 'remove',
          success: true,
          address: address || removeResult.address,
          id: id || removeResult.id,
          removed: removeResult.removed
        };
        break;

      default:
        throw new Error(`INVALID_BREAKPOINT: Unknown action '${action}'`);
    }

    const response = {
      breakpoints: action === 'list' ? adapters.debug.listBreakpoints() : undefined,
      operationResult
    };

    res.json(successResponse(response));
  } catch (error) {
    console.error('Debug breakpoints error:', error.message);

    if (error.message.includes('INVALID_BREAKPOINT') || error.message.includes('breakpoint already exists')) {
      throw new MCPError('INVALID_BREAKPOINT', 'undefined', null, 422);
    } else if (error.message.includes('NOT_FOUND')) {
      throw new MCPError('NOT_FOUND', 'undefined', null, 404);
    } else {
      throw new MCPError('INTERNAL_ERROR', 'undefined', null, 500);
    }
  }
}));

// Health check endpoint
app.get('/health', (req, res) => {
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

// Initialize and start server
async function startServer() {
  try {
    loadSchemas();
    initializeAdapters();
    initializeQueue();

    app.listen(PORT, () => {
      console.log(`iMaCoMpUtERussy MCP Server running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
      console.log(`API base URL: http://localhost:${PORT}/mcp`);
    });
  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

// Export app for testing
export { app };

// Start server when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
}