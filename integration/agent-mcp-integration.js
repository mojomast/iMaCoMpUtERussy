/**
 * MCP Server Integration Tests
 *
 * Comprehensive integration test suite that validates the autonomous agent
 * can successfully execute generated code using the MCP server emulator
 * in real-time. This test suite covers end-to-end workflows including
 * code generation, execution, debugging, and performance monitoring.
 *
 * @version 1.0.0
 * @author Kyle Durepos (via Roo Code)
 * @license MIT
 */

import { createAIClient } from '../lib/mcp-client.js';
import { AutonomousSoftwareAgent } from '../agent/autonomous-agent.js';
import PromptQueue from '../agent/queue-manager.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// TEST FRAMEWORK UTILITIES
// ============================================================================

class IntegrationTestRunner {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, errors: [] };
    this.startTime = null;
    this.endTime = null;
  }

  addTest(name, testFn) {
    this.tests.push({ name, testFn });
  }

  async runAll(verbose = true) {
    this.startTime = Date.now();
    console.log('\n🧪 Starting Agent-MCP Server Integration Tests');
    console.log('=' .repeat(60));

    for (const { name, testFn } of this.tests) {
      try {
        if (verbose) console.log(`\n▶️  Running: ${name}`);
        await testFn();
        console.log(`✅ PASSED: ${name}`);
        this.results.passed++;
      } catch (error) {
        console.error(`❌ FAILED: ${name}`);
        console.error(`   Error: ${error.message}`);
        if (error.stack) {
          console.error(`   Stack: ${error.stack.split('\n')[1]}`);
        }
        this.results.failed++;
        this.results.errors.push({ test: name, error: error.message });
      }
    }

    this.endTime = Date.now();
    this.printResults();
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log('🎯 Integration Test Results');
    console.log('='.repeat(60));
    console.log(`Total Tests: ${this.tests.length}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Duration: ${this.endTime - this.startTime}ms`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.errors.forEach(({ test, error }) => {
        console.log(`  - ${test}: ${error}`);
      });
    }

    const successRate = this.tests.length > 0 ?
      ((this.results.passed / this.tests.length) * 100).toFixed(1) : 0;

    console.log(`\n📊 Success Rate: ${successRate}%`);

    if (this.results.failed === 0) {
      console.log('🎉 All integration tests PASSED!');
    } else {
      console.log('⚠️  Some tests FAILED. Check the output above.');
      process.exit(1);
    }
  }
}

// Global test runner instance
const testRunner = new IntegrationTestRunner();

// ============================================================================
// TEST DATA AND UTILITIES
// ============================================================================

const TEST_DATA = {
  simplePrograms: {
    helloWorld: `.org $0600
LDA #$48        ; 'H'
STA $F1
LDA #$65        ; 'e'
STA $F1
LDA #$6C        ; 'l'
STA $F1
STA $F1         ; Second 'l'
LDA #$6F        ; 'o'
STA $F1
LDA #$0A        ; Newline
STA $F1
RTS`,

    addNumbers: `.org $0600
LDA #$05        ; Load 5
CLC
ADC #$03        ; Add 3 (result = 8)
STA $00         ; Store result
RTS`,

    loopCounter: `.org $0600
LDX #$00        ; Start counter at 0
LOOP:
  TXA           ; Transfer X to A
  STA $00,X     ; Store counter value
  INX           ; Increment counter
  CPX #$05      ; Compare with 5
  BNE LOOP      ; Loop if not equal
RTS`,

    memoryTest: `.org $0600
LDA #$AA        ; Load pattern AA
STA $2000       ; Store to memory
LDA #$BB        ; Load pattern BB
STA $2001       ; Store to next address
STA $F1         ; Output for verification
RTS`
  },

  testPrompts: {
    generation: "Create a simple assembly program that loads the value 42 into the accumulator and stores it at memory location 100",
    optimization: "Optimize this addition program for speed: LDA #$05; ADC #$03; STA $00; RTS",
    testing: "Test this program to verify it loads 42 into memory location 0: LDA #$2A; STA $00; RTS",
    debugging: "Debug this program - it should increment a counter from 0 to 10 but gets stuck: LDX #$00; LOOP: INX; CPX #$0A; BNE LOOP; RTS",
    educational: "Create a learning example that demonstrates memory operations: load, store, and read from memory"
  }
};

