// Debug script to check schema loading
import * as fs from 'fs';
import * as path from 'path';
import Ajv from 'ajv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const schemasDir = path.join(__dirname, 'docs/mcp_schemas');
const compiledValidators = {};
const ajv = new Ajv({ allErrors: true, removeAdditional: 'all' });

console.log('Checking schemas directory...');
console.log('Schema path:', schemasDir);

try {
  const files = fs.readdirSync(schemasDir).filter(f => f.endsWith('.json'));
  console.log('Found schema files:');
  files.forEach(file => console.log('  - ' + file));

  console.log('\nLoading schemas...');
  for (const file of files) {
    const schemaPath = path.join(schemasDir, file);
    const schemaContent = fs.readFileSync(schemaPath, 'utf8');
    const schema = JSON.parse(schemaContent);

    const key = file.replace('.json', '');
    try {
      compiledValidators[key] = ajv.compile(schema);
      console.log(`✅ Loaded schema: ${key}`);
    } catch (compileError) {
      console.log(`❌ Failed to compile ${key}:`, compileError.message);
    }
  }

  console.log(`\nTotal schemas loaded: ${Object.keys(compiledValidators).length}`);

  // Check if our specific memory schemas are loaded
  const memorySchemas = ['memory.read.request', 'memory.write.request', 'memory.loadProgram.request'];
  console.log('\nChecking memory schemas:');
  memorySchemas.forEach(schemaKey => {
    if (compiledValidators[schemaKey]) {
      console.log(`✅ ${schemaKey} - LOADED`);
    } else {
      console.log(`❌ ${schemaKey} - MISSING`);
    }
  });

} catch (error) {
  console.error('Error:', error);
}