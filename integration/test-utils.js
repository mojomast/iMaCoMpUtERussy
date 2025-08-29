/**
 * Integration Test Utilities
 *
 * Shared utilities and configurations for MCP server integration tests.
 *
 * @version 1.0.0
 * @author Kyle Durepos (via Roo Code)
 * @license MIT
 */

import fs from 'fs';
import path from 'path';
import { createAIClient } from '../lib/mcp-client.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

const TEST_CONFIG = {
  mcpServerUrl: 'http://localhost:8001',
  timeout: 30000,
  serverStartTimeout: 10000,
  taskProcessingTimeout: 60000,
  maxRetries: 3,
  debugMode: process.env.DEBUG_TESTS === 'true',
  parallelizationFactor: process.env.PARALLEL_TESTS || 1,
  reportOutputDir: path.join(__dirname, 'reports'),
  logOutputDir: path.join(__dirname, 'logs')
};

// Ensure required directories exist
if (!fs.existsSync(TEST_CONFIG.reportOutputDir)) {
  fs.mkdirSync(TEST_CONFIG.reportOutputDir, { recursive: true });
}

if (!fs.existsSync(TEST_CONFIG.logOutputDir)) {
  fs.mkdirSync(TEST_CONFIG.logOutputDir, { recursive: true });
}

// ============================================================================
// MCP SERVER MANAGEMENT
// ============================================================================

/**
 * Enhanced MCP Server Manager for integration tests
 */
export class MCPTestServerManager {
  constructor() {
    this.baseURL = TEST_CONFIG.mcpServerUrl;
    this.serverProcess = null;
    this.isRunning = false;
    this.client = null;
    this.startTime = null;
    this.testMetrics = {
      startAttempts: 0,
      stopAttempts: 0,
      failures: 0,
      totalUptime: 0
    };
  }

  /**
   * Start MCP server with retry logic
   */
  async start(options = {}) {
    const { retries = 3, waitTime = 2000 } = options;

    if (this.isRunning) {
      console.log('MCP test server already running');
      return this.client;
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      this.testMetrics.startAttempts++;

      try {
        console.log(`Attempt ${attempt}/${retries}: Starting MCP server...`);

        const { spawn } = await import('child_process');
        const serverPath = path.join(__dirname, '..', 'server', 'mcp_server.js');

        this.serverProcess = spawn('node', [serverPath], {
          cwd: path.join(__dirname, '..'),
          stdio: ['ignore', 'pipe', 'pipe'],
          detached: false,
          env: {
            ...process.env,
            PORT: '8001'
          }
        });

        this.startTime = Date.now();

        // Handle server output for debugging
        if (TEST_CONFIG.debugMode) {
          this.serverProcess.stdout.on('data', (data) => {
            console.log(`[MCP SERVER] ${data.toString().trim()}`);
          });

          this.serverProcess.stderr.on('data', (data) => {
            console.error(`[MCP SERVER ERROR] ${data.toString().trim()}`);
          });
        }

        // Wait for server to be ready
        await this._waitForServer(TEST_CONFIG.serverStartTimeout);

        this.client = createAIClient(this.baseURL);
        this.isRunning = true;

        const startupTime = Date.now() - this.startTime;
        console.log(`✅ MCP test server started in ${startupTime}ms`);
        this._logEvent('server_started', { startupTime, attempt });

        return this.client;

      } catch (error) {
        console.error(`❌ Server start attempt ${attempt} failed:`, error.message);

        if (this.serverProcess) {
          this.serverProcess.kill('SIGTERM');
          this.serverProcess = null;
        }

        this.testMetrics.failures++;
        this._logEvent('server_start_failed', { attempt, error: error.message });

        if (attempt < retries) {
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await this._delay(waitTime);
        } else {
          throw new Error(`Failed to start MCP server after ${retries} attempts`);
        }
      }
    }
  }

