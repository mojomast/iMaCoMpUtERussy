/**
 * MCP Server Tests
 *
 * Basic smoke tests for the iMaCoMpUtERussy MCP server.
 * Uses supertest for HTTP endpoint testing.
 */

import request from 'supertest';
import { app } from '../server/mcp_server.js';

// Test counters
let testsPassed = 0;
let testsFailed = 0;

function test(name, testFn) {
  try {
    testFn();
    console.log(`PASS Test: ${name}`);
    testsPassed++;
  } catch (e) {
    console.error(`FAIL Test: ${name} - ${e.message}`);
    console.error(e.stack || '');
    testsFailed++;
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

function assertHasProperty(obj, prop, message = '') {
  if (!(prop in obj)) {
    throw new Error(`${message} Expected property '${prop}' in object`);
  }
}

async function testAsync(name, testFn) {
  try {
    await testFn();
    console.log(`PASS Test: ${name}`);
    testsPassed++;
  } catch (e) {
    console.error(`FAIL Test: ${name} - ${e.message}`);
    console.error(e.stack || '');
    testsFailed++;
  }
}

console.log('\n=== Running MCP Server Smoke Tests ===');
  // Health check endpoint test
  await testAsync('health check endpoint returns ok status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    assertEqual(response.body.status, 'ok');
    assertHasProperty(response.body, 'timestamp');
  });

  // Programs list endpoint test
  await testAsync('programs list endpoint returns expected structure', async () => {
    const response = await request(app)
      .get('/mcp/programs/list')
      .expect(200);

    assertEqual(response.body.success, true);
    assertEqual(Array.isArray(response.body.data), true);
    assertGreaterThan(response.body.data.length, 0);
    assertHasProperty(response.body.data[0], 'name');
    assertHasProperty(response.body.data[0], 'description');
    assertHasProperty(response.body.data[0], 'size');
  });

  // POST /mcp/programs/load endpoint tests
  await testAsync('POST /mcp/programs/load with existing sample returns 200', async () => {
    const response = await request(app)
      .post('/mcp/programs/load')
      .send({ name: 'hello-terminal' })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'loadAddress');
    assertHasProperty(response.body.data, 'byteCount');
    assertEqual(response.body.data.loadAddress, 0x0600); // Default start address
    assertGreaterThan(response.body.data.byteCount, 0);
  });

  await testAsync('POST /mcp/programs/load with custom startAddress', async () => {
    const customAddress = 0x1000;
    const response = await request(app)
      .post('/mcp/programs/load')
      .send({ name: 'hello-terminal', startAddress: customAddress })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertEqual(response.body.data.loadAddress, customAddress);
    assertGreaterThan(response.body.data.byteCount, 0);
  });

  await testAsync('POST /mcp/programs/load with non-existent program returns 422', async () => {
    const response = await request(app)
      .post('/mcp/programs/load')
      .send({ name: 'non-existent-program' })
      .set('Content-Type', 'application/json')
      .expect(422);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'PROGRAM_NOT_FOUND');
  });

  await testAsync('POST /mcp/programs/load with invalid program name sanitized', async () => {
    const response = await request(app)
      .post('/mcp/programs/load')
      .send({ name: '../invalid-name' })
      .set('Content-Type', 'application/json')
      .expect(400);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'INVALID_REQUEST');
  });

  // POST /mcp/programs/save endpoint tests
  await testAsync('POST /mcp/programs/save with valid data returns 200', async () => {
    const testSource = '; Test program\n.org $0600\nLDA #$42\nSTA $00\nRTS\n';
    const testName = 'test-program-' + Date.now();

    const response = await request(app)
      .post('/mcp/programs/save')
      .send({
        name: testName,
        source: testSource
      })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'name');
    assertHasProperty(response.body.data, 'path');
    assertHasProperty(response.body.data, 'bytesWritten');
    assertEqual(response.body.data.name, testName);
    assertEqual(response.body.data.path, `${testName}.asm`);

    // Cleanup: Verify file exists and clean it up
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'samples', `${testName}.asm`);
    assertEqual(fs.existsSync(filePath), true);
    fs.unlinkSync(filePath); // Remove test file
  });

  await testAsync('POST /mcp/programs/save with duplicate name without overwrite returns 422', async () => {
    const testSource = '; Test program\n.org $0600\nLDA #$42\nSTA $00\nRTS\n';
    const testName = 'save-test-' + Date.now();

    // Create initial file
    await request(app)
      .post('/mcp/programs/save')
      .send({
        name: testName,
        source: testSource
      })
      .set('Content-Type', 'application/json')
      .expect(200);

    // Try to save again without overwrite flag
    const response = await request(app)
      .post('/mcp/programs/save')
      .send({
        name: testName,
        source: testSource
      })
      .set('Content-Type', 'application/json')
      .expect(422);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'PROGRAM_EXISTS');

    // Cleanup
    const fs = await import('fs');
    const path = await import('path');
    const filePath = path.join(process.cwd(), 'samples', `${testName}.asm`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  });

  await testAsync('POST /mcp/programs/save with invalid program name returns 400', async () => {
    const response = await request(app)
      .post('/mcp/programs/save')
      .send({
        name: 'invalid$name!@#',
        source: '; Test program\nLDA #$42\n'
      })
      .set('Content-Type', 'application/json')
      .expect(400);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'INVALID_REQUEST');
  });

  // CPU endpoints tests (existing - keeping for compatibility)
  await testAsync('CPU reset endpoint accepts valid request', async () => {
    const response = await request(app)
      .post('/mcp/cpu/reset')
      .send({ hardReset: false })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'pc');
    assertHasProperty(response.body.data, 'running');
  });

  await testAsync('CPU step endpoint accepts valid request', async () => {
    const response = await request(app)
      .post('/mcp/cpu/step')
      .send({})
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'pc');
    assertHasProperty(response.body.data, 'instruction');
    assertHasProperty(response.body.data, 'cycles');
    assertHasProperty(response.body.data, 'halted');
  });

  await testAsync('CPU run endpoint accepts valid request', async () => {
    const response = await request(app)
      .post('/mcp/cpu/run')
      .send({ maxSteps: 100 })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'stepsExecuted');
    assertHasProperty(response.body.data, 'halted');
    assertHasProperty(response.body.data, 'finalState');
  });

  await testAsync('CPU state endpoint returns current state', async () => {
    const response = await request(app)
      .get('/mcp/cpu/state')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'pc');
    assertHasProperty(response.body.data, 'running');
    assertHasProperty(response.body.data, 'flags');
  });

  // Memory endpoints tests - NEW MEMORY TESTS
  await testAsync('memory read endpoint accepts valid request', async () => {
    const response = await request(app)
      .post('/mcp/memory/read')
      .send({ address: 240, bytes: 1 })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertEqual(response.body.data.address, 240);
    assertHasProperty(response.body.data, 'value');
    assertHasProperty(response.body.data, 'hexValue');
  });

  await testAsync('memory write endpoint accepts valid request', async () => {
    const response = await request(app)
      .post('/mcp/memory/write')
      .send({ address: 240, value: 65, bytes: 1 })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertEqual(response.body.data.address, 240);
    assertEqual(response.body.data.value, 65);
  });

  await testAsync('memory load program endpoint accepts valid request', async () => {
    const response = await request(app)
      .post('/mcp/memory/loadProgram')
      .send({
        bytecode: [169, 66, 133, 0, 76],
        startAddress: 1536,
        validate: true
      })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'startAddress');
    assertHasProperty(response.body.data, 'bytesLoaded');
    assertHasProperty(response.body.data, 'endAddress');
  });

  // Assembly endpoints tests
  await testAsync('POST /mcp/assemble/source with small hello asm returns 200 and bytes array', async () => {
    const response = await request(app)
      .post('/mcp/assemble/source')
      .send({
        source: '.org $0600\nLDA #$42\nSTA $00\nHLT\ntest-simple.asm'
      })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'bytecode');
    assertHasProperty(response.body.data, 'hexBytes');
    assertHasProperty(response.body.data, 'sizeBytes');
    assertEqual(Array.isArray(response.body.data.bytecode), true);
    assertGreaterThan(response.body.data.bytecode.length, 0);
  });

  await testAsync('POST /mcp/assemble/loadAndRun assembling hello-terminal.asm runs and returns valid run outcome', async () => {
    const response = await request(app)
      .post('/mcp/assemble/loadAndRun')
      .send({
        source: '.org $0600\nLDA #$42\nSTA $00\nHLT\nhello-terminal.asm',
        resetCPU: true,
        maxSteps: 100
      })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'assembledByteCount');
    assertHasProperty(response.body.data, 'loadAddress');
    assertHasProperty(response.body.data, 'runOutcome');
    assertHasProperty(response.body.data.runOutcome, 'stepsExecuted');
    assertHasProperty(response.body.data.runOutcome, 'halted');
    assertHasProperty(response.body.data.runOutcome, 'finalState');
  });

  await testAsync('assembler endpoint with invalid assembly returns INVALID_ASSEMBLY', async () => {
    const response = await request(app)
      .post('/mcp/assemble/source')
      .send({
        source: 'INVALID ASSEMBLY CODE HERE'
      })
      .set('Content-Type', 'application/json')
      .expect(422);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'INVALID_ASSEMBLY');
  });

  await testAsync('loadAndRun endpoint with oversized source returns error', async () => {
    const oversizedSource = '.org $0600\n'.repeat(1000);
    const response = await request(app)
      .post('/mcp/assemble/loadAndRun')
      .send({
        source: oversizedSource
      })
      .set('Content-Type', 'application/json')
      .expect(422);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'INVALID_ASSEMBLY');
  });

  // Terminal endpoints tests
  await testAsync('POST /mcp/terminal/write with "hello" returns 200 and bytesWritten >= 1', async () => {
    const response = await request(app)
      .post('/mcp/terminal/write')
      .send({ text: 'hello' })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'bytesWritten');
    assertGreaterThan(response.body.data.bytesWritten, 0);
  });

  await testAsync('GET /mcp/terminal/read returns 200 and text field (may be empty)', async () => {
    const response = await request(app)
      .get('/mcp/terminal/read')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'text');
    assertHasProperty(response.body.data, 'bytes');
    // Text may be empty string, just ensure it's a string
    assertEqual(typeof response.body.data.text, 'string');
    assertEqual(typeof response.body.data.bytes, 'number');
  });

  await testAsync('POST /mcp/terminal/clear returns 200 and cleared:true', async () => {
    const response = await request(app)
      .post('/mcp/terminal/clear')
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'cleared');
    assertEqual(response.body.data.cleared, true);
  });

  await testAsync('invalid endpoint returns 404', async () => {
    const response = await request(app)
      .get('/mcp/invalid/endpoint')
      .expect(404);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'ENDPOINT_NOT_FOUND');
  });

  await testAsync('invalid request validation returns 422', async () => {
    const response = await request(app)
      .post('/mcp/cpu/reset')
      .send({ invalidField: 'value' })
      .set('Content-Type', 'application/json')
      .expect(422);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'VALIDATION_FAILED');
  });

  // Video endpoints tests
  await testAsync('POST /mcp/video/setPixel with valid coordinates returns 200 and address', async () => {
    const response = await request(app)
      .post('/mcp/video/setPixel')
      .send({ x: 10, y: 5, color: 15 })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'address');
    assertEqual(response.body.data.address, 0x0200 + (5 * 32) + 10); // Should be correct framebuffer address
  });

  await testAsync('POST /mcp/video/setPixel with out-of-bounds coordinates returns VIDEO_OUT_OF_BOUNDS error', async () => {
    const response = await request(app)
      .post('/mcp/video/setPixel')
      .send({ x: -1, y: 0, color: 15 })
      .set('Content-Type', 'application/json')
      .expect(422);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'VIDEO_OUT_OF_BOUNDS');
  });

  await testAsync('POST /mcp/video/update triggers display update and returns 200 with timing', async () => {
    const response = await request(app)
      .post('/mcp/video/update')
      .send({})
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'durationMs');
    assertHasProperty(response.body.data, 'status');
  });

  await testAsync('POST /mcp/video/clear clears display buffer and returns 200 with cleared status', async () => {
    const response = await request(app)
      .post('/mcp/video/clear')
      .send({})
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'cleared');
    assertEqual(response.body.data.cleared, true);
  });

