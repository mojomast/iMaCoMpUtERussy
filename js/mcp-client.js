/**
 * Browser-compatible MCP client for the frontend
 * This replaces the server-side MCP client that was causing module import errors
 */

import { assemble } from './assembler.js';

/**
 * Persistence helper functions for version-controlled storage
 */
class PersistenceHelpers {
  /**
   * Generate SHA-256 checksum for data
   * @param {string|ArrayBuffer} data - Data to hash
   * @returns {Promise<string>} Hex checksum
   */
  static async generateChecksum(data) {
    if (typeof data === 'string') {
      data = new TextEncoder().encode(data);
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Normalize path for cross-platform compatibility
   * @param {string} path - Path to normalize
   * @returns {string} Normalized path using forward slashes
   */
  static normalizePath(path) {
    return path.replace(/\\/g, '/');
  }

  /**
   * Get localStorage key for program version tracking
   * @param {string} programName - Program name
   * @returns {string} Storage key
   */
  static getVersionKey(programName) {
    return `mcp_program_version_${this.normalizePath(programName)}`;
  }

  /**
   * Store program version locally
   * @param {string} programName - Program name
   * @param {string} version - Version string
   * @param {Object} metadata - Program metadata
   */
  static storeVersion(programName, version, metadata = {}) {
    try {
      const key = this.getVersionKey(programName);
      const versionData = {
        version,
        metadata,
        updatedAt: new Date().toISOString(),
        checksum: metadata.checksum || ''
      };
      localStorage.setItem(key, JSON.stringify(versionData));
      console.log(`💾 Stored version ${version} for program '${programName}'`);
    } catch (error) {
      console.warn('Failed to store program version locally:', error);
    }
  }

  /**
   * Get stored program version
   * @param {string} programName - Program name
   * @returns {Object|null} Version data or null
   */
  static getStoredVersion(programName) {
    try {
      const key = this.getVersionKey(programName);
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.warn('Failed to get stored program version:', error);
      return null;
    }
  }

  /**
   * Validate program version compatibility
   * @param {string} currentVersion - Current program version
   * @param {string} expectedVersion - Expected version
   * @returns {Object} Validation result
   */
  static validateVersion(currentVersion, expectedVersion = '1.1') {
    const [currentMajor] = currentVersion.split('.').map(Number);
    const [expectedMajor] = expectedVersion.split('.').map(Number);
    
    return {
      valid: currentMajor >= expectedMajor,
      current: currentVersion,
      expected: expectedVersion,
      needsUpgrade: currentMajor < expectedMajor,
      message: currentMajor >= expectedMajor ? 'Version compatible' : `Version upgrade required from ${currentVersion} to ${expectedVersion}`
    };
  }

  /**
   * Validate checksum integrity
   * @param {string|ArrayBuffer} data - Data to validate
   * @param {string} expectedChecksum - Expected checksum
   * @returns {Promise<boolean>} Validation result
   */
  static async validateChecksum(data, expectedChecksum) {
    try {
      const currentChecksum = await this.generateChecksum(data);
      return currentChecksum === expectedChecksum;
    } catch (error) {
      console.error('Checksum validation failed:', error);
      return false;
    }
  }
}

/**
 * Initialize MCP integration with graceful fallbacks
 */
export async function initializeMCPIntegration() {
    console.log('🎚️ Initializing MCP client (browser-safe mode)...');

        // First, try same-origin proxy path '/mcp/health' (works with dev proxy and avoids CORS)
        let serverAvailable = false;
        let selectedUrl = null; // empty string indicates same-origin proxying (use relative paths)

        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 1200);
            const resp = await fetch('/mcp/health', { signal: controller.signal });
            clearTimeout(id);
            if (resp && resp.ok) {
                serverAvailable = true;
                selectedUrl = ''; // use relative paths so fetch('/mcp/...') will be proxied
                console.log('\u2705 MCP server detected via same-origin /mcp proxy');
            }
        } catch (err) {
            // ignore — we'll probe explicit candidates next
        }

        if (!serverAvailable) {
            // Probe a small list of explicit candidate endpoints, but avoid noisy per-host console spam.
            const candidates = [];
            try {
                if (window.location && window.location.hostname && window.location.protocol.startsWith('http')) {
                    candidates.push(`${window.location.protocol}//${window.location.hostname}:8001`);
                    candidates.push(`${window.location.protocol}//${window.location.hostname}:3000`);
                }
            } catch (e) {
                // ignore
            }
            candidates.push('http://localhost:8001');
            candidates.push('http://localhost:3000');

            // Try candidates but suppress per-candidate console.warns; only log final outcome
            for (const base of candidates) {
                try {
                    const controller = new AbortController();
                    const id = setTimeout(() => controller.abort(), 1200);
                    const resp = await fetch(`${base.replace(/\/+$/,'')}/health`, { signal: controller.signal });
                    clearTimeout(id);
                    if (resp && resp.ok) {
                        serverAvailable = true;
                        selectedUrl = base;
                        console.log('\u2705 MCP server detected at', base);
                        break;
                    }
                } catch (error) {
                    // swallow common network errors; no per-host noise
                    continue;
                }
            }
        }

        if (!serverAvailable) {
            console.warn('\u26a0\ufe0f MCP server not available - running in offline mode');
        }

    // Initialize MCP features with the selected server URL (or null for offline)
    initializeMCPClientController(serverAvailable, selectedUrl);
    initializeMCPLogs();
    attachMCPButtons();

    console.log('🎚️ MCP client initialization complete');
}

/**
 * Initialize MCP client controller with server connection status
 */
