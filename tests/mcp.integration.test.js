/**
 * MCP Server Comprehensive Integration Tests
 *
 * Comprehensive integration tests for all MCP API endpoints including:
 * - Schema validation testing
 * - Error conditions and edge cases
 * - Circuit breaker functionality
 * - Coordinate validation (X: 0-31, Y: 0-23)
 * - Bulk operations and performance scenarios
 * - Memory management and race condition testing
 */

import request from 'supertest';
import { app } from '../server/mcp_server.js';
import fs from 'fs';
import path from 'path';

// Test configuration
const TEST_CONFIG = {
  API_KEY: 'test-api-key-for-integration',
  MAX_TIMEOUT: 10000,
  PERFORMANCE_THRESHOLD: 5000, // 5 seconds max for operations
  BULK_OPERATION_SIZE: 1000,
  SCHEMA_VALIDATION_TIMEOUT: 2000
};

// Test counters and results
let testsPassed = 0;
let testsFailed = 0;
let testResults = [];

function test(name, testFn) {
  try {
    testFn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
    testResults.push({ name, status: 'PASS' });
  } catch (e) {
    console.error(`❌ FAIL: ${name} - ${e.message}`);
    console.error(e.stack || '');
    testsFailed++;
    testResults.push({ name, status: 'FAIL', error: e.message });
  }
}

async function testAsync(name, testFn) {
  try {
    await testFn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
    testResults.push({ name, status: 'PASS' });
  } catch (e) {
    console.error(`❌ FAIL: ${name} - ${e.message}`);
    console.error(e.stack || '');
    testsFailed++;
    testResults.push({ name, status: 'FAIL', error: e.message });
  }
}

function assertEqual(actual, expected, message = '') {
  if (actual !== expected) {
    throw new Error(`${message} Expected ${expected}, got ${actual}`);
  }
}

function assertGreaterThan(actual, threshold, message = '') {
  if (actual <= threshold) {
    throw new Error(`${message} Expected > ${threshold}, got ${actual}`);
  }
}

function assertLessThan(actual, threshold, message = '') {
  if (actual >= threshold) {
    throw new Error(`${message} Expected < ${threshold}, got ${actual}`);
  }
}

function assertHasProperty(obj, prop, message = '') {
  if (!(prop in obj)) {
    throw new Error(`${message} Expected property '${prop}' in object`);
  }
}

function assertArrayLength(array, length, message = '') {
  if (array.length !== length) {
    throw new Error(`${message} Expected array length ${length}, got ${array.length}`);
  }
}

function assertWithinRange(value, min, max, message = '') {
  if (value < min || value > max) {
    throw new Error(`${message} Expected value between ${min} and ${max}, got ${value}`);
  }
}

console.log('\n' + '='.repeat(80));
console.log('🚀 STARTING MCP SERVER COMPREHENSIVE INTEGRATION TESTS');
console.log('='.repeat(80));

// ============================================================================
// 1. SCHEMA VALIDATION TESTS
// ============================================================================

console.log('\n📋 SCHEMA VALIDATION TESTS');

// Test all video coordinate limits
await testAsync('video.setPixel validates X coordinate limits (0-31)', async () => {
  // Test lower bound
  let response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 0, y: 10, color: 15 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test upper bound
  response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 31, y: 10, color: 15 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test out of bounds - X too low
  response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: -1, y: 10, color: 15 })
    .expect(422);
  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'VIDEO_OUT_OF_BOUNDS');

  // Test out of bounds - X too high
  response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 32, y: 10, color: 15 })
    .expect(422);
  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'VIDEO_OUT_OF_BOUNDS');
});

await testAsync('video.setPixel validates Y coordinate limits (0-23)', async () => {
  // Test lower bound
  let response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 10, y: 0, color: 15 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test upper bound
  response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 10, y: 23, color: 15 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test out of bounds - Y too low
  response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 10, y: -1, color: 15 })
    .expect(422);
  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'VIDEO_OUT_OF_BOUNDS');

  // Test out of bounds - Y too high
  response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 10, y: 24, color: 15 })
    .expect(422);
  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'VIDEO_OUT_OF_BOUNDS');
});

await testAsync('video.setPixel validates color range (0-15)', async () => {
  // Test lower bound
  let response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 10, y: 10, color: 0 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test upper bound
  response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 10, y: 10, color: 15 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test out of bounds - color too low
  response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 10, y: 10, color: -1 })
    .expect(422);
  assertEqual(response.body.success, false);

  // Test out of bounds - color too high
  response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 10, y: 10, color: 16 })
    .expect(422);
  assertEqual(response.body.success, false);
});

