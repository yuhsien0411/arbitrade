module.exports = {
  displayName: 'Binance Tests',
  testMatch: [
    '<rootDir>/exchanges/binance/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'exchanges/binance/**/*.js',
    '!exchanges/binance/tests/**',
    '!exchanges/binance/example.js',
    '!exchanges/binance/README.md'
  ],
  coverageDirectory: 'coverage/binance',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  verbose: true,
  clearMocks: true,
  restoreMocks: true
};
