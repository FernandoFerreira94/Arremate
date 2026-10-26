import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "@playwright/test";
import { E2E_API, E2E_API_PORT, E2E_BASE, E2E_WEB_PORT, e2eDatabaseUrl } from "./e2e/support/e2e-env";

const envFile = resolve(__dirname, ".env");
if (!process.env.TEST_DATABASE_URL && existsSync(envFile)) process.loadEnvFile(envFile);
const testDatabaseUrl = e2eDatabaseUrl(process.env.TEST_DATABASE_URL);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1, // Mesmas contas/banco; concorrência de lances é exercitada dentro do cenário próprio.
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  globalSetup: "./e2e/support/global-setup.ts",
  use: { baseURL: E2E_BASE, trace: "retain-on-failure" },
  webServer: [
    {
      command: "node --env-file-if-exists=../.env -r ts-node/register src/main.ts",
      cwd: resolve(__dirname, "back-end"),
      url: `${E2E_API}/api/health/ready`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        DATABASE_URL: testDatabaseUrl,
        API_PORT: String(E2E_API_PORT),
        API_HOST: "127.0.0.1",
        WEB_ORIGIN: E2E_BASE,
        AUDIT_WITNESS_DIR: resolve(__dirname, ".data/witness-e2e"),
        MEDIA_DIR: resolve(__dirname, ".data/media-e2e"),
      },
    },
    {
      command: `npx next build && npx next start --hostname 127.0.0.1 --port ${E2E_WEB_PORT}`,
      cwd: resolve(__dirname, "front-end"),
      url: E2E_BASE,
      reuseExistingServer: false,
      timeout: 300000,
      env: { NEXT_PUBLIC_E2E_ERRORS: "1", NEXT_DIST_DIR: ".next-e2e", API_PROXY_TARGET: E2E_API, SITE_URL: E2E_BASE },
    },
  ],
});