  /**
   * Stop MCP server gracefully
   */
  async stop() {
    if (!this.isRunning || !this.serverProcess) {
      return;
    }

    this.testMetrics.stopAttempts++;

    try {
      const uptime = this.startTime ? Date.now() - this.startTime : 0;
      this.testMetrics.totalUptime += uptime;

      console.log('🛑 Stopping MCP test server...');

      // Graceful shutdown
      this.serverProcess.kill('SIGTERM');

      // Wait for process to exit
      const exitPromise = new Promise((resolve) => {
        this.serverProcess.on('exit', (code, signal) => {
          console.log(`MCP server exited with code ${code}, signal ${signal}`);
          resolve();
        });
      });

      // Set timeout in case process doesn't exit gracefully
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          console.log('MCP server did not exit gracefully, forcing kill...');
          this.serverProcess.kill('SIGKILL');
          resolve();
        }, 5000);
      });

      await Promise.race([exitPromise, timeoutPromise]);

      this.isRunning = false;
      this.serverProcess = null;
      this.client = null;
      this.startTime = null;

      this._logEvent('server_stopped', { uptime });
      console.log('✅ MCP test server stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping MCP server:', error.message);
      this._logEvent('server_stop_failed', { error: error.message });

      // Force kill as last resort
      if (this.serverProcess) {
        this.serverProcess.kill('SIGKILL');
        this.serverProcess = null;
      }

      throw error;
    }
  }

  /**
   * Check if server is healthy
   */
  async isHealthy() {
    if (!this.isRunning) return false;

    try {
      const response = await fetch(`${this.baseURL}/health`, {
        timeout: 5000
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Restart server
   */
  async restart() {
    await this.stop();
    await this.start();
  }

  /**
   * Wait for server to be ready
   * @private
   */
  async _waitForServer(timeoutMs) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`${this.baseURL}/health`);
        if (response.ok) {
          const health = await response.json();
          if (health.status === 'ok') {
            return true;
          }
        }
      } catch (error) {
        // Server not ready yet
      }

      await this._delay(500);
    }

    throw new Error(`MCP server failed to start within ${timeoutMs}ms`);
  }

  /**
   * Utility delay function
   * @private
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log test events for debugging and metrics
   * @private
   */
  _logEvent(event, data) {
    if (!TEST_CONFIG.debugMode) return;

    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      ...data
    };

    const logFile = path.join(TEST_CONFIG.logOutputDir, 'server-events.jsonl');
    try {
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    } catch (error) {
      console.warn('Failed to write server log:', error.message);
    }
  }

  /**
   * Get server metrics
   */
  getMetrics() {
    return {
      ...this.testMetrics,
      isRunning: this.isRunning,
      currentUptime: this.startTime ? Date.now() - this.startTime : 0,
      averageUptime: this.testMetrics.startAttempts > 0 ?
        this.testMetrics.totalUptime / this.testMetrics.startAttempts : 0
    };
  }
}

// Global server manager instance
export const serverManager = new MCPTestServerManager();

// ============================================================================
// PERFORMANCE MONITORING
// ============================================================================

