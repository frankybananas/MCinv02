const nextJest = require('next/jest')({ dir: './' });

const createJestConfig = nextJest({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: { 
    '^@/(.*)$': '<rootDir>/$1',
  },
});

/** @type {import('jest').Config} */
module.exports = createJestConfig({
  testMatch: ['**/__tests__/**/*.test.(ts|tsx|js)'],
});
