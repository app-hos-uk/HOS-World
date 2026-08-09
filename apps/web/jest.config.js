const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/.next/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    // Exercise utils source, not stale dist/ build output
    '^@hos-marketplace/utils$': '<rootDir>/../../packages/utils/src/index.ts',
    '^@hos-marketplace/utils/(.*)$': '<rootDir>/../../packages/utils/src/$1',
  },
};

module.exports = createJestConfig(customJestConfig);
