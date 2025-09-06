/**
 * Shared validation utilities for MCP server and client
 * Centralizes validation logic to reduce duplication and ensure consistency
 */

import { MCPError } from '../server/mcp_errors.js';

const VALIDATION_CONFIG = {
  MAX_PROGRAM_NAME_LENGTH: 50,
  MAX_PROGRAM_SOURCE_LENGTH: 10000,
  MAX_MEMORY_SIZE: 65536,
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
export function sanitizeProgramName(name) {
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
export function sanitizeProgramSource(source) {
  if (!source || typeof source !== 'string') {
    throw new MCPError('INVALID_REQUEST', 'Program source must be a non-empty string');
  }

  if (source.length > VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH) {
    throw new MCPError('PAYLOAD_TOO_LARGE', `Program source too large. Maximum size is ${VALIDATION_CONFIG.MAX_PROGRAM_SOURCE_LENGTH} characters`);
  }

  // Basic sanitization - remove control characters
  const sanitized = source.replace(/[\x00-\x1F\x7F-\x9F]/g, '');

  return sanitized;
}

/**
 * Validate memory address
 * @param {number} address - Memory address to validate
 * @returns {number} Validated address
 * @throws {MCPError} If address is invalid
 */
export function validateMemoryAddress(address) {
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
export function validateMemorySize(size) {
  if (typeof size !== 'number' || isNaN(size)) {
    throw new MCPError('INVALID_REQUEST', 'Size must be a valid number');
  }

  if (size < 1 || size > VALIDATION_CONFIG.MAX_MEMORY_SIZE) {
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
export function validatePixelCoordinates(x, y) {
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
export function validateColor(color) {
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
export function sanitizeTerminalText(text) {
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
export function validateTimeout(timeout) {
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
export function validateBoolean(value, fieldName = 'boolean') {
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
export function validateStringLength(str, maxLength, fieldName = 'string') {
  if (typeof str !== 'string') {
    throw new MCPError('INVALID_REQUEST', `${fieldName} must be a string`);
  }

  if (str.length > maxLength) {
    throw new MCPError('PAYLOAD_TOO_LARGE', `${fieldName} too long. Maximum length is ${maxLength} characters`);
  }
}

/**
 * Client-side MCP request validation using AJV (if available)
 * @param {string} schemaKey - Schema identifier
 * @param {Object} data - Request data to validate
 * @returns {Object} Validation result
 */
export function validateMCPRequest(schemaKey, data) {
  // Simple client-side validation - server does full AJV validation
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Invalid request data' };
  }

  // Basic type checks based on common MCP request patterns
  if (schemaKey.includes('memory') && (data.address === undefined || typeof data.address !== 'number')) {
    return { valid: false, error: 'Memory requests require valid address' };
  }

  if (schemaKey.includes('cpu') && (data.steps !== undefined && typeof data.steps !== 'number')) {
    return { valid: false, error: 'CPU step requests require valid steps number' };
  }

  return { valid: true };
}

// Export validation config for testing
export { VALIDATION_CONFIG };