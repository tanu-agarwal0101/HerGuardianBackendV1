export default {
  testEnvironment: "node",
  transform: {},
  moduleFileExtensions: ["js", "json"],
  verbose: false,
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: [
    "controllers/**/*.js",
    "middleware/**/*.js",
    "routes/**/*.js",
    "utils/**/*.js",
    "app.js"
  ],
  coverageThreshold: {
    global: {
      lines: 0.8,
      statements: 0.8,
      branches: 0.7,
      functions: 0.8,
    },
  },
};


