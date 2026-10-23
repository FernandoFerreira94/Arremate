module.exports = {
  testEnvironment: "node",
  transform: { "^.+\\.tsx?$": ["ts-jest", { tsconfig: "tsconfig.json" }] },
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  setupFiles: ["<rootDir>/test/setup.cjs"],
  clearMocks: true,
};
