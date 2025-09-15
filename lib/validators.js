/**
 * Shared validation utilities for MCP server and client
 * Centralizes validation logic to reduce duplication and ensure consistency
 */

import { MCPError, MCP_ERROR_CODES } from '../server/mcp_errors.js';

const VALIDATION_CONFIG = {
  MAX_PROGRAM_NAME_LENGTH: 50,
  MAX_PROGRAM_SOURCE_LENGTH: 10000,
  MAX_MEMORY_SIZE: 65536,
  MAX_PIXEL_COORDINATE_X: 31, // 32 columns (0-31)
  MAX_PIXEL_COORDINATE_Y: 23, // 24 rows (0-23)
  MAX_COLOR_VALUE: 255,
  MAX_TERMINAL_TEXT_LENGTH: 1000,
  MAX_TIMEOUT_MS: 30000,
  MIN_TIMEOUT_MS: 100
};

// Backward compatibility - deprecated, use specific X/Y constants
const MAX_PIXEL_COORDINATE = 31;

/**
 * Sanitize and validate program name
 * @param {string} name - Program name to validate
 * @returns {string} Sanitized program name
 * @throws {MCPError} If name is invalid
 */
export function sanitizeProgramName(name, operationType = 'programs', timeoutMs = 3000) {
  if (!name || typeof name !== 'string') {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Program name must be a non-empty string',
                      { field: 'name', expected: 'string', received: typeof name }, 400, false, 0, 0, operationType, timeoutMs);
  }

  const sanitized = name.trim().replace(/[^a-zA-Z0-9\-_\.]/g, '').substring(0, VALIDATION_CONFIG.MAX_PROGRAM_NAME_LENGTH);

  if (sanitized.length === 0) {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Program name contains no valid characters',
                      { field: 'name', length: 0, maxLength: VALIDATION_CONFIG.MAX_PROGRAM_NAME_LENGTH }, 400, false, 0, 0, operationType, timeoutMs);
  }

  // Prevent directory traversal
  if (sanitized.includes('..') || sanitized.includes('/') || sanitized.includes('\\')) {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Program name contains invalid path characters',
                      { field: 'name', invalidChars: ['..', '/', '\\'], sanitized }, 400, false, 0, 0, operationType, timeoutMs);
  }

  return sanitized;
}

/**
 * Sanitize and validate program source code
 * @param {string} source - Program source code to validate
 * @returns {string} Sanitized source code
 * @throws {MCPError} If source is invalid
 */
export function sanitizeProgramSource(source, operationType = 'assembly', timeoutMs = 5000) {
  if (!source || typeof source !== 'string') {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Program source must be a non-empty string',
                      { field: 'source', expected: 'string', received: typeof source }, 400, false, 0, 0, operationType, timeoutMs);
  }

  if (source.length > VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH) {
    throw new MCPError(MCP_ERROR_CODES.PAYLOAD_TOO_LARGE, `Program source too large. Maximum size is ${VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH} characters`,
                      { field: 'source', length: source.length, maxLength: VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH }, 413, false, 0, 0, operationType, timeoutMs);
  }

  // Basic sanitization - remove control characters but preserve common whitespace
  // (tabs, CR, LF) so multi-line assembly source remains intact for the assembler.
  const sanitized = source.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  return sanitized;
}

/**
 * Validate memory address
 * @param {number} address - Memory address to validate
 * @returns {number} Validated address
 * @throws {MCPError} If address is invalid
 */
export function validateMemoryAddress(address, operationType = 'memory', timeoutMs = 3000) {
  if (typeof address !== 'number' || isNaN(address)) {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Address must be a valid number',
                      { field: 'address', expected: 'number', received: typeof address, value: address }, 400, false, 0, 0, operationType, timeoutMs);
  }

  if (address < 0 || address > 0xFFFF) {
    throw new MCPError(MCP_ERROR_CODES.MEMORY_OUT_OF_BOUNDS, 'Address must be between 0x0000 and 0xFFFF',
                      { field: 'address', value: address, min: 0, max: 0xFFFF, hex: `0x${address.toString(16)}` }, 422, true, 3, 1000, operationType, timeoutMs);
  }

  return parseInt(address, 10);
}

/**
 * Validate memory size
 * @param {number} size - Memory size to validate
 * @returns {number} Validated size
 * @throws {MCPError} If size is invalid
 */
