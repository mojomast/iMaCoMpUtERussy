import winston from 'winston';

// Create logger instance that writes to a central log file
const logger = winston.createLogger({
  level: 'error',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log' })
  ]
});

class ErrorHandler {
  static standardizeError(error, component) {
    // Standardize the error object
    const stdError = {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || error.toString(),
      component: component,
      timestamp: new Date().toISOString(),
      context: error.context || {}
    };

    // Log the standardized error to file
    logger.error(stdError);

    return stdError;
  }
}

export default ErrorHandler;