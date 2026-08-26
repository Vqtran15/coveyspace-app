/**
 * staging-double-splash.spec.js
 *
 * QA for bug fix: switching groups should show GroupWelcomeBack but NOT WelcomeSplash.
 *
 * Test account: vqtran15+1@gmail.com (3 group memberships)
 *   Known groups:
 *     Chipotle's Group  7b2a1789-192a-4429-8790-9d85aad08154
 *     Lake Oswego CG    5a44cfa9-f28b-4386-81c6-175e247242cb
 *     West Linn CG      c3a1b282-22e2-44f3-b9cb-7390ded7807a
 *
 * Setup (before browser opens):
 *   1. Sign in via Supabase REST API to get an access token
 *   2. Call switch_active_group RPC to reset state to Chipotle's Group
 *      (ensures the test is repeatable regardless of prior run's switch)
 *   3. Pre-set welcome cookie for Chipotle's Group in the browser context
 *      (prevents WelcomeSplash from firing on login for the current group)
 *   4. Leave ALL other groups' cookies unset — that's the pre-fix bug condition
 *
 * The test then switches to Lake Oswego CG and asserts:
 *   GroupWelcomeBack: fires   ✓
 *   WelcomeSplash:   silent  ✓
 */

import { test, expect } from '@playwright/test'

const BASE      = 'http://localhost:5173'
const SUPABASE  = 'https://ktmlyzwpgvhrwfgyoeiq.supabase.co'
const ANON_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bWx5endwZ3ZocndmZ3lvZWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTMxMTMsImV4cCI6MjA5NzEyOTExM30.qFR30pKp1gm9k_SAmWHj-yKzwW4fBRoNZK8N6BeBV8k'
const EMAIL     = 'vqtran15+1@gmail.com'
const PASS      = 'tester'

const USER_ID       = 'c169b620-50d1-4930-aee7-358b355b31d6'
const START_GROUP   = '7b2a1789-192a-4429-8790-9d85aad08154' // Chipotle's Group — reset to this
const TARGET_NAME   = 'Lake Oswego'                           // switch to this

const SPLASH_MARKERS = [
  'You created', "You're in", 'Personalize your',
  'Set up your group', "Let's get your group",
]

test('switching groups: GroupWelcomeBack fires, WelcomeSplash does NOT', async ({ page }) => {

  // ── 0. Reset active group via Supabase API (ensures repeatability) ─────────
  const authResp = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  })
  const { access_token } = await authResp.json()
  expect(access_token, 'Failed to get access token from Supabase').toBeTruthy()

  await fetch(`${SUPABASE}/rest/v1/rpc/switch_active_group`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY,
      Authorization: `Bearer ${access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ target_group_id: START_GROUP }),
  })
  console.log("✓ Reset active group to Chipotle's Group via API")

  // ── 1. Pre-set welcome cookie for current group (prevents login splash) ────
  await page.context().addCookies([{
    name:     `cg_welcomed_${USER_ID}_${START_GROUP}`,
    value:    '1',
    domain:   'localhost',
    path:     '/',
    secure:   false,
    sameSite: 'Lax',
  }])

  // ── 2. Login ──────────────────────────────────────────────────────────────
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' })
  await page.waitForSelector('input[type="email"]', { timeout: 25000 })
  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASS)
  await page.click('button[type="submit"]')

  await page.waitForURL(url => !url.href.includes('/login'), { timeout: 25000 })
  await page.waitForLoadState('networkidle')
  await page.screenshot({ path: '/tmp/qa_splash_01_logged_in.png' })
  console.log('✓ Logged in cleanly (no WelcomeSplash)')

  // ── 3. Navigate to Settings ───────────────────────────────────────────────
  await page.goto(BASE + '/settings', { waitUntil: 'networkidle' })
  await page.screenshot({ path: '/tmp/qa_splash_02_settings.png' })
  console.log('✓ Settings loaded')

  // ── 4. Find the Lake Oswego CG group row ──────────────────────────────────
  // The active group button is disabled; inactive ones are not.
  // Lake Oswego is inactive since we reset to Chipotle's Group above.
  const switchButton = page.locator('button[disabled=""]').or(
    page.locator(`button:not([disabled])`).filter({ hasText: TARGET_NAME })
  )
  // Use just the non-disabled filter
  const targetBtn = page.locator(`button:not([disabled])`).filter({ hasText: TARGET_NAME }).first()
  await expect(targetBtn, `"${TARGET_NAME}" switch button not found or not enabled`).toBeVisible({ timeout: 8000 })
  await page.screenshot({ path: '/tmp/qa_splash_03_before_switch.png' })
  console.log(`✓ Found "${TARGET_NAME} CG" switch button`)

  // ── 5. Monitor for both splash screens (6-second window) ─────────────────
  let welcomeBackFired   = false
  let welcomeSplashFired = false
  const startedAt = Date.now()

  const monitor = async () => {
    const deadline = Date.now() + 6000
    while (Date.now() < deadline) {
      const text = await page.evaluate(() => document.body.innerText).catch(() => '')
      const elapsed = Date.now() - startedAt

      if (!welcomeBackFired && text.includes('Welcome back to')) {
        welcomeBackFired = true
        console.log(`  ✓ GroupWelcomeBack appeared at +${elapsed}ms`)
        await page.screenshot({ path: '/tmp/qa_splash_04_welcome_back.png' })
      }

      const hitMarker = SPLASH_MARKERS.find(m => text.includes(m))
      if (!welcomeSplashFired && hitMarker) {
        welcomeSplashFired = true
        console.log(`  ✗ WelcomeSplash appeared at +${elapsed}ms (matched: "${hitMarker}")`)
        await page.screenshot({ path: '/tmp/qa_splash_FAIL_welcome_splash.png' })
      }

      await page.waitForTimeout(100)
    }
  }

  // ── 6. Click switch and monitor concurrently ──────────────────────────────
  console.log(`→ Clicking "${TARGET_NAME}" to switch groups...`)
  const monitorPromise = monitor()
  await targetBtn.click()
  await monitorPromise

  await page.screenshot({ path: '/tmp/qa_splash_05_final.png' })

  // ── 7. Results ────────────────────────────────────────────────────────────
  console.log('')
  console.log('GroupWelcomeBack :', welcomeBackFired   ? '✓ fired (expected)'       : '✗ did not fire')
  console.log('WelcomeSplash    :', welcomeSplashFired ? '✗ fired (BUG REGRESSION)'  : '✓ did not fire (correct)')

  expect(welcomeBackFired,
    'GroupWelcomeBack ("Welcome back to") should appear on group switch'
  ).toBe(true)

  expect(welcomeSplashFired,
    'WelcomeSplash onboarding should NOT fire after a group switch (double-splash regression)'
  ).toBe(false)
})
