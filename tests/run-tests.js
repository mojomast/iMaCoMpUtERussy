// Simple test runner to require all .test.js files in tests/
import fs from 'fs';
import path from 'path';

const testsDir = path.resolve('./tests');
const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.js'));

if (files.length === 0) {
  console.log('No test files found');
  process.exit(0);
}

let failures = 0;
for (const file of files) {
  try {
    console.log(`\n=== Running ${file}`);
    // Use dynamic import to support ES modules and top-level await in tests if any
    const mod = await import(pathToFileURL(path.join(testsDir, file)).href);
    if (mod && typeof mod.runTests === 'function') {
      await mod.runTests();
    }
    console.log(`${file}: OK`);
  } catch (err) {
    failures += 1;
    console.error(`${file}: FAILED`);
    console.error(err.stack || err);
  }
}

if (failures > 0) {
  console.error(`\n${failures} test file(s) failed`);
  process.exit(1);
} else {
  console.log('\nAll test files passed');
}

function pathToFileURL(p) {
  const url = new URL('file:' + path.resolve(p));
  return url;
}
