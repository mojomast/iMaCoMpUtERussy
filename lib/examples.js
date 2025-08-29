/**
 * MCP Client Library Examples
 *
 * This file contains practical examples demonstrating how to use the
 * iMaCoMpUtERussy MCP client library for AI agent integration.
 *
 * Run examples with: node lib/examples.js (requires MCP server to be running)
 */

import { MCPClient, createAIClient, aiDevelopmentWorkflow } from './mcp-client.js';

/**
 * Example 1: Basic Client Usage
 * Demonstrates fundamental MCP client operations
 */
async function basicUsageExample() {
  console.log('=== Basic Usage Example ===');

  const client = new MCPClient('http://localhost:8001', {
    timeoutMs: 10000,
    enableCache: true
  });

  try {
    // Test server connectivity
    console.log('Testing server connectivity...');
    const health = await client.healthCheck();
    console.log('Server status:', health.healthy ? '🟢 Online' : '🔴 Offline');

    // List available programs
    console.log('\nListing available programs...');
    const programs = await client.listPrograms();
    console.log(`Found ${programs.length} programs:`);
    programs.forEach(program => {
      console.log(`  - ${program.name}: ${program.description}`);
    });

    // Reset CPU and check state
    console.log('\nResetting CPU...');
    const resetState = await client.resetCPU();
    console.log('CPU reset to:', `PC=${resetState.pc}, A=${resetState.a}`);

    // Assemble and run simple program
    console.log('\nAssembling and running simple program...');
    const source = `
      .org $0600
      LDA #$42      ; Load 42 into accumulator
      STA $00       ; Store at address $00
      HLT           ; Halt execution
    `;

    const result = await client.assembleAndRun(source);
    console.log('Program executed successfully!');
    console.log(`• Assembled ${result.assembledByteCount} bytes`);
    console.log(`• Executed ${result.runOutcome.stepsExecuted} steps`);

  } catch (error) {
    console.error('Error in basic usage example:', error.message);
  }
}

/**
 * Example 2: Memory Operations
 * Demonstrates reading and writing memory
 */
async function memoryOperationsExample() {
  console.log('\n=== Memory Operations Example ===');

  const client = new MCPClient('http://localhost:8001');

  try {
    // Write different values to memory
    console.log('Writing test values to memory...');
    await client.writeMemory(0x0064, 42);       // Write byte
    await client.writeMemory(0x0200, 0x1234, 2); // Write word

    // Read values back
    console.log('Reading values back...');
    const byteResult = await client.readMemory(0x0064, 1);
    const wordResult = await client.readMemory(0x0200, 2);

    console.log(`Byte at $64: ${byteResult.value} (0x${byteResult.hexValue})`);
    console.log(`Word at $200: ${wordResult.value} (0x${wordResult.hexValue})`);

    // Load bytecode
    console.log('\nLoading bytecode...');
    const bytecode = [0xA9, 0x42, 0x85, 0x00, 0x00]; // LDA #$42, STA $00, BRK
    const loadResult = await client.loadProgramToMemory(bytecode, 0x0600);
    console.log(`Loaded ${loadResult.bytesLoaded} bytes at $${loadResult.startAddress.toString(16)}`);

  } catch (error) {
    console.error('Error in memory operations example:', error.message);
  }
}

/**
 * Example 3: Terminal Operations
 * Demonstrates terminal I/O operations
 */
async function terminalOperationsExample() {
  console.log('\n=== Terminal Operations Example ===');

  const client = new MCPClient('http://localhost:8001');

  try {
    // Write to terminal with newline
    console.log('Writing to terminal...');
    await client.writeToTerminal('Hello from MCP Client!', true);
    await client.writeToTerminal('This is line 2', true);

    // Read from terminal (may be empty if no input)
    console.log('Reading from terminal...');
    const input = await client.readFromTerminal();
    if (input.hasInput) {
      console.log('Terminal input:', input.input);
    } else {
      console.log('No terminal input available');
    }

    // Clear terminal
    console.log('Clearing terminal...');
    await client.clearTerminal();
    console.log('Terminal cleared');

  } catch (error) {
    console.error('Error in terminal operations example:', error.message);
  }
}

