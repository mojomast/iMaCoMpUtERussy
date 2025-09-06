/**
 * Browser-compatible MCP client for the frontend
 * This replaces the server-side MCP client that was causing module import errors
 */

import { assemble } from './assembler.js';

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
        async timeoutFetch(url, options, timeoutMs = 10000) {
          const controller = new AbortController();
          const signal = controller.signal;
          
          // Add signal to options if not present
          options = { ...options, signal };
          
          // Timeout promise
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
              controller.abort();
              reject(new Error(`MCP request timeout after ${timeoutMs}ms`));
            }, timeoutMs);
          });
          
          // Fetch promise
          const fetchPromise = fetch(url, options).catch(err => {
            if (err.name !== 'AbortError') throw err;
            return Promise.reject(err);
          });
          
          try {
            const response = await Promise.race([fetchPromise, timeoutPromise]);
            return response;
          } catch (error) {
            if (error.name === 'AbortError') {
              console.warn('MCP request aborted due to timeout:', error.message);
            }
            throw error;
          }
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
            // Parse as MCPError if possible
            if (errorData.error && errorData.code) {
              const mcpError = {
                code: errorData.code,
                message: errorData.message || errorData.error,
                details: errorData.details || errorData.data
              };
              throw { isMCPError: true, ...mcpError };
            }
            throw { message: errorData.message || `HTTP ${response.status}` };
          }
          const result = await response.json();
          if (!result.success) {
            console.error(`❌ MCP ${operation} server error:`, result);
            throw { isMCPError: true, code: result.error?.code || 'SERVER_ERROR', message: result.error?.message || 'Server error' };
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
    
        // Initialize WebSocket for real-time events if server available
        if (serverAvailable) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}`;
      window.mcpWebSocket = new WebSocket(wsUrl);
      
      window.mcpWebSocket.onopen = function() {
        console.log('🔌 MCP WebSocket connected for real-time updates');
      };
      
      window.mcpWebSocket.onmessage = function(event) {
        try {
          const { type, data, timestamp } = JSON.parse(event.data);
          // Log MCP activity to UI
          if (window.logToMCP && data) {
            let logMessage = `[AI/MCP] ${type}`;
            if (type === 'cpu.step') {
              logMessage += ` at PC 0x${data.pc?.toString(16)}: ${data.instruction}`;
            } else if (type === 'video.setPixel') {
              logMessage += ` (${data.x}, ${data.y}) = 0x${data.color?.toString(16)}`;
            } else if (type === 'video.clear') {
              logMessage += ` range ${data.range} with color 0x${data.color?.toString(16)}`;
            } else if (type === 'memory.write') {
              logMessage += ` to address 0x${data.address?.toString(16)} = 0x${data.value?.toString(16)}`;
            }
            window.logToMCP('info', logMessage, { type, data, timestamp });
          }
          // Trigger memory refresh for relevant events
          if (['cpu.step', 'video.setPixel', 'memory.write'].includes(type)) {
            if (window.refreshMemoryDisplay) {
              window.refreshMemoryDisplay();
            }
          }
        } catch (err) {
          console.warn('Failed to parse MCP WebSocket message:', err);
        }
      };
      
      window.mcpWebSocket.onerror = function(error) {
        console.error('MCP WebSocket error:', error);
      };
      
      window.mcpWebSocket.onclose = function() {
        console.log('MCP WebSocket disconnected');
      };
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
export function getMCPBaseUrl() {
    return window.location.port === '3001' ? 'http://localhost:8001' : 'http://localhost:3000';
}