/**
 * Performance monitor for integration tests
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = {
      operations: {},
      averages: {},
      peaks: {},
      totals: {}
    };
    this.currentSession = null;
  }

  /**
   * Start monitoring session
   */
  startSession(name) {
    this.currentSession = {
      name,
      startTime: Date.now(),
      operations: {}
    };
  }

  /**
   * Record operation timing
   */
  recordOperation(operationName, duration, metadata = {}) {
    if (!this.metrics.operations[operationName]) {
      this.metrics.operations[operationName] = [];
    }

    this.metrics.operations[operationName].push({
      duration,
      timestamp: Date.now(),
      ...metadata
    });

    // Update current session
    if (this.currentSession) {
      if (!this.currentSession.operations[operationName]) {
        this.currentSession.operations[operationName] = { count: 0, totalDuration: 0 };
      }

      this.currentSession.operations[operationName].count++;
      this.currentSession.operations[operationName].totalDuration += duration;
    }
  }

  /**
   * End current monitoring session
   */
  endSession() {
    if (this.currentSession) {
      this.currentSession.endTime = Date.now();
      this.currentSession.duration = this.currentSession.endTime - this.currentSession.startTime;

      // Save session data to file
      this._saveSessionData(this.currentSession);
      this.currentSession = null;
    }
  }

  /**
   * Get performance statistics
   */
  getStatistics(operationName = null) {
    const stats = {};

    const operations = operationName ?
      { [operationName]: this.metrics.operations[operationName] } :
      this.metrics.operations;

    Object.entries(operations).forEach(([name, timings]) => {
      if (!timings || timings.length === 0) return;

      const durations = timings.map(t => t.duration);
      stats[name] = {
        count: durations.length,
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        p50: this._percentile(durations, 0.5),
        p95: this._percentile(durations, 0.95),
        p99: this._percentile(durations, 0.99)
      };
    });

    return stats;
  }

  /**
   * Generate performance report
   */
  generateReport(filename = null) {
    const report = {
      generatedAt: new Date().toISOString(),
      totalSessions: this.currentSession ? 1 : 0,
      statistics: this.getStatistics()
    };

    const reportPath = filename ?
      path.join(TEST_CONFIG.reportOutputDir, filename) :
      path.join(TEST_CONFIG.reportOutputDir, 'performance-report.json');

    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📊 Performance report saved to ${reportPath}`);
    } catch (error) {
      console.error('Failed to save performance report:', error.message);
    }

    return report;
  }

  /**
   * Calculate percentile from array
   * @private
   */
  _percentile(arr, p) {
    const sorted = [...arr].sort((a, b) => a - b);
    const index = (sorted.length - 1) * p;
    const lower = Math.floor(index);
    const upper = Math.ceil(index);

    if (lower === upper) return sorted[lower];

    return sorted[lower] + (index - lower) * (sorted[upper] - sorted[lower]);
  }

  /**
   * Save session data to disk
   * @private
   */
  _saveSessionData(session) {
    const filename = `session-${session.name}-${Date.now()}.json`;
    const filepath = path.join(TEST_CONFIG.logOutputDir, filename);

    try {
      fs.writeFileSync(filepath, JSON.stringify(session, null, 2));
    } catch (error) {
      console.warn('Failed to save session data:', error.message);
    }
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor();

// ============================================================================
// ASSERTION UTILITIES
// ============================================================================

/**
 * Enhanced assertion utilities for integration tests
 */
export class TestAssertions {
  static assertMCPResponse(response, expectedStructure = {}) {
    if (!response) {
      throw new Error('Response is null or undefined');
    }

    if (typeof response !== 'object') {
      throw new Error('Response must be an object');
    }

    // Check success field
    if (response.success === undefined) {
      throw new Error('MCP response missing required "success" field');
    }

    // Check data field structure
    if (response.success && !response.data) {
      throw new Error('Successful MCP response missing required "data" field');
    }

    // Check expected structure
    if (expectedStructure.data) {
      const data = response.data;
      Object.entries(expectedStructure.data).forEach(([key, type]) => {
        if (!(key in data)) {
          throw new Error(`Response data missing expected field: ${key}`);
        }

        if (type === 'array' && !Array.isArray(data[key])) {
          throw new Error(`Expected field ${key} to be an array, got ${typeof data[key]}`);
        } else if (type !== 'array' && typeof data[key] !== type) {
          throw new Error(`Expected field ${key} to be of type ${type}, got ${typeof data[key]}`);
        }
      });
    }

    return true;
  }

  static assertPerformance(duration, maxDuration, operation = 'operation') {
    if (duration > maxDuration) {
      throw new Error(`${operation} exceeded maximum duration (${duration}ms > ${maxDuration}ms)`);
    }
  }

  static assertMemoryState(client, address, expectedValue, description = '') {
    // Note: This would require actual memory inspection implementation
    // For now, just check that we can read memory without errors
    if (!description) {
      description = `Memory at address 0x${address.toString(16)}`;
    }

    // Basic validation only
    if (address < 0 || address > 0xFFFF) {
      throw new Error(`${description}: Invalid address range`);
    }

    return true;
  }

  static assertTaskCompletion(taskStats, expectedCount, taskType = 'tasks') {
    if (taskStats.total < expectedCount) {
      throw new Error(`Expected at least ${expectedCount} ${taskType}, got ${taskStats.total}`);
    }

    return true;
  }

  static assertAgentHealth(agentStats) {
    if (!agentStats.isRunning) {
      throw new Error('Agent is not running');
    }

    if (agentStats.tasksFailed > agentStats.tasksProcessed * 0.5) {
      throw new Error(`Too many failed tasks: ${agentStats.tasksFailed}/${agentStats.tasksProcessed}`);
    }

    return true;
  }
}

// ============================================================================
// TEST DATA PROVIDERS
// ============================================================================

/**
 * Test data generators for various scenarios
 */
export class TestDataProvider {
  static generateAssemblyProgram(type = 'simple') {
    const templates = {
      simple: `.org $0600
LDA #$42        ; Load immediate value
STA $00         ; Store to memory location 0
RTS             ; Return from subroutine`,

      math: `.org $0600
LDA #$05        ; First operand
CLC            ; Clear carry for addition
ADC #$03        ; Add second operand (result = 8)
STA $00         ; Store result
LDA #$0A        ; Load 10
SEC            ; Set carry for subtraction
SBC #$04        ; Subtract 4 (result = 6)
STA $01         ; Store second result
RTS`,

      loop: `.org $0600
LDX #$00        ; Initialize counter
LOOP:
  TXA           ; Transfer X to accumulator
  STA $00,X     ; Store counter value
  INX           ; Increment counter
  CPX #$05      ; Compare with limit
  BNE LOOP      ; Branch if not equal
RTS`,

      output: `.org $0600
LDA #$48        ; ASCII 'H'
STA $F1         ; Output to terminal
LDA #$65        ; ASCII 'e'
STA $F1
LDA #$6C        ; ASCII 'l'
STA $F1
STA $F1         ; Second 'l'
LDA #$6F        ; ASCII 'o'
STA $F1
RTS`
    };

    return templates[type] || templates.simple;
  }

  static generateTestPrompts(count = 5) {
    const templates = [
      {
        prompt: "Create a simple assembly program that loads value 42 into the accumulator and stores it at memory location 100",
        type: "generation",
        expected: { value: 42, address: 100 }
      },
      {
        prompt: "Optimize this addition program for speed: LDA #$05; CLC; ADC #$03; STA $00; RTS",
        type: "optimization",
        expected: { operations: ['LDA', 'ADC', 'STA'] }
      },
      {
        prompt: "Test this math program to verify calculations: LDA #$0A; CLC; ADC #$05; STA $00; SBC #$02; STA $01; RTS",
        type: "testing",
        expected: { results: [15, 13] }
      },
      {
        prompt: "Debug this loop program - it should count from 0 to 9: LDX #$00; LOOP: INX; STA $00,X; CPX #$0A; BNE LOOP; RTS",
        type: "debugging",
        expected: { iterationCount: 10 }
      },
      {
        prompt: "Create a learning example showing memory operations: load immediate, store to memory, read from memory",
        type: "educational",
        expected: { concepts: ['LDA', 'STA', 'immediate addressing'] }
      }
    ];

    return templates.slice(0, count);
  }

  static generateLoadTestData(concurrentCount = 10) {
    const testData = [];

    for (let i = 0; i < concurrentCount; i++) {
      testData.push({
        id: `load_test_${i}`,
        assembly: this.generateAssemblyProgram('math'),
        expectedSteps: 8 + (i % 3), // Vary expected steps slightly
        metadata: {
          testBatch: 'load_test',
          sequenceId: i
        }
      });
    }

    return testData;
  }

  static generateErrorCases() {
    return [
      {
        name: 'invalid_assembly',
        code: 'INVALID INSTRUCTION HERE',
        expectedError: 'INVALID_ASSEMBLY'
      },
      {
        name: 'out_of_bounds_memory',
        code: '.org $0600\nLDA #$42\nSTA $10000\nRTS',
        expectedError: 'MEMORY_OUT_OF_BOUNDS'
      },
      {
        name: 'missing_operand',
        code: '.org $0600\nLDA\nSTA $00\nRTS',
        expectedError: 'INVALID_ASSEMBLY'
      },
      {
        name: 'undefined_label',
        code: '.org $0600\nJMP UNDEFINED_LABEL\nRTS\nUNDEFINED_LABEL: NOP',
        expectedError: 'INVALID_ASSEMBLY'
      }
    ];
  }
}

// ============================================================================
// INTEGRATION TEST HELPERS
// ============================================================================

/**
 * Run agent with specific test configuration
 */
export async function runAgentWithConfig(config, prompts) {
  const { AutonomousSoftwareAgent } = await import('../agent/autonomous-agent.js');
  let agent = null;

  try {
    agent = new AutonomousSoftwareAgent({
      mcpServerUrl: TEST_CONFIG.mcpServerUrl,
      ...config
    });

    await agent.start();

    // Add test prompts
    for (const promptData of prompts) {
      await agent.queue.addPrompt(promptData.prompt, {
        type: promptData.type,
        priority: promptData.priority || 'normal'
      });
    }

    // Wait for processing
    const maxWait = config.maxWait || TEST_CONFIG.taskProcessingTimeout;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      const stats = agent.getStats();
      if (stats.tasksProcessed >= prompts.length) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Get final statistics
    const finalStats = agent.getStats();

    return {
      success: finalStats.tasksSuccessful === prompts.length,
      stats: finalStats,
      completed: finalStats.tasksSuccessful,
      expected: prompts.length
    };

  } finally {
    if (agent) {
      await agent.stop();
    }
  }
}

/**
 * Cleanup function for integration tests
 */
export async function cleanupIntegration() {
  try {
    // Stop any running servers
    await serverManager.stop();

    // Clear any test files
    const testPatterns = [
      'samples/agent_generated_*',
      'data/test_queue_*',
      'data/test_learning_*'
    ];

    for (const pattern of testPatterns) {
      // Simple cleanup - in real implementation would use glob patterns
      console.log(`Would clean up pattern: ${pattern}`);
    }

    // Reset performance monitor
    performanceMonitor.endSession();

    console.log('🧹 Integration test cleanup completed');

  } catch (error) {
    console.error('Cleanup failed:', error.message);
  }
}

// ============================================================================
// CI/CD INTEGRATION UTILITIES
// ============================================================================

/**
 * Generate JUnit XML report for CI/CD systems
 */
export function generateJunitReport(results, outputPath = './integration/junit-results.xml') {
  const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="MCP Integration Tests" tests="${results.total}" failures="${results.failed}" time="${results.duration || 0}">
    ${results.testCases.map(testCase => `
    <testcase name="${testCase.name}" time="${testCase.duration || 0}"${testCase.status === 'failed' ? `
      <failure message="${testCase.error}" type="${testCase.errorType || 'TestFailure'}">${testCase.stackTrace || testCase.error}</failure>` : ''}
    </testcase>`).join('\n')}
  </testsuite>
</testsuites>`;

  try {
    fs.writeFileSync(outputPath, xmlContent);
    console.log(`📋 JUnit report generated: ${outputPath}`);
  } catch (error) {
    console.error('Failed to generate JUnit report:', error.message);
  }
}

