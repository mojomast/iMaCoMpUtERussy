import net from 'net';

/**
 * Port availability and conflict resolution utilities
 */

/**
 * Check if a port is available for binding
 * @param {number} port - Port number to check
 * @returns {Promise<boolean>} True if port is available, false otherwise
 */
export async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.listen(port, '127.0.0.1', () => {
      server.close();
      resolve(true);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        // Other errors (permissions, etc.) are treated as unavailable
        resolve(false);
      }
    });
  });
}

/**
 * Find the next available port starting from the given port
 * @param {number} startPort - Port to start checking from
 * @param {number} maxAttempts - Maximum number of ports to check
 * @returns {Promise<number>} First available port found
 */
export async function findAvailablePort(startPort, maxAttempts = 100) {
  for (let port = startPort; port < startPort + maxAttempts; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`Could not find available port after checking ${maxAttempts} ports starting from ${startPort}`);
}

/**
 * Check port availability and attempt to find alternative if needed
 * @param {number} preferredPort - Preferred port number
 * @param {string} serviceName - Name of service for logging
 * @param {Object} logger - Optional logger instance
 * @returns {Promise<number>} Port number to use
 */
export async function resolvePort(preferredPort, serviceName = 'service', logger = console) {
  const available = await isPortAvailable(preferredPort);
  if (available) {
    logger.info(`Port ${preferredPort} available for ${serviceName}`);
    return preferredPort;
  } else {
    logger.warn(`Port ${preferredPort} already in use for ${serviceName}. Finding alternative...`);
    const alternativePort = await findAvailablePort(preferredPort + 1, 100);
    logger.warn(`Using alternative port ${alternativePort} for ${serviceName} (preferred was ${preferredPort})`);
    return alternativePort;
  }
}

export default { isPortAvailable, findAvailablePort, resolvePort };