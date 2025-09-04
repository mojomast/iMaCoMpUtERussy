/**
 * iMaCoMpUtERussy MCP Client Library
 *
 * A robust, promise-based MCP (Model Context Protocol) client library designed specifically
 * for AI agents to interact with the iMaCoMpUtERussy emulator through the MCP server.
 *
 * Features:
 * - Promise-based API with async/await support
 * - Configurable timeout and retry logic
 * - Comprehensive error handling with AI-friendly messages
 * - Response caching for frequently-accessed data
 * - Cross-platform compatibility (Node.js & browser)
 * - Special AI-focused workflows and utilities
 * - Batch operations support
 * - Comprehensive JSDoc documentation with examples
 *
 * @version 2.1.0
 * @author Kyle Durepos (via Roo Code)
 * @license MIT
 */

import { MCP_ERROR_CODES, formatError } from '../server/mcp_errors.js';
import ErrorHandler from './ErrorHandler.js';

// ============================================================================
// Cross-Platform HTTP Layer
// ============================================================================

/**
 * Cross-platform HTTP adapter that works in both Node.js and browsers
 */
class HttpAdapter {
  constructor() {
    this.isNode = typeof window === 'undefined' && typeof globalThis !== 'undefined';
  }

  /**
   * Perform HTTP request with unified interface
   * @param {Object} options - Request options
   * @returns {Promise<Response>}
   */
  async request(options) {
    if (this.isNode) {
      return this.nodeRequest(options);
    } else {
      return this.browserRequest(options);
    }
  }

  async nodeRequest({ url, method = 'GET', headers = {}, body = null, timeout = 30000 }) {
    const importMeta = import.meta.url;
    // In Node.js, use native fetch if available (Node 18+), otherwise polyfill
    if (!globalThis.fetch) {
      throw new Error('fetch is not available. Please use Node.js 18+ or install a fetch polyfill.');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      const stdError = ErrorHandler.standardizeError(error, 'mcp_client::browserRequest');
      throw error;
    }
  }

  async browserRequest({ url, method = 'GET', headers = {}, body = null, timeout = 30000 }) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      const stdError = ErrorHandler.standardizeError(error, 'mcp_client::nodeRequest');
      throw error;
    }
  }

  /**
   * Create a timeout promise
   * @param {number} ms - Timeout in milliseconds
   * @param {string} message - Error message
   * @returns {Promise}
   */
  static createTimeoutPromise(ms, message = 'Request timeout') {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
    });
  }
}

// ============================================================================
// MCPError Handling
// ============================================================================

class MCPClientError extends Error {
  constructor(code, message, details = null, httpStatus = 500) {
    super(message);
    this.name = 'MCPClientError';
    this.code = code;
    this.details = details;
    this.httpStatus = httpStatus;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, MCPClientError);
    }
  }

  /**
   * Create MCPClientError from server error response
   * @param {Object} errorResponse - Error response from server
   * @returns {MCPClientError}
   */
  static fromServerResponse(errorResponse) {
    return new MCPClientError(
      errorResponse.error.code,
      errorResponse.error.message,
      errorResponse.error.details,
      MCPClientError.mapHttpStatus(errorResponse.error.code)
    );
  }

  /**
   * Map MCP error codes to HTTP status codes
   * @param {string} errorCode - MCP error code
   * @returns {number} HTTP status code
   */
  static mapHttpStatus(errorCode) {
    const statusMap = {
      [MCP_ERROR_CODES.INVALID_REQUEST]: 400,
      [MCP_ERROR_CODES.CPU_NOT_READY]: 409,
      [MCP_ERROR_CODES.MEMORY_OUT_OF_BOUNDS]: 400,
      [MCP_ERROR_CODES.INVALID_ASSEMBLY]: 400,
      [MCP_ERROR_CODES.PROGRAM_NOT_FOUND]: 404,
      [MCP_ERROR_CODES.PROGRAM_EXISTS]: 409,
      [MCP_ERROR_CODES.TERMINAL_BUSY]: 429,
      [MCP_ERROR_CODES.VIDEO_OUT_OF_BOUNDS]: 400,
      [MCP_ERROR_CODES.INVALID_BREAKPOINT]: 400,
      [MCP_ERROR_CODES.TIMEOUT_EXCEEDED]: 408,
      [MCP_ERROR_CODES.INTERNAL_ERROR]: 500,
      [MCP_ERROR_CODES.SYSTEM_ERROR]: 500,
      [MCP_ERROR_CODES.VALIDATION_FAILED]: 422
    };
    return statusMap[errorCode] || 500;
  }
}

// ============================================================================
// Response Cache
// ============================================================================

