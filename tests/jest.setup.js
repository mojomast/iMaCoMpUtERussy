// Jest setup file for iMaCoMpUtERussy tests
// Configure global mocks and environment

// Mock global window object for browser-specific tests
global.window = global.window || {};

// Mock video display for video I/O tests
if (!global.window.videoDisplay) {
  global.window.videoDisplay = {
    updateDisplay: jest.fn()
  };
}

// Mock setTimeout for VDL instruction tests
if (!global.setTimeout) {
  global.setTimeout = jest.fn();
}

// Mock console methods for cleaner test output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const consoleMocks = {
  log: [],
  error: []
};

global.console = {
  ...console,
  log: jest.fn((...args) => {
    consoleMocks.log.push(args.join(' '));
    originalConsoleLog(...args);
  }),
  error: jest.fn((...args) => {
    consoleMocks.error.push(args.join(' '));
    originalConsoleError(...args);
  })
};

// Global cleanup after each test file
afterAll(() => {
  jest.clearAllMocks();
  global.window = undefined;
  global.setTimeout = undefined;
  global.console = {
    ...console,
    log: originalConsoleLog,
    error: originalConsoleError
  };
});

// Add custom matchers for CPU flag testing
expect.extend({
  toBeFlagSet(received, flagName) {
    const { printReceived, printExpected } = this.utils;
    const pass = received === true;
    
    if (pass) {
      return {
        message: () => `expected ${printReceived(received)} not to be flag ${flagName}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${printReceived(received)} to be flag ${flagName}`,
        pass: false
      };
    }
  }
});

// Mock file system operations if needed for integration tests
const originalReadFile = global.fs ? global.fs.readFileSync : null;
const originalWriteFile = global.fs ? global.fs.writeFileSync : null;

if (global.fs) {
  global.fs.readFileSync = jest.fn((path, encoding) => {
    if (path.includes('test') || path.includes('sample')) {
      return Buffer.from('test data');
    }
    return originalReadFile(path, encoding);
  });
  
  global.fs.writeFileSync = jest.fn((path, data) => {
    if (path.includes('test')) {
      consoleMocks.log.push(`Mock write to ${path}`);
    }
    originalWriteFile(path, data);
  });
}

// Ensure test environment is clean
global.jestTestEnvironment = 'node';