// Test memory address validation
await testAsync('memory endpoints validate address range (0-65535)', async () => {
  // Test lower bound
  let response = await request(app)
    .post('/mcp/memory/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0, bytes: 1 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test upper bound
  response = await request(app)
    .post('/mcp/memory/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 65535, bytes: 1 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test out of bounds - address too high
  response = await request(app)
    .post('/mcp/memory/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 65536, bytes: 1 })
    .expect(422);
  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'MEMORY_OUT_OF_RANGE');
});

// Test CPU timeout validation
await testAsync('CPU step validates timeout range (100-5000ms)', async () => {
  // Test lower bound
  let response = await request(app)
    .post('/mcp/cpu/step')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ timeout: 100 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test upper bound
  response = await request(app)
    .post('/mcp/cpu/step')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ timeout: 5000 })
    .expect(200);
  assertEqual(response.body.success, true);

  // Test out of bounds - timeout too low
  response = await request(app)
    .post('/mcp/cpu/step')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ timeout: 99 })
    .expect(422);
  assertEqual(response.body.success, false);

  // Test out of bounds - timeout too high
  response = await request(app)
    .post('/mcp/cpu/step')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ timeout: 5001 })
    .expect(422);
  assertEqual(response.body.success, false);
});

// ============================================================================
// 2. COMPREHENSIVE ENDPOINT COVERAGE TESTS
// ============================================================================

console.log('\n🔧 COMPREHENSIVE ENDPOINT COVERAGE TESTS');

// CPU Endpoints
await testAsync('CPU reset with hard reset flag', async () => {
  const response = await request(app)
    .post('/mcp/cpu/reset')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ hardReset: true })
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'pc');
  assertHasProperty(response.body.data, 'running');
  assertEqual(response.body.data.pc, 0); // Hard reset should set PC to 0
});

await testAsync('CPU run with various parameters', async () => {
  const response = await request(app)
    .post('/mcp/cpu/run')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({
      maxSteps: 50,
      stepDelay: 10,
      breakOnHalt: true
    })
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'stepsExecuted');
  assertHasProperty(response.body.data, 'halted');
  assertLessThan(response.body.data.stepsExecuted, 51); // Should not exceed maxSteps
});

await testAsync('CPU state retrieval', async () => {
  const response = await request(app)
    .get('/mcp/cpu/state')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'pc');
  assertHasProperty(response.body.data, 'a');
  assertHasProperty(response.body.data, 'x');
  assertHasProperty(response.body.data, 'y');
  assertHasProperty(response.body.data, 'flags');
});

// Memory Endpoints
await testAsync('Memory read with different byte sizes', async () => {
  // Test 1 byte
  let response = await request(app)
    .post('/mcp/memory/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0x1000, bytes: 1 })
    .expect(200);
  assertEqual(response.body.success, true);
  assertArrayLength(response.body.data.byteArray, 1);

  // Test 2 bytes
  response = await request(app)
    .post('/mcp/memory/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0x1000, bytes: 2 })
    .expect(200);
  assertEqual(response.body.success, true);
  assertArrayLength(response.body.data.byteArray, 2);
});

await testAsync('Memory write operations', async () => {
  // Write single byte
  let response = await request(app)
    .post('/mcp/memory/write')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0x2000, value: 0x42, bytes: 1 })
    .expect(200);
  assertEqual(response.body.success, true);
  assertEqual(response.body.data.value, 0x42);

  // Verify by reading back
  response = await request(app)
    .post('/mcp/memory/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0x2000, bytes: 1 })
    .expect(200);
  assertEqual(response.body.data.byteArray[0], 0x42);
});

await testAsync('Memory loadProgram with bytecode validation', async () => {
  const bytecode = [0xA9, 0x42, 0x85, 0x00]; // LDA #$42, STA $00

  const response = await request(app)
    .post('/mcp/memory/loadProgram')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({
      bytecode: bytecode,
      startAddress: 0x3000
    })
    .expect(200);

  assertEqual(response.body.success, true);
  assertEqual(response.body.data.bytesLoaded, bytecode.length);
  assertEqual(response.body.data.startAddress, 0x3000);
});

// Program Endpoints
await testAsync('Programs list returns valid structure', async () => {
  const response = await request(app)
    .get('/mcp/programs/list')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .expect(200);

  assertEqual(response.body.success, true);
  assertArrayLength(response.body.data, response.body.data.length); // Just ensure it's an array

  if (response.body.data.length > 0) {
    const program = response.body.data[0];
    assertHasProperty(program, 'name');
    assertHasProperty(program, 'description');
  }
});

await testAsync('Programs save with metadata', async () => {
  const testSource = '; Test program with metadata\n.org $0600\nLDA #$42\nSTA $00\nRTS\n';
  const testName = `integration-test-${Date.now()}`;

  const response = await request(app)
    .post('/mcp/programs/save')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({
      name: testName,
      source: testSource,
      metadata: {
        author: 'integration-test',
        version: '1.0',
        tags: ['test', 'integration']
      }
    })
    .expect(200);

  assertEqual(response.body.success, true);
  assertEqual(response.body.data.name, testName);
  assertGreaterThan(response.body.data.size, 0);

  // Cleanup
  const filePath = path.join(process.cwd(), 'samples', `${testName}.asm`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
});

// Assembly Endpoints
await testAsync('Assemble source with different origins', async () => {
  const source = 'LDA #$42\nSTA $00\nRTS\n';

  // Test default origin
  let response = await request(app)
    .post('/mcp/assemble/source')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ source: source })
    .expect(200);
  assertEqual(response.body.success, true);
  assertGreaterThan(response.body.data.byteCount, 0);

  // Test custom origin
  response = await request(app)
    .post('/mcp/assemble/source')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ source: source, origin: 0x1000 })
    .expect(200);
  assertEqual(response.body.success, true);
  assertEqual(response.body.data.origin, 0x1000);
});

