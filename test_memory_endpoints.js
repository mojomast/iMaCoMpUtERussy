import request from 'supertest';
import { app } from './server/mcp_server.js';

console.log('Testing Memory Endpoints...\n');

// Test memory read endpoint
await request(app)
  .post('/mcp/memory/read')
  .send({ address: 240, bytes: 1 })
  .set('Content-Type', 'application/json')
  .expect(200)
  .then(response => {
    console.log('✅ Memory read test passed');
    console.log('   Response:', JSON.stringify(response.body, null, 2));
  })
  .catch(error => {
    console.log('❌ Memory read test failed');
    console.error('   Error:', error.message);
  });

// Test memory write endpoint
await request(app)
  .post('/mcp/memory/write')
  .send({ address: 240, value: 65, bytes: 1 })
  .set('Content-Type', 'application/json')
  .expect(200)
  .then(response => {
    console.log('✅ Memory write test passed');
    console.log('   Response:', JSON.stringify(response.body, null, 2));
  })
  .catch(error => {
    console.log('❌ Memory write test failed');
    console.error('   Error:', error.message);
  });

// Test memory loadProgram endpoint
await request(app)
  .post('/mcp/memory/loadProgram')
  .send({
    bytecode: [169, 66, 133, 0, 76],
    startAddress: 1536,
    validate: true
  })
  .set('Content-Type', 'application/json')
  .expect(200)
  .then(response => {
    console.log('✅ Memory loadProgram test passed');
    console.log('   Response:', JSON.stringify(response.body, null, 2));
  })
  .catch(error => {
    console.log('❌ Memory loadProgram test failed');
    console.error('   Error:', error.message);
  });

console.log('\nMemory endpoint tests completed!');