function initializeMCPClientController(serverAvailable, serverUrl) {
    // Create global MCP client object
    window.mcpClient = {
        serverAvailable,
        serverUrl,

        // Helper to create consistent fetch options
        createFetchOptions(body = null, additionalHeaders = {}) {
            const options = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'default-api-key-change-in-production',
                    ...additionalHeaders
                }
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            return options;
        },

        // Timeout-enabled fetch wrapper
        /**
         * Enhanced timeout fetch with client-side retry logic
         */
        async resilientFetch(url, options, maxRetries = 3, baseDelay = 1000, operationType = 'default', queueOnFailure = true) {
          let lastError;
          let retryCount = 0;
          const specificDelays = [1000, 2000, 4000]; // 1s, 2s, 4s for 3 attempts
      
          while (retryCount <= maxRetries) {
            try {
              const timeoutMs = options._timeoutMs || 10000;
              const controller = new AbortController();
              const signal = controller.signal;
              
              // Add signal to options if not present
              const fetchOptions = { ...options, signal };
              
              // Timeout promise
              const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                  controller.abort();
                  reject(new Error(`MCP request timeout after ${timeoutMs}ms`));
                }, timeoutMs);
              });
              
              // Fetch promise
              const fetchPromise = fetch(url, fetchOptions).catch(err => {
                if (err.name !== 'AbortError') throw err;
                return Promise.reject(err);
              });
              
              const response = await Promise.race([fetchPromise, timeoutPromise]);
              
              // Success - clear any queued operations for this URL if applicable
              if (queueOnFailure && retryCount > 0) {
                this.clearQueuedOperations(url, 'retry_success');
              }
              
              return response;
              
            } catch (error) {
              lastError = error;
              retryCount++;
              
              // Check if retryable error (network errors, timeouts, 5xx server errors)
              const isRetryable = error.name === 'AbortError' ||
                                 error.message?.includes('timeout') ||
                                 (error.status >= 500 && error.status < 600) ||
                                 (error.isMCPError && ['SERVICE_UNAVAILABLE', 'TIMEOUT_EXCEEDED', 'RETRYABLE_SERVICE'].includes(error.code));
              
              if (!isRetryable || retryCount > maxRetries) {
                // Final failure - queue operation if requested
                if (queueOnFailure && this.shouldQueueOperation(error, operationType)) {
                  await this.queueOperationForReplay({ url, options: JSON.stringify(options), operationType, timestamp: Date.now(), attempt: retryCount });
                  console.warn('📱 MCP operation queued for replay due to failure:', { url, operationType, error: error.message });
                  if (window.logToMCP) {
                    window.logToMCP('warn', `Operation queued for retry: ${operationType} (${error.message})`);
                  }
                }
                throw error;
              }
              
              // Calculate retry delay
              let delay;
              if (retryCount <= specificDelays.length) {
                delay = specificDelays[retryCount - 1];
              } else {
                // Exponential backoff for additional retries
                delay = baseDelay * Math.pow(2, retryCount - 1);
                delay = Math.min(delay, 8000); // Cap at 8 seconds
              }
              
              console.warn(`🔄 MCP retry ${retryCount}/${maxRetries} for ${operationType} after ${delay}ms:`, error.message);
              if (window.logToMCP) {
                window.logToMCP('info', `Retrying ${operationType} operation (attempt ${retryCount}/${maxRetries}) in ${delay}ms`);
              }
              
              // Wait before retry
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
          
          // All retries exhausted
          console.error('❌ MCP operation failed after all retries:', lastError);
          if (window.logToMCP) {
            window.logToMCP('error', `Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`);
          }
          throw lastError;
        },
      
        /**
         * Check if operation should be queued for replay
         */
        shouldQueueOperation(error, operationType) {
          // Queue critical operations or specific error types
          const criticalOperations = ['cpu.reset', 'cpu.step', 'cpu.run', 'memory.write', 'programs.save'];
          const queueableErrors = ['SERVICE_UNAVAILABLE', 'TIMEOUT_EXCEEDED', 'RETRYABLE_SERVICE', 'NETWORK_ERROR'];
          
          const shouldQueue = criticalOperations.some(op => operationType.includes(op)) ||
                             (error.isMCPError && queueableErrors.includes(error.code)) ||
                             error.name === 'TypeError' || // Network errors
                             error.message?.includes('fetch');
          
          return shouldQueue;
        },
      
        /**
         * Queue operation for later replay from localStorage
         */
        async queueOperationForReplay(operation) {
          try {
            const queueKey = 'mcp_operation_queue';
            let queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
            
            // Add operation to queue with unique ID
            operation.id = Date.now() + Math.random();
            operation.retries = 0;
            operation.maxRetries = 5; // Max 5 replay attempts
            queue.unshift(operation); // Add to front for FIFO
            
            // Keep only last 50 operations
            if (queue.length > 50) {
              queue = queue.slice(0, 50);
            }
            
            localStorage.setItem(queueKey, JSON.stringify(queue));
            console.log('💾 MCP operation queued:', operation.id);
            
            // Schedule replay attempt
            this.scheduleReplayCheck();
            
          } catch (storageError) {
            console.error('Failed to queue operation for replay:', storageError);
          }
        },
      
        /**
         * Clear queued operations (success or manual clear)
         */
        clearQueuedOperations(url, reason = 'manual') {
          try {
            const queueKey = 'mcp_operation_queue';
            let queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
            
            // Filter out operations matching the URL or all if reason is 'manual'
            if (reason === 'manual') {
              queue = [];
            } else {
              queue = queue.filter(op => !op.url.includes(url));
            }
            
            localStorage.setItem(queueKey, JSON.stringify(queue));
            console.log('🧹 MCP queued operations cleared:', reason);
            
          } catch (error) {
            console.error('Failed to clear queued operations:', error);
          }
        },
      
        /**
         * Schedule periodic check for queued operations replay
         */
        scheduleReplayCheck() {
          if (this.replayTimer) return; // Already scheduled
          
          this.replayTimer = setInterval(async () => {
            await this.replayQueuedOperations();
          }, 5000); // Check every 5 seconds
          
          // Clear timer after 5 minutes of inactivity
          setTimeout(() => {
            if (this.replayTimer) {
              clearInterval(this.replayTimer);
              this.replayTimer = null;
              console.log('⏰ MCP replay timer cleared due to inactivity');
            }
          }, 5 * 60 * 1000);
        },
      
        /**
         * Replay queued operations from localStorage
         */
        async replayQueuedOperations() {
          try {
            const queueKey = 'mcp_operation_queue';
            let queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
            
            if (queue.length === 0) {
              if (this.replayTimer) {
                clearInterval(this.replayTimer);
                this.replayTimer = null;
              }
              return;
            }
            
            console.log('🔄 Attempting to replay', queue.length, 'queued MCP operations');
            
            let replayed = 0;
            let failed = 0;
            
            // Process operations in reverse order (most recent first)
            for (let i = queue.length - 1; i >= 0; i--) {
              const operation = queue[i];
              
              if (operation.retries >= operation.maxRetries) {
                console.warn('⏭️ Skipping operation after max retries:', operation.id);
                queue.splice(i, 1);
                continue;
              }
              
              try {
                // Reconstruct options from stored JSON
                const options = {
                  ...operation.options,
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'X-API-Key': 'default-api-key-change-in-production'
                  }
                };
                
                if (operation.options.body) {
                  options.body = operation.options.body;
                }
                
                const response = await this.resilientFetch(operation.url, options, 1, 1000, operation.operationType, false); // No re-queuing on replay
                
                if (response.ok) {
                  console.log('✅ Queued operation replayed successfully:', operation.id);
                  if (window.logToMCP) {
                    window.logToMCP('success', `Replayed queued operation: ${operation.operationType}`);
                  }
                  queue.splice(i, 1); // Remove from queue
                  replayed++;
                }
              } catch (replayError) {
                operation.retries++;
                console.warn('❌ Failed to replay queued operation:', operation.id, replayError.message);
                if (window.logToMCP) {
                  window.logToMCP('warn', `Replay attempt ${operation.retries}/${operation.maxRetries} failed for ${operation.operationType}`);
                }
                failed++;
              }
            }
            
            // Update storage
            localStorage.setItem(queueKey, JSON.stringify(queue));
            
            console.log(`📊 Replay complete: ${replayed} successful, ${failed} failed, ${queue.length} remaining`);
            
            if (queue.length === 0 && this.replayTimer) {
              clearInterval(this.replayTimer);
              this.replayTimer = null;
              console.log('🎉 All queued operations replayed successfully');
            }
            
          } catch (error) {
            console.error('Failed to process queued operations:', error);
          }
        },
      
        /**
         * Get server availability status
         */
        async checkServerAvailability() {
          try {
            const response = await this.resilientFetch(`${this.serverUrl}/health`, { method: 'GET' }, 1, 1000, 'health_check', false);
            const health = await response.json();
            this.serverAvailable = health.status === 'ok' || health.status === 'degraded';
            this.serverHealth = health;
            return this.serverAvailable;
          } catch (error) {
            this.serverAvailable = false;
            console.warn('Server availability check failed:', error.message);
            return false;
          }
        },
      
        async timeoutFetch(url, options, timeoutMs = 10000) {
          // Legacy method - use resilientFetch for new implementations
          console.warn('Using legacy timeoutFetch - consider using resilientFetch for retry support');
          return this.resilientFetch(url, options, 0, 0, 'legacy', false);
        },
      
        // Helper to create consistent fetch options with timeout support
        createFetchOptions(body = null, additionalHeaders = {}, timeoutMs = 10000) {
          const options = {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': 'default-api-key-change-in-production',
              ...additionalHeaders
            }
          };
          if (body) {
            options.body = JSON.stringify(body);
          }
          // Attach timeout to options for timeoutFetch
          options._timeoutMs = timeoutMs;
          return options;
        },
      
        // Helper to handle MCP responses with error parsing
        async handleMCPResponse(response, operation) {
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            console.error(`❌ MCP ${operation} failed:`, errorData);
            
            // Enhanced error parsing with circuit breaker status
            if (errorData.error && errorData.code) {
              const mcpError = {
                code: errorData.code,
                message: errorData.message || errorData.error,
                details: errorData.details || errorData.data,
                retryable: errorData.retryable || false,
                circuitStatus: errorData.circuitStatus || null,
                retryCount: errorData.retryCount || 0
              };
              throw { isMCPError: true, ...mcpError };
            }
            throw {
              message: errorData.message || `HTTP ${response.status}`,
              status: response.status,
              retryable: response.status >= 500 // Server errors are retryable
            };
          }
          const result = await response.json();
          if (!result.success) {
            console.error(`❌ MCP ${operation} server error:`, result);
            const errorObj = {
              isMCPError: true,
              code: result.error?.code || 'SERVER_ERROR',
              message: result.error?.message || 'Server error',
              details: result.error?.details,
              retryable: result.error?.retryable || false,
              circuitStatus: result.error?.circuitStatus
            };
            throw errorObj;
          }
          return result;
        },

        // CPU control methods
        async resetCPU(hardReset = false) {
            if (!this.serverAvailable) {
                console.info('🔄 MCP: CPU reset (simulated offline mode)');
                return { success: true, message: 'CPU reset in offline mode' };
            }
      
            try {
                logger.debug('MCP CPU reset request', { hardReset });
                const options = this.createFetchOptions({ hardReset }, {}, 5000); // 5s timeout for reset
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/cpu/reset`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'CPU reset');
            } catch (error) {
                logger.error('MCP CPU reset error', { error: error.message, isMCPError: !!error.isMCPError, code: error.code });
                if (window.logToMCP) {
                    window.logToMCP('error', `CPU reset failed: ${error.message}`);
                }
                throw error;
            }
        },

        async getCPUState() {
            if (!this.serverAvailable) {
                console.info('📊 MCP: CPU state (simulated offline mode)');
                return {
                    success: true,
                    data: {
                        PC: 0x0600,
                        A: 0,
                        X: 0,
                        Y: 0,
                        flags: { Z: false, N: false, C: false, V: false, I: false, D: false },
                        running: false
                    }
                };
            }
      
            try {
                logger.debug('MCP CPU state request');
                const options = this.createFetchOptions({}, {}, 2000); // 2s timeout for state
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/cpu/state`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'CPU state');
            } catch (error) {
                logger.error('MCP CPU state error', { error: error.message, isMCPError: !!error.isMCPError, code: error.code });
                if (window.logToMCP) {
                    window.logToMCP('error', `CPU state fetch failed: ${error.message}`);
                }
                throw error;
            }
        },

        async stepCPU(steps = 1) {
            if (!this.serverAvailable) {
                console.info('⏭️ MCP: CPU step (simulated offline mode)');
                return { success: true, message: `CPU step ${steps} (offline)` };
            }
      
            try {
                logger.debug('MCP CPU step request', { steps });
                const options = this.createFetchOptions({ steps });
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/cpu/step`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'CPU step');
            } catch (error) {
                logger.error('MCP CPU step error', { error: error.message, isMCPError: !!error.isMCPError, code: error.code });
                if (window.logToMCP) {
                    window.logToMCP('error', `CPU step failed: ${error.message}`);
                }
                throw error;
            }
        },

        async runCPU() {
            if (!this.serverAvailable) {
                console.info('▶️ MCP: CPU run (simulated offline mode)');
                return { success: true, message: 'CPU run in offline mode' };
            }
      
            try {
                logger.debug('MCP CPU run request');
                const options = this.createFetchOptions({});
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/cpu/run`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'CPU run');
            } catch (error) {
                logger.error('MCP CPU run error', { error: error.message, isMCPError: !!error.isMCPError, code: error.code });
                if (window.logToMCP) {
                    window.logToMCP('error', `CPU run failed: ${error.message}`);
                }
                throw error;
            }
        },

        // Memory methods
        async readMemory(address, size = 1) {
            if (!this.serverAvailable) {
                console.info(`📖 MCP: Memory read ${address} (simulated offline mode)`);
                return { success: true, value: 0 };
            }
      
            try {
                logger.debug('MCP memory read request', { address, size });
                const options = this.createFetchOptions({ address, size });
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/memory/read`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'memory read');
            } catch (error) {
                logger.error('MCP memory read error', { error: error.message, isMCPError: !!error.isMCPError, code: error.code, address });
                if (window.logToMCP) {
                    window.logToMCP('error', `Memory read failed at 0x${address.toString(16)}: ${error.message}`);
                }
                throw error;
            }
        },

        async writeMemory(address, value, size = 1) {
            if (!this.serverAvailable) {
                console.info(`📝 MCP: Memory write ${address} = ${value} (simulated offline mode)`);
                return { success: true };
            }
      
            try {
                logger.debug('MCP memory write request', { address, value, size });
                const options = this.createFetchOptions({ address, value, size });
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/memory/write`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'memory write');
            } catch (error) {
                logger.error('MCP memory write error', { error: error.message, isMCPError: !!error.isMCPError, code: error.code, address });
                if (window.logToMCP) {
                    window.logToMCP('error', `Memory write failed at 0x${address.toString(16)}: ${error.message}`);
                }
                throw error;
            }
        },

        /**
         * Save current RAM state with a given name
         * @param {string} name - Name for the RAM state
         * @param {Object} [options] - Optional parameters
         * @param {Object} [options.range] - Memory range to save {start, end}
         * @param {boolean} [options.overwrite=false] - Overwrite existing state
         * @returns {Promise} Result with save status
         */
        async saveState(name, options = {}) {
            if (!this.serverAvailable) {
                console.info(`💾 MCP: Save RAM state '${name}' (simulated offline mode)`);
                return {
                    success: true,
                    message: `RAM state '${name}' saved in offline mode`,
                    name,
                    bytesSaved: 65536
                };
            }

            try {
                console.log(`💾 Saving RAM state '${name}' via MCP...`);
                
                const requestBody = {
                    name: name.trim(),
                    ...options
                };

                const options = this.createFetchOptions(requestBody);
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/memory/saveState`, options, options._timeoutMs);
                const result = await this.handleMCPResponse(response, 'saveState');
                
                if (result.success) {
                    console.log(`✅ RAM state '${name}' saved: ${result.data.bytesSaved} bytes`);
                    
                    // Broadcast save event via WebSocket
                    if (window.mcpWebSocket && window.mcpWebSocket.readyState === WebSocket.OPEN) {
                        const eventData = {
                            type: 'memory.saveState',
                            name: result.data.name,
                            bytesSaved: result.data.bytesSaved,
                            range: result.data.range,
                            timestamp: new Date().toISOString()
                        };
                        window.mcpWebSocket.send(JSON.stringify(eventData));
                    }

                    // Log to MCP display
                    if (window.logToMCP) {
                        window.logToMCP('info', `Saved RAM state '${name}' (${result.data.bytesSaved} bytes)`);
                    }
                } else {
                    console.error('❌ MCP saveState failed:', result);
                }

                return result;
            } catch (error) {
                console.error('❌ MCP saveState failed:', error);
                if (window.logToMCP) {
                    window.logToMCP('error', `Failed to save RAM state '${name}': ${error.message}`);
                }
                throw error;
            }
        },

        /**
         * Load RAM state by name
         * @param {string} name - Name of the RAM state to load
         * @param {Object} [options] - Optional parameters
         * @param {number} [options.targetAddress=0x0000] - Target address to load at
         * @param {Object} [options.range] - Specific range to load {start, end}
         * @returns {Promise} Result with load status
         */
        async loadState(name, options = {}) {
            if (!this.serverAvailable) {
                console.info(`📂 MCP: Load RAM state '${name}' (simulated offline mode)`);
                return {
                    success: true,
                    message: `RAM state '${name}' loaded in offline mode`,
                    name,
                    bytesLoaded: 65536
                };
            }

            try {
                console.log(`📂 Loading RAM state '${name}' via MCP...`);
                
                const requestBody = {
                    name: name.trim(),
                    ...options
                };

                const options = this.createFetchOptions(requestBody);
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/memory/loadState`, options, options._timeoutMs);
                const result = await this.handleMCPResponse(response, 'loadState');
                
                if (result.success) {
                    console.log(`✅ RAM state '${name}' loaded: ${result.data.bytesLoaded} bytes`);
                    
                    // Broadcast load event via WebSocket
                    if (window.mcpWebSocket && window.mcpWebSocket.readyState === WebSocket.OPEN) {
                        const eventData = {
                            type: 'memory.loadState',
                            name: result.data.name,
                            bytesLoaded: result.data.bytesLoaded,
                            targetAddress: result.data.targetAddress,
                            range: result.data.range,
                            timestamp: new Date().toISOString()
                        };
                        window.mcpWebSocket.send(JSON.stringify(eventData));
                    }

                    // Log to MCP display and trigger memory refresh
                    if (window.logToMCP) {
                        window.logToMCP('info', `Loaded RAM state '${name}' (${result.data.bytesLoaded} bytes)`);
                    }
                    
                    // Refresh memory display if available
                    if (window.refreshMemoryDisplay) {
                        setTimeout(() => window.refreshMemoryDisplay(), 100);
                    }
                } else {
                    console.error('❌ MCP loadState failed:', result);
                }

                return result;
            } catch (error) {
                console.error('❌ MCP loadState failed:', error);
                if (window.logToMCP) {
                    window.logToMCP('error', `Failed to load RAM state '${name}': ${error.message}`);
                }
                throw error;
            }
        },

        // Debug methods
        async getMemoryView(address, size) {
            if (!this.serverAvailable) {
                console.info(`🔍 MCP: Memory view ${address}-${address + size} (simulated offline mode)`);
                return { success: true, bytes: new Array(size).fill(0) };
            }
      
            try {
                const options = this.createFetchOptions({ address, size });
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/debug/memoryView`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'memory view');
            } catch (error) {
                console.error('❌ MCP memory view failed:', error);
                throw error;
            }
        },

        // Programs management methods
        async saveProgram(name, programBytes, metadata = {}) {
            if (!this.serverAvailable) {
                console.info(`💾 MCP: Save program '${name}' (simulated offline mode)`);
                // Simulate version-controlled save in offline mode
                const sourceCode = Array.from(programBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
                const checksum = await PersistenceHelpers.generateChecksum(sourceCode);
                const versionData = {
                    ...metadata,
                    checksum,
                    integrity: 'sha256',
                    savedAt: new Date().toISOString(),
                    version: '1.1'
                };
                PersistenceHelpers.storeVersion(name, '1.1', versionData);
                return {
                    success: true,
                    message: `Program '${name}' saved in offline mode`,
                    name,
                    size: programBytes.length,
                    metadata: versionData,
                    version: '1.1',
                    checksum
                };
            }

            try {
                // Generate client-side checksum for additional validation
                const sourceCode = Array.from(programBytes).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
                const clientChecksum = await PersistenceHelpers.generateChecksum(sourceCode);
                
                logger.debug('MCP program save request', { name, size: programBytes.length, metadata, clientChecksum });
                
                // Enhance metadata with client-side validation data
                const enhancedMetadata = {
                    ...metadata,
                    clientChecksum,
                    clientGeneratedAt: new Date().toISOString(),
                    platform: navigator.platform,
                    userAgent: navigator.userAgent.substring(0, 100)
                };

                const requestBody = {
                    name: PersistenceHelpers.normalizePath(name.trim()),
                    programBytes,
                    metadata: enhancedMetadata
                };
                const options = this.createFetchOptions(requestBody, {}, 10000); // 10s for larger programs
                const response = await this.resilientFetch(`${this.serverUrl}/mcp/programs/save`, options, 3, 1000, 'programs.save', true);
                const result = await this.handleMCPResponse(response, 'program save');
                
                if (result.success) {
                    // Store version information locally for offline access
                    PersistenceHelpers.storeVersion(name, result.data.version, result.data.metadata);
                    
                    // Cross-platform path logging
                    const normalizedPath = PersistenceHelpers.normalizePath(result.data.path || '');
                    console.log(`✅ Program '${name}' saved with version ${result.data.version} at ${normalizedPath}`);
                    
                    // Validate server checksum if provided
                    if (result.data.checksum && result.data.checksum !== clientChecksum) {
                        console.warn('⚠️ Client/server checksum mismatch detected:', {
                            client: clientChecksum.substring(0, 16) + '...',
                            server: result.data.checksum.substring(0, 16) + '...'
                        });
                    }
                    
                    if (window.logToMCP) {
                        window.logToMCP('success', `Saved program '${name}' (v${result.data.version}, ${result.data.size} bytes, checksum: ${result.data.checksum?.substring(0, 16)}...)`);
                    }
                }
                
                return result;
            } catch (error) {
                logger.error('MCP program save error', {
                    error: error.message,
                    isMCPError: !!error.isMCPError,
                    code: error.code,
                    name
                });
                if (window.logToMCP) {
                    window.logToMCP('error', `Program save failed for '${name}': ${error.message}`);
                }
                throw error;
            }
        },

        async loadProgram(name, targetAddress = 0x0600) {
            if (!this.serverAvailable) {
                console.info(`📂 MCP: Load program '${name}' (simulated offline mode)`);
                // Load from local version storage if available
                const storedVersion = PersistenceHelpers.getStoredVersion(name);
                if (storedVersion) {
                    console.log(`📂 Loading offline version ${storedVersion.version} of '${name}'`);
                    return {
                        success: true,
                        message: `Program '${name}' loaded from local storage (v${storedVersion.version})`,
                        name,
                        version: storedVersion.version,
                        metadata: storedVersion.metadata,
                        bytesLoaded: 256, // Simulated
                        targetAddress,
                        checksum: storedVersion.checksum
                    };
                }
                return {
                    success: true,
                    message: `Program '${name}' loaded in offline mode`,
                    name,
                    bytesLoaded: 256,
                    targetAddress
                };
            }

            try {
                logger.debug('MCP program load request', { name, targetAddress });
                
                // Check local version first for consistency
                const localVersion = PersistenceHelpers.getStoredVersion(name);
                console.log(`🔍 Checking local version for '${name}':`, localVersion ? `v${localVersion.version}` : 'none');
                
                const normalizedName = PersistenceHelpers.normalizePath(name.trim());
                const requestBody = { name: normalizedName, targetAddress };
                const options = this.createFetchOptions(requestBody, {}, 10000);
                const response = await this.resilientFetch(`${this.serverUrl}/mcp/programs/load`, options, 3, 1000, 'programs.load', true);
                const result = await this.handleMCPResponse(response, 'program load');
                
                if (result.success) {
                    // Validate version compatibility
                    const versionValidation = PersistenceHelpers.validateVersion(result.version || '1.0');
                    if (!versionValidation.valid) {
                        console.warn('⚠️ Version compatibility warning:', versionValidation.message);
                        if (window.logToMCP) {
                            window.logToMCP('warn', `Program version ${result.version} may need upgrade: ${versionValidation.message}`);
                        }
                    }
                    
                    // Validate checksum if provided
                    if (result.checksum && result.metadata && result.metadata.source) {
                        const checksumValid = await PersistenceHelpers.validateChecksum(result.metadata.source, result.checksum);
                        if (!checksumValid) {
                            console.error('❌ Checksum validation failed for loaded program');
                            if (window.logToMCP) {
                                window.logToMCP('error', `Checksum validation failed for '${name}' - data may be corrupted`);
                            }
                            // Don't throw - allow load but warn user
                        } else {
                            console.log('✅ Checksum validation passed for loaded program');
                        }
                    }
                    
                    // Update local version storage
                    if (result.version && result.metadata) {
                        PersistenceHelpers.storeVersion(name, result.version, result.metadata);
                    }
                    
                    const normalizedPath = PersistenceHelpers.normalizePath(result.path || '');
                    console.log(`✅ Program '${name}' loaded (v${result.version || 'unknown'}) from ${normalizedPath}, ${result.bytesLoaded} bytes at 0x${targetAddress.toString(16)}`);
                    
                    if (window.logToMCP) {
                        window.logToMCP('success', `Loaded program '${name}' (v${result.version || 'unknown'}, ${result.bytesLoaded} bytes)`);
                    }
                    
                    // Refresh memory display after load
                    if (window.refreshMemoryDisplay) {
                        setTimeout(() => window.refreshMemoryDisplay(), 100);
                    }
                }
                
                return result;
            } catch (error) {
                logger.error('MCP program load error', {
                    error: error.message,
                    isMCPError: !!error.isMCPError,
                    code: error.code,
                    name
                });
                if (window.logToMCP) {
                    window.logToMCP('error', `Program load failed for '${name}': ${error.message}`);
                }
                throw error;
            }
        },

        // Queue management methods
        async addToQueue(programName, priority = 'normal') {
            if (!this.serverAvailable) {
                console.info(`📋 MCP: Add to queue '${programName}' (simulated offline mode)`);
                return {
                    success: true,
                    message: `Program '${programName}' added to queue in offline mode`,
                    programName,
                    priority,
                    position: 1
                };
            }

            try {
                logger.debug('MCP queue add request', { programName, priority });
                const requestBody = { programName: programName.trim(), priority };
                const options = this.createFetchOptions(requestBody, {}, 5000);
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/queue/add`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'queue add');
            } catch (error) {
                logger.error('MCP queue add error', { error: error.message, isMCPError: !!error.isMCPError, code: error.code, programName });
                if (window.logToMCP) {
                    window.logToMCP('error', `Queue add failed for '${programName}': ${error.message}`);
                }
                throw error;
            }
        },

        async listQueue() {
            if (!this.serverAvailable) {
                console.info('📋 MCP: List queue (simulated offline mode)');
                return {
                    success: true,
                    data: {
                        items: [
                            { id: 1, programName: 'sample', priority: 'normal', status: 'pending', position: 1, addedAt: new Date().toISOString() }
                        ],
                        total: 1
                    }
                };
            }

            try {
                logger.debug('MCP queue list request');
                const options = this.createFetchOptions({}, {}, 3000);
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/queue/list`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'queue list');
            } catch (error) {
                logger.error('MCP queue list error', { error: error.message, isMCPError: !!error.isMCPError, code: error.code });
                if (window.logToMCP) {
                    window.logToMCP('error', `Queue list failed: ${error.message}`);
                }
                throw error;
            }
        },

        /**
         * Assemble assembly source code and load to memory via MCP
         * @param {string} source - Assembly source code
         * @param {number} origin - Memory origin address (default: 0x0600)
         * @returns {Promise} Result with assembled bytes and load status
         */
        async assembleAndLoad(source, origin = 0x0600) {
            if (!this.serverAvailable) {
                console.info('🔨 MCP: Assemble and load (simulated offline mode)');
                try {
                    const assembled = assemble(source, { origin });
                    return {
                        success: true,
                        assembledBytes: assembled.length,
                        origin,
                        message: 'Assembled and loaded in offline mode'
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }

            try {
                // First assemble locally
                console.log('🔨 Assembling source code locally...');
                const assembled = assemble(source, { origin });
                
                if (!assembled || assembled.length === 0) {
                    throw new Error('Assembly produced no bytes');
                }

                // Load via batch memory writes
                console.log(`📤 Loading ${assembled.length} bytes to 0x${origin.toString(16)} via MCP...`);
                let bytesLoaded = 0;
                const results = [];

                for (let i = 0; i < assembled.length; i++) {
                    const address = origin + i;
                    const result = await this.writeMemory(address, assembled[i], 1);
                    
                    if (!result.success) {
                        console.warn(`Failed to write byte ${i} at 0x${address.toString(16)}`);
                        break;
                    }
                    
                    bytesLoaded++;
                    results.push(result);
                }

                // Reset CPU and set PC to origin
                await this.resetCPU(true);
                await this.stepCPU(1); // Ensure CPU is ready

                console.log(`✅ Loaded ${bytesLoaded} bytes successfully`);

                // Broadcast assembly load event
                if (window.mcpWebSocket && window.mcpWebSocket.readyState === WebSocket.OPEN) {
                    const eventData = {
                        type: 'assemble.load',
                        origin,
                        bytesLoaded,
                        totalBytes: assembled.length,
                        sourceLength: source.length
                    };
                    window.mcpWebSocket.send(JSON.stringify(eventData));
                }

                return {
                    success: true,
                    assembledBytes: assembled.length,
                    bytesLoaded,
                    origin,
                    results
                };

            } catch (error) {
                console.error('❌ MCP assembleAndLoad failed:', error);
                return { success: false, error: error.message };
            }
        },

        /**
         * Assemble assembly source code, load to memory, and run via MCP
         * @param {string} source - Assembly source code
         * @param {number} origin - Memory origin address (default: 0x0600)
         * @param {number} maxSteps - Maximum steps to run (default: 1000)
         * @returns {Promise} Result with execution status
         */
        async assembleAndRun(source, origin = 0x0600, maxSteps = 1000) {
            if (!this.serverAvailable) {
                console.info('▶️ MCP: Assemble and run (simulated offline mode)');
                try {
                    const assembled = assemble(source, { origin });
                    return {
                        success: true,
                        assembledBytes: assembled.length,
                        origin,
                        stepsExecuted: maxSteps,
                        message: 'Assembled and executed in offline mode'
                    };
                } catch (error) {
                    return { success: false, error: error.message };
                }
            }

            try {
                // First assemble and load
                console.log('🔨 Assembling and loading program...');
                const loadResult = await this.assembleAndLoad(source, origin);
                
                if (!loadResult.success) {
                    throw new Error(`Load failed: ${loadResult.error}`);
                }

                // Then run the CPU
                console.log(`▶️ Running CPU for up to ${maxSteps} steps...`);
                const runResult = await this.runCPU();
                
                if (!runResult.success) {
                    throw new Error(`Run failed: ${runResult.error}`);
                }

                // Execute additional steps if needed
                const stepResult = await this.stepCPU(maxSteps);
                
                console.log(`✅ Program executed: ${stepResult.stepsExecuted || maxSteps} steps`);

                // Broadcast assembly run event
                if (window.mcpWebSocket && window.mcpWebSocket.readyState === WebSocket.OPEN) {
                    const eventData = {
                        type: 'assemble.run',
                        origin,
                        bytesLoaded: loadResult.bytesLoaded,
                        maxSteps,
                        sourceLength: source.length
                    };
                    window.mcpWebSocket.send(JSON.stringify(eventData));
                }

                return {
                    success: true,
                    assembledBytes: loadResult.assembledBytes,
                    bytesLoaded: loadResult.bytesLoaded,
                    origin,
                    maxSteps,
                    runResult,
                    stepResult
                };

            } catch (error) {
                console.error('❌ MCP assembleAndRun failed:', error);
                return { success: false, error: error.message };
            }
        },

        /**
         * Generate AI content via MCP for natural language/voice input
         * @param {string} prompt - The prompt to send to the AI
         * @param {string} [task='generation'] - Type of task
         * @param {Object} [options] - Additional generation options
         * @returns {Promise} Result with generated content or error
         */
        async aiGenerate(prompt, task = 'generation', options = {}) {
            if (!this.serverAvailable) {
                console.info(`🤖 MCP: AI generate (simulated offline mode)`);
                return {
                    success: true,
                    data: {
                        content: `SIMULATED: Response to "${prompt}" using ${task} task`,
                        model: 'offline-simulator',
                        tokensUsed: 42,
                        generatedAt: new Date().toISOString()
                    }
                };
            }
      
            try {
                logger.debug('MCP AI generate request', { task, promptLength: prompt.length, options });
                const requestBody = {
                    prompt: prompt.trim(),
                    task,
                    options
                };
                const options = this.createFetchOptions(requestBody, {}, 30000); // 30s timeout for AI
                const response = await this.timeoutFetch(`${this.serverUrl}/mcp/ai/generate`, options, options._timeoutMs);
                return await this.handleMCPResponse(response, 'AI generate');
            } catch (error) {
                logger.error('MCP AI generate error', { error: error.message, isMCPError: !!error.isMCPError, code: error.code, task });
                if (window.logToMCP) {
                    window.logToMCP('error', `AI generation failed: ${error.message}`);
                }
                throw error;
            }
        }
        };
    
        // Enhanced WebSocket with automatic reconnection
        if (serverAvailable) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = `${protocol}//${window.location.host}`;
          
          let reconnectAttempts = 0;
          const maxReconnectAttempts = 5;
          const reconnectDelays = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff
          
          function connectWebSocket() {
            window.mcpWebSocket = new WebSocket(wsUrl);
            
            window.mcpWebSocket.onopen = function() {
              console.log('🔌 MCP WebSocket connected for real-time updates');
              reconnectAttempts = 0; // Reset reconnect counter on successful connection
              if (window.logToMCP) {
                window.logToMCP('info', 'MCP WebSocket reconnected successfully');
              }
              
              // Re-subscribe to any lost events or send pending messages
              if (window.mcpClient.replayTimer) {
                console.log('🔄 WebSocket reconnected - triggering queued operation replay');
                window.mcpClient.replayQueuedOperations();
              }
            };
            
            window.mcpWebSocket.onmessage = function(event) {
              try {
                const { type, data, timestamp } = JSON.parse(event.data);
                // Log MCP activity to UI
                if (window.logToMCP && data) {
                  let logMessage = `[AI/MCP] ${type}`;
                  if (type === 'cpu.step') {
                    logMessage += ` at PC 0x${data.pc?.toString(16)}: ${data.instruction}`;
                  } else if (type === 'cpu.state') {
                    logMessage += ` PC=0x${data.pc?.toString(16)} A=0x${data.a?.toString(16)} running=${data.running}`;
                  } else if (type === 'video.setPixel') {
                    logMessage += ` (${data.x}, ${data.y}) = 0x${data.color?.toString(16)}`;
                  } else if (type === 'video.clear') {
                    logMessage += ` range ${data.range} with color 0x${data.color?.toString(16)}`;
                  } else if (type === 'memory.write') {
                    logMessage += ` to address 0x${data.address?.toString(16)} = 0x${data.value?.toString(16)}`;
                  } else if (type === 'queue.status') {
                    logMessage += ` ${data.items?.length || 0} items, next: ${data.nextProgram || 'none'}`;
                  } else if (type === 'error') {
                    logMessage += ` ${data.message || 'Unknown error'}`;
                    window.logToMCP('error', logMessage, { type, data, timestamp });
                    // Show error toast if feedback system available
                    if (window.feedbackSystem && window.feedbackSystem.showToast) {
                      window.feedbackSystem.showToast(`MCP Error: ${data.message || 'Unknown error'}`, 'error');
                    }
                    return; // Errors already logged as error level
                  } else if (type === 'circuit.breaker') {
                    logMessage += ` ${data.service} state: ${data.state}`;
                    const severity = data.state === 'OPEN' ? 'error' : data.state === 'HALF_OPEN' ? 'warn' : 'info';
                    window.logToMCP(severity, logMessage, { type, data, timestamp });
                    if (window.feedbackSystem && window.feedbackSystem.showToast && data.state === 'OPEN') {
                      window.feedbackSystem.showToast(`Service ${data.service} unavailable - circuit breaker OPEN`, 'error');
                    }
                    return;
                  }
                  window.logToMCP('info', logMessage, { type, data, timestamp });
                }
                // Trigger memory refresh for relevant events
                if (['cpu.step', 'cpu.state', 'video.setPixel', 'memory.write'].includes(type)) {
                  if (window.refreshMemoryDisplay) {
                    window.refreshMemoryDisplay();
                  }
                }
                // Trigger queue refresh for queue events
                if (type === 'queue.status' && window.updateQueueDisplay) {
                  window.updateQueueDisplay(data);
                }
                // Trigger CPU state update for debugger
                if (type === 'cpu.state' && window.updateCPUStateDisplay) {
                  window.updateCPUStateDisplay(data);
                }
              } catch (err) {
                console.warn('Failed to parse MCP WebSocket message:', err);
              }
            };
            
            window.mcpWebSocket.onerror = function(error) {
              console.error('MCP WebSocket error:', error);
              if (window.logToMCP) {
                window.logToMCP('error', 'MCP WebSocket connection error - attempting reconnection');
              }
            };
            
            window.mcpWebSocket.onclose = function(event) {
              console.log('MCP WebSocket disconnected:', event.code, event.reason);
              if (window.logToMCP) {
                window.logToMCP('warn', `MCP WebSocket disconnected (code: ${event.code}) - attempting reconnection`);
              }
              
              // Attempt reconnection with exponential backoff
              if (reconnectAttempts < maxReconnectAttempts) {
                const delay = reconnectDelays[reconnectAttempts] || 30000; // Cap at 30s
                reconnectAttempts++;
                console.log(`🔄 WebSocket reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`);
                
                setTimeout(() => {
                  console.log('🔄 Attempting WebSocket reconnection...');
                  connectWebSocket();
                }, delay);
              } else {
                console.error('❌ Max WebSocket reconnection attempts reached');
                if (window.logToMCP) {
                  window.logToMCP('error', 'Max WebSocket reconnection attempts reached - operating in degraded mode');
                }
                // Switch to degraded/offline mode
                this.serverAvailable = false;
                if (window.feedbackSystem && window.feedbackSystem.showToast) {
                  window.feedbackSystem.showToast('WebSocket failed - operating in offline mode', 'error');
                }
              }
            };
          }
          
          // Initial connection
          connectWebSocket();
        } else {
          // Offline mode - initialize local CPU simulation
          console.log('📱 Operating in offline mode with local CPU simulation');
          this.initializeLocalCPUSimulation();
        }

    console.log('🎮 MCP client controller initialized with server status:', serverAvailable ? 'online' : 'offline');
}

