import { defineConfig, devices } from '@playwright/test'

// Staging E2E config — runs the local Vite dev server against the real Supabase backend.
// This avoids Vercel's WAF bot-detection while still exercising real data.
// The local build is identical to what's deployed on origin/staging.
//
// Run with: npx playwright test --config playwright.staging.config.js

export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/staging-auth.setup.js', '**/staging-*.spec.js'],
  timeout: 60000,
  retries: 1,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 20000,
    navigationTimeout: 45000,
  },
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: true,
    timeout: 90000,
  },
  projects: [
    // Step 1: authenticate once and save storage state (cookies)
    {
      name: 'setup',
      testMatch: /staging-auth\.setup\.js/,
      use: { ...devices['Pixel 5'] },
    },
    // Step 2: run all tests with saved auth state (no repeated logins)
    {
      name: 'chromium-mobile',
      use: {
        ...devices['Pixel 5'],
        storageState: '.playwright-auth.json',
      },
      dependencies: ['setup'],
      testMatch: /staging-(events|compress)\.spec\.js/,
    },
  ],
})