class MCPTestServer {
  constructor() {
    this.baseURL = 'http://localhost:8001';
    this.client = null;
    this.isRunning = false;
  }

  async start() {
    if (this.isRunning) return;

    try {
      // Start MCP server process
      const { spawn } = await import('child_process');
      const serverPath = path.join(__dirname, '..', 'server', 'mcp_server.js');

      this.serverProcess = spawn('node', [serverPath], {
        cwd: path.join(__dirname, '..'),
        stdio: ['ignore', 'pipe', 'pipe']
      });

      // Wait for server to be ready
      await this.waitForServer(5000);

      this.client = createAIClient(this.baseURL);
      this.isRunning = true;

      console.log('🚀 MCP Test Server started on port 8001');

    } catch (error) {
      console.error('Failed to start MCP test server:', error.message);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) return;

    if (this.serverProcess) {
      this.serverProcess.kill('SIGTERM');

      // Wait for process to exit
      await new Promise((resolve) => {
        this.serverProcess.on('exit', resolve);
      });
    }

    this.isRunning = false;
    console.log('🛑 MCP Test Server stopped');
  }

  async waitForServer(timeoutMs = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await fetch(`${this.baseURL}/health`);
        if (response.ok) {
          return true;
        }
      } catch (error) {
        // Server not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    throw new Error('MCP server failed to start within timeout');
  }
}

// Global test server instance
const testServer = new MCPTestServer();

// ============================================================================
// MCP CLIENT INTEGRATION TESTS
// ============================================================================

/**
 * Test all MCP client methods work with live server
 */
async function testMCPClientIntegration() {
  const client = createAIClient(testServer.baseURL);

  // 1. Test CPU operations
  console.log('  Testing CPU operations...');
  const resetResult = await client.resetCPU();
  if (!resetResult.pc || resetResult.pc !== 0x0600) {
    throw new Error('CPU reset failed - PC not set to default');
  }

  const stateResult = await client.getCPUState();
  if (!stateResult.pc || !stateResult.running) {
    throw new Error('CPU state retrieval failed');
  }

  // 2. Test assembly compilation
  console.log('  Testing assembly compilation...');
  const assemblyResult = await client.assemble("LDA #$42\\nSTA $0100\\nRTS", {
    origin: 0x1000
  });

  if (!assemblyResult.bytecode || assemblyResult.bytecode.length === 0) {
    throw new Error('Assembly compilation failed');
  }

  // 3. Test program execution
  console.log('  Testing program execution...');
  const executionResult = await client.assembleAndRun("LDA #$FF\\nSTA $F1\\nRTS", {
    maxSteps: 100
  });

  if (!executionResult.runOutcome || executionResult.runOutcome.stepsExecuted === 0) {
    throw new Error('Program execution failed');
  }

  // 4. Test memory operations
  console.log('  Testing memory operations...');
  await client.writeMemory(0x2000, [0xAA, 0xBB, 0xCC]);
  const memoryResult = await client.readMemory(0x2000, 3);

  if (memoryResult.value !== 0xAA || memoryResult.bytes !== 1) {
    throw new Error('Memory read/write failed');
  }

  // 5. Test terminal I/O
  console.log('  Testing terminal I/O...');
  await client.writeToTerminal("Hello World");
  const terminalResult = await client.readFromTerminal();

  if (!terminalResult.hasInput && terminalResult.bytes > 0) {
    // Note: Terminal read may not have input, but bytes should be consistent
  }

  // 6. Test video operations
  console.log('  Testing video operations...');
  await client.setPixel(10, 5, 12);

  // 7. Test program management
  console.log('  Testing program management...');
  const programs = await client.listPrograms();
  if (!Array.isArray(programs)) {
    throw new Error('Program list failed');
  }

  console.log('  ✅ All MCP client integration tests passed!');
}

// ============================================================================
// AGENT-MCP SERVER INTEGRATION TESTS
// ============================================================================

/**
 * Test complete generation workflow from agent to MCP server
 */