/**
 * Example 4: Video Operations
 * Demonstrates video framebuffer operations
 */
async function videoOperationsExample() {
  console.log('\n=== Video Operations Example ===');

  const client = new MCPClient('http://localhost:8001');

  try {
    // Draw a simple pattern
    console.log('Drawing pattern on video display...');

    // Draw a diagonal line
    for (let i = 0; i < 32; i++) {
      if (i < 32) { // Stay within bounds
        await client.setPixel(i, i, (i % 16) + 1); // Cycle through colors
      }
    }

    // Draw a rectangle
    const color = 15; // White
    for (let x = 5; x < 15; x++) {
      await client.setPixel(x, 5, color);  // Top
      await client.setPixel(x, 14, color); // Bottom
    }
    for (let y = 5; y < 15; y++) {
      await client.setPixel(5, y, color);  // Left
      await client.setPixel(14, y, color); // Right
    }

    // Update display
    console.log('Updating video display...');
    const updateResult = await client.updateVideoDisplay();
    console.log(`Display updated in ${updateResult.durationMs}ms`);

    // Optional: Clear display after delay
    setTimeout(async () => {
      await client.clearVideoDisplay(0);
      console.log('Display cleared');
    }, 5000);

  } catch (error) {
    console.error('Error in video operations example:', error.message);
  }
}

/**
 * Example 5: Debug Operations
 * Demonstrates debugging capabilities
 */
async function debugOperationsExample() {
  console.log('\n=== Debug Operations Example ===');

  const client = new MCPClient('http://localhost:8001');

  try {
    // Load a debug program
    const debugProgram = `
      .org $0600
      LDA #$01      ; Load 1 (start counter)
      STA $20       ; Store at $20
      INC $20       ; Increment counter
      INC $20       ; Increment again
      HLT           ; Halt
    `;

    console.log('Setting up debug session...');
    await client.resetCPU();
    await client.assembleAndRun(debugProgram);

    // Set breakpoint after first increment
    await client.setBreakpoint(0x0605); // After first INC

    // Trace execution
    console.log('Tracing execution with breakpoint...');
    const trace = await client.traceExecution(10, {
      until: 'breakpoint'
    });

    console.log(`Traced ${trace.stepsExecuted} steps`);
    if (trace.haltReason === 'breakpoint_hit') {
      console.log('Execution stopped at breakpoint');
    }

    console.log('Trace summary:');
    trace.trace.slice(0, 5).forEach(step => {
      console.log(`  PC=${step.pc.toString(16)}: ${step.instruction}`);
    });

    // Inspect memory around program
    console.log('\nInspecting program memory...');
    const memoryInspect = await client.inspectMemory(0x0600, 0x060F);
    console.log('Memory at program start:', memoryInspect.bytes.slice(0, 10));

  } catch (error) {
    console.error('Error in debug operations example:', error.message);
  }
}

/**
 * Example 6: AI-Focused Workflows
 * Demonstrates AI-specific features
 */
async function aiWorkflowsExample() {
  console.log('\n=== AI-Focused Workflows Example ===');

  // Use AI-optimized client
  const aiClient = createAIClient('http://localhost:8001');

  try {
    // Code generation
    console.log('Generating assembly from natural language...');
    const spec = "Load value 42 into accumulator, add 10, store result, then halt";
    const generated = await aiClient.generateAssembly(spec);

    console.log('Generated code:');
    console.log(generated.source);
    console.log(`Estimated cycles: ${generated.estimatedCycles}`);

    // Test the generated code
    console.log('\nTesting generated code...');
    const tests = [
      { description: "Should halt after execution", expectHalt: true },
      { description: "Final result should be 52", expectA: 52 }
    ];

    const testResults = await aiClient.testAssembly(generated.source, tests);
    console.log(`Test results: ${testResults.passed}/${testResults.total} passed`);

    // Optimize the code
    console.log('\nOptimizing code...');
    const optimized = await aiClient.optimizeAssembly(generated.source, {
      minimizeSize: true
    });

    console.log('Optimization result:');
    console.log(`Original size: ${optimized.original.sizeBytes} bytes`);
    console.log(`Optimized size: ${optimized.optimized.sizeBytes} bytes`);
    console.log('Improvements:', optimized.optimizations.join(', '));

  } catch (error) {
    console.error('Error in AI workflows example:', error.message);
  }
}