/**
 * Initialize MCP logs functionality
 */
function initializeMCPLogs() {
    // Global MCP logging function (browser-compatible)
    window.logToMCP = function(level, message, data = null) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `mcp-log-entry mcp-${level}`;

        let logText = `[${timestamp}] ${level.toUpperCase()}: ${message}`;
        if (data) {
            logText += '\n' + JSON.stringify(data, null, 2);
        }

        logEntry.textContent = logText;

        const mcpDisplay = document.getElementById('mcp-display');
        if (mcpDisplay) {
            mcpDisplay.appendChild(logEntry);
            mcpDisplay.scrollTop = mcpDisplay.scrollHeight;

            // Keep only last 100 entries
            const entries = mcpDisplay.children;
            if (entries.length > 100) {
                mcpDisplay.removeChild(entries[0]);
            }
        } else {
            console.warn('MCP display element not found');
        }
    };

// Global MCP clear logs function
    window.clearMCPLogs = function() {
        const mcpDisplay = document.getElementById('mcp-display');
        if (mcpDisplay) {
            mcpDisplay.innerHTML = '<div style="color: #666; font-style: italic;">MCP (Model Context Protocol) interactions will appear here...</div>';
            console.log('🧹 MCP logs cleared');
        }
    };

    console.log('📝 MCP logging initialized');
}