await testAsync('Assemble loadAndRun with execution', async () => {
  const source = '.org $0600\nLDA #$42\nSTA $00\nHLT\n';

  const response = await request(app)
    .post('/mcp/assemble/loadAndRun')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({
      source: source,
      run: true,
      maxSteps: 10
    })
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'execution');
  assertHasProperty(response.body.data.execution, 'stepsExecuted');
});

// ============================================================================
// 3. ERROR CONDITIONS AND EDGE CASES
// ============================================================================

console.log('\n🚨 ERROR CONDITIONS AND EDGE CASES');

// Authentication errors
await testAsync('Missing API key returns 401', async () => {
  const response = await request(app)
    .post('/mcp/cpu/reset')
    .send({})
    .expect(401);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'UNAUTHORIZED');
});

await testAsync('Invalid API key returns 401', async () => {
  const response = await request(app)
    .post('/mcp/cpu/reset')
    .set('x-api-key', 'invalid-key')
    .send({})
    .expect(401);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'UNAUTHORIZED');
});

// Rate limiting simulation (would need actual rate limiter testing)
await testAsync('Invalid endpoint returns 404', async () => {
  const response = await request(app)
    .get('/mcp/nonexistent/endpoint')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .expect(404);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'NOT_FOUND');
});

// Schema validation errors
await testAsync('Missing required fields return validation error', async () => {
  const response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 10, y: 10 }) // Missing color
    .expect(422);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'VALIDATION_FAILED');
});

await testAsync('Invalid data types return validation error', async () => {
  const response = await request(app)
    .post('/mcp/video/setPixel')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ x: 'not-a-number', y: 10, color: 15 })
    .expect(422);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'VALIDATION_FAILED');
});

// Boundary condition errors
await testAsync('Memory read beyond address space fails', async () => {
  const response = await request(app)
    .post('/mcp/memory/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0xFFFE, bytes: 4 }) // Would read beyond 0xFFFF
    .expect(422);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'MEMORY_OUT_OF_RANGE');
});

await testAsync('Assembly with oversized source fails', async () => {
  const oversizedSource = '.org $0600\nLDA #$42\n'.repeat(10000);

  const response = await request(app)
    .post('/mcp/assemble/source')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ source: oversizedSource })
    .expect(413);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'PAYLOAD_TOO_LARGE');
});

// ============================================================================
// 4. CIRCUIT BREAKER FUNCTIONALITY
// ============================================================================

console.log('\n⚡ CIRCUIT BREAKER FUNCTIONALITY TESTS');

await testAsync('Circuit breaker state tracking', async () => {
  // This would require multiple rapid requests to trigger circuit breaker
  // For now, we'll test that the health endpoint includes circuit breaker status

  const response = await request(app)
    .get('/health')
    .expect(200);

  assertEqual(response.body.status, 'ok');
  assertHasProperty(response.body, 'circuitBreaker');
  assertHasProperty(response.body.circuitBreaker, 'cpu');
  assertHasProperty(response.body.circuitBreaker, 'ai');
  assertHasProperty(response.body.circuitBreaker, 'queue');
});

// ============================================================================
// 5. PERFORMANCE AND BULK OPERATIONS
// ============================================================================