/**
 * Example 7: Batch Operations
 * Demonstrates processing multiple operations efficiently
 */
async function batchOperationsExample() {
  console.log('\n=== Batch Operations Example ===');

  const client = new MCPClient('http://localhost:8001');

  try {
    // Define batch of operations
    const operations = [
      // Reset and check state
      { type: 'resetCPU', params: [] },
      { type: 'getCPUState', params: [] },

      // Memory operations
      { type: 'writeMemory', params: [0x0020, 0xAA, 1] },
      { type: 'readMemory', params: [0x0020, 1] },

      // Terminal operations
      { type: 'writeToTerminal', params: ['Batch processing test', true] },

      // Video operations (commented to avoid slowing down)
      // { type: 'setPixel', params: [10, 10, 15] },
      // { type: 'updateVideoDisplay', params: [] },
      // { type: 'clearVideoDisplay', params: [0] }
    ];

    console.log(`Executing batch of ${operations.length} operations...`);
    const startTime = Date.now();

    const results = await client.processBatch(operations);

    const totalTime = Date.now() - startTime;

    console.log(`\nBatch completed in ${totalTime}ms:`);
    let successCount = 0;

    results.forEach((result, index) => {
      const op = operations[index];
      const status = result.success ? '✅' : '❌';
      console.log(`  ${status} ${op.type}(${op.params.join(', ')})`);

      if (result.success) {
        successCount++;
      } else {
        console.log(`     Error: ${result.error}`);
      }
    });

    console.log(`\nSummary: ${successCount}/${results.length} operations succeeded`);

  } catch (error) {
    console.error('Error in batch operations example:', error.message);
  }
}

/**
 * Example 8: Error Handling
 * Demonstrates proper error handling with MCP client
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling Example ===');

  const client = new MCPClient('http://localhost:8001', {
    retryAttempts: 1, // Keep low for demo
    timeoutMs: 5000
  });

  try {
    // Test with invalid memory address
    console.log('Testing invalid memory access...');
    await client.readMemory(0x10000); // Invalid address

  } catch (error) {
    console.log('Error caught:');
    console.log(`  Code: ${error.code}`);
    console.log(`  Message: ${error.message}`);
    console.log(`  HTTP Status: ${error.httpStatus}`);
  }

  try {
    // Test with invalid assembly
    console.log('\nTesting invalid assembly...');
    await client.assemble('INVALID MNEMONIC');

  } catch (error) {
    console.log('Assembly error caught:');
    console.log(`  Code: ${error.code}`);
    console.log(`  Message: ${error.message}`);
  }

  try {
    // Test with non-existent server (would timeout)
    console.log('\nTesting network error handling...');
    const badClient = new MCPClient('http://nonexistent:12345', {
      timeoutMs: 2000,
      retryAttempts: 0
    });

    await badClient.healthCheck();

  } catch (error) {
    console.log('Network error caught:');
    console.log(`  Code: ${error.code}`);
    console.log(`  Message: ${error.message}`);
  }
}

/**
 * Example 9: Interactive Development Session
 * Demonstrates a complete interactive development workflow
 */