// Debug endpoints tests - STUB BEHAVIOR TESTS
  await testAsync('POST /mcp/debug/trace with small steps returns 200 and trace array', async () => {
    const response = await request(app)
      .post('/mcp/debug/trace')
      .send({ steps: 1 })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'trace');
    assertHasProperty(response.body.data, 'stepsExecuted');
    assertEqual(Array.isArray(response.body.data.trace), true);
    assertGreaterThan(response.body.data.trace.length, 0);
    // Should have at least basic trace entry structure
    const firstEntry = response.body.data.trace[0];
    assertHasProperty(firstEntry, 'pc');
    assertHasProperty(firstEntry, 'instruction');
  });

  await testAsync('POST /mcp/debug/memoryView with valid range returns 200 and memory data', async () => {
    const response = await request(app)
      .post('/mcp/debug/memoryView')
      .send({ address: 240, size: 10 })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'bytes');
    assertHasProperty(response.body.data, 'address');
    assertHasProperty(response.body.data, 'size');
    assertEqual(response.body.data.address, 240);
    assertEqual(response.body.data.size, 10);
    assertEqual(Array.isArray(response.body.data.bytes), true);
    assertEqual(response.body.data.bytes.length, 10);
  });

  await testAsync('POST /mcp/debug/memoryView with out-of-bounds address returns MEMORY_OUT_OF_BOUNDS', async () => {
    const response = await request(app)
      .post('/mcp/debug/memoryView')
      .send({ address: 0x10000, size: 10 }) // Beyond 64KB address space
      .set('Content-Type', 'application/json')
      .expect(400);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'MEMORY_OUT_OF_BOUNDS');
  });

  await testAsync('POST /mcp/debug/breakpoints with action "list" returns 200 and breakpoints array', async () => {
    const response = await request(app)
      .post('/mcp/debug/breakpoints')
      .send({ action: 'list' })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(response.body.success, true);
    assertHasProperty(response.body.data, 'breakpoints');
    assertHasProperty(response.body.data, 'operationResult');
    assertEqual(Array.isArray(response.body.data.breakpoints), true);
    assertEqual(response.body.data.operationResult.action, 'list');
    assertEqual(response.body.data.operationResult.success, true);
  });

  await testAsync('POST /mcp/debug/breakpoints with action "set" then "list" returns expected breakpoint', async () => {
    // First set a breakpoint
    const setResponse = await request(app)
      .post('/mcp/debug/breakpoints')
      .send({ action: 'set', address: 0x0600 })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(setResponse.body.success, true);
    assertHasProperty(setResponse.body.data.operationResult, 'id');
    assertEqual(setResponse.body.data.operationResult.action, 'set');

    const breakpointId = setResponse.body.data.operationResult.id;

    // Then list breakpoints
    const listResponse = await request(app)
      .post('/mcp/debug/breakpoints')
      .send({ action: 'list' })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(listResponse.body.success, true);
    assertGreaterThan(listResponse.body.data.breakpoints.length, 0);
    const foundBreakpoint = listResponse.body.data.breakpoints.find(bp => bp.id === breakpointId);
    assertHasProperty(foundBreakpoint, 'address');
    assertEqual(foundBreakpoint.address, 0x0600);

    // Clean up - remove the test breakpoint
    await request(app)
      .post('/mcp/debug/breakpoints')
      .send({ action: 'remove', id: breakpointId })
      .set('Content-Type', 'application/json');
  });

  await testAsync('POST /mcp/debug/breakpoints with action "remove" by address succeeds', async () => {
    // Set a breakpoint
    await request(app)
      .post('/mcp/debug/breakpoints')
      .send({ action: 'set', address: 0x0700 })
      .set('Content-Type', 'application/json')
      .expect(200);

    // Remove by address
    const removeResponse = await request(app)
      .post('/mcp/debug/breakpoints')
      .send({ action: 'remove', address: 0x0700 })
      .set('Content-Type', 'application/json')
      .expect(200);

    assertEqual(removeResponse.body.success, true);
    assertEqual(removeResponse.body.data.operationResult.action, 'remove');
    assertEqual(removeResponse.body.data.operationResult.removed, true);
  });

  await testAsync('invalid debug endpoint request returns INVALID_REQUEST', async () => {
    const response = await request(app)
      .post('/mcp/debug/trace')
      .send({ invalidField: 'value' })
      .set('Content-Type', 'application/json')
      .expect(400);

    assertEqual(response.body.success, false);
    assertEqual(response.body.error.code, 'INVALID_REQUEST');
  });

