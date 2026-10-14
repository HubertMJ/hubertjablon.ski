import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// The e2e tests run against the built site (npm run build) served by scripts/serve.mjs.
// PW_CHROMIUM_PATH points at a preinstalled Chromium where the bundled one is missing.
const executablePath = process.env.PW_CHROMIUM_PATH && existsSync(process.env.PW_CHROMIUM_PATH) ? process.env.PW_CHROMIUM_PATH : undefined;

export default defineConfig({
  testDir: "test/e2e",
  use: { baseURL: "http://127.0.0.1:4173", launchOptions: executablePath ? { executablePath } : {} },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } },
  ],
  webServer: { command: "node scripts/serve.mjs", url: "http://127.0.0.1:4173/", reuseExistingServer: !process.env.CI },
});