async function interactiveDevelopmentExample() {
  console.log('\n=== Interactive Development Example ===');

  const client = new MCPClient('http://localhost:8001');

  try {
    console.log('🚀 Starting interactive development session...\n');

    // 1. Reset system
    console.log('1. Resetting emulator...');
    await client.resetCPU();
    await client.clearVideoDisplay();
    await client.clearTerminal();

    // 2. Create a test program
    const program = `
      .org $0600
      LDA #$20          ; Load space character
      STA $20           ; Store in memory
      LDA #$48          ; Load 'H'
      STA $F1           ; Write to terminal
      LDA #$65          ; Load 'e'
      STA $F1
      LDA #$6C          ; Load 'l'
      STA $F1
      STA $F1           ; Load 'l' again
      LDA #$6F          ; Load 'o'
      STA $F1
      LDA #$20          ; Load space
      STA $F1
      LDA #$21          ; Load '!'
      STA $F1
      HLT
    `;

    console.log('2. Creating "Hello World" program...');
    const assembled = await client.assemble(program);
    console.log(`   Assembled ${assembled.bytecode.length} bytes`);

    // 3. Load and run
    console.log('3. Loading program...');
    await client.loadProgramToMemory(assembled.bytecode, 0x0600);

    console.log('4. Executing program...');
    await client.runCPU(100);

    // 4. Inspect results
    console.log('5. Inspecting results...');
    const state = await client.getCPUState();
    console.log(`   Final PC: $${state.pc.toString(16)}`);

    const memCheck = await client.readMemory(0x0020, 1);
    console.log(`   Memory at $20: ${memCheck.value} ('${String.fromCharCode(memCheck.value)}')`);

    console.log('\n✅ Interactive session completed successfully!');

  } catch (error) {
    console.error('❌ Interactive development session failed:', error.message);
  }
}

/**
 * Example 10: Connection Testing Utility
 */
async function testConnection() {
  console.log('\n=== Connection Test ===');

  const baseUrl = 'http://localhost:8001';
  const isConnected = await MCPClient.testConnection(baseUrl);

  console.log(`Testing connection to ${baseUrl}...`);
  console.log(`Status: ${isConnected ? '🟢 CONNECTED' : '🔴 NOT CONNECTED'}`);

  if (!isConnected) {
    console.log('\nTroubleshooting tips:');
    console.log('1. Make sure the MCP server is running: npm run mcp-server');
    console.log('2. Check if port 8001 is accessible');
    console.log('3. Verify firewall settings');
  }

  return isConnected;
}

/**
 * Run All Examples
 * Executes all examples in sequence
 */
async function runAllExamples() {
  console.log('iMaCoMpUtERussy MCP Client Library Examples');
  console.log('==========================================');
  console.log('Make sure the MCP server is running on port 8001\n');

  // Test connection first
  const connected = await testConnection();
  if (!connected) {
    console.log('\n❌ Cannot run examples - MCP server not accessible');
    process.exit(1);
  }

  // Run examples
  await basicUsageExample();
  await memoryOperationsExample();
  await terminalOperationsExample();
  await videoOperationsExample();
  await debugOperationsExample();
  await aiWorkflowsExample();
  await batchOperationsExample();
  await errorHandlingExample();
  await interactiveDevelopmentExample();

  console.log('\n🎉 All examples completed!');
}

/**
 * Export individual examples for selective testing
 */
export {
  basicUsageExample,
  memoryOperationsExample,
  terminalOperationsExample,
  videoOperationsExample,
  debugOperationsExample,
  aiWorkflowsExample,
  batchOperationsExample,
  errorHandlingExample,
  interactiveDevelopmentExample,
  testConnection
};

// Run all examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples().catch(error => {
    console.error('Failed to run examples:', error);
    process.exit(1);
  });
}

// For Node.js CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    basicUsageExample,
    memoryOperationsExample,
    terminalOperationsExample,
    videoOperationsExample,
    debugOperationsExample,
    aiWorkflowsExample,
    batchOperationsExample,
    errorHandlingExample,
    interactiveDevelopmentExample,
    testConnection,
    runAllExamples
  };
}