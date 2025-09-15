#!/usr/bin/env node

/* local logger for error handling module */
import winston from 'winston';

// Create a logger for this module if a global one isn't provided
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'mcp-errors' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({ filename: 'logs/mcp-errors.log', maxsize: 5 * 1024 * 1024, maxFiles: 3 })
  ]
});

/**
 * MCP Error Handling Module
 *
 * Centralized error handling for MCP server with structured error responses,
 * retry logic, and recovery mechanisms.
 */

import ErrorHandler from '../lib/ErrorHandler.js';

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

  // Queue Errors
  QUEUE_FULL: 'QUEUE_FULL',
  TASK_NOT_FOUND: 'TASK_NOT_FOUND',

  // Generic Errors
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

  // Retryable Errors
  RETRYABLE_TIMEOUT: 'RETRYABLE_TIMEOUT',
  RETRYABLE_SERVICE: 'RETRYABLE_SERVICE',

  // Validation and System Errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  ENDPOINT_NOT_FOUND: 'ENDPOINT_NOT_FOUND'
};

// Retryable error codes
export const RETRYABLE_ERROR_CODES = [
  MCP_ERROR_CODES.TIMEOUT_EXCEEDED,
  MCP_ERROR_CODES.SERVICE_UNAVAILABLE,
  MCP_ERROR_CODES.QUEUE_FULL,
  MCP_ERROR_CODES.RETRYABLE_TIMEOUT,
  MCP_ERROR_CODES.RETRYABLE_SERVICE,
  MCP_ERROR_CODES.CPU_TIMEOUT,
  MCP_ERROR_CODES.VIDEO_UPDATE_TIMEOUT
];

/**
 * Structured MCP Error class with retry support
 */
export class MCPError extends Error {
  constructor(code, message, details = null, httpStatus = 422, retryable = false, maxRetries = 3, baseDelay = 100, operationType = null, timeoutMs = null) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;
    this.retryable = retryable || RETRYABLE_ERROR_CODES.includes(code);
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.retryCount = 0;
    this.operationType = operationType; // 'cpu', 'ai', 'queue', etc.
    this.timeoutMs = timeoutMs || this.getDefaultTimeout(operationType); // 5s for CPU, 30s for AI

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPError);
    }
  }

  /**
   * Get default timeout based on operation type
   */
  getDefaultTimeout(operationType) {
    const timeouts = {
      cpu: 5000,   // 5s for CPU operations
      ai: 30000,   // 30s for AI operations
      queue: 10000, // 10s for queue operations
      memory: 3000, // 3s for memory operations
      video: 2000  // 2s for video operations
    };
    return timeouts[operationType] || 10000; // Default 10s
  }

  /**
   * Check if this error is retryable
   */
  isRetryable() {
    return this.retryable && this.retryCount < this.maxRetries;
  }

  /**
   * Increment retry count and calculate next delay
   */
  nextRetryDelay() {
    if (!this.isRetryable()) {
      return null;
    }
    this.retryCount++;
    // Specific delays: 1s, 2s, 4s for 3 attempts
    const specificDelays = [1000, 2000, 4000];
    if (this.retryCount <= specificDelays.length) {
      return specificDelays[this.retryCount - 1];
    }
    // Fallback to exponential backoff for additional retries
    const delay = this.baseDelay * Math.pow(2, this.retryCount - 1);
    return Math.min(delay, 8000); // Cap at 8 seconds
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

  /**
   * Create retryable error for specific scenarios
   */
  static retryable(code, message, details = null, maxRetries = 3, baseDelay = 100) {
    return new MCPError(code, message, details, 503, true, maxRetries, baseDelay);
  }

  /**
   * Create timeout error with retry support
   */
  static timeout(message = 'Operation timed out', maxRetries = 3) {
    return this.retryable(MCP_ERROR_CODES.TIMEOUT_EXCEEDED, message, null, maxRetries, 200);
  }
}

/**
 * Retry middleware for Express routes
 * Handles retryable errors with exponential backoff
 */
/**
 * Circuit Breaker implementation for service resilience
 */
class CircuitBreaker {
  constructor(failureThreshold = 5, timeout = 30000, halfOpenTimeout = 30000) {
    this.failureThreshold = failureThreshold;
    this.timeout = timeout;
    this.halfOpenTimeout = halfOpenTimeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.services = new Map(); // Track per-service circuit breakers
  }