export function validateMemorySize(size, operationType = 'memory', timeoutMs = 3000) {
  if (typeof size !== 'number' || isNaN(size)) {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Size must be a valid number',
                      { field: 'size', expected: 'number', received: typeof size, value: size }, 400, false, 0, 0, operationType, timeoutMs);
  }

  if (size < 1 || size > VALIDATION_CONFIG.MAX_MEMORY_SIZE) {
    throw new MCPError(MCP_ERROR_CODES.MEMORY_OUT_OF_RANGE, 'Size must be between 1 and 65536 bytes',
                      { field: 'size', value: size, min: 1, max: VALIDATION_CONFIG.MAX_MEMORY_SIZE }, 422, true, 3, 1000, operationType, timeoutMs);
  }

  return parseInt(size, 10);
}

/**
 * Validate pixel coordinates
 * @param {number} x - X coordinate
 * @param {number} y - Y coordinate
 * @throws {MCPError} If coordinates are invalid
 */
export function validatePixelCoordinates(x, y, operationType = 'video', timeoutMs = 2000) {
  if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Coordinates must be valid numbers',
                      { field: 'coordinates', x: { type: typeof x, value: x }, y: { type: typeof y, value: y } }, 400, false, 0, 0, operationType, timeoutMs);
  }

  if (x < 0 || x > VALIDATION_CONFIG.MAX_PIXEL_COORDINATE_X) {
    throw new MCPError(MCP_ERROR_CODES.VIDEO_OUT_OF_BOUNDS, `X coordinate must be between 0 and ${VALIDATION_CONFIG.MAX_PIXEL_COORDINATE_X}`,
                      { field: 'x', value: x, min: 0, max: VALIDATION_CONFIG.MAX_PIXEL_COORDINATE_X, display: `(${x}, ${y})` }, 422, true, 3, 1000, operationType, timeoutMs);
  }

  if (y < 0 || y > VALIDATION_CONFIG.MAX_PIXEL_COORDINATE_Y) {
    throw new MCPError(MCP_ERROR_CODES.VIDEO_OUT_OF_BOUNDS, `Y coordinate must be between 0 and ${VALIDATION_CONFIG.MAX_PIXEL_COORDINATE_Y}`,
                      { field: 'y', value: y, min: 0, max: VALIDATION_CONFIG.MAX_PIXEL_COORDINATE_Y, display: `(${x}, ${y})` }, 422, true, 3, 1000, operationType, timeoutMs);
  }
}

/**
 * Validate color value
 * @param {number} color - Color value to validate
 * @returns {number} Validated color
 * @throws {MCPError} If color is invalid
 */
export function validateColor(color, operationType = 'video', timeoutMs = 2000) {
  if (typeof color !== 'number' || isNaN(color)) {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Color must be a valid number',
                      { field: 'color', expected: 'number', received: typeof color, value: color }, 400, false, 0, 0, operationType, timeoutMs);
  }

  if (color < 0 || color > VALIDATION_CONFIG.MAX_COLOR_VALUE) {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, `Color must be between 0 and ${VALIDATION_CONFIG.MAX_COLOR_VALUE}`,
                      { field: 'color', value: color, min: 0, max: VALIDATION_CONFIG.MAX_COLOR_VALUE, hex: `0x${color.toString(16)}` }, 400, false, 0, 0, operationType, timeoutMs);
  }

  return parseInt(color, 10);
}

/**
 * Validate and sanitize terminal text
 * @param {string} text - Terminal text to validate
 * @returns {string} Sanitized text
 * @throws {MCPError} If text is invalid
 */