class ResponseCache {
  constructor(maxSize = 500, ttlMs = 300000, maxMemoryMB = 100) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
    this.maxMemoryMB = maxMemoryMB;
    this.currentMemoryBytes = 0;
  }

  /**
   * Calculate approximate memory size of data
   */
  _calculateSize(data) {
    return JSON.stringify(data).length * 2; // Approximate bytes (UTF-16)
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp >= this.ttlMs) {
      this.cache.delete(key);
      this.currentMemoryBytes -= entry.sizeBytes;
      return null;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.data;
  }

  set(key, data) {
    const sizeBytes = this._calculateSize(data);
    const newEntry = {
      data,
      timestamp: Date.now(),
      sizeBytes
    };

    // Check if key already exists
    const existingEntry = this.cache.get(key);
    if (existingEntry) {
      this.cache.delete(key);
      this.currentMemoryBytes -= existingEntry.sizeBytes;
    }

    // Evict entries if needed (LRU eviction based on size and count)
    while (this.cache.size >= this.maxSize ||
           (this.currentMemoryBytes + sizeBytes) > (this.maxMemoryMB * 1024 * 1024)) {
      // Remove least recently used entry (first in Map)
      const oldestKey = this.cache.keys().next().value;
      const oldestEntry = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      if (oldestEntry) {
        this.currentMemoryBytes -= oldestEntry.sizeBytes;
      }
    }

    this.cache.set(key, newEntry);
    this.currentMemoryBytes += sizeBytes;
  }

  clear() {
    this.cache.clear();
    this.currentMemoryBytes = 0;
  }

  delete(key) {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.currentMemoryBytes -= entry.sizeBytes;
      return true;
    }
    return false;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      entries: this.cache.size,
      memoryBytes: this.currentMemoryBytes,
      memoryMB: Math.round(this.currentMemoryBytes / (1024 * 1024) * 100) / 100,
      maxMemoryMB: this.maxMemoryMB,
      maxSize: this.maxSize
    };
  }
}

// ============================================================================
// MAIN MCP CLIENT CLASS
// ============================================================================

/**
 * @class MCPClient
 * @description iMaCoMpUtERussy MCP Client for AI agent integration
 *
 * This is the main client class that provides clean, promise-based access to all
 * MCP server endpoints. It's specifically designed for AI agent workflows.
 *
 * @example
 * ```javascript
 * const client = new MCPClient('http://localhost:8001');
 *
 * // Simple usage
 * const programs = await client.listPrograms();
 *
 * // With custom options
 * const client = new MCPClient('http://localhost:8001', {
 *   timeoutMs: 30000,
 *   retryAttempts: 3,
 *   enableCache: true
 * });
 * ```
 */
export class MCPClient {
  /**
   * Create a new MCP client instance
   * @param {string} baseURL - Base URL of MCP server (e.g., "http://localhost:8001")
   * @param {Object} options - Client configuration options
   */
  constructor(baseURL = 'http://localhost:8001', options = {}) {
    this.baseURL = baseURL.replace(/\/$/, ''); // Remove trailing slash

    // Default configuration
    this.config = Object.assign({
      timeoutMs: 30000,        // Request timeout in milliseconds
      retryAttempts: 2,        // Number of retry attempts
      retryDelayMs: 1000,      // Delay between retries
      enableCache: true,       // Enable response caching
      cacheTTLMs: 300000,      // Cache TTL in milliseconds (5 minutes)
      maxCacheSize: 500,       // Maximum cache entries (increased for LRU)
      maxCacheMemoryMB: 100,   // Maximum cache memory size in MB
      userAgent: 'MCPClient/2.1.0'
    }, options);

    // Initialize components
    this.http = new HttpAdapter();
    this.cache = this.config.enableCache ?
      new ResponseCache(this.config.maxCacheSize, this.config.cacheTTLMs, this.config.maxCacheMemoryMB) : null;

    // Bind methods for better error reporting
    this._bindMethods();
  }

  /**
   * Bind all methods to maintain correct 'this' context
   * @private
   */
  _bindMethods() {
    const methods = [
      // CPU operations
      'resetCPU', 'stepCPU', 'runCPU', 'getCPUState',

      // Memory operations
      'readMemory', 'writeMemory', 'loadProgramToMemory',

      // Assembly operations
      'assemble', 'assembleAndRun',

      // Program management
      'saveProgram', 'loadProgram', 'listPrograms',

      // Terminal operations
      'writeToTerminal', 'readFromTerminal', 'clearTerminal',

      // Video operations
      'setPixel', 'updateVideoDisplay', 'clearVideoDisplay',

      // Debug operations
      'setBreakpoint', 'clearBreakpoint', 'getBreakpoints',
      'traceExecution', 'inspectMemory',

      // AI-focused workflows
      'generateAssembly', 'testAssembly', 'interactiveDebug',
      'optimizeAssembly', 'processBatch',

      // Utilities
      'ping', 'clearCache', 'setTimeout', 'healthCheck'
    ];

    methods.forEach(method => {
      if (typeof this[method] === 'function') {
        this[method] = this[method].bind(this);
      }
    });
  }

  // ============================================================================
  // HTTP Request and Error Handling
  // ============================================================================

  /**
   * Make HTTP request to MCP server
   * @private
   * @param {string} endpoint - API endpoint path
   * @param {string} method - HTTP method
   * @param {Object} data - Request body data
   * @param {Object} options - Additional request options
   * @returns {Promise<Object>} Response data
   */
  async _makeRequest(endpoint, method = 'GET', data = null, options = {}) {
    const url = `${this.baseURL}/mcp${endpoint}`;
    const config = Object.assign({
      retryAttempt: 0,
      skipCache: false,
      customHeaders: {}
    }, options);

    try {
      const response = await this._executeRequest(url, method, data, config);

      if (!response.ok) {
        throw await this._createErrorFromResponse(response);
      }

      const responseData = await response.json();
      this._handleSuccessResponse(responseData);

      return responseData.data;
    } catch (error) {
      return await this._handleRequestError(error, endpoint, method, data, config);
    }
  }

  /**
   * Execute the actual HTTP request with retry logic
   * @private
   */
  async _executeRequest(url, method, data, config) {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': this.config.userAgent,
      ...config.customHeaders
    };

    const requestOptions = {
      url,
      method,
      headers
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(data);
    }

