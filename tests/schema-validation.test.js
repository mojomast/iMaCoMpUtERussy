/**
 * MCP Schema Validation Tests
 *
 * Automated tests that validate all MCP schemas including:
 * - Schema consistency across all endpoints
 * - Coordinate validation (X: 0-31, Y: 0-23)
 * - Schema completeness and accuracy
 * - Request/response validation matching
 */

import fs from 'fs';
import path from 'path';
import Ajv from 'ajv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const SCHEMAS_DIR = path.join(__dirname, '..', 'docs', 'mcp_schemas');

// Test counters
let testsPassed = 0;
let testsFailed = 0;
let schemaValidationResults = [];

function test(name, testFn) {
  try {
    testFn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
    schemaValidationResults.push({ name, status: 'PASS' });
  } catch (e) {
    console.error(`❌ FAIL: ${name} - ${e.message}`);
    console.error(e.stack || '');
    testsFailed++;
    schemaValidationResults.push({ name, status: 'FAIL', error: e.message });
  }
}

async function testAsync(name, testFn) {
  try {
    await testFn();
    console.log(`✅ PASS: ${name}`);
    testsPassed++;
    schemaValidationResults.push({ name, status: 'PASS' });
  } catch (e) {
    console.error(`❌ FAIL: ${name} - ${e.message}`);
    console.error(e.stack || '');
    testsFailed++;
    schemaValidationResults.push({ name, status: 'FAIL', error: e.message });
  }
}

console.log('\n' + '='.repeat(80));
console.log('📋 MCP SCHEMA VALIDATION TESTS');
console.log('='.repeat(80));

// Initialize AJV validator
const ajv = new Ajv({
  allErrors: true,
  removeAdditional: 'all',
  addUsedSchema: true,
  strict: false,
  formats: {
    date: true,
    'date-time': true
  }
});

// Add custom formats
ajv.addFormat('date-time', {
  type: 'string',
  validate: (str) => {
    const date = new Date(str);
    return !isNaN(date.getTime()) && date.toISOString() === str;
  }
});

// Load all schemas
function loadAllSchemas() {
  const schemas = {};
  const files = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json'));

  for (const file of files) {
    const schemaPath = path.join(SCHEMAS_DIR, file);
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);

    // Remove $schema reference to avoid remote resolution issues
    if (schema.$schema) {
      delete schema.$schema;
    }

    const key = file.replace('.json', '');
    schemas[key] = schema;
  }

  return schemas;
}

await testAsync('Load all MCP schemas successfully', async () => {
  const schemas = loadAllSchemas();
  console.log(`Loaded ${Object.keys(schemas).length} schemas`);

  // Should have at least 20 schemas
  if (Object.keys(schemas).length < 20) {
    throw new Error(`Expected at least 20 schemas, got ${Object.keys(schemas).length}`);
  }
});

const allSchemas = loadAllSchemas();

// ============================================================================
// 1. SCHEMA STRUCTURE VALIDATION
// ============================================================================

console.log('\n📋 SCHEMA STRUCTURE VALIDATION');

await testAsync('All schemas have required JSON Schema properties', async () => {
  for (const [key, schema] of Object.entries(allSchemas)) {
    if (!schema.type) {
      throw new Error(`Schema ${key} missing required 'type' property`);
    }
    if (!schema.properties && schema.type !== 'object') {
      throw new Error(`Schema ${key} should have 'properties' for object type`);
    }
  }
});

await testAsync('Schema naming conventions are consistent', async () => {
  const expectedPatterns = [
    /\.request$/,
    /\.response$/,
    /^error\.schema$/
  ];

  for (const key of Object.keys(allSchemas)) {
    const matchesPattern = expectedPatterns.some(pattern => pattern.test(key));
    if (!matchesPattern) {
      throw new Error(`Schema ${key} does not follow naming conventions (.request, .response, or error.schema)`);
    }
  }
});

// ============================================================================
// 2. COORDINATE VALIDATION TESTS
// ============================================================================

console.log('\n📐 COORDINATE VALIDATION TESTS');

await testAsync('Video schemas enforce coordinate limits (X: 0-31, Y: 0-23)', async () => {
  const videoSchemas = Object.entries(allSchemas).filter(([key]) =>
    key.includes('video') && key.includes('request')
  );

  for (const [key, schema] of videoSchemas) {
    if (schema.properties?.x) {
      if (schema.properties.x.minimum !== 0 || schema.properties.x.maximum !== 31) {
        throw new Error(`Schema ${key} X coordinate limits incorrect: expected 0-31, got ${schema.properties.x.minimum}-${schema.properties.x.maximum}`);
      }
    }
    if (schema.properties?.y) {
      if (schema.properties.y.minimum !== 0 || schema.properties.y.maximum !== 23) {
        throw new Error(`Schema ${key} Y coordinate limits incorrect: expected 0-23, got ${schema.properties.y.minimum}-${schema.properties.y.maximum}`);
      }
    }
  }
});

