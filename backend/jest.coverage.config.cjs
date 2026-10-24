'use strict';

// Compile with the production TypeScript compiler before native instrumentation.
// Per-file transpilation invents metadata fallback branches that are absent from
// the application build. Inline source maps preserve the original TS inventory.
module.exports = {
  rootDir: '.',
  moduleFileExtensions: ['js', 'json'],
  testMatch: ['<rootDir>/.test-build/**/*.spec.js'],
  transform: {},
  testEnvironment: 'node',
  collectCoverage: true,
  collectCoverageFrom: ['.test-build/**/*.js', '!.test-build/**/*.spec.js'],
  coverageDirectory: 'coverage',
  coverageReporters: ['json', 'json-summary', 'text-summary'],
  coverageThreshold: {
    global: { lines: 100, branches: 100, statements: 100, functions: 100 },
  },
};
