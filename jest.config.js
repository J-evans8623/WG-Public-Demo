/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  projects: [
    {
      displayName: 'node',
      preset: 'ts-jest',
      testEnvironment: 'node',
      moduleFileExtensions: ['js', 'ts'],
      transform: {
        '^.+\\.ts?$': [
          'ts-jest',
          {
            tsconfig: './app/tsconfig.jest.json',
          },
        ],
      },
      testMatch: ['**/__tests__/**/*.test.ts'],
    },
    {
      displayName: 'jsdom',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      moduleFileExtensions: ['js', 'ts', 'tsx'],
      transform: {
        '^.+\\.tsx?$': [
          'ts-jest',
          {
            tsconfig: './app/tsconfig.jest.json',
          },
        ],
      },
      testMatch: ['**/__tests__/**/*.test.tsx'],
    },
  ],
};
