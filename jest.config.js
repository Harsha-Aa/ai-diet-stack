module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    'lib/**/*.ts',
    '!src/**/*.d.ts',
    '!lib/**/*.d.ts',
    '!src/**/index.ts',
    '!lib/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'text-summary', 'lcov', 'html', 'json'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1'
  },
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true
      }
    }
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testTimeout: 30000,
  verbose: true,
  // Ignore property-based tests in coverage (they test properties, not coverage)
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '\\.property\\.test\\.ts$',
  ],
};
