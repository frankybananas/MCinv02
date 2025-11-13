const nextJest = require('next/jest')({ dir: './' });

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { 
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
  testEnvironment: 'node',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(bson|mongodb|mongodb-memory-server)/)',
  ],
  collectCoverageFrom: [
    'lib/**/*.{js,ts}',
    'models/**/*.{js,ts}',
    'app/api/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
  ],
};

module.exports = nextJest(customJestConfig);
