/**
 * MCP Error Handling Module
 *
 * Centralized error handling for MCP server with structured error responses.
 */

// MCP Error Codes
export const MCP_ERROR_CODES = {
  // Validation and Request Errors
  INVALID_REQUEST: 'INVALID_REQUEST',

  // CPU Errors
  CPU_HALTED: 'CPU_HALTED',
  CPU_NOT_READY: 'CPU_NOT_READY',
  CPU_TIMEOUT: 'CPU_TIMEOUT',
  TIMEOUT_EXCEEDED: 'TIMEOUT_EXCEEDED',

  // Memory Errors
  MEMORY_OUT_OF_RANGE: 'MEMORY_OUT_OF_RANGE',
  MEMORY_OUT_OF_BOUNDS: 'MEMORY_OUT_OF_BOUNDS',

  // Assembly Errors
  INVALID_ASSEMBLY: 'INVALID_ASSEMBLY',

  // Terminal Errors
  TERMINAL_BUSY: 'TERMINAL_BUSY',

  // Video Errors
  VIDEO_OUT_OF_BOUNDS: 'VIDEO_OUT_OF_BOUNDS',
  VIDEO_UPDATE_TIMEOUT: 'VIDEO_UPDATE_TIMEOUT',

  // Program Management Errors
  PROGRAM_NOT_FOUND: 'PROGRAM_NOT_FOUND',
  PROGRAM_EXISTS: 'PROGRAM_EXISTS',

  // Debug Errors
  INVALID_BREAKPOINT: 'INVALID_BREAKPOINT',
  BREAKPOINT_HIT: 'BREAKPOINT_HIT',

  // Generic Errors
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',

  // Validation and System Errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND'
};

/**
 * Structured MCP Error class
 */
export class MCPError extends Error {
  constructor(code, message, details = null, httpStatus = 422) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  /**
   * Check if this is an MCPError
   */
  static isMCPError(error) {
    return error instanceof MCPError;
  }

  /**
   * Create an MCPError from an AJV validation error
   */
  static fromAJVValidation(ajvErrors) {
    const formatErrors = ajvErrors.map(err => ({
      field: err.instancePath || err.params.key || 'root',
      message: err.message,
      details: err
    }));

    return new MCPError(
      MCP_ERROR_CODES.INVALID_REQUEST,
      'Request validation failed',
      { errors: formatErrors },
      400
    );
  }

  /**
   * Create an MCPError from a thrown validation error
   */
  static fromValidationError(originalError) {
    return new MCPError(
      MCP_ERROR_CODES.INVALID_REQUEST,
      `Validation error: ${originalError.message}`,
      { originalError: originalError.message, stack: originalError.stack },
      400
    );
  }
}

/**
 * Format an error into MCP error response structure
 *
 * @param {Error} err - The error to format
 * @returns {Object} Formatted error response matching the schema
 */
export function formatError(err) {
  if (MCPError.isMCPError(err)) {
    return {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {})
      }
    };
  }

  // Fallback for unknown errors
  return {
    success: false,
    error: {
      code: MCP_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error',
      ...(err ? { details: { originalError: err.message, stack: err.stack } } : {})
    }
  };
}