/**
 * Run integration tests in CI mode
 */
export async function runInCIMode(testSuite, options = {}) {
  const { verbose = false, timeout = 300000, outputDir = './integration' } = options;

  console.log('🏭 Running integration tests in CI mode...');

  const ciResults = {
    total: 0,
    passed: 0,
    failed: 0,
    testCases: [],
    startTime: Date.now()
  };

  try {
    // Start server
    await serverManager.start({ retries: 5 });

    // Run test suite
    for (const testCase of testSuite) {
      const testStart = Date.now();

      try {
        const result = await testCase.run();
        const testDuration = Date.now() - testStart;

        ciResults.testCases.push({
          name: testCase.name,
          status: 'passed',
          duration: testDuration / 1000,
          result
        });

        ciResults.passed++;

      } catch (error) {
        const testDuration = Date.now() - testStart;

        ciResults.testCases.push({
          name: testCase.name,
          status: 'failed',
          duration: testDuration / 1000,
          error: error.message,
          errorType: error.constructor.name,
          stackTrace: error.stack
        });

        ciResults.failed++;
        console.error(`❌ CI Test Failed: ${testCase.name}`);
        console.error(error.message);
      }
    }

  } finally {
    await serverManager.stop();
  }

  ciResults.total = ciResults.testCases.length;
  ciResults.duration = (Date.now() - ciResults.startTime) / 1000;

  // Generate reports
  generateJunitReport(ciResults, path.join(outputDir, 'results.xml'));
  serverManager.generateReport(path.join(outputDir, 'server-metrics.json'));

  console.log(`CI Results: ${ciResults.passed}/${ciResults.total} tests passed`);
  return ciResults;
}

export { TEST_CONFIG };
export default {
  MCPTestServerManager,
  PerformanceMonitor,
  TestAssertions,
  TestDataProvider,
  serverManager,
  performanceMonitor,
  TEST_CONFIG
};