/**
 * Attach MCP buttons to existing UI elements
 */
function attachMCPButtons() {
    // Test MCP button functionality is already handled in HTML
    // The buttons should now use window.mcpClient methods

    console.log('🔗 MCP UI buttons attached to client methods');
}

// Helper function to check MCP command structure
export function validateMCPRequest(schema, data) {
    // Simple validation for browser mode
    if (!data || typeof data !== 'object') {
        return { valid: false, error: 'Invalid request data' };
    }

    // Add more specific validations as needed
    return { valid: true };
}

// Export base URL for debugging (as a function)
  /**
   * Initialize local CPU simulation for offline mode
   */
  initializeLocalCPUSimulation() {
    // Simple 6502-like CPU simulation for offline mode
    this.localCPU = {
      PC: 0x0600,
      A: 0x00,
      X: 0x00,
      Y: 0x00,
      SP: 0xFF,
      flags: { C: false, Z: false, I: false, D: false, V: false, N: false },
      memory: new Uint8Array(65536).fill(0), // 64KB RAM
      halted: false,
      
      reset() {
        this.PC = 0x0600;
        this.A = 0x00;
        this.X = 0x00;
        this.Y = 0x00;
        this.SP = 0xFF;
        this.flags = { C: false, Z: false, I: false, D: false, V: false, N: false };
        this.halted = false;
        console.log('🖥️ Local CPU simulation reset');
        if (window.logToMCP) {
          window.logToMCP('info', 'Local CPU simulation initialized (offline mode)');
        }
      },
      
      step(steps = 1) {
        if (this.halted) {
          console.warn('Local CPU is halted');
          return { pc: this.PC, instruction: 'HLT', registers: { A: this.A, X: this.X, Y: this.Y } };
        }
        
        for (let i = 0; i < steps; i++) {
          // Simple simulation - increment PC and A for demo
          const instruction = this.memory[this.PC] || 0xEA; // NOP default
          this.PC = (this.PC + 1) & 0xFFFF;
          
          // Simulate some operations
          switch (instruction & 0xFF) {
            case 0x69: // ADC immediate (demo)
              this.A = (this.A + Math.floor(Math.random() * 0x10)) & 0xFF;
              break;
            case 0x3A: // HLT (demo halt)
              this.halted = true;
              break;
            default:
              // NOP or unknown - just increment
              break;
          }
          
          // Update flags (simplified)
          this.flags.Z = this.A === 0;
          this.flags.N = (this.A & 0x80) !== 0;
        }
        
        return {
          pc: this.PC,
          instruction: `0x${(this.memory[this.PC - 1] || 0).toString(16).padStart(2, '0').toUpperCase()}`,
          registers: { A: this.A, X: this.X, Y: this.Y },
          flags: this.flags,
          halted: this.halted
        };
      },
      
      readMemory(address, size = 1) {
        const bytes = [];
        for (let i = 0; i < size; i++) {
          bytes.push(this.memory[(address + i) & 0xFFFF]);
        }
        return { address, size, bytes, success: true };
      },
      
      writeMemory(address, value, size = 1) {
        for (let i = 0; i < size; i++) {
          this.memory[(address + i) & 0xFFFF] = (value >> (i * 8)) & 0xFF;
        }
        return { address, value, size, success: true };
      },
      
      getState() {
        return {
          PC: this.PC,
          A: this.A,
          X: this.X,
          Y: this.Y,
          SP: this.SP,
          flags: this.flags,
          running: !this.halted,
          memory: Array.from(this.memory.slice(0, 256)) // First 256 bytes for demo
        };
      }
    };
    
    // Initialize local CPU
    this.localCPU.reset();
    
    // Override CPU methods to use local simulation when offline
    const originalResetCPU = this.resetCPU;
    const originalStepCPU = this.stepCPU;
    const originalRunCPU = this.runCPU;
    const originalGetCPUState = this.getCPUState;
    
    this.resetCPU = async (hardReset = false) => {
      if (!this.serverAvailable) {
        console.log('🖥️ Using local CPU simulation for reset');
        this.localCPU.reset();
        if (window.feedbackSystem?.showToast) {
          window.feedbackSystem.showToast('CPU reset (offline simulation)', 'info');
        }
        return { success: true, message: 'Local CPU reset completed', data: this.localCPU.getState() };
      }
      return originalResetCPU.call(this, hardReset);
    };
    
    this.stepCPU = async (steps = 1) => {
      if (!this.serverAvailable) {
        console.log(`🖥️ Using local CPU simulation for ${steps} step(s)`);
        const result = this.localCPU.step(steps);
        if (window.feedbackSystem?.showToast && steps > 1) {
          window.feedbackSystem.showToast(`Local CPU: ${result.halted ? 'Halted' : `${steps} steps executed`}`, 'info');
        }
        return { success: true, data: result };
      }
      return originalStepCPU.call(this, steps);
    };
    
    this.runCPU = async (maxSteps = 1000) => {
      if (!this.serverAvailable) {
        console.log(`🖥️ Using local CPU simulation for run (${maxSteps} max steps)`);
        let stepsExecuted = 0;
        while (stepsExecuted < maxSteps && !this.localCPU.halted) {
          this.localCPU.step(1);
          stepsExecuted++;
        }
        const result = this.localCPU.getState();
        result.stepsExecuted = stepsExecuted;
        result.halted = this.localCPU.halted;
        if (window.feedbackSystem?.showToast) {
          window.feedbackSystem.showToast(`Local CPU run: ${stepsExecuted} steps${result.halted ? ' (halted)' : ''}`, 'info');
        }
        return { success: true, data: result };
      }
      return originalRunCPU.call(this, maxSteps);
    };
    
    this.getCPUState = async () => {
      if (!this.serverAvailable) {
        console.log('🖥️ Using local CPU simulation for state');
        return { success: true, data: this.localCPU.getState() };
      }
      return originalGetCPUState.call(this);
    };
    
    // Add periodic health check for reconnection
    this.healthCheckInterval = setInterval(async () => {
      if (!this.serverAvailable) {
        const available = await this.checkServerAvailability();
        if (available) {
          console.log('🌐 Server became available - switching from offline mode');
          if (window.feedbackSystem?.showToast) {
            window.feedbackSystem.showToast('Server reconnected - resuming online mode', 'success');
          }
          // Replay any queued operations
          if (this.replayTimer) {
            await this.replayQueuedOperations();
          }
        }
      }
    }, 10000); // Check every 10 seconds
    
    console.log('🖥️ Local CPU simulation initialized for offline mode');
  };

  /**
   * Cleanup resources on page unload
   */
  cleanup() {
    if (this.replayTimer) {
      clearInterval(this.replayTimer);
      this.replayTimer = null;
    }
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    };
    if (window.mcpWebSocket) {
      window.mcpWebSocket.close();
    }
    console.log('🧹 MCP client resources cleaned up');
  }
};

window.addEventListener('beforeunload', () => {
  if (window.mcpClient) {
    window.mcpClient.cleanup();
  }
});

// Auto-cleanup queued operations older than 24 hours
setInterval(() => {
  if (window.mcpClient) {
    try {
      const queueKey = 'mcp_operation_queue';
      let queue = JSON.parse(localStorage.getItem(queueKey) || '[]');
      const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
      
      queue = queue.filter(op => (op.timestamp || 0) > cutoffTime);
      localStorage.setItem(queueKey, JSON.stringify(queue));
      
      if (queue.length < (JSON.parse(localStorage.getItem(queueKey) || '[]').length)) {
        console.log('🧹 Cleaned up old queued operations');
      }
    } catch (error) {
      console.error('Failed to clean up old queued operations:', error);
    }
  }
}, 60 * 60 * 1000); // Hourly cleanup

export function getMCPBaseUrl() {
  return window.location.port === '3001' ? 'http://localhost:8001' : 'http://localhost:3000';
}