// MCP Error Response Tests
await testAsync('validation error returns 400 with INVALID_REQUEST code', async () => {
  const response = await request(app)
    .post('/mcp/cpu/step')
    .send({ invalidField: 'value' })
    .set('Content-Type', 'application/json')
    .expect(400);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'INVALID_REQUEST');
  assertHasProperty(response.body.error, 'message');
});

await testAsync('memory out of bounds error returns 422 with MEMORY_OUT_OF_RANGE code', async () => {
  // Test memory read with address out of bounds
  const response = await request(app)
    .post('/mcp/memory/read')
    .send({ address: 0x10000, bytes: 1 }) // Address beyond 64KB
    .set('Content-Type', 'application/json')
    .expect(422);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'MEMORY_OUT_OF_RANGE');
  assertHasProperty(response.body.error, 'message');
});

await testAsync('program not found error returns 422 with PROGRAM_NOT_FOUND code', async () => {
  const response = await request(app)
    .post('/mcp/programs/load')
    .send({ name: 'definitely-not-a-program-name' })
    .set('Content-Type', 'application/json')
    .expect(422);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'PROGRAM_NOT_FOUND');
  assertHasProperty(response.body.error, 'message');
});

await testAsync('endpoint not found returns 404 with NOT_FOUND code', async () => {
  const response = await request(app)
    .get('/mcp/nonexistent/endpoint')
    .expect(404);

  assertEqual(response.body.success, false);
  assertEqual(response.body.error.code, 'NOT_FOUND');
  assertHasProperty(response.body.error, 'message');
});

// Summary
console.log(`\nTests completed: ${testsPassed} passed, ${testsFailed} failed`);
if (testsFailed === 0) {
  console.log('All tests passed!');
} else {
  console.error(`${testsFailed} tests failed!`);
}

// Integration tests (commented out - require full server setup)
// describe('MCP Server Integration Tests', () => {
//   let server;

//   beforeAll((done) => {
//     server = app.listen(8002, () => {
//       console.log('Test server started on port 8002');
//       done();
//     });
//   });

//   afterAll((done) => {
//     if (server) server.close(done);
//   });

//   test('server responds to real HTTP requests', async () => {
//     const response = await request(app).get('/health').expect(200);
//     expect(response.body.status).toBe('ok');
//   });
// });

export default {}; // Make this a proper ES module