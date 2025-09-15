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
 * Enhanced Circuit Breaker implementation for service resilience
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

    // Recovery and monitoring enhancements
    this.recoveryStrategies = new Map();
    this.serviceMetrics = new Map();
    this.alerts = new Map();

    // Auto-recovery configuration
    this.autoRecoveryEnabled = true;
    this.recoveryCheckInterval = 30000; // 30 seconds
    this.recoverySuccessThreshold = 3; // Successes needed to fully recover

    // Start auto-recovery monitoring
    this.startAutoRecovery();
  }

  /**
   * Get circuit breaker for specific service with enhanced tracking
   */
  getServiceBreaker(serviceName) {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, {
        failureCount: 0,
        lastFailureTime: null,
        state: 'CLOSED',
        successCount: 0,
        totalRequests: 0,
        lastSuccessTime: null,
        consecutiveSuccesses: 0,
        recoveryAttempts: 0,
        metrics: {
          uptime: 0,
          downtime: 0,
          lastTransitionTime: Date.now(),
          errorRate: 0
        }
      });
    }
    return this.services.get(serviceName);
  }

  /**
   * Execute operation with circuit breaker protection and recovery
   */
  async execute(serviceName, operation, context = {}) {
    const breaker = this.getServiceBreaker(serviceName);
    const startTime = Date.now();

    // Update metrics
    breaker.totalRequests++;
    this.updateMetrics(serviceName, breaker);

    // Check circuit state
    if (breaker.state === 'OPEN') {
      const timeSinceFailure = Date.now() - (breaker.lastFailureTime || 0);
      if (timeSinceFailure < this.halfOpenTimeout) {
        throw new MCPError('SERVICE_UNAVAILABLE', `Circuit breaker OPEN for ${serviceName} (wait ${Math.round((this.halfOpenTimeout - timeSinceFailure)/1000)}s)`,
                          { state: 'OPEN', service: serviceName, timeUntilRetry: Math.round((this.halfOpenTimeout - timeSinceFailure)/1000) }, 503, true, 0, 0, serviceName);
      }
      // Transition to HALF_OPEN with recovery attempt tracking
      breaker.state = 'HALF_OPEN';
      breaker.recoveryAttempts++;
      breaker.lastFailureTime = Date.now();

      logger.info('Circuit breaker transitioning to HALF_OPEN', {
        service: serviceName,
        recoveryAttempt: breaker.recoveryAttempts,
        timeSinceLastFailure: timeSinceFailure
      });
    }

    try {
      const result = await operation();
      const executionTime = Date.now() - startTime;

      // Success - update success metrics and handle recovery logic
      breaker.successCount++;
      breaker.consecutiveSuccesses++;
      breaker.lastSuccessTime = Date.now();

      // Handle HALF_OPEN recovery
      if (breaker.state === 'HALF_OPEN') {
        if (breaker.consecutiveSuccesses >= this.recoverySuccessThreshold) {
          breaker.state = 'CLOSED';
          breaker.failureCount = 0;
          breaker.consecutiveSuccesses = 0;
          breaker.metrics.lastTransitionTime = Date.now();

          logger.info('Circuit breaker FULLY RECOVERED', {
            service: serviceName,
            recoveryAttempts: breaker.recoveryAttempts,
            consecutiveSuccesses: breaker.consecutiveSuccesses,
            totalDowntime: Math.round((Date.now() - (breaker.lastFailureTime || 0))/1000) + 's'
          });

          // Clear recovery attempts
          breaker.recoveryAttempts = 0;
        } else {
          logger.debug('Circuit breaker HALF_OPEN success', {
            service: serviceName,
            consecutiveSuccesses: breaker.consecutiveSuccesses,
            neededForRecovery: this.recoverySuccessThreshold
          });
        }
      } else if (breaker.state === 'CLOSED') {
        // Reset failure metrics on success
        breaker.failureCount = Math.max(0, breaker.failureCount - 1); // Gradual improvement
        breaker.consecutiveSuccesses = Math.min(breaker.consecutiveSuccesses + 1, 10); // Cap at 10
      }

      logger.info('Circuit breaker success', {
        service: serviceName,
        state: breaker.state,
        executionTimeMs: executionTime,
        successRate: this.calculateSuccessRate(breaker)
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Record failure with detailed metrics
      breaker.failureCount++;
      breaker.consecutiveSuccesses = 0;
      breaker.lastFailureTime = Date.now();

      // Update error rate
      breaker.metrics.errorRate = breaker.failureCount / breaker.totalRequests;

      // Circuit breaker state transition logic
      if (breaker.failureCount >= this.failureThreshold && breaker.state !== 'OPEN') {
        const previousState = breaker.state;
        breaker.state = 'OPEN';
        breaker.metrics.lastTransitionTime = Date.now();

        logger.warn('Circuit breaker OPENED', {
          service: serviceName,
          failures: breaker.failureCount,
          threshold: this.failureThreshold,
          previousState,
          errorRate: breaker.metrics.errorRate.toFixed(3),
          willReopenIn: Math.round(this.halfOpenTimeout/1000) + 's'
        });

        // Trigger alert
        this.triggerAlert(serviceName, 'OPEN', { failureCount: breaker.failureCount, errorRate: breaker.metrics.errorRate });

      } else if (breaker.state === 'HALF_OPEN') {
        // HALF_OPEN failure - return to OPEN
        breaker.state = 'OPEN';
        logger.warn('Circuit breaker returned to OPEN after HALF_OPEN failure', {
          service: serviceName,
          recoveryAttempt: breaker.recoveryAttempts,
          failures: breaker.failureCount
        });
      }

      // Log detailed failure information
      logger.error('Circuit breaker operation failed', {
        service: serviceName,
        state: breaker.state,
        failureCount: breaker.failureCount,
        consecutiveSuccesses: breaker.consecutiveSuccesses,
        errorRate: breaker.metrics.errorRate.toFixed(3),
        executionTimeMs: executionTime,
        errorCode: error.code || 'UNKNOWN_ERROR',
        error: error.message,
        context,
        totalRequests: breaker.totalRequests,
        successCount: breaker.successCount
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
   * Get circuit breaker status for all services with enhanced metrics
   */
  getStatus() {
    const status = {};
    for (const [service, breaker] of this.services) {
      status[service] = {
        state: breaker.state,
        failureCount: breaker.failureCount,
        lastFailureTime: breaker.lastFailureTime,
        available: this.isAvailable(service),
        successCount: breaker.successCount,
        totalRequests: breaker.totalRequests,
        consecutiveSuccesses: breaker.consecutiveSuccesses,
        recoveryAttempts: breaker.recoveryAttempts,
        errorRate: breaker.metrics.errorRate,
        uptime: this.calculateUptime(service, breaker),
        healthScore: this.calculateHealthScore(service)
      };
    }
    return status;
  }

  /**
   * Calculate success rate for a service
   */
  calculateSuccessRate(breaker) {
    if (breaker.totalRequests === 0) return 1.0;
    return breaker.successCount / breaker.totalRequests;
  }

  /**
   * Calculate uptime percentage
   */
  calculateUptime(service, breaker) {
    const totalTime = Date.now() - breaker.metrics.lastTransitionTime;
    const downtime = breaker.state === 'OPEN' ? (Date.now() - (breaker.lastFailureTime || 0)) : 0;
    return Math.max(0, (totalTime - downtime) / totalTime);
  }

  /**
   * Calculate health score (0-100)
   */
  calculateHealthScore(service) {
    const breaker = this.getServiceBreaker(service);
    const successRate = this.calculateSuccessRate(breaker);
    const uptime = this.calculateUptime(service, breaker);

    // Weighted score: 70% success rate, 30% uptime
    return Math.round((successRate * 0.7 + uptime * 0.3) * 100);
  }

  /**
   * Update service metrics
   */
  updateMetrics(serviceName, breaker) {
    const now = Date.now();
    if (breaker.metrics.lastTransitionTime) {
      const timeDiff = now - breaker.metrics.lastTransitionTime;
      if (breaker.state === 'CLOSED') {
        breaker.metrics.uptime += timeDiff;
      } else {
        breaker.metrics.downtime += timeDiff;
      }
    }
    breaker.metrics.lastTransitionTime = now;
  }

  /**
   * Start auto-recovery monitoring
   */
  startAutoRecovery() {
    if (!this.autoRecoveryEnabled) return;

    setInterval(() => {
      for (const [serviceName, breaker] of this.services) {
        if (breaker.state === 'OPEN') {
          const timeSinceFailure = Date.now() - (breaker.lastFailureTime || 0);
          if (timeSinceFailure >= this.halfOpenTimeout) {
            // Auto-transition to HALF_OPEN for recovery testing
            breaker.state = 'HALF_OPEN';
            breaker.recoveryAttempts++;
            logger.info('Auto-recovery: Circuit breaker transitioning to HALF_OPEN', {
              service: serviceName,
              recoveryAttempt: breaker.recoveryAttempts,
              timeSinceFailure: Math.round(timeSinceFailure/1000) + 's'
            });
          }
        }
      }
    }, this.recoveryCheckInterval);
  }

  /**
   * Trigger alert for circuit breaker state changes
   */
  triggerAlert(serviceName, state, details) {
    const alertKey = `${serviceName}-${state}-${Date.now()}`;
    this.alerts.set(alertKey, {
      service: serviceName,
      state,
      details,
      timestamp: Date.now(),
      acknowledged: false
    });

    logger.warn('Circuit breaker alert triggered', {
      alertKey,
      service: serviceName,
      state,
      details
    });

    // In a production system, this would send notifications
    // (email, Slack, monitoring system, etc.)
  }

  /**
   * Get active alerts
   */
  getAlerts() {
    return Array.from(this.alerts.values()).filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertKey) {
    const alert = this.alerts.get(alertKey);
    if (alert) {
      alert.acknowledged = true;
      logger.info('Alert acknowledged', { alertKey, service: alert.service });
    }
  }

  /**
   * Force circuit breaker state (for manual recovery/testing)
   */
  forceState(serviceName, state) {
    const breaker = this.getServiceBreaker(serviceName);
    const previousState = breaker.state;
    breaker.state = state;
    breaker.metrics.lastTransitionTime = Date.now();

    if (state === 'CLOSED') {
      breaker.failureCount = 0;
      breaker.consecutiveSuccesses = 0;
    }

    logger.warn('Circuit breaker state forcibly changed', {
      service: serviceName,
      fromState: previousState,
      toState: state,
      reason: 'manual_override'
    });
  }

  /**
   * Reset circuit breaker for a service
   */
  reset(serviceName) {
    const breaker = this.getServiceBreaker(serviceName);
    breaker.failureCount = 0;
    breaker.successCount = 0;
    breaker.consecutiveSuccesses = 0;
    breaker.recoveryAttempts = 0;
    breaker.state = 'CLOSED';
    breaker.lastFailureTime = null;
    breaker.lastSuccessTime = Date.now();
    breaker.metrics.lastTransitionTime = Date.now();
    breaker.metrics.errorRate = 0;

    logger.info('Circuit breaker manually reset', { service: serviceName });
  }
}

// Global circuit breaker instance
export const circuitBreaker = new CircuitBreaker(5, 30000, 30000);

/**
 * Enhanced retry handler with circuit breaker integration and graceful degradation
 */
export function retryHandler(maxRetries = 3, baseDelay = 1000, serviceName = 'default') {
  return async (req, res, next) => {
    let lastError;
    let retryCount = 0;
    let degradationApplied = false;

    // Check circuit breaker before attempting operation
    if (!circuitBreaker.isAvailable(serviceName)) {
      // Apply graceful degradation
      const degradedResponse = await applyGracefulDegradation(req, serviceName);
      if (degradedResponse) {
        logger.warn('Graceful degradation applied due to circuit breaker OPEN', {
          service: serviceName,
          endpoint: req.path,
          degradationType: degradedResponse.type
        });
        degradationApplied = true;
        return res.status(degradedResponse.status).json(degradedResponse.response);
      }

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

      // Enhanced retry logic with exponential backoff and jitter
      while (retryCount < maxRetries) {
        retryCount++;
        const baseDelayMs = error.nextRetryDelay();
        if (!baseDelayMs) {
          break; // No more retries
        }

        // Add jitter to prevent thundering herd (10-20% randomization)
        const jitterFactor = 0.9 + Math.random() * 0.2;
        const delay = Math.round(baseDelayMs * jitterFactor);

        logger.warn('Retrying operation with exponential backoff and jitter', {
          endpoint: req.path,
          service: serviceName,
          attempt: retryCount,
          maxRetries,
          baseDelayMs,
          actualDelayMs: delay,
          jitterFactor: jitterFactor.toFixed(2),
          errorCode: error.code,
          errorMessage: error.message,
          circuitState: circuitBreaker.getServiceBreaker(serviceName).state,
          healthScore: circuitBreaker.calculateHealthScore(serviceName)
        });

        // Wait before retry with jitter
        await new Promise(resolve => setTimeout(resolve, delay));

        // Check circuit breaker before each retry
        if (!circuitBreaker.isAvailable(serviceName)) {
          // Apply graceful degradation on retry failure
          const degradedResponse = await applyGracefulDegradation(req, serviceName, retryCount);
          if (degradedResponse) {
            logger.warn('Graceful degradation applied during retry', {
              service: serviceName,
              endpoint: req.path,
              retryAttempt: retryCount,
              degradationType: degradedResponse.type
            });
            degradationApplied = true;
            return res.status(degradedResponse.status).json(degradedResponse.response);
          }

          const cbError = new MCPError('SERVICE_UNAVAILABLE', `Service ${serviceName} unavailable during retry (circuit breaker OPEN)`,
                                     { service: serviceName, attempt: retryCount, status: circuitBreaker.getStatus() }, 503, false, 0, 0, serviceName);
          return next(cbError);
        }

        try {
          await circuitBreaker.execute(serviceName, protectedOperation, {
            endpoint: req.path,
            method: req.method,
            retryAttempt: retryCount,
            totalDelayMs: delay
          });
          // Success on retry - log recovery
          logger.info('Operation recovered after retry', {
            endpoint: req.path,
            service: serviceName,
            successfulAttempt: retryCount,
            totalDelayMs: delay,
            healthScore: circuitBreaker.calculateHealthScore(serviceName)
          });
          // Reset circuit breaker failure count on successful retry
          circuitBreaker.getServiceBreaker(serviceName).failureCount = Math.max(0,
            circuitBreaker.getServiceBreaker(serviceName).failureCount - 1);
          return; // Success, exit retry loop
        } catch (retryError) {
          lastError = retryError;
          if (!MCPError.isMCPError(retryError) || !retryError.isRetryable()) {
            return next(retryError);
          }

          // Log retry failure with increasing detail
          logger.error('Retry attempt failed', {
            endpoint: req.path,
            service: serviceName,
            attempt: retryCount,
            maxRetries,
            retryErrorCode: retryError.code,
            retryErrorMessage: retryError.message,
            cumulativeDelayMs: delay,
            circuitState: circuitBreaker.getServiceBreaker(serviceName).state,
            remainingAttempts: maxRetries - retryCount
          });
        }
      }

      // All retries exhausted - apply final graceful degradation
      if (!degradationApplied) {
        const finalDegradedResponse = await applyGracefulDegradation(req, serviceName, maxRetries, true);
        if (finalDegradedResponse) {
          logger.error('Final graceful degradation applied after all retries exhausted', {
            service: serviceName,
            endpoint: req.path,
            totalAttempts: maxRetries,
            degradationType: finalDegradedResponse.type
          });
          return res.status(finalDegradedResponse.status).json(finalDegradedResponse.response);
        }
      }

      // All retries exhausted and no degradation possible
      if (lastError) {
        logger.error('All retries exhausted for circuit breaker protected operation', {
          endpoint: req.path,
          service: serviceName,
          totalAttempts: maxRetries,
          totalPossibleDelayMs: error.nextRetryDelay() || 0,
          finalErrorCode: lastError.code,
          finalErrorMessage: lastError.message,
          circuitState: circuitBreaker.getServiceBreaker(serviceName).state,
          circuitHealthScore: circuitBreaker.calculateHealthScore(serviceName),
          degradationApplied
        });
        lastError.message = `${lastError.message} (after ${maxRetries} retries with exponential backoff, circuit breaker protection, and graceful degradation)`;
      }

      next(lastError || new MCPError('RETRY_EXHAUSTED', `Operation failed after maximum retries for ${serviceName}`,
                                   { service: serviceName, status: circuitBreaker.getStatus(), totalRetries: maxRetries }, 503, false, 0, 0, serviceName));
    }
  };
}

/**
 * Apply graceful degradation based on service and request type
 */
async function applyGracefulDegradation(req, serviceName, retryAttempt = 0, isFinalAttempt = false) {
  const degradationStrategies = {
    cpu: async (req) => {
      if (req.path.includes('/cpu/run') && req.body.maxSteps > 100) {
        // Reduce CPU execution steps for degraded performance
        return {
          type: 'cpu_steps_reduced',
          status: 200,
          response: {
            success: true,
            data: {
              stepsExecuted: Math.min(req.body.maxSteps, 50),
              halted: true,
              finalPC: 0,
              degradation: {
                reason: 'Circuit breaker protection',
                originalMaxSteps: req.body.maxSteps,
                reducedMaxSteps: 50,
                performanceImpact: 'Reduced execution steps to prevent system overload'
              }
            }
          }
        };
      }
      return null;
    },

    memory: async (req) => {
      if (req.path.includes('/memory/read') && req.body.bytes > 256) {
        // Reduce memory read size
        return {
          type: 'memory_read_reduced',
          status: 200,
          response: {
            success: true,
            data: {
              address: req.body.address,
              bytes: Math.min(req.body.bytes, 128),
              byteArray: [],
              endAddress: req.body.address + Math.min(req.body.bytes, 128) - 1,
              degradation: {
                reason: 'Circuit breaker protection',
                originalSize: req.body.bytes,
                reducedSize: 128,
                performanceImpact: 'Reduced read size to maintain system stability'
              }
            }
          }
        };
      }
      return null;
    },

    video: async (req) => {
      if (req.path.includes('/video/clear') || req.path.includes('/video/setPixel')) {
        // Return success without actual operation for non-critical video updates
        return {
          type: 'video_operation_deferred',
          status: 200,
          response: {
            success: true,
            data: {
              deferred: true,
              reason: 'Circuit breaker protection',
              degradation: {
                reason: 'Service temporarily unavailable',
                operationType: req.path.split('/').pop(),
                impact: 'Video operation deferred, display may be stale'
              }
            }
          }
        };
      }
      return null;
    },

    ai: async (req) => {
      // For AI operations, return a cached or simplified response
      return {
        type: 'ai_response_simplified',
        status: 200,
        response: {
          success: true,
          data: {
            content: 'Service temporarily unavailable due to system protection measures. Please try again later.',
            model: 'degraded-mode',
            tokensUsed: 0,
            generatedAt: new Date().toISOString(),
            degradation: {
              reason: 'Circuit breaker protection',
              impact: 'AI service operating in degraded mode with simplified responses'
            }
          }
        }
      };
    },

    queue: async (req) => {
      if (req.path.includes('/queue/add')) {
        // Accept but mark as low priority during degradation
        return {
          type: 'queue_priority_reduced',
          status: 200,
          response: {
            success: true,
            data: {
              taskId: `degraded-${Date.now()}`,
              message: 'Task queued with reduced priority due to system protection measures',
              priority: 'low',
              degradation: {
                reason: 'Circuit breaker protection',
                impact: 'Task queued with lower priority to reduce system load'
              }
            }
          }
        };
      }
      return null;
    }
  };

  // Apply service-specific degradation strategy
  const strategy = degradationStrategies[serviceName];
  if (strategy) {
    try {
      return await strategy(req);
    } catch (error) {
      logger.warn('Graceful degradation strategy failed', {
        service: serviceName,
        strategyError: error.message,
        endpoint: req.path
      });
    }
  }

  // Fallback degradation for any service
  if (isFinalAttempt) {
    return {
      type: 'generic_degradation',
      status: 503,
      response: {
        success: false,
        error: {
          code: 'SERVICE_DEGRADED',
          message: `${serviceName} service is operating in degraded mode`,
          details: {
            service: serviceName,
            retryAttempt,
            degradationApplied: true,
            suggestedAction: 'Try again later or use alternative endpoint'
          },
          retryable: true,
          retryDelay: 5000
        }
      }
    };
  }

  return null;
}

/**
 * Enhanced recovery handler for specific error types with monitoring
 * Attempts automatic recovery where possible and tracks recovery metrics
 */
export async function recoveryHandler(error, context = {}) {
  if (!MCPError.isMCPError(error)) {
    return { recovered: false, message: 'Not an MCPError, no recovery attempted' };
  }

  const recoveryStartTime = Date.now();
  const recoveryId = `recovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  logger.info('Attempting enhanced recovery for error', {
    recoveryId,
    errorCode: error.code,
    context,
    recoveryAttempt: true,
    errorContext: {
      endpoint: context.endpoint,
      service: context.service,
      retryAttempt: context.retryAttempt,
      circuitState: context.circuitState
    }
  });

  try {
    let recoveryResult;

    switch (error.code) {
      case MCP_ERROR_CODES.QUEUE_FULL:
        recoveryResult = await handleQueueFullRecovery(context, recoveryId);
        break;

      case MCP_ERROR_CODES.TIMEOUT_EXCEEDED:
      case MCP_ERROR_CODES.CPU_TIMEOUT:
        recoveryResult = await handleCpuTimeoutRecovery(context, recoveryId);
        break;

      case MCP_ERROR_CODES.SERVICE_UNAVAILABLE:
        recoveryResult = await handleServiceUnavailableRecovery(context, recoveryId);
        break;

      case MCP_ERROR_CODES.MEMORY_OUT_OF_BOUNDS:
        recoveryResult = await handleMemoryOutOfBoundsRecovery(context, recoveryId);
        break;

      case MCP_ERROR_CODES.VIDEO_UPDATE_TIMEOUT:
        recoveryResult = await handleVideoTimeoutRecovery(context, recoveryId);
        break;

      case MCP_ERROR_CODES.AI_GENERATION_FAILED:
      case MCP_ERROR_CODES.RETRYABLE_SERVICE:
        recoveryResult = await handleAIServiceRecovery(context, recoveryId);
        break;

      default:
        logger.debug('No specific recovery handler for error code', {
          recoveryId,
          errorCode: error.code
        });
        recoveryResult = { recovered: false, message: 'No applicable recovery available' };
    }

    const recoveryDuration = Date.now() - recoveryStartTime;

    // Log recovery metrics
    logger.info('Recovery attempt completed', {
      recoveryId,
      errorCode: error.code,
      recovered: recoveryResult.recovered,
      durationMs: recoveryDuration,
      message: recoveryResult.message,
      recoveryType: recoveryResult.type || 'unknown'
    });

    // Update recovery metrics in circuit breaker
    if (context.service && circuitBreaker.services.has(context.service)) {
      const serviceBreaker = circuitBreaker.services.get(context.service);
      if (recoveryResult.recovered) {
        serviceBreaker.recoverySuccessCount = (serviceBreaker.recoverySuccessCount || 0) + 1;
      } else {
        serviceBreaker.recoveryFailureCount = (serviceBreaker.recoveryFailureCount || 0) + 1;
      }
    }

    return recoveryResult;

  } catch (recoveryError) {
    const recoveryDuration = Date.now() - recoveryStartTime;

    logger.error('Recovery attempt failed catastrophically', {
      recoveryId,
      originalError: error.code,
      recoveryError: recoveryError.message,
      durationMs: recoveryDuration,
      context,
      stack: recoveryError.stack
    });

    // Trigger alert for recovery failure
    circuitBreaker.triggerAlert(context.service || 'unknown', 'RECOVERY_FAILED', {
      originalError: error.code,
      recoveryError: recoveryError.message,
      context
    });

    return {
      recovered: false,
      message: 'Recovery attempt failed catastrophically',
      recoveryError: recoveryError.message,
      type: 'recovery_failure'
    };
  }
}

/**
 * Handle queue full recovery by cleaning completed tasks
 */
async function handleQueueFullRecovery(context, recoveryId) {
  if (!globalThis.queueManager) {
    return { recovered: false, message: 'Queue manager not available for recovery' };
  }

  try {
    const cleanResult = await globalThis.queueManager.cleanCompleted();

    if (cleanResult.removed > 0) {
      logger.info('Queue cleanup recovery successful', {
        recoveryId,
        removed: cleanResult.removed,
        remaining: cleanResult.remaining,
        freeSlots: cleanResult.freeSlots || 'unknown'
      });

      return {
        recovered: true,
        message: `Queue cleaned (${cleanResult.removed} tasks removed), try again`,
        type: 'queue_cleanup',
        cleanup: cleanResult
      };
    } else {
      return {
        recovered: false,
        message: 'No completed tasks to clean from queue',
        type: 'queue_cleanup_failed'
      };
    }
  } catch (error) {
    logger.warn('Queue cleanup recovery failed', {
      recoveryId,
      error: error.message
    });
    return {
      recovered: false,
      message: 'Queue cleanup recovery failed',
      type: 'queue_cleanup_error',
      error: error.message
    };
  }
}

/**
 * Handle CPU timeout recovery by resetting CPU state
 */
async function handleCpuTimeoutRecovery(context, recoveryId) {
  if (!context.endpoint?.includes('cpu') || !globalThis.adapters?.cpu) {
    return { recovered: false, message: 'CPU adapter not available for recovery' };
  }

  try {
    await globalThis.adapters.cpu.reset(false); // Soft reset

    logger.info('CPU soft reset recovery performed', {
      recoveryId,
      endpoint: context.endpoint,
      resetType: 'soft'
    });

    return {
      recovered: true,
      message: 'CPU state reset, operation may succeed now',
      type: 'cpu_reset',
      resetType: 'soft'
    };
  } catch (error) {
    logger.warn('CPU reset recovery failed', {
      recoveryId,
      error: error.message
    });
    return {
      recovered: false,
      message: 'CPU reset recovery failed',
      type: 'cpu_reset_error',
      error: error.message
    };
  }
}

/**
 * Handle service unavailable recovery
 */
async function handleServiceUnavailableRecovery(context, recoveryId) {
  const service = context.service || 'unknown';

  // Wait and check service health
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Check if service recovered
  const isAvailable = circuitBreaker.isAvailable(service);
  const healthScore = circuitBreaker.calculateHealthScore(service);

  if (isAvailable && healthScore > 50) {
    logger.info('Service health recovery detected', {
      recoveryId,
      service,
      healthScore,
      available: isAvailable
    });

    return {
      recovered: true,
      message: `Service ${service} health recovered (score: ${healthScore})`,
      type: 'service_health_recovery',
      healthScore
    };
  } else {
    return {
      recovered: false,
      message: `Service ${service} still unhealthy (score: ${healthScore})`,
      type: 'service_still_unhealthy',
      healthScore
    };
  }
}

/**
 * Handle memory out of bounds recovery by adjusting range
 */
async function handleMemoryOutOfBoundsRecovery(context, recoveryId) {
  if (!context.address || !context.size || !globalThis.adapters?.memory) {
    return { recovered: false, message: 'Insufficient context for memory recovery' };
  }

  const originalSize = context.size;
  const safeSize = Math.min(originalSize, 0xFFFF - context.address + 1);

  if (safeSize > 0 && safeSize < originalSize) {
    logger.info('Memory range adjusted for recovery', {
      recoveryId,
      originalSize,
      safeSize,
      address: context.address,
      reductionPercent: (((originalSize - safeSize) / originalSize) * 100).toFixed(1) + '%'
    });

    return {
      recovered: true,
      message: `Memory range adjusted from ${originalSize} to ${safeSize} bytes`,
      type: 'memory_range_adjusted',
      adjustedSize: safeSize,
      originalSize,
      address: context.address
    };
  } else {
    return {
      recovered: false,
      message: 'Unable to adjust memory range safely',
      type: 'memory_range_unadjustable'
    };
  }
}

/**
 * Handle video timeout recovery
 */
async function handleVideoTimeoutRecovery(context, recoveryId) {
  // For video timeouts, we can try reducing the operation scope
  if (context.endpoint?.includes('update')) {
    logger.info('Video update timeout recovery - reducing scope', { recoveryId });

    return {
      recovered: true,
      message: 'Video operation scope reduced for recovery',
      type: 'video_scope_reduced',
      suggestion: 'Try updating smaller regions or reducing flush frequency'
    };
  }

  return {
    recovered: false,
    message: 'Video timeout recovery not applicable',
    type: 'video_recovery_unavailable'
  };
}

/**
 * Handle AI service recovery
 */
async function handleAIServiceRecovery(context, recoveryId) {
  // For AI service failures, suggest fallback models or cached responses
  const fallbackOptions = {
    suggestion: 'Use cached response or switch to simpler model',
    availableFallbacks: ['cached', 'simple-model', 'degraded-mode'],
    recoveryTimeEstimate: '30-60 seconds'
  };

  logger.info('AI service recovery options provided', {
    recoveryId,
    fallbackOptions
  });

  return {
    recovered: true,
    message: 'AI service recovery options available',
    type: 'ai_fallback_available',
    fallbackOptions
  };
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