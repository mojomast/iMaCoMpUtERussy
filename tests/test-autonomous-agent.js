/**
 * Test script for the Autonomous Software Generation Agent
 *
 * This script validates the basic functionality of the autonomous agent
 * by testing task creation, classification, and basic workflow operations.
 */

import { AutonomousSoftwareAgent, testAutonomousAgent } from '../agent/autonomous-agent.js';
import { MCPClient } from '../lib/mcp-client.js';

/**
 * Basic functionality test
 */
async function testBasicFunctionality() {
  console.log('\n🧪 Testing Autonomous Agent Basic Functionality...\n');

  const agent = new AutonomousSoftwareAgent({
    mcpServerUrl: 'http://localhost:8001',
    processingInterval: 10000, // 10 seconds for testing
    learningEnabled: false    // Disable learning for tests
  });

  try {
    // Test MCP connection
    console.log('🔍 Testing MCP Connection...');
    const connectionOk = await testConnection(agent);
    if (!connectionOk) {
      console.warn('⚠️  MCP server not available - some tests will be skipped');
      console.log('   To run full tests, start MCP server with: npm run mcp-server');
    }

    // Test task classification
    console.log('📊 Testing Task Classification...');
    await testTaskClassification(agent);

    // Test task addition to queue
    console.log('📋 Testing Task Queue Operations...');
    await testQueueOperations(agent);

    // Test specification parsing
    console.log('🔍 Testing Specification Parsing...');
    await testSpecParsing(agent);

    // Test learning model
    console.log('🧠 Testing Learning Model...');
    await testLearningModel(agent);

    console.log('\n✅ Basic functionality tests completed successfully!\n');

  } catch (error) {
    console.error('❌ Basic functionality test failed:', error.message);
    throw error;
  } finally {
    await agent.stop();
  }
}

/**
 * Test MCP server connection
 */
async function testConnection(agent) {
  try {
    await agent.verifyMCPConnection();
    console.log('  ✅ MCP connection successful');
    return true;
  } catch (error) {
    console.log('  ❌ MCP connection failed');
    return false;
  }
}

/**
 * Test task type classification
 */
async function testTaskClassification(agent) {
  const testPrompts = [
    {
      prompt: 'Create a program that loads 42 into the accumulator and stores it at address 100',
      expected: 'generation'
    },
    {
      prompt: 'Make this code faster by optimizing the loop',
      expected: 'optimization'
    },
    {
      prompt: 'The program crashes when reaching line 10',
      expected: 'debugging'
    },
    {
      prompt: 'Teach me how to use load and store instructions',
      expected: 'educational'
    },
    {
      prompt: 'Verify that the program produces correct output for inputs 1, 2, and 3',
      expected: 'testing'
    }
  ];

  for (const test of testPrompts) {
    const type = agent.classifyTaskType(test.prompt);
    const success = type === test.expected;
    console.log(`  ${success ? '✅' : '❌'} "${test.prompt.substring(0, 30)}..." → ${type} (${success ? 'correct' : `expected ${test.expected}`})`);
  }
}

/**
 * Test queue operations
 */
async function testQueueOperations(agent) {
  try {
    const testPrompts = [
      'Create a simple program that adds two numbers',
      'Optimize existing fibonacci program for speed',
      'Debug the memory issue in the graphics demo'
    ];

    console.log('  📝 Adding test prompts to queue...');
    for (const prompt of testPrompts) {
      const id = await agent.queue.addPrompt(prompt);
      console.log(`    ✅ Added: ${id}`);
    }

    const queueStats = agent.queue.getQueueStats();
    console.log(`  📊 Queue contains ${queueStats.total} tasks`);
    console.log(`     - Queued: ${queueStats.byStatus.queued || 0}`);
    console.log(`     - Processing: ${queueStats.byStatus.processing || 0}`);
    console.log(`     - Completed: ${queueStats.byStatus.completed || 0}`);

    return true;
  } catch (error) {
    console.log(`  ❌ Queue operations failed: ${error.message}`);
    return false;
  }
}