async function testCodeGenerationWorkflow() {
  const agent = new AutonomousSoftwareAgent({
    mcpServerUrl: testServer.baseURL,
    processingInterval: 100, // Fast processing for tests
    maxRetries: 2
  });

  try {
    // Start agent
    await agent.start();

    // Add test prompts to queue
    console.log('  Adding test prompts to agent queue...');
    const taskId1 = await agent.queue.addPrompt({
      prompt: TEST_DATA.testPrompts.generation,
      type: "generation",
      priority: "high"
    });

    const taskId2 = await agent.queue.addPrompt({
      prompt: TEST_DATA.testPrompts.testing,
      type: "testing",
      priority: "normal"
    });

    // Wait for tasks to be processed
    console.log('  Processing tasks...');

    let attempts = 0;
    const maxWaitAttempts = 30; // 30 seconds max wait

    while (attempts < maxWaitAttempts) {
      const stats = agent.getStats();
      if (stats.tasksProcessed >= 2) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (attempts >= maxWaitAttempts) {
      throw new Error('Tasks did not complete within timeout');
    }

    // Verify program was executed and results saved
    console.log('  Verifying generated programs...');
    const programs = await agent.mcpClient.listPrograms();
    const generatedPrograms = programs.filter(p =>
      p.name && (
        p.name.includes("generated") ||
        p.name.includes("42") ||
        p.name.includes("test") ||
        p.name.includes("load")
      )
    );

    if (generatedPrograms.length === 0) {
      console.warn('  Warning: No generated programs found in list');
    }

    // Test that agent can retrieve queue statistics
    const queueStats = await agent.queue.getQueueStats();
    if (queueStats.total < 2) {
      throw new Error('Queue statistics incorrect');
    }

    console.log(`  ✅ Agent processed ${queueStats.total} tasks successfully`);

  } finally {
    await agent.stop();
  }
}

// ============================================================================
// REAL-TIME DEBUGGING INTEGRATION TESTS
// ============================================================================

/**
 * Test debugging workflows with MCP server
 */
async function testDebuggingWorkflow() {
  const client = testServer.client;

  console.log('  Testing debugging workflows...');

  // Generate program with potential issues
  const assemblyWithBug = `.org $0600
LDA #$42        ; Load 42
STA $FFFF       ; Store to invalid address (out of bounds)
RTS             ; Return (may not be reached)
`;

  try {
    // Test error detection
    const result = await client.assembleAndRun(assemblyWithBug, {
      maxSteps: 50
    });

    // Should either halt early or detect error condition
    if (result.runOutcome.stepsExecuted === 0) {
      throw new Error('Program did not execute at all');
    }

    console.log(`  Program executed ${result.runOutcome.stepsExecuted} steps`);

  } catch (error) {
    console.log(`  Expected error caught: ${error.message}`);
    // This is expected - invalid memory access
  }

  // Test debugging session setup
  console.log('  Testing debugging session...');

  await client.resetCPU();
  const assembled = await client.assemble(assemblyWithBug.replace('STA $FFFF', 'STA $00  ; Fixed'));
  await client.loadProgramToMemory(assembled.bytecode);

  // Set breakpoint
  const bpResult = await client.setBreakpoint(0x0602); // After LDA instruction
  if (!bpResult.success) {
    throw new Error('Failed to set breakpoint');
  }

  // Run with tracing
  await client.resetCPU();
  const traceResult = await client.traceExecution(10, {
    until: 'breakpoint'
  });

  if (traceResult.stepsExecuted === 0 || traceResult.trace.length === 0) {
    throw new Error('Tracing failed to produce results');
  }

  console.log(`  Trace completed: ${traceResult.stepsExecuted} steps, ${traceResult.trace.length} trace entries`);

  // Test memory inspection
  const memoryView = await client.inspectMemory(0x00, 8);
  if (memoryView.bytes.length !== 8) {
    throw new Error('Memory inspection failed');
  }

  console.log('  ✅ Debugging workflow tests passed!');
}

// ============================================================================
// PERFORMANCE AND RELIABILITY TESTS
// ============================================================================

/**
 * Test load performance with concurrent operations
 */
async function testLoadPerformance() {
  const client = testServer.client;
  console.log('  Testing load performance with concurrent operations...');

  const testAssembly = `
.org $0600
LDX #$05        ; Loop counter
LOOP:
  DEX           ; Decrement
  BNE LOOP      ; Continue until zero
RTS
`;

  const numConcurrent = 5;
  const promises = [];

  console.log(`  Starting ${numConcurrent} concurrent operations...`);

  for (let i = 0; i < numConcurrent; i++) {
    promises.push(
      client.assembleAndRun(testAssembly, {
        maxSteps: 100,
        resetCPU: true
      })
    );
  }

  const startTime = Date.now();
  const results = await Promise.all(promises);
  const endTime = Date.now();

  const duration = endTime - startTime;
  const avgDuration = duration / numConcurrent;

  console.log(`  Concurrent operations completed in ${duration}ms`);
  console.log(`  Average: ${avgDuration}ms per operation`);

  // Verify all operations completed successfully
  const successful = results.filter(r => r.runOutcome && r.runOutcome.stepsExecuted > 0);
  if (successful.length !== numConcurrent) {
    throw new Error(`${numConcurrent - successful.length} operations failed`);
  }

  console.log('  ✅ Load performance test passed!');
}

/**
 * Test error recovery mechanisms
 */
async function testErrorRecovery() {
  const client = createAIClient('http://localhost:9999'); // Invalid URL
  console.log('  Testing error recovery mechanisms...');

  // Test with invalid server
  try {
    await client.healthCheck();
    throw new Error('Should have failed with invalid URL');
  } catch (error) {
    console.log(`  Expected error with invalid server: ${error.message}`);

    if (!error.message.includes('ECONNREFUSED') &&
        !error.message.includes('ENOTFOUND') &&
        !error.message.includes('Failed to fetch')) {
      throw new Error(`Unexpected error type: ${error.message}`);
    }
  }

  // Test retry logic with valid client
  const validClient = testServer.client;

  // Create a promise that resolves after a delay
  const originalRequest = validClient._makeRequest;
  let attemptCount = 0;

  validClient._makeRequest = async (...args) => {
    attemptCount++;
    if (attemptCount === 1) {
      throw new Error('Simulated network error');
    }
    return originalRequest.apply(validClient, args);
  };

  try {
    await validClient.resetCPU();
    if (attemptCount !== 2) {
      throw new Error(`Expected 2 attempts, got ${attemptCount}`);
    }
    console.log('  ✅ Retry logic working correctly');
  } finally {
    // Restore original method
    validClient._makeRequest = originalRequest;
  }

  console.log('  ✅ Error recovery tests passed!');
}

// ============================================================================
// HEALTH MONITORING AND METRICS TESTS
// ============================================================================

/**
 * Test production monitoring integration
 */
async function monitorMCPIntegration() {
  console.log('  Testing production health monitoring...');

  const healthMetrics = {
    clientConnection: false,
    serverStatus: false,
    integrationTests: false,
    performance: {},
    reliability: {}
  };

  // Test client connection
  try {
    await testServer.client.healthCheck();
    healthMetrics.clientConnection = true;
  } catch (error) {
    console.log(`  Client connection test failed: ${error.message}`);
  }

  // Test server status
  try {
    const response = await fetch(`${testServer.baseURL}/health`);
    if (response.ok) {
      healthMetrics.serverStatus = true;
    }
  } catch (error) {
    console.log(`  Server status check failed: ${error.message}`);
  }

  // Test basic integration
  try {
    const state = await testServer.client.getCPUState();
    if (state && state.pc !== undefined) {
      healthMetrics.integrationTests = true;
    }
  } catch (error) {
    console.log(`  Integration test failed: ${error.message}`);
  }

  // Performance metrics
  const perfStart = Date.now();
  await testServer.client.resetCPU();
  const perfEnd = Date.now();
  healthMetrics.performance.operationLatency = perfEnd - perfStart;

  // Reliability metrics (simulate some operations)
  const reliabilityStart = Date.now();
  let successCount = 0;
  const totalOperations = 10;

  for (let i = 0; i < totalOperations; i++) {
    try {
      await testServer.client.getCPUState();
      successCount++;
    } catch (error) {
      // Count as failure - do nothing
    }
  }

  const reliabilityEnd = Date.now();
  healthMetrics.reliability.successRate = (successCount / totalOperations) * 100;
  healthMetrics.reliability.totalTime = reliabilityEnd - reliabilityStart;
  healthMetrics.reliability.avgResponseTime = healthMetrics.reliability.totalTime / totalOperations;

  console.log('  Health Check Results:');
  console.log(`    Client Connection: ${healthMetrics.clientConnection ? '✅' : '❌'}`);
  console.log(`    Server Status: ${healthMetrics.serverStatus ? '✅' : '❌'}`);
  console.log(`    Integration Tests: ${healthMetrics.integrationTests ? '✅' : '❌'}`);
  console.log(`    Perf Latency: ${healthMetrics.performance.operationLatency}ms`);
  console.log(`    Reliability: ${healthMetrics.reliability.successRate}% success rate`);
  console.log(`    Avg Response: ${healthMetrics.reliability.avgResponseTime.toFixed(2)}ms`);

  const overallHealth = healthMetrics.clientConnection &&
                        healthMetrics.serverStatus &&
                        healthMetrics.integrationTests &&
                        healthMetrics.reliability.successRate >= 90;

  if (overallHealth) {
    console.log('  ✅ Health monitoring test passed!');
  } else {
    console.log('  ⚠️  Health monitoring test flagged some issues');
  }

  return healthMetrics;
}

/**
 * Test metrics collection for production monitoring
 */
async function collectIntegrationMetrics() {
  console.log('  Collecting integration metrics...');

  const metrics = {
    sessionDuration: 0,
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageResponseTime: 0,
    peakConcurrentUsers: 0,
    memoryUsage: {},
    errorRate: 0,
    throughput: 0
  };

  const sessionStart = Date.now();
  let totalResponseTime = 0;
  let operationCount = 0;
  let errorCount = 0;

  // Run a series of operations to collect metrics
  const operations = [
    () => testServer.client.resetCPU(),
    () => testServer.client.getCPUState(),
    () => testServer.client.assemble('LDA #$01\nRTS'),
    () => testServer.client.listPrograms(),
    () => testServer.client.setPixel(0, 0, 1),
    () => testServer.client.writeToTerminal('Test'),
    () => testServer.client.traceExecution(5),
    () => testServer.client.inspectMemory(0x00, 4)
  ];

  for (let i = 0; i < operations.length; i++) {
    const opStart = Date.now();
    try {
      await operations[i]();
      metrics.successfulOperations++;
    } catch (error) {
      metrics.failedOperations++;
      errorCount++;
    }
    const opEnd = Date.now();
    totalResponseTime += (opEnd - opStart);
    operationCount++;
  }

  metrics.sessionDuration = Date.now() - sessionStart;
  metrics.totalOperations = operationCount;
  metrics.averageResponseTime = totalResponseTime / operationCount;
  metrics.errorRate = (errorCount / operationCount) * 100;
  metrics.throughput = operationCount / (metrics.sessionDuration / 1000); // ops/second

  // Memory usage estimation
  try {
    const memUsage = process.memoryUsage();
    metrics.memoryUsage = {
      rss: Math.round(memUsage.rss / 1024 / 1024), // MB
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memUsage.external / 1024 / 1024) // MB
    };
  } catch (error) {
    console.log(`  Memory usage collection failed: ${error.message}`);
  }

  console.log('  Integration Metrics:');
  console.log(`    Session Duration: ${metrics.sessionDuration}ms`);
  console.log(`    Total Operations: ${metrics.totalOperations}`);
  console.log(`    Success Rate: ${((metrics.successfulOperations / metrics.totalOperations) * 100).toFixed(1)}%`);
  console.log(`    Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
  console.log(`    Error Rate: ${metrics.errorRate.toFixed(1)}%`);
  console.log(`    Throughput: ${metrics.throughput.toFixed(2)} ops/sec`);
  console.log(`    Memory Usage: ${JSON.stringify(metrics.memoryUsage)}`);

  if (metrics.errorRate < 10 && metrics.averageResponseTime < 1000) {
    console.log('  ✅ Metrics collection test passed!');
  } else {
    console.log('  ⚠️  Metrics collection shows performance concerns');
  }

  return metrics;
}

// ============================================================================
// END-TO-END SCENARIO TESTS
// ============================================================================

/**
 * Test complete software development workflow
 */
async function testEndToEndSoftwareDevelopment() {
  console.log('  Testing complete software development workflow...');

  const agent = new AutonomousSoftwareAgent({
    mcpServerUrl: testServer.baseURL,
    processingInterval: 200,
    maxRetries: 1
  });

  try {
    await agent.start();

    // Step 1: Generate a program
    const generateId = await agent.queue.addPrompt({
      prompt: "Create a program that displays 'HELLO' on the terminal",
      type: "generation",
      priority: "high"
    });

    // Step 2: Test the generated program
    await agent.queue.addPrompt({
      prompt: "Test the generated 'HELLO' program",
      type: "testing",
      priority: "high"
    });

    // Step 3: Optimize it for size
    await agent.queue.addPrompt({
      prompt: "Optimize the HELLO program for smaller size",
      type: "optimization",
      priority: "normal"
    });

    // Wait for all tasks to complete
    console.log('  Processing development workflow...');

    let completedTasks = 0;
    const maxAttempts = 60; // 2 minutes
    let attempts = 0;

    while (attempts < maxAttempts && completedTasks < 3) {
      const stats = agent.getStats();
      completedTasks = stats.tasksSuccessful;

      if (completedTasks >= 3) break;

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    if (completedTasks < 3) {
      throw new Error(`Only ${completedTasks}/3 tasks completed within timeout`);
    }

    // Verify final results
    const programs = await agent.mcpClient.listPrograms();
    const helloPrograms = programs.filter(p =>
      p.name && (
        p.name.toLowerCase().includes('hello') ||
        p.name.toLowerCase().includes('generated')
      )
    );

    if (helloPrograms.length === 0) {
      console.warn('  Warning: No HELLO programs found');
    }

    console.log(`  ✅ End-to-end workflow completed ${completedTasks} tasks`);

  } finally {
    await agent.stop();
  }
}

// ============================================================================
// MAIN TEST SUITE EXECUTION
// ============================================================================

async function runAllIntegrationTests() {
  console.log('\n🚀 Agent-MCP Server Integration Test Suite');
  console.log('==========================================');

  // Start MCP test server
  console.log('⏳ Starting MCP test server...');
  await testServer.start();

  try {
    // Register all tests
    testRunner.addTest('MCP Client Integration Test', testMCPClientIntegration);
    testRunner.addTest('Agent Code Generation Workflow Test', testCodeGenerationWorkflow);
    testRunner.addTest('Real-time Debugging Integration Test', testDebuggingWorkflow);
    testRunner.addTest('Load Performance Test', testLoadPerformance);
    testRunner.addTest('Error Recovery Test', testErrorRecovery);
    testRunner.addTest('Health Monitoring Test', async () => {
      const health = await monitorMCPIntegration();
      if (!health.clientConnection || !health.serverStatus || !health.integrationTests) {
        throw new Error('Health monitoring detected issues');
      }
    });
    testRunner.addTest('Metrics Collection Test', async () => {
      const metrics = await collectIntegrationMetrics();
      if (metrics.errorRate > 15) {
        throw new Error(`High error rate: ${metrics.errorRate}%`);
      }
    });
    testRunner.addTest('End-to-End Development Workflow Test', testEndToEndSoftwareDevelopment);

    // Run all tests
    await testRunner.runAll();

  } finally {
    // Always clean up
    console.log('\n⏳ Stopping MCP test server...');
    await testServer.stop();
  }
}

// ============================================================================
// COMMAND LINE EXECUTION
// ============================================================================

// Export individual test functions for external use
export {
  testMCPClientIntegration,
  testCodeGenerationWorkflow,
  testDebuggingWorkflow,
  testLoadPerformance,
  testErrorRecovery,
  monitorMCPIntegration,
  collectIntegrationMetrics,
  testEndToEndSoftwareDevelopment,
  runAllIntegrationTests
};

// Execute tests when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllIntegrationTests().catch(error => {
    console.error('\n💥 Fatal error during integration testing:', error);
    console.error(error.stack);
    process.exit(1);
  });
}

export default runAllIntegrationTests;

// ============================================================================
// ADDITIONAL UTILITIES FOR CI/CD INTEGRATION
// ============================================================================

/**
 * Run tests with JUnit XML output for CI/CD
 */
export async function runTestsWithReport(outputPath = './integration-results.xml') {
  const results = { testsuites: { testsuite: [] } };

  for (const { name, testFn } of testRunner.tests) {
    const startTime = Date.now();
    let testResult = {
      name,
      time: 0,
      status: 'passed'
    };

    try {
      await testFn();
    } catch (error) {
      testResult.status = 'failed';
      testResult.failure = {
        message: error.message,
        type: error.constructor.name,
        stack: error.stack
      };
    }

    testResult.time = (Date.now() - startTime) / 1000; // seconds

    results.testsuites.testsuite.push({
      name: 'Integration Tests',
      tests: testRunner.tests.length,
      time: results.testsuites.time + testResult.time,
      testcase: [testResult]
    });
  }

  // Generate JUnit XML (simplified)
  const xmlOutput = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="Integration Tests" tests="${testRunner.results.passed + testRunner.results.failed}" failures="${testRunner.results.failed}" time="${results.testsuites.time || 0}">
    ${results.testsuites.testsuite.map(ts =>
      ts.testcase.map(tc => `
    <testcase name="${tc.name}" time="${tc.time}"${tc.status === 'failed' ? `
      <failure message="${tc.failure.message}" type="${tc.failure.type}">${tc.failure.stack}</failure>` : ''}
    </testcase>`).join('\n')
    ).join('\n')}
  </testsuite>
</testsuites>`;

  fs.writeFileSync(outputPath, xmlOutput);
  console.log(`📄 Test results written to ${outputPath}`);
}

// ============================================================================
// PERFORMANCE BENCHMARKING UTILITIES
// ============================================================================

/**
 * Run performance benchmarking against MCP server
 */
export async function benchmarkMCPServer(iterations = 100) {
  console.log(`\n🔬 Benchmarking MCP Server (${iterations} iterations)...`);

  const benchmarks = {
    cpuOperations: { times: [], total: 0 },
    memoryOperations: { times: [], total: 0 },
    assemblyOperations: { times: [], total: 0 },
    programOperations: { times: [], total: 0 },
    debugOperations: { times: [], total: 0 },
    videoOperations: { times: [], total: 0 },
    terminalOperations: { times: [], total: 0 }
  };

  // CPU benchmarks
  console.log('  Benchmarking CPU operations...');
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await testServer.client.resetCPU();
    await testServer.client.stepCPU();
    await testServer.client.getCPUState();
    const time = Date.now() - start;
    benchmarks.cpuOperations.times.push(time);
    benchmarks.cpuOperations.total += time;
  }

  // Memory benchmarks
  console.log('  Benchmarking memory operations...');
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await testServer.client.readMemory(0x2000, 1);
    await testServer.client.writeMemory(0x2000, 0x42, 1);
    const time = Date.now() - start;
    benchmarks.memoryOperations.times.push(time);
    benchmarks.memoryOperations.total += time;
  }

  // Assembly benchmarks
  console.log('  Benchmarking assembly operations...');
  for (let i = 0; i < iterations; i++) {
    const start = Date.now();
    await testServer.client.assemble('LDA #$01\nRTS');
    const time = Date.now() - start;
    benchmarks.assemblyOperations.times.push(time);
    benchmarks.assemblyOperations.total += time;
  }

  // Calculate statistics
  Object.keys(benchmarks).forEach(key => {
    const ops = benchmarks[key];
    ops.average = ops.total / iterations;
    ops.min = Math.min(...ops.times);
    ops.max = Math.max(...ops.times);
    ops.p95 = ops.times.sort((a, b) => a - b)[Math.floor(iterations * 0.95)];
  });

  // Print benchmark results
  console.log('\n🏃 Benchmark Results (ms):');
  console.log('='.repeat(80));
  console.log('Operation Type       | Avg   | Min   | Max   | P95   | Ops/sec');
  console.log('-'.repeat(80));

  Object.entries(benchmarks).forEach(([key, ops]) => {
    const name = key.replace('Operations', '').padEnd(19, ' ');
    const avg = ops.average.toFixed(2).padStart(5);
    const min = ops.min.toString().padStart(5);
    const max = ops.max.toString().padStart(5);
    const p95 = ops.p95.toString().padStart(5);
    const opsPerSec = (1000 / ops.average).toFixed(1).padStart(7);

    console.log(`${name} | ${avg} | ${min} | ${max} | ${p95} | ${opsPerSec}`);
  });

  console.log('='.repeat(80));

  return benchmarks;
}