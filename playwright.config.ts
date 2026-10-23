import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3300", trace: "retain-on-failure" },
  webServer: { command: "npm run dev:web", url: "http://127.0.0.1:3300", reuseExistingServer: !process.env.CI, timeout: 120000 },
});