  /**
   * Get circuit breaker for specific service
   */
  getServiceBreaker(serviceName) {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, {
        failureCount: 0,
        lastFailureTime: null,
        state: 'CLOSED'
      });
    }
    return this.services.get(serviceName);
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute(serviceName, operation, context = {}) {
    const breaker = this.getServiceBreaker(serviceName);
    
    // Check circuit state
    if (breaker.state === 'OPEN') {
      const timeSinceFailure = Date.now() - (breaker.lastFailureTime || 0);
      if (timeSinceFailure < this.halfOpenTimeout) {
        throw new MCPError('SERVICE_UNAVAILABLE', `Circuit breaker OPEN for ${serviceName} (wait ${Math.round((this.halfOpenTimeout - timeSinceFailure)/1000)}s)`,
                          { state: 'OPEN', service: serviceName }, 503, true, 0, 0, serviceName);
      }
      // Transition to HALF_OPEN
      breaker.state = 'HALF_OPEN';
      breaker.lastFailureTime = Date.now();
    }

    try {
      const result = await operation();
      
      // Success - reset failure count and close circuit
      breaker.failureCount = 0;
      breaker.state = 'CLOSED';
      breaker.lastFailureTime = null;
      
      logger.info('Circuit breaker success', { service: serviceName, state: breaker.state });
      return result;
      
    } catch (error) {
      // Record failure
      breaker.failureCount++;
      breaker.lastFailureTime = Date.now();
      
      if (breaker.failureCount >= this.failureThreshold && breaker.state !== 'OPEN') {
        breaker.state = 'OPEN';
        logger.warn('Circuit breaker OPENED', {
          service: serviceName,
          failures: breaker.failureCount,
          threshold: this.failureThreshold,
          willReopenIn: Math.round(this.halfOpenTimeout/1000) + 's'
        });
      }
      
      // Log HALF_OPEN failure (should close circuit on failure)
      if (breaker.state === 'HALF_OPEN') {
        breaker.state = 'OPEN';
        logger.warn('Circuit breaker returned to OPEN after HALF_OPEN failure', { service: serviceName });
      }
      
      logger.error('Circuit breaker operation failed', {
        service: serviceName,
        state: breaker.state,
        failureCount: breaker.failureCount,
        error: error.message,
        context
      });
      
      throw error;
    }
  }

  /**
   * Check if service is available through circuit breaker
   */
  isAvailable(serviceName) {
    const breaker = this.getServiceBreaker(serviceName);
    return breaker.state !== 'OPEN';
  }

  /**
   * Get circuit breaker status for all services
   */
  getStatus() {
    const status = {};
    for (const [service, breaker] of this.services) {
      status[service] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        lastFailureTime: breaker.lastFailureTime,
        available: this.isAvailable(service)
      };
    }
    return status;
  }
}

// Global circuit breaker instance
export const circuitBreaker = new CircuitBreaker(5, 30000, 30000);

/**
 * Enhanced retry handler with circuit breaker integration
 */
export function retryHandler(maxRetries = 3, baseDelay = 1000, serviceName = 'default') {
  return async (req, res, next) => {
    let lastError;
    let retryCount = 0;

    // Check circuit breaker before attempting operation
    if (!circuitBreaker.isAvailable(serviceName)) {
      const cbError = new MCPError('SERVICE_UNAVAILABLE', `Service ${serviceName} unavailable (circuit breaker OPEN)`,
                                 { service: serviceName, status: circuitBreaker.getStatus() }, 503, false, 0, 0, serviceName);
      return next(cbError);
    }

    // Wrap operation with circuit breaker
    const protectedOperation = () => new Promise((resolve, reject) => {
      const nextWithErrorHandling = (err) => {
        if (err && MCPError.isMCPError(err) && err.isRetryable()) {
          lastError = err;
          resolve(); // Continue to retry logic
        } else {
          reject(err); // Non-retryable error
        }
      };

      // Call the next middleware. Express's next() does not accept a callback
      // function as an argument; passing a function becomes an error object.
      // Instead, invoke next() to continue the middleware chain and resolve
      // the protected operation immediately. Errors from downstream middleware
      // will be propagated via the normal Express error handling path.
      try {
        next();
        resolve();
      } catch (err) {
        // If next() synchronously throws (rare), treat as an error
        nextWithErrorHandling(err);
      }
    });

    try {
      await circuitBreaker.execute(serviceName, protectedOperation, {
        endpoint: req.path,
        method: req.method
      });
      return; // Success, exit retry loop
    } catch (error) {
      if (!MCPError.isMCPError(error) || !error.isRetryable()) {
        return next(error); // Non-retryable, pass through
      }

      // Retry logic with exponential backoff
      while (retryCount < maxRetries) {
        retryCount++;
        const delay = error.nextRetryDelay();
        if (!delay) {
          break; // No more retries
        }

        logger.warn('Retrying operation after circuit breaker protected error', {
          endpoint: req.path,
          service: serviceName,
          attempt: retryCount,
          maxRetries,
          delayMs: delay,
          errorCode: error.code,
          errorMessage: error.message,
          circuitState: circuitBreaker.getServiceBreaker(serviceName).state
        });

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delay));

        // Check circuit breaker before each retry
        if (!circuitBreaker.isAvailable(serviceName)) {
          const cbError = new MCPError('SERVICE_UNAVAILABLE', `Service ${serviceName} unavailable during retry (circuit breaker OPEN)`,
                                     { service: serviceName, attempt: retryCount, status: circuitBreaker.getStatus() }, 503, false, 0, 0, serviceName);
          return next(cbError);
        }

        try {
          await circuitBreaker.execute(serviceName, protectedOperation, {
            endpoint: req.path,
            method: req.method,
            retryAttempt: retryCount
          });
          // Success on retry - reset circuit breaker failure count
          circuitBreaker.getServiceBreaker(serviceName).failureCount = 0;
          return; // Success, exit retry loop
        } catch (retryError) {
          lastError = retryError;
          if (!MCPError.isMCPError(retryError) || !retryError.isRetryable()) {
            return next(retryError);
          }
        }
      }

      // All retries exhausted
      if (lastError) {
        logger.error('All retries exhausted for circuit breaker protected operation', {
          endpoint: req.path,
          service: serviceName,
          totalAttempts: maxRetries,
          finalErrorCode: lastError.code,
          finalErrorMessage: lastError.message,
          circuitState: circuitBreaker.getServiceBreaker(serviceName).state
        });
        lastError.message = `${lastError.message} (after ${maxRetries} retries with circuit breaker)`;
      }

      next(lastError || new MCPError('RETRY_EXHAUSTED', `Operation failed after maximum retries for ${serviceName}`,
                                   { service: serviceName, status: circuitBreaker.getStatus() }, 503, false, 0, 0, serviceName));
    }
  };
}

