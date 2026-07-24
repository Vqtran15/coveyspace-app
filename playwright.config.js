import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  retries: 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit-iphone', use: { ...devices['iPhone 14'], browserName: 'webkit' }, testMatch: '**/event-form-overflow.spec.js' },
  ],
  webServer: {
    command: 'npm run dev',
    port: 5173,
    reuseExistingServer: false,
    timeout: 60000,
  },
})
