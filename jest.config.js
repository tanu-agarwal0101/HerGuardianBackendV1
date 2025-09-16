export default {
  testEnvironment: "node",
  transform: {},
  moduleFileExtensions: ["js", "json"],
  verbose: false,
  testMatch: ["**/__tests__/**/*.test.js"],
  collectCoverageFrom: ["controllers/**/*.js", "middleware/**/*.js", "routes/**/*.js", "app.js"],
};