/**
 * Recovery handler for specific error types
 * Attempts automatic recovery where possible
 */
export async function recoveryHandler(error, context = {}) {
  if (!MCPError.isMCPError(error)) {
    return { recovered: false, message: 'Not an MCPError, no recovery attempted' };
  }

  logger.info('Attempting recovery for error', {
    errorCode: error.code,
    context,
    recoveryAttempt: true
  });

  try {
    switch (error.code) {
      case MCP_ERROR_CODES.QUEUE_FULL:
        // Recovery: Clean completed tasks to free space
        if (globalThis.queueManager) {
          const cleanResult = await globalThis.queueManager.cleanCompleted();
          logger.info('Queue cleanup recovery successful', { removed: cleanResult.removed, remaining: cleanResult.remaining });
          return { recovered: true, message: 'Queue cleaned, try again', cleanup: cleanResult };
        }
        break;

      case MCP_ERROR_CODES.TIMEOUT_EXCEEDED:
      case MCP_ERROR_CODES.CPU_TIMEOUT:
        // Recovery: Reset CPU state if safe
        if (context.endpoint?.includes('cpu') && globalThis.adapters?.cpu) {
          await globalThis.adapters.cpu.reset(false); // Soft reset
          logger.info('CPU soft reset recovery performed');
          return { recovered: true, message: 'CPU state reset, operation may succeed now' };
        }
        break;

      case MCP_ERROR_CODES.SERVICE_UNAVAILABLE:
        // Recovery: Check service health and wait
        if (context.service === 'queue' && globalThis.queueManager) {
          // Wait and retry queue operation
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { recovered: true, message: 'Service delay handled' };
        }
        break;

      case MCP_ERROR_CODES.MEMORY_OUT_OF_BOUNDS:
        // Recovery: Validate and adjust memory range
        if (context.address && context.size && globalThis.adapters?.memory) {
          const safeSize = Math.min(context.size, 0xFFFF - context.address + 1);
          if (safeSize > 0) {
            logger.info('Memory range adjusted for recovery', { originalSize: context.size, safeSize });
            return { recovered: true, message: `Memory range adjusted to ${safeSize} bytes`, adjustedSize: safeSize };
          }
        }
        break;

      default:
        logger.debug('No specific recovery handler for error code', { errorCode: error.code });
    }

    return { recovered: false, message: 'No applicable recovery available' };
  } catch (recoveryError) {
    logger.error('Recovery attempt failed', {
      originalError: error.code,
      recoveryError: recoveryError.message,
      context
    });
    return { recovered: false, message: 'Recovery attempt failed', recoveryError: recoveryError.message };
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
    const response = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
        retryable: err.isRetryable(),
        ...(err.retryCount > 0 ? { retryCount: err.retryCount, maxRetries: err.maxRetries } : {})
      }
    };

    // Include recovery suggestion if applicable
    if (err.isRetryable()) {
      response.error.retryDelay = err.nextRetryDelay();
      response.error.suggestedAction = 'Retry operation';
    }

    return response;
  }

  // Fallback for unknown errors
  return {
    success: false,
    error: {
      code: MCP_ERROR_CODES.INTERNAL_ERROR,
      message: 'Internal server error',
      ...(err ? { details: { originalError: err.message, stack: err.stack } } : {}),
      retryable: false
    }
  };
}

// Export for use in server

// Export enhanced error handling utilities
export default {
  MCPError,
  formatError,
  retryHandler,
  recoveryHandler,
  MCP_ERROR_CODES,
  RETRYABLE_ERROR_CODES,
  circuitBreaker
};