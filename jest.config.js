/*
 * Jest configuration for iMaCoMpUtERussy Emulator Project
 * Supports ES modules and the existing test structure
 */

const config = {
  // Basic configuration
  verbose: true,
  testEnvironment: 'node',
  
  // File matching
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/integration/**/*.test.js',
    '<rootDir>/**/*.test.js'
  ],
  
  // Module name mapping for relative imports without .js extension
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Transform ES modules using babel-jest
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Ignore node_modules except for specific ESM packages if needed
  transformIgnorePatterns: [
    'node_modules/(?!(supertest)/)'
  ],
  
  // Setup files for mocking globals
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.min.js',
    '!js/vendor/**',
    '!js/polyfills/**'
  ],
  
  // Coverage reporters and thresholds
  coverageReporters: ['text', 'lcov', 'json'],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0
    }
  }
};

export default config;