export function sanitizeTerminalText(text, operationType = 'terminal', timeoutMs = 2000) {
  if (typeof text !== 'string') {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Terminal text must be a string',
                      { field: 'text', expected: 'string', received: typeof text }, 400, false, 0, 0, operationType, timeoutMs);
  }

  if (text.length > VALIDATION_CONFIG.MAX_TERMINAL_TEXT_LENGTH) {
    throw new MCPError(MCP_ERROR_CODES.PAYLOAD_TOO_LARGE, `Terminal text too long. Maximum length is ${VALIDATION_CONFIG.MAX_TERMINAL_TEXT_LENGTH} characters`,
                      { field: 'text', length: text.length, maxLength: VALIDATION_CONFIG.MAX_TERMINAL_TEXT_LENGTH }, 413, false, 0, 0, operationType, timeoutMs);
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
export function validateTimeout(timeout, operationType = 'default', timeoutMs = 3000) {
  if (timeout === undefined) return VALIDATION_CONFIG.MIN_TIMEOUT_MS;

  if (typeof timeout !== 'number' || isNaN(timeout)) {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Timeout must be a valid number',
                      { field: 'timeout', expected: 'number', received: typeof timeout, value: timeout }, 400, false, 0, 0, operationType, timeoutMs);
  }

  if (timeout < VALIDATION_CONFIG.MIN_TIMEOUT_MS || timeout > VALIDATION_CONFIG.MAX_TIMEOUT_MS) {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, `Timeout must be between ${VALIDATION_CONFIG.MIN_TIMEOUT_MS} and ${VALIDATION_CONFIG.MAX_TIMEOUT_MS} milliseconds`,
                      { field: 'timeout', value: timeout, min: VALIDATION_CONFIG.MIN_TIMEOUT_MS, max: VALIDATION_CONFIG.MAX_TIMEOUT_MS }, 400, false, 0, 0, operationType, timeoutMs);
  }

  return parseInt(timeout, 10);
}

/**
 * Validate boolean values
 * @param {*} value - Value to validate
 * @param {string} fieldName - Name of the field for error messages
 * @throws {MCPError} If value is not a valid boolean
 */
export function validateBoolean(value, fieldName = 'boolean', operationType = 'default', timeoutMs = 2000) {
  if (typeof value !== 'boolean') {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, `${fieldName} must be a boolean value`,
                      { field: fieldName, expected: 'boolean', received: typeof value, value }, 400, false, 0, 0, operationType, timeoutMs);
  }
}

/**
 * Validate string length
 * @param {string} str - String to validate
 * @param {number} maxLength - Maximum allowed length
 * @param {string} fieldName - Name of the field for error messages
 * @throws {MCPError} If string is invalid
 */
export function validateStringLength(str, maxLength, fieldName = 'string', operationType = 'default', timeoutMs = 2000) {
  if (typeof str !== 'string') {
    throw new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, `${fieldName} must be a string`,
                      { field: fieldName, expected: 'string', received: typeof str }, 400, false, 0, 0, operationType, timeoutMs);
  }

  if (str.length > maxLength) {
    throw new MCPError(MCP_ERROR_CODES.PAYLOAD_TOO_LARGE, `${fieldName} too long. Maximum length is ${maxLength} characters`,
                      { field: fieldName, length: str.length, maxLength }, 413, false, 0, 0, operationType, timeoutMs);
  }
}

/**
 * Client-side MCP request validation using AJV (if available)
 * @param {string} schemaKey - Schema identifier
 * @param {Object} data - Request data to validate
 * @returns {Object} Validation result
 */
/**
 * Enhanced client-side MCP request validation with error mapping
 */
export function validateMCPRequest(schemaKey, data, operationType = 'default', timeoutMs = 5000) {
  // Simple client-side validation - server does full AJV validation
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Invalid request data',
                         { schema: schemaKey, expected: 'object', received: typeof data }, 400, false, 0, 0, operationType, timeoutMs)
    };
  }

  // Basic type checks based on common MCP request patterns with detailed error mapping
  if (schemaKey.includes('memory')) {
    if (data.address === undefined || typeof data.address !== 'number') {
      return {
        valid: false,
        error: new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Memory requests require valid address',
                           { schema: schemaKey, field: 'address', expected: 'number', received: typeof data.address }, 400, false, 0, 0, operationType, timeoutMs)
      };
    }
    if (data.size !== undefined && (typeof data.size !== 'number' || data.size < 1)) {
      return {
        valid: false,
        error: new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Memory requests require positive size',
                           { schema: schemaKey, field: 'size', expected: 'positive number', received: data.size }, 400, false, 0, 0, operationType, timeoutMs)
      };
    }
  }

  if (schemaKey.includes('cpu')) {
    if (data.steps !== undefined && (typeof data.steps !== 'number' || data.steps < 1)) {
      return {
        valid: false,
        error: new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'CPU step requests require positive steps number',
                           { schema: schemaKey, field: 'steps', expected: 'positive number', received: data.steps }, 400, false, 0, 0, operationType, timeoutMs)
      };
    }
    if (data.timeout !== undefined && (typeof data.timeout !== 'number' || data.timeout < 0)) {
      return {
        valid: false,
        error: new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'CPU timeout must be non-negative number',
                           { schema: schemaKey, field: 'timeout', expected: 'non-negative number', received: data.timeout }, 400, false, 0, 0, operationType, timeoutMs)
      };
    }
  }

  if (schemaKey.includes('video')) {
    if ((data.x !== undefined || data.y !== undefined) &&
        (typeof data.x !== 'number' || typeof data.y !== 'number' || isNaN(data.x) || isNaN(data.y))) {
      return {
        valid: false,
        error: new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Video requests require valid coordinates',
                           { schema: schemaKey, x: data.x, y: data.y, expected: 'numbers' }, 400, false, 0, 0, operationType, timeoutMs)
      };
    }
    if (data.color !== undefined && (typeof data.color !== 'number' || data.color < 0 || data.color > 255)) {
      return {
        valid: false,
        error: new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Video color must be 0-255',
                           { schema: schemaKey, field: 'color', value: data.color, expected: '0-255' }, 400, false, 0, 0, operationType, timeoutMs)
      };
    }
  }

  if (schemaKey.includes('queue') || schemaKey.includes('ai')) {
    if (data.prompt !== undefined && (typeof data.prompt !== 'string' || data.prompt.trim().length === 0)) {
      return {
        valid: false,
        error: new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Prompt must be a non-empty string',
                           { schema: schemaKey, field: 'prompt', length: data.prompt?.length || 0, expected: 'non-empty string' }, 400, false, 0, 0, operationType, timeoutMs)
      };
    }
  }

  return { valid: true };
}