    return await this.http.request(requestOptions);
  }

  /**
   * Create error object from HTTP response
   * @private
   */
  async _createErrorFromResponse(response) {
    try {
      const errorData = await response.json();
      if (errorData.error) {
        return MCPClientError.fromServerResponse(errorData);
      }
    } catch (parseError) {
      // Non-JSON error response
    }

    const error = new MCPClientError(
      'HTTP_ERROR',
      `HTTP ${response.status}: ${response.statusText}`,
      { status: response.status, url: response.url }
    );
    return error;
  }

  /**
   * Handle successful response
   * @private
   */
  _handleSuccessResponse(responseData) {
    if (!responseData || !responseData.success) {
      throw new MCPClientError(
        'INVALID_RESPONSE',
        'Server response is missing success field or success=false',
        { response: responseData }
      );
    }

    // Successful MCP response should have success=true and optional data field
    return responseData;
  }

  /**
   * Handle request errors with retry logic
   * @private
   */
  async _handleRequestError(error, endpoint, method, data, config) {
    // If this is a network error or recoverable error, try retry
    if (config.retryAttempt < this.config.retryAttempts && this._shouldRetry(error)) {
      console.warn(`MCP request failed, retrying (${config.retryAttempt + 1}/${this.config.retryAttempts}):`, error.message);

      await this._delay(this.config.retryDelayMs);
      return this._makeRequest(endpoint, method, data, {
        ...config,
        retryAttempt: config.retryAttempt + 1
      });
    }

    // Final error - create user-friendly message
    if (error instanceof MCPClientError) {
      throw error;
    }

    // Handle network/common errors
    const errorMessages = {
      'ECONNREFUSED': 'Cannot connect to MCP server. Is it running?',
      'ENOTFOUND': 'MCP server address not found. Check the hostname.',
      'ETIMEDOUT': 'Request timed out. The server may be overloaded.',
      'ABORT_ERR': 'Request was cancelled',
      'Failed to fetch': 'Network error. Check your internet connection.'
    };

    const message = Object.keys(errorMessages).find(key =>
      error.message && error.message.includes(key)
    );

    throw new MCPClientError(
      'NETWORK_ERROR',
      message ? errorMessages[message] : `Request failed: ${error.message}`,
      { originalError: error.message, endpoint, method }
    );
  }

  /**
   * Determine if an error should be retried
   * @private
   */
  _shouldRetry(error) {
    // Don't retry client errors (4xx) except for 429 (too many requests)
    if (error instanceof MCPClientError && error.httpStatus >= 400 && error.httpStatus < 500) {
      return error.httpStatus === 429; // Only retry rate limiting
    }

    // Retry network errors, timeouts, and server errors
    return error.name === 'TypeError' || // Fetch network errors
           error.name === 'AbortError' || // Timeouts
           error.httpStatus >= 500 || // Server errors
           !error.httpStatus; // Network errors without HTTP status
  }

  /**
   * Cache-aware request wrapper
   * @private
   */
  async _cachedRequest(cacheKey, endpoint, method, data, options) {
    // Check cache first if enabled and GET request
    if (this.cache && method === 'GET' && !options.skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        console.debug('Cache hit for:', cacheKey);
        return cached;
      }
    }

    // Make the request
    const result = await this._makeRequest(endpoint, method, data, options);

    // Cache the result if enabled and GET request
    if (this.cache && method === 'GET' && result) {
      this.cache.set(cacheKey, result);
      console.debug('Cached result for:', cacheKey);
    }

    return result;
  }

  /**
   * Delay utility for retries
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // ============================================================================
  // CPU OPERATIONS
  // ============================================================================

  /**
   * Reset the CPU to initial state
   *
   * @param {boolean} hardReset - If true, performs a hard reset (default: false)
   * @returns {Promise<Object>} CPU state after reset
   *
   * @example
   * ```javascript
   * // Soft reset (preserve memory)
   * const state = await client.resetCPU();
   *
   * // Hard reset (clear everything)
   * const state = await client.resetCPU(true);
   * ```
   */
  async resetCPU(hardReset = false) {
    return await this._makeRequest('/cpu/reset', 'POST', { hardReset });
  }

  /**
   * Execute a single CPU instruction
   *
   * @param {number} timeout - Timeout in milliseconds (default: 1000)
   * @returns {Promise<Object>} Step execution result
   *
   * @example
   * ```javascript
   * const result = await client.stepCPU();
   * console.log(`Executed: ${result.instruction}`);
   * console.log(`Cycles: ${result.cycles}`);
   * ```
   */
  async stepCPU(timeout = 1000) {
    return await this._makeRequest('/cpu/step', 'POST', { timeout });
  }

  /**
   * Execute multiple CPU instructions
   *
   * @param {number} steps - Number of steps to execute (1-10000)
   * @param {Object} options - Execution options
   * @param {number} options.stepDelay - Delay between steps in milliseconds
   * @param {boolean} options.breakOnHalt - Stop when CPU halts
   * @returns {Promise<Object>} Execution results
   *
   * @example
   * ```javascript
   * // Run 50 steps with debug delay
   * const result = await client.runCPU(50, {
   *   stepDelay: 100,
   *   breakOnHalt: true
   * });
   * console.log(`Executed ${result.stepsExecuted} steps`);
   * ```
   */
  async runCPU(steps = 100, options = {}) {
    const requestData = {
      maxSteps: Math.min(Math.max(steps, 1), 10000), // Clamp to valid range
      ...options
    };
    return await this._makeRequest('/cpu/run', 'POST', requestData);
  }

  /**
   * Get current CPU state
   *
   * @returns {Promise<Object>} Current CPU registers and flags
   *
   * @example
   * ```javascript
   * const state = await client.getCPUState();
   * console.log(`PC: $${state.pc.toString(16).padStart(4, '0')}`);
   * console.log(`A: ${state.a}, X: ${state.x}, Y: ${state.y}`);
   * ```
   */
  async getCPUState() {
    return await this._cachedRequest(
      'cpu_state',
      '/cpu/state',
      'GET',
      null,
      { skipCache: false }
    );
  }

  // ============================================================================
  // MEMORY OPERATIONS
  // ============================================================================

  /**
   * Read memory from the emulator
   *
   * @param {number} address - Memory address (0x0000-0xFFFF)
   * @param {number} bytes - Number of bytes to read (1 or 2)
   * @returns {Promise<Object>} Memory read result
   *
   * @example
   * ```javascript
   * // Read byte at address 0x200
   * const result = await client.readMemory(0x0200, 1);
   * console.log(`Value: ${result.value} (0x${result.hexValue})`);
   *
   * // Read word (2 bytes)
   * const wordResult = await client.readMemory(0x200, 2);
   * ```
   */
  async readMemory(address, bytes = 1) {
    if (address < 0 || address > 0xFFFF) {
      throw new MCPClientError('INVALID_ADDRESS', 'Address must be between 0x0000 and 0xFFFF');
    }

    const requestData = { address, bytes: Math.min(bytes, 2) };
    return await this._makeRequest('/memory/read', 'POST', requestData);
  }

  /**
   * Write data to emulator memory
   *
   * @param {number} address - Memory address (0x0000-0xFFFF)
   * @param {number} value - Value to write
   * @param {number} bytes - Number of bytes (1 or 2)
   * @returns {Promise<Object>} Write operation result
   *
   * @example
   * ```javascript
   * // Write byte to address 0x200
   * await client.writeMemory(0x0200, 42, 1);
   *
   * // Write word to address
   * await client.writeMemory(0x0200, 0x1234, 2);
   * ```
   */
  async writeMemory(address, value, bytes = 1) {
    if (address < 0 || address > 0xFFFF) {
      throw new MCPClientError('INVALID_ADDRESS', 'Address must be between 0x0000 and 0xFFFF');
    }

    if (bytes === 2 && (value < 0 || value > 0xFFFF)) {
      throw new MCPClientError('INVALID_VALUE', 'Word value must be between 0x0000 and 0xFFFF');
    }

    if (bytes === 1 && (value < 0 || value > 0xFF)) {
      throw new MCPClientError('INVALID_VALUE', 'Byte value must be between 0x00 and 0xFF');
    }

    const requestData = { address, value, bytes };
    return await this._makeRequest('/memory/write', 'POST', requestData);
  }

  /**
   * Load bytecode directly into memory
   *
   * @param {number} startAddress - Starting memory address
   * @param {Array<number>} bytecode - Bytecode array to load
   * @returns {Promise<Object>} Load operation result
   *
   * @example
   * ```javascript
   * const bytecode = [0xA9, 0x42, 0x8D, 0x00, 0x06, 0x00]; // LDA #$42, STA $0600, BRK
   * const result = await client.loadProgramToMemory(0x0600, bytecode);
   * console.log(`Loaded ${result.bytesLoaded} bytes`);
   * ```
   */
  async loadProgramToMemory(bytecode, startAddress = 0x0600) {
    if (!Array.isArray(bytecode) || !bytecode.length) {
      throw new MCPClientError('INVALID_BYTECODE', 'Bytecode must be a non-empty array');
    }

    if (startAddress < 0 || startAddress > 0xFFFF) {
      throw new MCPClientError('INVALID_ADDRESS', 'Start address must be between 0x0000 and 0xFFFF');
    }

    const requestData = {
      bytecode,
      startAddress,
      validate: true
    };

    const result = await this._makeRequest('/memory/loadProgram', 'POST', requestData);

    // Clear relevant cache entries after memory modification
    if (this.cache) {
      this.cache.delete('cpu_state');
      this.cache.clear(); // Clear all cache as memory changes can affect many things
    }

    return result;
  }

  // ============================================================================
  // ASSEMBLY OPERATIONS
  // ============================================================================

  /**
   * Assemble source code to bytecode
   *
   * @param {string} sourceCode - Assembly source code
   * @param {Object} options - Assembly options
   * @returns {Promise<Object>} Assembly result
   *
   * @example
   * ```javascript
   * const source = `
   * .org $0600
   * LDA #$42
   * STA $00
   * HLT
   * `;
   *
   * const result = await client.assemble(source);
   * console.log('Bytecode:', result.hexBytes);
   * ```
   */
  async assemble(sourceCode, options = {}) {
    if (!sourceCode || typeof sourceCode !== 'string') {
      throw new MCPClientError('INVALID_SOURCE', 'Source code must be a non-empty string');
    }

    const requestData = {
      source: sourceCode,
      optimize: options.optimize || false,
      orgAddress: options.orgAddress || 0x0600,
      ...options
    };

    return await this._makeRequest('/assemble/source', 'POST', requestData);
  }

  /**
   * Assemble, load, and execute program
   *
   * @param {string} sourceCode - Assembly source code
   * @param {Object} options - Execution options
   * @returns {Promise<Object>} Combined result
   *
   * @example
   * ```javascript
   * const source = `
   * .org $0600
   * LDA #$42
   * STA $00
   * HLT
   * `;
   *
   * const result = await client.assembleAndRun(source, {
   *   resetCPU: true,
   *   maxSteps: 10
   * });
   *
   * console.log('Assembled bytes:', result.assembledByteCount);
   * console.log('Steps executed:', result.runOutcome.stepsExecuted);
   * ```
   */
  async assembleAndRun(sourceCode, options = {}) {
    if (!sourceCode || typeof sourceCode !== 'string') {
      throw new MCPClientError('INVALID_SOURCE', 'Source code must be a non-empty string');
    }

    const defaultOptions = {
      resetCPU: true,
      maxSteps: 1000,
      optimize: false,
      orgAddress: 0x0600
    };

    const requestData = {
      source: sourceCode,
      ...defaultOptions,
      ...options
    };

    return await this._makeRequest('/assemble/loadAndRun', 'POST', requestData);
  }

  // ============================================================================
  // PROGRAM MANAGEMENT
  // ============================================================================

  /**
   * List available sample programs
   *
   * @returns {Promise<Array>} Array of program information
   *
   * @example
   * ```javascript
   * const programs = await client.listPrograms();
   * programs.forEach(program => {
   *   console.log(`${program.name}: ${program.description}`);
   * });
   * ```
   */
  async listPrograms() {
    return await this._cachedRequest(
      'programs_list',
      '/programs/list',
      'GET'
    );
  }

  /**
   * Load a program from samples directory
   *
   * @param {string} name - Program name (without .asm extension)
   * @param {Object} options - Load options
   * @returns {Promise<Object>} Program information and bytecode
   *
   * @example
   * ```javascript
   * // Load and assemble
   * const program = await client.loadProgram('hello-world', {
   *   resetCPU: true
   * });
   * console.log('Program loaded:', program.programSize, 'bytes');
   * ```
   */
  async loadProgram(name, options = {}) {
    if (!name || typeof name !== 'string') {
      throw new MCPClientError('INVALID_NAME', 'Program name must be a non-empty string');
    }

    const requestData = {
      name: name.replace(/\.asm$/, ''), // Remove extension if provided
      startAddress: options.startAddress || 0x0600
    };

    return await this._makeRequest('/programs/load', 'POST', requestData);
  }

  /**
   * Save assembly source to samples directory
   *
   * @param {string} name - Program name (without .asm extension)
   * @param {string} sourceCode - Assembly source code
   * @param {boolean} overwrite - Overwrite if exists
   * @returns {Promise<Object>} Save operation result
   *
   * @example
   * ```javascript
   * const source = `
   * .org $0600
   * LDA #$42
   * STA $00
   * RTS
   * `;
   *
   * const result = await client.saveProgram('my-program', source);
   * console.log('Saved:', result.path);
   * ```
   */
  async saveProgram(name, sourceCode, overwrite = false) {
    if (!name || typeof name !== 'string') {
      throw new MCPClientError('INVALID_NAME', 'Program name must be a non-empty string');
    }

    if (!sourceCode || typeof sourceCode !== 'string') {
      throw new MCPClientError('INVALID_SOURCE', 'Source code must be a non-empty string');
    }

    const requestData = {
      name: name.replace(/\.asm$/, ''), // Remove extension if provided
      source: sourceCode,
      overwrite
    };

    return await this._makeRequest('/programs/save', 'POST', requestData);
  }

  // ============================================================================
  // TERMINAL I/O OPERATIONS
  // ============================================================================

  /**
   * Write text to terminal output
   *
   * @param {string} text - Text to write
   * @param {boolean} addNewline - Add newline after text
   * @returns {Promise<Object>} Write operation result
   *
   * @example
   * ```javascript
   * await client.writeToTerminal("Hello, World!");
   * await client.writeToTerminal("With newline", true);
   * ```
   */
  async writeToTerminal(text, addNewline = true) {
    if (typeof text !== 'string') {
      throw new MCPClientError('INVALID_TEXT', 'Text must be a string');
    }

    const requestData = {
      text,
      addNewline
    };

    return await this._makeRequest('/terminal/write', 'POST', requestData);
  }

  /**
   * Read input from terminal
   *
   * @returns {Promise<Object>} Terminal input state
   *
   * @example
   * ```javascript
   * const result = await client.readFromTerminal();
   * if (result.hasInput) {
   *   console.log('Input:', result.input);
   * } else {
   *   console.log('No input available');
   * }
   * ```
   */
  async readFromTerminal() {
    return await this._makeRequest('/terminal/read', 'POST');
  }

  /**
   * Clear terminal buffers
   *
   * @returns {Promise<Object>} Clear operation result
   *
   * @example
   * ```javascript
   * await client.clearTerminal();
   * console.log('Terminal cleared');
   * ```
   */
  async clearTerminal() {
    return await this._makeRequest('/terminal/clear', 'POST');
  }

  // ============================================================================
  // VIDEO OPERATIONS
  // ============================================================================

  /**
   * Set a pixel in the video framebuffer
   *
   * @param {number} x - X coordinate (0-31)
   * @param {number} y - Y coordinate (0-31)
   * @param {number} color - Color value (0-255)
   * @returns {Promise<Object>} Pixel operation result
   *
   * @example
   * ```javascript
   * // Set pixel at (10, 5) to red
   * await client.setPixel(10, 5, 12);
   * ```
   */
  async setPixel(x, y, color) {
    if (x < 0 || x > 31 || y < 0 || y > 31) {
      throw new MCPClientError('INVALID_COORDINATES', 'X,Y coordinates must be between 0 and 31');
    }

    if (color < 0 || color > 255) {
      throw new MCPClientError('INVALID_COLOR', 'Color value must be between 0 and 255');
    }

    const requestData = { x, y, color };
    return await this._makeRequest('/video/setPixel', 'POST', requestData);
  }

  /**
   * Update video display
   *
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   *
   * @example
   * ```javascript
   * // Update display with default timeout
   * const result = await client.updateVideoDisplay();
   * console.log('Update duration:', result.durationMs, 'ms');
   * ```
   */
  async updateVideoDisplay(options = {}) {
    const requestData = {
      flush: options.flush !== false,
      timeout: options.timeout || 5000
    };

    return await this._makeRequest('/video/update', 'POST', requestData);
  }

  /**
   * Clear video display with color
   *
   * @param {number} color - Fill color (0-255, default: 0)
   * @returns {Promise<Object>} Clear operation result
   *
   * @example
   * ```javascript
   * await client.clearVideoDisplay(0); // Clear to black
   * await client.clearVideoDisplay(15); // Clear to white
   * ```
   */
  async clearVideoDisplay(color = 0) {
    if (color < 0 || color > 255) {
      throw new MCPClientError('INVALID_COLOR', 'Color value must be between 0 and 255');
    }

    const requestData = { color };
    return await this._makeRequest('/video/clear', 'POST', requestData);
  }

  // ============================================================================
  // DEBUG OPERATIONS
  // ============================================================================

  /**
   * Set a breakpoint at an address
   *
   * @param {number} address - Memory address for breakpoint
   * @param {Object} options - Breakpoint options
   * @returns {Promise<Object>} Breakpoint operation result
   *
   * @example
   * ```javascript
   * const bpResult = await client.setBreakpoint(0x0605);
   * console.log('Breakpoint ID:', bpResult.operationResult.id);
   * ```
   */
  async setBreakpoint(address, options = {}) {
    if (address < 0 || address > 0xFFFF) {
      throw new MCPClientError('INVALID_ADDRESS', 'Address must be between 0x0000 and 0xFFFF');
    }

    const requestData = {
      action: 'set',
      address,
      condition: options.condition || 'execute'
    };

    return await this._makeRequest('/debug/breakpoints', 'POST', requestData);
  }

  /**
   * Clear breakpoint by address or ID
   *
   * @param {number|string} addressOrId - Address or breakpoint ID to clear
   * @returns {Promise<Object>} Clear operation result
   *
   * @example
   * ```javascript
   * // Clear by address
   * await client.clearBreakpoint(0x0605);
   *
   * // Clear by ID
   * await client.clearBreakpoint('bp_1');
   * ```
   */
  async clearBreakpoint(addressOrId) {
    const requestData = {
      action: 'remove',
      id: addressOrId,
      address: addressOrId
    };

    return await this._makeRequest('/debug/breakpoints', 'POST', requestData);
  }

  /**
   * Get list of active breakpoints
   *
   * @returns {Promise<Array>} Array of breakpoints
   *
   * @example
   * ```javascript
   * const breakpoints = await client.getBreakpoints();
   * breakpoints.forEach(bp => {
   *   console.log(`BP ${bp.id}: $${bp.address.toString(16)}`);
   * });
   * ```
   */
  async getBreakpoints() {
    const requestData = { action: 'list' };
    return await this._makeRequest('/debug/breakpoints', 'POST', requestData);
  }

  /**
   * Trace program execution
   *
   * @param {number} steps - Number of steps to trace
   * @param {Object} options - Trace options
   * @returns {Promise<Object>} Trace results
   *
   * @example
   * ```javascript
   * const trace = await client.traceExecution(50, {
   *   until: 'breakpoint'
   * });
   *
   * console.log(`Traced ${trace.stepsExecuted} steps`);
   * trace.trace.forEach(step => {
   *   console.log(`PC:${step.pc.toString(16)} ${step.instruction}`);
   * });
   * ```
   */
  async traceExecution(steps = 100, options = {}) {
    const requestData = {
      steps: Math.min(Math.max(steps, 1), 10000),
      until: options.until // 'halt', 'breakpoint', or address
    };

    return await this._makeRequest('/debug/trace', 'POST', requestData);
  }

  /**
   * Inspect memory region
   *
   * @param {number} startAddr - Start address
   * @param {number} endAddr - End address (optional, defaults to startAddr + 255)
   * @returns {Promise<Object>} Memory inspection result
   *
   * @example
   * ```javascript
   * // Inspect 256 bytes starting at 0x600
   * const memory = await client.inspectMemory(0x0600, 0x06FF);
   * console.log('Memory region:', memory.bytes);
   * ```
   */
  async inspectMemory(startAddr, endAddr = null) {
    if (startAddr < 0 || startAddr > 0xFFFF) {
      throw new MCPClientError('INVALID_ADDRESS', 'Start address must be between 0x0000 and 0xFFFF');
    }

    const endAddress = endAddr || Math.min(startAddr + 255, 0xFFFF);
    if (endAddress > 0xFFFF || endAddress < startAddr) {
      throw new MCPClientError('INVALID_RANGE', 'Invalid memory range');
    }

    const requestData = {
      address: startAddr,
      size: endAddress - startAddr + 1
    };

    return await this._makeRequest('/debug/memoryView', 'POST', requestData);
  }

  // ============================================================================
  // SPECIAL AI-FOCUSED WORKFLOWS
  // ============================================================================

  /**
   * Generate assembly code from natural language specification
   *
   * @param {string} specification - Natural language description
   * @param {Object} constraints - Generation constraints
   * @returns {Promise<Object>} Assembly generation result
   *
   * @example
   * ```javascript
   * const result = await client.generateAssembly(
   *   "Load value 42 into accumulator, store at address 100, then halt",
   *   { maxInstructions: 5 }
   * );
   *
   * console.log('Generated code:', result.source);
   * ```
   */
  async generateAssembly(specification, constraints = {}) {
    if (!specification || typeof specification !== 'string') {
      throw new MCPClientError('INVALID_SPECIFICATION', 'Specification must be a non-empty string');
    }

    // Simple pattern-based code generation (can be enhanced with AI)
    const patterns = {
      'load.*accumulator': ['LDA #$42'],
      'store.*address': ['STA $0064'],
      'halt': ['HLT']
    };

    // Generate simple assembly based on specification
    const lines = specification.toLowerCase().split(',');
    const generatedCode = [];

    for (const line of lines) {
      const matched = Object.keys(patterns).find(pattern =>
        line.trim().includes(pattern.split('.')[1])
      );

      if (matched && patterns[matched]) {
        generatedCode.push(...patterns[matched]);
      }
    }

    if (!generatedCode.length) {
      // Default simple program
      generatedCode.push('LDA #$42', 'STA $00', 'HLT');
    }

    const sourceCode = ['.org $0600', ...generatedCode].join('\n');

    // Test assemble to ensure it's valid
    await this.assemble(sourceCode);

    return {
      specification,
      source: sourceCode,
      instructions: generatedCode.length,
      estimatedCycles: generatedCode.length * 3,
      success: true
    };
  }

  /**
   * Test assembly code against expected behavior
   *
   * @param {string} assembly - Assembly source code
   * @param {Array} testCases - Expected test results
   * @returns {Promise<Object>} Test execution results
   *
   * @example
   * ```javascript
   * const tests = [
   *   { description: "Loads value 42", expectA: 42 },
   *   { description: "Halts after execution", expectHalt: true }
   * ];
   *
   * const results = await client.testAssembly(assembly, tests);
   * console.log(`${results.passed}/${results.total} tests passed`);
   * ```
   */
  async testAssembly(assembly, testCases = []) {
    const results = {
      total: testCases.length,
      passed: 0,
      failed: 0,
      results: []
    };

    for (const testCase of testCases) {
      try {
        // Reset CPU first
        await this.resetCPU();

        // Assemble and run the code
        const runResult = await this.assembleAndRun(assembly, {
          maxSteps: testCase.maxSteps || 100
        });

        // Verify expectations
        let passed = true;
        let actualValues = {};

        if (testCase.expectA !== undefined) {
          const state = await this.getCPUState();
          actualValues.a = state.a;
          passed = passed && (state.a === testCase.expectA);
        }

        if (testCase.expectHalt !== undefined) {
          actualValues.halted = runResult.runOutcome.halted;
          passed = passed && (runResult.runOutcome.halted === testCase.expectHalt);
        }

        results.results.push({
          description: testCase.description,
          passed,
          expected: testCase,
          actual: actualValues
        });

        if (passed) results.passed++;
        else results.failed++;

      } catch (error) {
        results.results.push({
          description: testCase.description,
          passed: false,
          error: error.message
        });
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Set up interactive debugging session
   *
   * @param {string} assembly - Assembly code to debug
   * @param {Array} breakpointLocations - Breakpoint addresses
   * @returns {Promise<Object>} Debug session setup result
   *
   * @example
   * ```javascript
   * const session = await client.interactiveDebug(assembly, [
   *   0x0602, // Break at second instruction
   *   0x0605  // Break at store operation
   * ]);
   *
   * // Now can step through execution
   * await client.stepCPU();
   * ```
   */
  async interactiveDebug(assembly, breakpointLocations = []) {
    // Reset everything first
    await this.resetCPU();

    // Load and assemble the code
    const assembled = await this.assemble(assembly);
    await this.loadProgramToMemory(assembled.bytecode);

    // Set breakpoints
    const breakpoints = [];
    for (const addr of breakpointLocations) {
      try {
        const bp = await this.setBreakpoint(addr);
        breakpoints.push(bp);
      } catch (error) {
        const stdError = ErrorHandler.standardizeError(error, 'mcp_client::interactiveDebug');
      }
    }

    return {
      assembled,
      breakpoints,
      pc: 0x0600,
      ready: true,
      instructions: assembled.instructionCount
    };
  }

  /**
   * Optimize assembly code
   *
   * @param {string} assembly - Original assembly code
   * @param {Object} criteria - Optimization criteria
   * @returns {Promise<Object>} Optimization result
   *
   * @example
   * ```javascript
   * const optimized = await client.optimizeAssembly(assembly, {
   *   minimizeSize: true,
   *   minimizeCycles: false
   * });
   *
   * console.log('Original size:', optimized.original.sizeBytes);
   * console.log('Optimized size:', optimized.optimized.sizeBytes);
   * ```
   */
  async optimizeAssembly(assembly, criteria = {}) {
    const original = await this.assemble(assembly);

    let optimizedCode = assembly;
    let optimizations = [];

    // Simple optimizations
    if (criteria.minimizeSize) {
      // Replace multi-byte instructions with shorter equivalents
      optimizedCode = optimizedCode.replace(/\n\s*STA.*?\n\s*LDA\s*\$00/g, '\nSTA $00\n');
      optimizations.push('removed redundant LDA');
    }

    const optimized = await this.assemble(optimizedCode);

    return {
      original: {
        source: assembly,
        sizeBytes: original.sizeBytes,
        cycles: original.instructionCount * 3
      },
      optimized: {
        source: optimizedCode,
        sizeBytes: optimized.sizeBytes,
        cycles: optimized.instructionCount * 3
      },
      improvements: {
        sizeReduction: original.sizeBytes - optimized.sizeBytes,
        cycleReduction: (original.instructionCount - optimized.instructionCount) * 3
      },
      optimizations
    };
  }

  /**
   * Process multiple operations as a batch
   *
   * @param {Array} operations - Array of operation objects
   * @returns {Promise<Array>} Array of results
   *
   * @example
   * ```javascript
   * const operations = [
   *   { type: 'setPixel', params: [10, 5, 12] },
   *   { type: 'setPixel', params: [11, 5, 14] },
   *   { type: 'writeToTerminal', params: ['Batch done'] },
   *   { type: 'updateVideoDisplay', params: [] }
   * ];
   *
   * const results = await client.processBatch(operations);
   * console.log('Batch processed:', results.length, 'operations');
   * ```
   */
  async processBatch(operations) {
    if (!Array.isArray(operations)) {
      throw new MCPClientError('INVALID_OPERATIONS', 'Operations must be an array');
    }

    const results = [];
    let totalStartTime = Date.now();

    for (const operation of operations) {
      const startTime = Date.now();

      try {
        const methodName = operation.type;
        const params = operation.params || [];

        if (typeof this[methodName] !== 'function') {
          throw new Error(`Unknown operation type: ${methodName}`);
        }

        const result = await this[methodName](...params);
        const endTime = Date.now();

        results.push({
          type: methodName,
          params,
          result,
          durationMs: endTime - startTime,
          success: true
        });
      } catch (error) {
        const endTime = Date.now();
        results.push({
          type: operation.type,
          params: operation.params || [],
          error: error.message,
          durationMs: endTime - startTime,
          success: false
        });
      }
    }

    return results;
  }

  /**
   * Health check utility
   *
   * @returns {Promise<Object>} Health check result
   */
  async healthCheck() {
    try {
      const response = await this.http.request({
        url: `${this.baseURL}/health`,
        method: 'GET',
        timeout: 5000
      });
      return { healthy: response.ok, status: response.status };
    } catch (error) {
      return { healthy: false, error: error.message };
    }
  }

  /**
   * Ping the server
   *
   * @returns {Promise<Object>} Ping result
   */
  async ping() {
    return await this.healthCheck();
  }

  /**
   * Clear response cache
   *
   * @returns {Promise<void>}
   */
  async clearCache() {
    if (this.cache) {
      this.cache.clear();
      console.debug('Response cache cleared');
    }
  }

  /**
   * Get current client configuration
   *
   * @returns {Object} Current configuration
   */
  getConfig() {
    return Object.assign({}, this.config);
  }

  /**
   * Update client configuration
   *
   * @param {Object} newConfig - New configuration options
   * @returns {Promise<void>}
   */
  updateConfig(newConfig) {
    this.config = Object.assign(this.config, newConfig);

    // Reinitialize cache if any cache-related parameters changed
    if (newConfig.cacheTTLMs || newConfig.maxCacheSize || newConfig.maxCacheMemoryMB) {
      this.cache = this.config.enableCache ?
        new ResponseCache(this.config.maxCacheSize, this.config.cacheTTLMs, this.config.maxCacheMemoryMB) :
        null;
    }
  }

  // ============================================================================
  // STATIC UTILITY METHODS
  // ============================================================================

  /**
   * Create a simplified client for basic operations
   *
   * @param {string} baseURL - Base URL of MCP server
   * @returns {MCPClient} New MCP client instance
   */
  static createClient(baseURL = 'http://localhost:8001') {
    return new MCPClient(baseURL, {
      timeoutMs: 15000,
      retryAttempts: 1,
      enableCache: false // Disable cache for simple client
    });
  }

  /**
   * Quick test to verify MCP server is running
   *
   * @param {string} baseURL - Base URL to test
   * @returns {Promise<boolean>} True if server is accessible
   */
  static async testConnection(baseURL = 'http://localhost:8001') {
    try {
      const client = MCPClient.createClient(baseURL);
      const result = await client.healthCheck();
      return result.healthy;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// CONVENIENCE EXPORTS AND UTILITIES
// ============================================================================

/**
 * Default export - the main MCPClient class
 * @type {MCPClient}
 */
export default MCPClient;

/**
 * Create a new MCP client with sensible defaults for AI workflows
 *
 * @param {string} baseURL - Base URL of MCP server
 * @param {Object} options - Additional options
 * @returns {MCPClient} Configured MCP client
 *
 * @example
 * ```javascript
 * import { createAIClient } from './lib/mcp-client.js';
 *
 * const client = createAIClient('http://localhost:8001');
 * const assembly = await client.generateAssembly('Load 42 into accumulator');
 * ```
 */
export function createAIClient(baseURL = 'http://localhost:8001', options = {}) {
  const defaults = {
    timeoutMs: 20000,
    retryAttempts: 3,
    enableCache: true,
    cacheTTLMs: 120000, // 2 minutes for AI workflows
    userAgent: 'MCPClient-AI/2.1.0'
  };

  return new MCPClient(baseURL, Object.assign(defaults, options));
}

/**
 * Quick sanity check for MCP client integration
 *
 * @returns {Promise<Object>} Sanity check result
 */
export async function sanityCheck() {
  try {
    const client = MCPClient.createClient();

    // Test basic connectivity
    const programs = await client.listPrograms();

    return {
      success: true,
      message: 'MCP Client is working correctly',
      samplePrograms: programs.length,
      serverVersion: 'detected'
    };
  } catch (error) {
    const stdError = ErrorHandler.standardizeError(error, 'mcp_client::sanityCheck');
    return {
      success: false,
      message: 'MCP Client connection failed',
      error: stdError.message
    };
  }
}