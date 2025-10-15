// Jest setup for Node.js environment (API tests)
// This file is used for tests that run in Node.js environment (not jsdom)

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