/**
 * Create validation error mapper for specific field types
 */
export function createValidationErrorMapper(operationType = 'default', timeoutMs = 3000) {
  return {
    // Memory validation errors
    memoryAddress: (address) => new MCPError(MCP_ERROR_CODES.MEMORY_OUT_OF_BOUNDS, 'Invalid memory address',
                                           { address, expected: '0x0000-0xFFFF' }, 422, true, 3, 1000, operationType, timeoutMs),
    
    memorySize: (size) => new MCPError(MCP_ERROR_CODES.MEMORY_OUT_OF_RANGE, 'Invalid memory size',
                                     { size, expected: '1-65536 bytes' }, 422, true, 3, 1000, operationType, timeoutMs),
    
    // Video validation errors
    pixelCoordinates: (x, y) => new MCPError(MCP_ERROR_CODES.VIDEO_OUT_OF_BOUNDS, 'Invalid pixel coordinates',
                                           { x, y, expected: `X: 0-${VALIDATION_CONFIG.MAX_PIXEL_COORDINATE_X}, Y: 0-${VALIDATION_CONFIG.MAX_PIXEL_COORDINATE_Y}` }, 422, true, 3, 1000, operationType, timeoutMs),
    
    colorValue: (color) => new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Invalid color value',
                                       { color, expected: '0-255' }, 400, false, 0, 0, operationType, timeoutMs),
    
    // Program validation errors
    programName: (name) => new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, 'Invalid program name',
                                       { name, expected: `alphanumeric, max ${VALIDATION_CONFIG.MAX_PROGRAM_NAME_LENGTH} chars` }, 400, false, 0, 0, operationType, timeoutMs),
    
    programSource: (source) => new MCPError(MCP_ERROR_CODES.PAYLOAD_TOO_LARGE, 'Program source too large',
                                          { length: source.length, max: VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH }, 413, false, 0, 0, operationType, timeoutMs),
    
    // Queue/AI validation errors
    promptLength: (prompt) => new MCPError(MCP_ERROR_CODES.PAYLOAD_TOO_LARGE, 'Prompt too long',
                                         { length: prompt.length, max: 5000 }, 413, true, 3, 1000, operationType, timeoutMs),
    
    invalidType: (field, value) => new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, `Invalid ${field} type`,
                                              { field, value, expected: 'valid enum' }, 400, false, 0, 0, operationType, timeoutMs),
    
    // Generic validation errors
    missingField: (field) => new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, `Missing required field: ${field}`,
                                        { field, required: true }, 400, false, 0, 0, operationType, timeoutMs),
    
    typeMismatch: (field, expected, received) => new MCPError(MCP_ERROR_CODES.INVALID_REQUEST, `Type mismatch for ${field}`,
                                                            { field, expected, received, value: data[field] }, 400, false, 0, 0, operationType, timeoutMs)
  };
}

// Export validation config for testing
export { VALIDATION_CONFIG };