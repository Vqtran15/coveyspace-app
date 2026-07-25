/**
 * staging-auth.setup.js
 *
 * Playwright global setup: logs in the E2E test user ONCE, then saves
 * the browser storage state (cookies + localStorage) to .playwright-auth.json.
 * All staging tests reuse this state so we only hit the Supabase auth
 * endpoint a single time per test run, avoiding Vercel's bot-detection
 * rate limiter.
 */

import { test as setup, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const AUTH_FILE = path.resolve(__dirname, '../.playwright-auth.json')

const BASE     = 'http://localhost:5173'
const EMAIL    = 'e2e-playwright-test@coveyspace.com'
const PASSWORD = 'E2eTest2026!'
const TEST_USER_ID = 'e58ad88e-6622-4bb6-9a0f-af7297a1bea9'
const GROUP_ID     = '7b2a1789-192a-4429-8790-9d85aad08154'
const WELCOMED_COOKIE = `cg_welcomed_${TEST_USER_ID}_${GROUP_ID}`

setup('authenticate and save session', async ({ page }) => {
  // Pre-set the welcomed cookie so the onboarding splash is skipped.
  // On localhost (HTTP) the cookie cannot have Secure=true.
  await page.context().addCookies([{
    name:     WELCOMED_COOKIE,
    value:    '1',
    domain:   'localhost',
    path:     '/',
    secure:   false,
    sameSite: 'Lax',
  }])

  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.waitForSelector('input[type="email"]', { timeout: 25000 })

  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')

  // Wait for the app to navigate to /home
  await page.waitForURL('**/home', { timeout: 25000 })
  await page.waitForTimeout(2000)

  // Verify we landed on the home screen
  await expect(page.locator('nav').last().getByText('Home')).toBeVisible()

  // Save the authenticated storage state
  await page.context().storageState({ path: AUTH_FILE })
})