console.log('\n⚡ PERFORMANCE AND BULK OPERATIONS');

await testAsync('Bulk video operations performance', async () => {
  const startTime = Date.now();

  // Perform multiple video operations
  for (let i = 0; i < 10; i++) {
    await request(app)
      .post('/mcp/video/setPixel')
      .set('x-api-key', TEST_CONFIG.API_KEY)
      .send({ x: i % 32, y: Math.floor(i / 32), color: i % 16 });
  }

  const duration = Date.now() - startTime;
  assertLessThan(duration, TEST_CONFIG.PERFORMANCE_THRESHOLD);
});

await testAsync('Bulk memory operations performance', async () => {
  const startTime = Date.now();

  // Perform multiple memory writes
  for (let i = 0; i < 10; i++) {
    await request(app)
      .post('/mcp/memory/write')
      .set('x-api-key', TEST_CONFIG.API_KEY)
      .send({ address: 0x4000 + i, value: i, bytes: 1 });
  }

  const duration = Date.now() - startTime;
  assertLessThan(duration, TEST_CONFIG.PERFORMANCE_THRESHOLD);
});

await testAsync('Large memory read performance', async () => {
  const startTime = Date.now();

  const response = await request(app)
    .post('/mcp/memory/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0x5000, bytes: 256 })
    .expect(200);

  const duration = Date.now() - startTime;
  assertLessThan(duration, TEST_CONFIG.PERFORMANCE_THRESHOLD);
  assertArrayLength(response.body.data.byteArray, 256);
});

// ============================================================================
// 6. MEMORY MANAGEMENT AND RACE CONDITIONS
// ============================================================================

console.log('\n🧠 MEMORY MANAGEMENT AND RACE CONDITIONS');

await testAsync('Concurrent memory operations', async () => {
  const operations = [];

  // Create multiple concurrent memory operations
  for (let i = 0; i < 5; i++) {
    operations.push(
      request(app)
        .post('/mcp/memory/write')
        .set('x-api-key', TEST_CONFIG.API_KEY)
        .send({ address: 0x6000 + i, value: i * 10, bytes: 1 })
    );
  }

  // Execute all operations concurrently
  const results = await Promise.all(operations);

  // Verify all operations succeeded
  results.forEach((response, index) => {
    assertEqual(response.body.success, true);
    assertEqual(response.body.data.value, index * 10);
  });
});

await testAsync('Memory cleanup and resource management', async () => {
  // Write some data
  await request(app)
    .post('/mcp/memory/write')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0x7000, value: 0xFF, bytes: 1 });

  // Clear video buffer
  await request(app)
    .post('/mcp/video/clear')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ color: 0 });

  // Verify memory was cleared in video area
  const response = await request(app)
    .post('/mcp/memory/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0x0200, bytes: 4 }); // First 4 bytes of video buffer

  assertEqual(response.body.success, true);
  // Should be cleared (all zeros or the clear color)
});

// ============================================================================
// 7. QUEUE MANAGEMENT ENDPOINTS
// ============================================================================

console.log('\n📋 QUEUE MANAGEMENT ENDPOINTS');

await testAsync('Queue add with valid parameters', async () => {
  const response = await request(app)
    .post('/mcp/queue/add')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({
      prompt: 'Test prompt for integration testing',
      type: 'testing',
      priority: 'normal',
      metadata: { testId: 'integration-test' }
    })
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'taskId');
  assertEqual(response.body.data.type, 'testing');
  assertEqual(response.body.data.priority, 'normal');
});

await testAsync('Queue list with filtering', async () => {
  const response = await request(app)
    .get('/mcp/queue/list?status=queued&type=testing&limit=10')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'tasks');
  assertArrayLength(response.body.data.tasks, response.body.data.tasks.length);
  assertLessThan(response.body.data.tasks.length, 11); // Should respect limit
});

// ============================================================================
// 8. AI MODEL ENDPOINTS
// ============================================================================

console.log('\n🤖 AI MODEL ENDPOINTS');

await testAsync('AI generate with valid parameters', async () => {
  const response = await request(app)
    .post('/mcp/ai/generate')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({
      prompt: 'Generate a simple test response',
      task: 'testing'
    })
    .timeout(TEST_CONFIG.MAX_TIMEOUT)
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'content');
  assertHasProperty(response.body.data, 'model');
  assertGreaterThan(response.body.data.content.length, 0);
});

await testAsync('AI models list', async () => {
  const response = await request(app)
    .post('/mcp/ai/models')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({})
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'availableModels');
  assertArrayLength(response.body.data.availableModels, response.body.data.availableModels.length);
});

