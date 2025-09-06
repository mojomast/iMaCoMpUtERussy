/**
 * Shared test runner utilities for VideoStorage-8 tests
 * Consolidates test execution and reporting across test files
 */

export function test(name, testFn) {
  try {
    testFn();
    console.log(`PASS: ${name}`);
    return true;
  } catch (error) {
    console.error(`FAIL: ${name} - ${error.message}`);
    return error.message;
  }
}

export function runTests(testSuiteFn) {
  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  const testNames = testSuiteFn(); // Get test names from suite
  for (const testName of testNames) {
    const result = test(testName, () => {
      // Execute the specific test by name
      testSuiteFn()[testName]();
    });
    if (result === true) {
      results.passed++;
    } else {
      results.failed++;
      results.tests.push({ name: testName, status: 'FAIL', error: result });
    }
    results.tests.push({ name: testName, status: result === true ? 'PASS' : 'FAIL' });
  }

  console.log(`\nTest Suite completed: ${results.passed} passed, ${results.failed} failed`);
  return results;
}

// Export for browser and Node.js compatibility
if (typeof window !== 'undefined') {
  window.test = test;
  window.runTests = runTests;
}