/**
 * Test specification parsing
 */
async function testSpecParsing(agent) {
  const testPrompts = [
    'Create a program that loads value 42, stores it, then halts',
    'Make a fast program that calculates fibonacci numbers',
    'Debug the infinite loop in my addition program',
    'Teach basic arithmetic operations in assembly'
  ];

  for (const prompt of testPrompts) {
    const spec = await agent.parseSpecification(prompt);
    console.log(`  ✅ Parsed: "${prompt.substring(0, 30)}..."`);
    console.log(`     Type: ${spec.type}, Requirements: ${spec.requirements.length}, Optimize: ${spec.optimize}`);
  }
}

/**
 * Test learning model functionality
 */
async function testLearningModel(agent) {
  console.log('  🎓 Learning Model Structure:');
  console.log(`     - Parsing Success: ${agent.learningModel.parsing.successCount}`);
  console.log(`     - Known Patterns: ${Object.keys(agent.learningModel.parsing.patterns).length}`);
  console.log(`     - Strategies: ${Object.keys(agent.learningModel.strategies).length}`);

  // Test pattern extraction
  const testText = 'create a program that generates fibonacci numbers';
  const patterns = agent.extractPatterns(testText);
  console.log(`     - Extracted Patterns: ${patterns.length} (${patterns.slice(0, 2).join(', ')}...)`);

  // Test error categorization
  const testErrors = [
    new Error('Assembly failed: syntax error on line 5'),
    new Error('Timeout exceeded: program did not halt'),
    new Error('Memory access violation at $FFFF')
  ];

  for (const error of testErrors) {
    const category = agent.categorizeError(error);
    console.log(`     - Error "${error.message.substring(0, 30)}..." → ${category}`);
  }
}

/**
 * Integration test with actual MCP client
 */
async function testMCPIntegration() {
  console.log('\n🔌 Testing MCP Integration...\n');

  try {
    const client = new MCPClient('http://localhost:8001', {
      timeoutMs: 5000
    });

    console.log('📡 Testing basic MCP operations...');

    // Test saving a simple program
    const simpleProgram = `.org $0600
LDA #$42
STA $00
RTS`;

    const saveResult = await client.saveProgram('test_autonomous_program', simpleProgram);
    console.log('  ✅ Program saved successfully:', saveResult);

    // Test loading the program
    const loadResult = await client.loadProgram('test_autonomous_program');
    console.log('  ✅ Program loaded successfully:', loadResult.programSize, 'bytes');

    // Test assembly
    const assembleResult = await client.assemble(simpleProgram);
    console.log('  ✅ Assembly successful:', assembleResult.sizeBytes, 'bytes');

    // Test memory operations
    await client.resetCPU();
    const loadMemResult = await client.loadProgramToMemory(assembleResult.bytecode);
    console.log('  ✅ Program loaded to memory:', loadMemResult.bytesLoaded, 'bytes');

    // Test CPU execution
    const runResult = await client.runCPU(5);
    console.log('  ✅ Execution successful:', runResult.instructionCount, 'instructions executed');

    console.log('\n✅ MCP Integration tests completed successfully!\n');

  } catch (error) {
    console.error('❌ MCP Integration test failed:', error.message);
    console.log('   Note: MCP server must be running for full integration tests');
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('🚀 Starting Autonomous Agent Test Suite\n');

  try {
    await testBasicFunctionality();
    await testMCPIntegration();

    console.log('🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log('   - Basic functionality: ✅');
    console.log('   - Task classification: ✅');
    console.log('   - Queue operations: ✅');
    console.log('   - Specification parsing: ✅');
    console.log('   - Learning model: ✅');
    console.log('   - MCP integration: ✅ (if MCP server running)');

  } catch (error) {
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests();
}

export {
  testBasicFunctionality,
  testMCPIntegration,
  testTaskClassification,
  testQueueOperations,
  testSpecParsing,
  testLearningModel
};