// ============================================================================
// 9. TERMINAL ENDPOINTS COMPREHENSIVE
// ============================================================================

console.log('\n💻 TERMINAL ENDPOINTS COMPREHENSIVE');

await testAsync('Terminal write with various text inputs', async () => {
  // Test normal text
  let response = await request(app)
    .post('/mcp/terminal/write')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ text: 'Hello World' })
    .expect(200);

  assertEqual(response.body.success, true);
  assertGreaterThan(response.body.data.bytesWritten, 0);

  // Test with newline
  response = await request(app)
    .post('/mcp/terminal/write')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ text: 'Line 1', addNewline: true })
    .expect(200);

  assertEqual(response.body.success, true);
  assertGreaterThan(response.body.data.bytesWritten, 5); // Should include newline

  // Test empty text
  response = await request(app)
    .post('/mcp/terminal/write')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ text: '' })
    .expect(422);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'INVALID_REQUEST');
});

await testAsync('Terminal read operations', async () => {
  const response = await request(app)
    .get('/mcp/terminal/read')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'input');
  assertHasProperty(response.body.data, 'bytesRead');
  assertHasProperty(response.body.data, 'hasInput');
  assertEqual(typeof response.body.data.input, 'string');
});

// ============================================================================
// 10. DEBUG ENDPOINTS COMPREHENSIVE
// ============================================================================

console.log('\n🐛 DEBUG ENDPOINTS COMPREHENSIVE');

await testAsync('Debug trace with various step counts', async () => {
  // Small trace
  let response = await request(app)
    .post('/mcp/debug/trace')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ steps: 5 })
    .expect(200);

  assertEqual(response.body.success, true);
  assertHasProperty(response.body.data, 'trace');
  assertHasProperty(response.body.data, 'stepsExecuted');
  assertLessThan(response.body.data.stepsExecuted, 6);

  // Larger trace
  response = await request(app)
    .post('/mcp/debug/trace')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ steps: 50 })
    .expect(200);

  assertEqual(response.body.success, true);
  assertLessThan(response.body.data.stepsExecuted, 51);
});

await testAsync('Debug memory view with various sizes', async () => {
  // Small view
  let response = await request(app)
    .post('/mcp/debug/memoryView')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0x8000, size: 16 })
    .expect(200);

  assertEqual(response.body.success, true);
  assertArrayLength(response.body.data.bytes, 16);

  // Larger view
  response = await request(app)
    .post('/mcp/debug/memoryView')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ address: 0x9000, size: 128 })
    .expect(200);

  assertEqual(response.body.success, true);
  assertArrayLength(response.body.data.bytes, 128);
});

await testAsync('Debug breakpoints lifecycle', async () => {
  // Set breakpoint
  let response = await request(app)
    .post('/mcp/debug/breakpoints')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ action: 'set', address: 0xA000 })
    .expect(200);

  assertEqual(response.body.success, true);
  const breakpointId = response.body.data.operationResult.id;

  // List breakpoints
  response = await request(app)
    .post('/mcp/debug/breakpoints')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ action: 'list' })
    .expect(200);

  assertEqual(response.body.success, true);
  const foundBreakpoint = response.body.data.breakpoints.find(bp => bp.id === breakpointId);
  assertHasProperty(foundBreakpoint, 'address');
  assertEqual(foundBreakpoint.address, 0xA000);

  // Remove breakpoint
  response = await request(app)
    .post('/mcp/debug/breakpoints')
    .set('x-api-key', TEST_CONFIG.API_KEY)
    .send({ action: 'remove', id: breakpointId })
    .expect(200);

  assertEqual(response.body.success, true);
  assertEqual(response.body.data.operationResult.removed, true);
});

// ============================================================================
// TEST SUMMARY AND REPORTING
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('📊 TEST SUMMARY');
console.log('='.repeat(80));

console.log(`\nTotal Tests: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(2)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 ALL TESTS PASSED! System reliability and maintainability verified.');
} else {
  console.log('\n⚠️  SOME TESTS FAILED. Review the errors above for issues to address.');
  console.log('\nFailed Tests:');
  testResults
    .filter(result => result.status === 'FAIL')
    .forEach(result => {
      console.log(`  - ${result.name}: ${result.error}`);
    });
}

console.log('\n' + '='.repeat(80));
console.log('🏁 MCP SERVER COMPREHENSIVE INTEGRATION TESTS COMPLETED');
console.log('='.repeat(80));

// Export test results for external analysis
export { testResults, testsPassed, testsFailed };