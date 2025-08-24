module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Test timeout (30 seconds for network operations)
  testTimeout: 30000,
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    '**/*.js',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/*.test.js',
    '!**/jest.config.js',
    '!**/jest.setup.js',
    '!**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json'
  ],
  coverageThreshold: {
    global: {
      branches: 15,
      functions: 15,
      lines: 15,
      statements: 15
    }
  },
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Test file extensions
  moduleFileExtensions: ['js', 'json'],
  
  // Verbose output
  verbose: true,
  
  // Force exit after tests
  forceExit: true,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks between tests
  restoreMocks: true,
  
  // Reset modules between tests
  resetModules: true,
  
  // Test path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/',
    '/logs/'
  ],
  
  // Module path ignore patterns
  modulePathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/',
    '/logs/'
  ],
  
  // Watch path ignore patterns
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/dist/',
    '/build/',
    '/logs/'
  ],
  
  // Test environment variables
  testEnvironmentOptions: {
    url: 'http://localhost'
  },
  
  // Notify mode
  notify: false,
  
  // Error on deprecation
  errorOnDeprecated: true,
  
  // Maximum workers
  maxWorkers: '50%',
  
  // Worker idle memory limit
  workerIdleMemoryLimit: '512MB',
  
  // Module name mapping for mocks
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1'
  },
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    '/node_modules/(?!(mysql2|bcrypt|winston)/)'
  ],
  
  // Global test setup
  globalSetup: '<rootDir>/jest.global-setup.js',
  
  // Global test teardown
  globalTeardown: '<rootDir>/jest.global-teardown.js'
}; 