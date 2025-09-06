
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
    '<rootDir>/tests/integration/**/*.test.js'
  ],
  
  // ES module support
  extensionsToTreatAsEsm: ['.js'],
  preset: 'ts-jest/presets/default-esm', // For ES module support
  
  // Module name mapping
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  
  // Coverage configuration
  collectCoverageFrom: [
    'js/**/*.js',
    '!js/**/*.min.js',
    '!js/vendor/**',
    '!js/polyfills/**'
  ],
  
  // Transform for ES modules
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Test environment setup
  testEnvironmentOptions: {
    customExportConditions: ['node']
  },
  
  // Collect coverage for emulator core
  coverageReporters: ['text', 'lcov', 'json'],
  coverageDirectory: '<rootDir>/coverage',
  coverageThreshold: {
    global: {
      branches