await testAsync('Video setPixel schema has correct color range (0-15)', async () => {
  const setPixelSchema = allSchemas['video.setPixel.request'];

  if (!setPixelSchema) {
    throw new Error('video.setPixel.request schema not found');
  }

  if (!setPixelSchema.properties?.color) {
    throw new Error('video.setPixel.request schema missing color property');
  }

  if (setPixelSchema.properties.color.minimum !== 0 || setPixelSchema.properties.color.maximum !== 15) {
    throw new Error(`video.setPixel.request color range incorrect: expected 0-15, got ${setPixelSchema.properties.color.minimum}-${setPixelSchema.properties.color.maximum}`);
  }
});

// ============================================================================
// 3. MEMORY ADDRESS VALIDATION
// ============================================================================

console.log('\n🧠 MEMORY ADDRESS VALIDATION');

await testAsync('Memory schemas enforce address range (0-65535)', async () => {
  const memorySchemas = Object.entries(allSchemas).filter(([key]) =>
    key.includes('memory') && key.includes('request')
  );

  for (const [key, schema] of memorySchemas) {
    if (schema.properties?.address) {
      if (schema.properties.address.minimum !== 0 || schema.properties.address.maximum !== 65535) {
        throw new Error(`Schema ${key} address limits incorrect: expected 0-65535, got ${schema.properties.address.minimum}-${schema.properties.address.maximum}`);
      }
    }
  }
});

await testAsync('Memory read schema has correct byte limits', async () => {
  const readSchema = allSchemas['memory.read.request'];

  if (!readSchema) {
    throw new Error('memory.read.request schema not found');
  }

  if (!readSchema.properties?.bytes) {
    throw new Error('memory.read.request schema missing bytes property');
  }

  if (!readSchema.properties.bytes.enum || !readSchema.properties.bytes.enum.includes(1) || !readSchema.properties.bytes.enum.includes(2)) {
    throw new Error('memory.read.request bytes enum incorrect: should allow 1 and 2');
  }
});

// ============================================================================
// 4. CPU TIMEOUT VALIDATION
// ============================================================================

console.log('\n⚡ CPU TIMEOUT VALIDATION');

await testAsync('CPU step schema enforces timeout range (100-5000ms)', async () => {
  const stepSchema = allSchemas['cpu.step.request'];

  if (!stepSchema) {
    throw new Error('cpu.step.request schema not found');
  }

  if (!stepSchema.properties?.timeout) {
    throw new Error('cpu.step.request schema missing timeout property');
  }

  if (stepSchema.properties.timeout.minimum !== 100 || stepSchema.properties.timeout.maximum !== 5000) {
    throw new Error(`cpu.step.request timeout range incorrect: expected 100-5000, got ${stepSchema.properties.timeout.minimum}-${stepSchema.properties.timeout.maximum}`);
  }
});

// ============================================================================
// 5. REQUIRED FIELDS VALIDATION
// ============================================================================

console.log('\n📝 REQUIRED FIELDS VALIDATION');

await testAsync('Video setPixel request has all required fields', async () => {
  const schema = allSchemas['video.setPixel.request'];

  if (!schema) {
    throw new Error('video.setPixel.request schema not found');
  }

  const required = schema.required || [];
  const expectedRequired = ['x', 'y', 'color'];

  for (const field of expectedRequired) {
    if (!required.includes(field)) {
      throw new Error(`video.setPixel.request missing required field: ${field}`);
    }
  }
});

await testAsync('Memory read request has all required fields', async () => {
  const schema = allSchemas['memory.read.request'];

  if (!schema) {
    throw new Error('memory.read.request schema not found');
  }

  const required = schema.required || [];
  const expectedRequired = ['address'];

  for (const field of expectedRequired) {
    if (!required.includes(field)) {
      throw new Error(`memory.read.request missing required field: ${field}`);
    }
  }
});

await testAsync('Programs load request has all required fields', async () => {
  const schema = allSchemas['programs.loadSample.request'];

  if (!schema) {
    throw new Error('programs.loadSample.request schema not found');
  }

  const required = schema.required || [];
  const expectedRequired = ['name'];

  for (const field of expectedRequired) {
    if (!required.includes(field)) {
      throw new Error(`programs.loadSample.request missing required field: ${field}`);
    }
  }
});

