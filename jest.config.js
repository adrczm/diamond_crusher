/** Unit tests for domain, data and content run in Node (ARCH-080, ARCH-081). */
module.exports = {
  preset: 'jest-expo/node',
  testMatch: ['<rootDir>/test/**/*.test.ts', '<rootDir>/test/**/*.test.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@noble/.*|fflate)',
  ],
  collectCoverageFrom: ['src/domain/**/*.ts'],
};
