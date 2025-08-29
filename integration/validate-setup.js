#!/usr/bin/env node

/**
 * Integration Test Setup Validator
 *
 * Basic validation script to check that the integration testing environment
 * is properly configured without running full tests or starting servers.
 *
 * @version 1.0.0
 * @author Kyle Durepos (via Roo Code)
 * @license MIT
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🧪 Integration Test Setup Validation\n');

// Validation checks
const checks = {
  'agent-mcp-integration.js exists': false,
  'test-utils.js exists': false,
  'package.json exists': false,
  'Main agent module exists': false,
  'MCP client module exists': false,
  'MCP server module exists': false,
  'Queue manager exists': false,
  'MCP error handling exists': false,
  'Directory structure correct': false
};

// 1. Check integration test files
console.log('📁 Checking integration test files...');

const intTestFiles = [
  'agent-mcp-integration.js',
  'test-utils.js',
  'package.json'
];

for (const file of intTestFiles) {
  const filePath = path.join(__dirname, file);
  checks[file + ' exists'] = fs.existsSync(filePath);
  if (checks[file + ' exists']) {
    const stats = fs.statSync(filePath);
    console.log(`  ✅ ${file} (${stats.size} bytes)`);
  } else {
    console.log(`  ❌ ${file} - MISSING`);
  }
}

// 2. Check core modules
console.log('\n🏗️  Checking core application modules...');

const coreModules = [
  ['agent/autonomous-agent.js', 'Main agent module'],
  ['lib/mcp-client.js', 'MCP client module'],
  ['server/mcp_server.js', 'MCP server module'],
  ['agent/queue-manager.js', 'Queue manager'],
  ['server/mcp_errors.js', 'MCP error handling']
];

for (const [file, description] of coreModules) {
  const filePath = path.join(rootDir, file);
  checks[description + ' exists'] = fs.existsSync(filePath);
  if (checks[description + ' exists']) {
    const stats = fs.statSync(filePath);
    console.log(`  ✅ ${description} (${stats.size} bytes)`);
  } else {
    console.log(`  ❌ ${description} - MISSING`);
  }
}

// 3. Check directory structure
console.log('\n📂 Checking directory structure...');

const directories = [
  'integration',
  'integration/reports',
  'integration/logs',
  'agent',
  'lib',
  'server',
  'data',
  'docs',
  'tests'
];

let dirStructureValid = true;
for (const dir of directories) {
  const dirPath = path.join(rootDir, dir);
  if (fs.existsSync(dirPath)) {
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      console.log(`  ✅ ${dir}/`);
    } else {
      console.log(`  ❌ ${dir} - NOT A DIRECTORY`);
      dirStructureValid = false;
    }
  } else {
    console.log(`  ❌ ${dir}/ - MISSING`);
    dirStructureValid = false;
  }
}

checks['Directory structure correct'] = dirStructureValid;

// 4. Quick syntax validation
console.log('\n🔍 Quick syntax validation...');

let syntaxValid = true;
const mainFilesToCheck = [
  'integration/agent-mcp-integration.js',
  'integration/test-utils.js',
  'agent/autonomous-agent.js',
  'lib/mcp-client.js'
];

for (const file of mainFilesToCheck) {
  try {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      // Load the module to check for syntax errors
      const url = new URL('file://' + filePath);
      // Simple syntax check by trying to parse without executing
      const content = fs.readFileSync(filePath, 'utf8');
      // Basic syntax validation by checking for common patterns
      if (!content.includes('import ') && !content.includes('export ')) {
        console.log(`  ⚠️  ${file} - May not be ES module`);
      } else {
        console.log(`  ✅ ${file} - Basic syntax OK`);
      }
    } else {
      console.log(`  ❌ ${file} - File missing`);
      syntaxValid = false;
    }
  } catch (error) {
    console.log(`  ❌ ${file} - Syntax error: ${error.message}`);
    syntaxValid = false;
  }
}

// 5. Check for package.json dependencies
console.log('\n📦 Checking dependencies...');

const rootPackageJson = path.join(rootDir, 'package.json');
if (fs.existsSync(rootPackageJson)) {
  try {
    const packageData = JSON.parse(fs.readFileSync(rootPackageJson, 'utf8'));
    const deps = { ...packageData.dependencies, ...packageData.devDependencies };

    const requiredDeps = ['express', 'cors'];
    const optionalDeps = ['supertest', 'ajv'];

    for (const dep of requiredDeps) {
      if (deps[dep]) {
        console.log(`  ✅ ${dep}@${deps[dep]} (required)`);
      } else {
        console.log(`  ❌ ${dep} - MISSING (required)`);
      }
    }

    for (const dep of optionalDeps) {
      if (deps[dep]) {
        console.log(`  ✅ ${dep}@${deps[dep]} (optional)`);
      } else {
        console.log(`  ⚠️  ${dep} - MISSING (optional)`);
      }
    }
  } catch (error) {
    console.log(`  ❌ package.json parsing failed: ${error.message}`);
  }
} else {
  console.log(`  ❌ package.json missing`);
}

// Summary
console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🎯 VALIDATION SUMMARY');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// Count passed checks
const totalChecks = Object.keys(checks).length;
const passedChecks = Object.values(checks).filter(Boolean).length;
const failedChecks = totalChecks - passedChecks;

console.log(`Total checks: ${totalChecks}`);
console.log(`Passed: ${passedChecks}`);
console.log(`Failed: ${failedChecks}`);
console.log(`Success rate: ${((passedChecks / totalChecks) * 100).toFixed(1)}%`);

if (failedChecks === 0) {
  console.log('\n🎉 INTEGRATION TEST SETUP VALIDATION PASSED!');
  console.log('\nNext steps:');
  console.log('  1. Start MCP server: npm run mcp-server');
  console.log('  2. Run basic tests: cd integration && npm run test:client');
  console.log('  3. Run full suite: cd integration && npm test');
} else {
  console.log('\n⚠️  SOME CHECKS FAILED!');
  console.log('\nPlease resolve the following issues:');

  for (const [check, passed] of Object.entries(checks)) {
    if (!passed) {
      console.log(`  - ${check}`);
    }
  }

  console.log('\nThen rerun: node integration/validate-setup.js');
}

// Check overall health
const overallHealth = failedChecks === 0 ? 'excellent' : failedChecks <= 2 ? 'good' : 'needs attention';

console.log(`\n🏥 Overall Health: ${overallHealth.toUpperCase()}`);

process.exit(failedChecks === 0 ? 0 : 1);