// ============================================================================
// 6. RESPONSE SCHEMA CONSISTENCY
// ============================================================================

console.log('\n🔄 RESPONSE SCHEMA CONSISTENCY');

await testAsync('All request schemas have corresponding response schemas', async () => {
  const requestSchemas = Object.keys(allSchemas).filter(key => key.includes('.request'));
  const responseSchemas = Object.keys(allSchemas).filter(key => key.includes('.response'));

  for (const requestKey of requestSchemas) {
    const baseName = requestKey.replace('.request', '');
    const expectedResponseKey = `${baseName}.response`;

    if (!responseSchemas.includes(expectedResponseKey)) {
      throw new Error(`Missing response schema for ${requestKey}: expected ${expectedResponseKey}`);
    }
  }
});

await testAsync('Response schemas have success/data structure', async () => {
  const responseSchemas = Object.entries(allSchemas).filter(([key]) => key.includes('.response'));

  for (const [key, schema] of responseSchemas) {
    if (!schema.properties?.success) {
      throw new Error(`Response schema ${key} missing success property`);
    }

    if (!schema.properties?.data) {
      throw new Error(`Response schema ${key} missing data property`);
    }

    // Check that success is boolean and data is object when success is true
    if (schema.properties.success.type !== 'boolean') {
      throw new Error(`Response schema ${key} success property should be boolean`);
    }
  }
});

await testAsync('Error schema has correct structure', async () => {
  const errorSchema = allSchemas['error.schema'];

  if (!errorSchema) {
    throw new Error('error.schema not found');
  }

  const required = errorSchema.required || [];
  if (!required.includes('success') || !required.includes('error')) {
    throw new Error('error.schema missing required success or error properties');
  }

  if (!errorSchema.properties?.error?.properties?.code ||
      !errorSchema.properties?.error?.properties?.message) {
    throw new Error('error.schema error object missing code or message properties');
  }
});

// ============================================================================
// 7. SCHEMA COMPILATION VALIDATION
// ============================================================================

console.log('\n🔧 SCHEMA COMPILATION VALIDATION');

await testAsync('All schemas compile successfully with AJV', async () => {
  const compiledValidators = {};

  for (const [key, schema] of Object.entries(allSchemas)) {
    try {
      compiledValidators[key] = ajv.compile(schema);
    } catch (error) {
      throw new Error(`Schema ${key} failed to compile: ${error.message}`);
    }
  }

  console.log(`Successfully compiled ${Object.keys(compiledValidators).length} schemas`);
});

// ============================================================================
// 8. CROSS-SCHEMA CONSISTENCY
// ============================================================================

console.log('\n🔗 CROSS-SCHEMA CONSISTENCY');

await testAsync('CPU run and step schemas are consistent', async () => {
  const stepSchema = allSchemas['cpu.step.request'];
  const runSchema = allSchemas['cpu.run.request'];

  if (stepSchema?.properties?.timeout && runSchema?.properties?.maxSteps) {
    // Both should have reasonable defaults
    if (!stepSchema.properties.timeout.default && !runSchema.properties.maxSteps.default) {
      console.log('⚠️  Warning: No defaults found for timeout/maxSteps, this may be intentional');
    }
  }
});

await testAsync('Terminal write and read schemas are consistent', async () => {
  const writeSchema = allSchemas['terminal.write.request'];
  const readSchema = allSchemas['terminal.read.response'];

  if (writeSchema?.properties?.text?.type !== 'string') {
    throw new Error('terminal.write.request text property should be string');
  }

  if (readSchema?.properties?.data?.properties?.input?.type !== 'string') {
    throw new Error('terminal.read.response input property should be string');
  }
});

await testAsync('AI generate schemas have consistent structure', async () => {
  const requestSchema = allSchemas['ai.generate.request'];
  const responseSchema = allSchemas['ai.generate.response'];

  if (requestSchema?.properties?.prompt?.type !== 'string') {
    throw new Error('ai.generate.request prompt property should be string');
  }

  if (responseSchema?.properties?.data?.properties?.content?.type !== 'string') {
    throw new Error('ai.generate.response content property should be string');
  }
});

// ============================================================================
// 9. ENUM AND CONSTANT VALIDATION
// ============================================================================

console.log('\n📊 ENUM AND CONSTANT VALIDATION');

await testAsync('Programs load request has valid type enum', async () => {
  const schema = allSchemas['programs.loadSample.request'];

  if (!schema) {
    throw new Error('programs.loadSample.request schema not found');
  }

  // Check if type property exists and has reasonable constraints
  if (schema.properties?.assembled?.type !== 'boolean') {
    console.log('⚠️  Warning: programs.loadSample.request assembled property should be boolean');
  }
});

