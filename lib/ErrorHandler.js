import winston from 'winston';

// Configure Winston logger for ErrorHandler (Node.js only)
let logger = null;

if (typeof window === 'undefined') {
  // Node.js environment
  logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'error-handler' },
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      new winston.transports.File({
        filename: 'logs/error-handler.log',
        maxsize: 5 * 1024 * 1024,
        maxFiles: 5
      })
    ]
  });
} else {
  // Browser environment - fallback to console
  logger = {
    error: (data) => {
      if (window.console) {
        console.error('[ErrorHandler]', data);
      }
    }
  };
}

class ErrorHandler {
  static standardizeError(error, component) {
    // Standardize the error object
    const stdError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || error.toString(),
      component: component,
      timestamp: new Date().toISOString(),
      context: error.context || {},
      ...(error.stack ? { stack: error.stack } : {})
    };

    // Log using Winston in Node.js or console in browser
    if (logger && logger.error) {
      logger.error('Standardized error', stdError);
    }

    return stdError;
  }
}

export default ErrorHandler;