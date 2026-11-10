import type { Config } from 'jest';

/**
 * Jest + ts-jest against one in-memory MongoDB (mongodb-memory-server) for the
 * whole run: global-setup.ts starts it, setup.ts gives each test file its own
 * database on it, global-teardown.ts stops it. No test touches MONGODB_URI's
 * real server.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  globalSetup: '<rootDir>/src/test/global-setup.ts',
  globalTeardown: '<rootDir>/src/test/global-teardown.ts',
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],
  restoreMocks: true,
  collectCoverageFrom: ['src/services/**/*.ts', 'src/controllers/**/*.ts'],
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coverageThreshold: {
    global: { statements: 80, branches: 80, functions: 80, lines: 80 },
  },
};

export default config;