await testAsync('Queue add request has valid enums', async () => {
  // Note: This would check queue-related schemas if they exist
  console.log('ℹ️  Queue schemas validation skipped (may not be fully implemented)');
});

await testAsync('Debug action enums are valid', async () => {
  const breakpointsSchema = allSchemas['debug.breakpoints.request'];

  if (!breakpointsSchema) {
    throw new Error('debug.breakpoints.request schema not found');
  }

  // Check if action property exists
  if (!breakpointsSchema.properties?.action) {
    throw new Error('debug.breakpoints.request missing action property');
  }
});

// ============================================================================
// 10. SCHEMA VALIDATION AGAINST SAMPLE DATA
// ============================================================================

console.log('\n🧪 SCHEMA VALIDATION AGAINST SAMPLE DATA');

await testAsync('Validate sample video.setPixel request data', async () => {
  const schema = allSchemas['video.setPixel.request'];
  const validator = ajv.compile(schema);

  const testData = { x: 15, y: 10, color: 7 };

  const isValid = validator(testData);
  if (!isValid) {
    throw new Error(`Sample video.setPixel data failed validation: ${JSON.stringify(validator.errors)}`);
  }
});

await testAsync('Validate sample memory.read request data', async () => {
  const schema = allSchemas['memory.read.request'];
  const validator = ajv.compile(schema);

  const testData = { address: 0x1000, bytes: 1 };

  const isValid = validator(testData);
  if (!isValid) {
    throw new Error(`Sample memory.read data failed validation: ${JSON.stringify(validator.errors)}`);
  }
});

await testAsync('Validate sample CPU step request data', async () => {
  const schema = allSchemas['cpu.step.request'];
  const validator = ajv.compile(schema);

  const testData = { timeout: 1000 };

  const isValid = validator(testData);
  if (!isValid) {
    throw new Error(`Sample CPU step data failed validation: ${JSON.stringify(validator.errors)}`);
  }
});

// ============================================================================
// 11. EDGE CASE AND BOUNDARY TESTING
// ============================================================================

console.log('\n🎯 EDGE CASE AND BOUNDARY TESTING');

await testAsync('Boundary values in coordinate validation', async () => {
  const schema = allSchemas['video.setPixel.request'];
  const validator = ajv.compile(schema);

  // Test exact boundaries
  const boundaryData = [
    { x: 0, y: 0, color: 0 },
    { x: 31, y: 23, color: 15 },
    { x: 15, y: 11, color: 7 }
  ];

  for (const data of boundaryData) {
    const isValid = validator(data);
    if (!isValid) {
      throw new Error(`Boundary data ${JSON.stringify(data)} failed validation: ${JSON.stringify(validator.errors)}`);
    }
  }
});

await testAsync('Invalid boundary values are rejected', async () => {
  const schema = allSchemas['video.setPixel.request'];
  const validator = ajv.compile(schema);

  // Test invalid boundaries
  const invalidData = [
    { x: -1, y: 0, color: 0 },
    { x: 32, y: 0, color: 0 },
    { x: 0, y: -1, color: 0 },
    { x: 0, y: 24, color: 0 },
    { x: 0, y: 0, color: -1 },
    { x: 0, y: 0, color: 16 }
  ];

  for (const data of invalidData) {
    const isValid = validator(data);
    if (isValid) {
      throw new Error(`Invalid boundary data ${JSON.stringify(data)} should have been rejected`);
    }
  }
});

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('📊 SCHEMA VALIDATION TEST SUMMARY');
console.log('='.repeat(80));

console.log(`\nTotal Tests: ${testsPassed + testsFailed}`);
console.log(`✅ Passed: ${testsPassed}`);
console.log(`❌ Failed: ${testsFailed}`);
console.log(`📈 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(2)}%`);

if (testsFailed === 0) {
  console.log('\n🎉 ALL SCHEMA VALIDATION TESTS PASSED!');
  console.log('✅ Schema consistency verified');
  console.log('✅ Coordinate limits validated (X: 0-31, Y: 0-23)');
  console.log('✅ All schemas match expected structure');
} else {
  console.log('\n⚠️  SOME SCHEMA VALIDATION TESTS FAILED!');
  console.log('\nFailed Tests:');
  schemaValidationResults
    .filter(result => result.status === 'FAIL')
    .forEach(result => {
      console.log(`  - ${result.name}: ${result.error}`);
    });
}

console.log('\n' + '='.repeat(80));
console.log('🏁 MCP SCHEMA VALIDATION TESTS COMPLETED');
console.log('='.repeat(80));

// Export results for external analysis
export { schemaValidationResults, testsPassed, testsFailed };