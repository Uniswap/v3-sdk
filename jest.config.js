/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  // preset: 'ts-jest',
  // testEnvironment: 'node',
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  transform: {
    // transform files with ts-jest
    '^.+\\.(js|ts)$': [
      'ts-jest',
      {
        tsconfig: {
          // allow js in typescript
          allowJs: true,
        },
      },
    ],
  },
  transformIgnorePatterns: [
    // allow lit-html transformation
    'node_modules/(?!lit-html)',
  ],
  // for absolute imports
  moduleNameMapper: {
    'src/(.*)': '<rootDir>/src/$1',
  },
}
