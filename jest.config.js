/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom', // Necessary for testing React components
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    // Handle CSS modules (if using)
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    // Handle module aliases (if any)
    '^@/(.*)$': '<rootDir>/app/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: './tsconfig.json' }],
  },
  // Optionally, specify test file extensions
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)'],
};
