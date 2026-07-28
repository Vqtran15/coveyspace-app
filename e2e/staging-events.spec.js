/**
 * staging-events.spec.js
 *
 * End-to-end tests for Events tab, RSVP flows, Chat view, and Home screen
 * on the staging Vercel Preview deployment.
 *
 * Auth: relies on .playwright-auth.json written by staging-auth.setup.js.
 * Each test starts already authenticated as e2e-playwright-test@coveyspace.com
 * (member of "Chipotle's Group", events_enabled=true).
 *
 * Events in the group (as of 2026-07-25):
 *   Past:     "Old event"  — 2026-07-17
 *   Featured: "Lake Day"   — 2026-07-25 (today; first upcoming → featured card)
 *   Compact:  "Next event" — 2026-07-30
 *
 * Run: npx playwright test --config playwright.staging.config.js
 */

import { test, expect, request } from '@playwright/test'

const BASE = 'http://localhost:5173'
const TEST_USER_ID   = 'e58ad88e-6622-4bb6-9a0f-af7297a1bea9'
const LAKE_DAY_ID    = '613e33f3-9fca-47dd-899c-019ceadb53f3'
const NEXT_EVENT_ID  = 'bf502f3a-8460-438f-90aa-dee5a35a6674'
const SUPABASE_URL   = 'https://ktmlyzwpgvhrwfgyoeiq.supabase.co'
const ANON_KEY       = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bWx5endwZ3ZocndmZ3lvZWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTMxMTMsImV4cCI6MjA5NzEyOTExM30.qFR30pKp1gm9k_SAmWHj-yKzwW4fBRoNZK8N6BeBV8k'

// ── Helpers ───────────────────────────────────────────────────────────────────

/** The bottom mobile nav (second <nav> on the page; desktop sidebar is first but hidden) */
function bottomNav(page) {
  return page.locator('nav').last()
}

async function goToEvents(page) {
  await page.goto(BASE + '/events', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
}

async function goToChat(page) {
  await page.goto(BASE + '/chat', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
}

/**
 * Delete the test user's RSVP for a specific event via Supabase REST API.
 * Reads the real user JWT from the page's Supabase session (localStorage or
 * cookie) so the DELETE satisfies the "members manage own rsvps" RLS policy.
 * Falls back to anon key if session is unavailable (will silently delete 0 rows).
 */
async function clearTestUserRsvp(page, eventId) {
  await page.evaluate(async ({ supabaseUrl, anonKey, userId, eventId }) => {
    // Resolve the real user access token — try localStorage first (Supabase JS v2 default),
    // then fall back to reading the cookie (used when the app configures cookieStorage).
    let accessToken = anonKey
    const sessionKey = 'sb-ktmlyzwpgvhrwfgyoeiq-auth-token'
    try {
      const raw = localStorage.getItem(sessionKey)
      if (raw) {
        const parsed = JSON.parse(raw)
        const session = Array.isArray(parsed) ? parsed[0] : parsed
        if (session?.access_token) accessToken = session.access_token
      }
    } catch (_) {}

    if (accessToken === anonKey) {
      try {
        const m = document.cookie.match(/sb-ktmlyzwpgvhrwfgyoeiq-auth-token=([^;]+)/)
        if (m) {
          const parsed = JSON.parse(decodeURIComponent(m[1]))
          const session = Array.isArray(parsed) ? parsed[0] : parsed
          if (session?.access_token) accessToken = session.access_token
        }
      } catch (_) {}
    }

    await fetch(
      `${supabaseUrl}/rest/v1/event_rsvps?event_id=eq.${eventId}&user_id=eq.${userId}`,
      {
        method: 'DELETE',
        headers: {
          'apikey':        anonKey,
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type':  'application/json',
        },
      }
    )
  }, { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY, userId: TEST_USER_ID, eventId })
  // Brief wait for the deletion to propagate before the next UI action
  await page.waitForTimeout(400)
}

// ── Smoke / Auth ──────────────────────────────────────────────────────────────

test.describe('Smoke & auth', () => {
  test('navigates to /home and renders bottom nav with Events tab', async ({ page }) => {
    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // The stored auth state should keep the user logged in
    expect(page.url()).toContain('/home')
    await expect(bottomNav(page).getByText('Events')).toBeVisible({ timeout: 10000 })
  })

  test('home screen has no unexpected JS errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => {
      const msg = e.message
      if (!msg.includes('supabase') && !msg.includes('fetch') && !msg.includes('Network')) {
        errors.push(msg)
      }
    })

    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)
    expect(errors).toHaveLength(0)
  })
})

// ── Home screen event integration ─────────────────────────────────────────────

test.describe('Home screen', () => {
  test('shows NEXT EVENT card with Lake Day', async ({ page }) => {
    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    await expect(page.getByText('NEXT EVENT').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Lake Day').first()).toBeVisible()
  })

  test('Next Event card shows Jul 25 date', async ({ page }) => {
    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    await expect(page.getByText(/Jul 25/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('clicking Next Event card navigates to /events', async ({ page }) => {
    await page.goto(BASE + '/home', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    // Click on the Next Event card row
    await page.getByText('NEXT EVENT').first().click()
    await page.waitForURL('**/events', { timeout: 10000 })
    expect(page.url()).toContain('/events')
  })
})

// ── Events list ───────────────────────────────────────────────────────────────

test.describe('Events list', () => {
  test('loads without JS errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => {
      const msg = e.message
      if (!msg.includes('supabase') && !msg.includes('fetch') && !msg.includes('Network')) {
        errors.push(msg)
      }
    })

    await goToEvents(page)
    await page.waitForTimeout(2000)
    expect(errors).toHaveLength(0)
  })

  test('shows both upcoming events: Lake Day and Next event', async ({ page }) => {
    await goToEvents(page)

    await expect(page.getByText('Lake Day')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Next event')).toBeVisible({ timeout: 10000 })
  })

  test('shows "Past events" section header with count', async ({ page }) => {
    await goToEvents(page)

    await expect(page.getByText(/Past events/i).first()).toBeVisible({ timeout: 10000 })
  })

  test('past section expands to show Old event on click', async ({ page }) => {
    await goToEvents(page)

    await page.getByText(/Past events/i).first().click()
    await page.waitForTimeout(600)

    await expect(page.getByText('Old event')).toBeVisible({ timeout: 5000 })
  })
})

// ── Featured card (Lake Day) ──────────────────────────────────────────────────

test.describe('Featured event card (Lake Day)', () => {
  test('shows date badge — JUL and 25', async ({ page }) => {
    await goToEvents(page)

    // The featured card's date badge has month and day
    await expect(page.getByText('Jul').first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('25').first()).toBeVisible()
  })

  test('shows event title, location, time, and description', async ({ page }) => {
    await goToEvents(page)

    await expect(page.getByText('Lake Day')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/Seth/i).first()).toBeVisible()    // location "Seth's house"
    await expect(page.getByText(/Fun night/i).first()).toBeVisible() // description
  })

  test('shows three inline RSVP buttons: Going, Maybe, Can\'t go', async ({ page }) => {
    await goToEvents(page)

    await expect(page.getByRole('button', { name: 'Going' }).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Maybe' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: "Can't go" }).first()).toBeVisible()
  })

  test('compact card (Next event) does NOT have inline RSVP buttons inside it', async ({ page }) => {
    await goToEvents(page)

    // The compact card is a motion.button wrapping a layout with no RSVP pill buttons.
    // We verify by checking that "Next event" card's parent has no Going/Maybe/Can't go buttons.
    const compactCard = page.getByText('Next event').locator('..').locator('..')
    const rsvpBtnsInsideCompact = compactCard.getByRole('button', { name: /going|maybe|can't go/i })
    await expect(rsvpBtnsInsideCompact).toHaveCount(0, { timeout: 5000 })
  })

  test('shows RSVP count (existing RSVPs from other users)', async ({ page }) => {
    await goToEvents(page)

    // Lake Day already has RSVPs from real users — count text should appear
    const rsvpLine = page.getByText(/\d+ going|\d+ maybe|\d+ can't go/i).first()
    await expect(rsvpLine).toBeVisible({ timeout: 10000 })
  })

  test('has a 3-dot (DotsThreeVertical) button visible in the card header', async ({ page }) => {
    await goToEvents(page)

    // The 3-dot button is the last button inside the first .rounded-2xl card
    const firstCard = page.locator('.rounded-2xl').first()
    const dotsBtn = firstCard.locator('button').last()
    await expect(dotsBtn).toBeVisible({ timeout: 10000 })
  })
})

// ── RSVP interactions ─────────────────────────────────────────────────────────

test.describe('RSVP interactions', () => {
  test.beforeEach(async ({ page }) => {
    // Reset test user RSVPs on Lake Day before each RSVP test to ensure isolation
    await page.goto(BASE + '/events', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    await clearTestUserRsvp(page, LAKE_DAY_ID)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
  })

  test('clicking Going activates bg-ember on the button', async ({ page }) => {
    const goingBtn = page.getByRole('button', { name: 'Going' }).first()
    await goingBtn.click()
    await page.waitForTimeout(1200)

    const cls = await goingBtn.getAttribute('class')
    expect(cls).toMatch(/bg-ember/)
  })

  test('clicking Going again (toggle off) removes active state', async ({ page }) => {
    const goingBtn = page.getByRole('button', { name: 'Going' }).first()

    // First click — RSVP as Going (starts inactive after beforeEach reset)
    await goingBtn.click()
    await page.waitForTimeout(1000)

    // Verify it's active
    let cls = await goingBtn.getAttribute('class')
    expect(cls).toMatch(/bg-ember/)

    // Second click — toggle off
    await goingBtn.click()
    await page.waitForTimeout(1000)

    cls = await goingBtn.getAttribute('class')
    expect(cls).toMatch(/bg-stone-100/)
  })

  test('clicking Maybe activates bg-lagoon-700', async ({ page }) => {
    const maybeBtn = page.getByRole('button', { name: 'Maybe' }).first()
    await maybeBtn.click()
    await page.waitForTimeout(1200)

    const cls = await maybeBtn.getAttribute('class')
    expect(cls).toMatch(/bg-lagoon-700/)
  })

  test("clicking Can't go activates bg-stone-500", async ({ page }) => {
    const cantGoBtn = page.getByRole('button', { name: "Can't go" }).first()
    await cantGoBtn.click()
    await page.waitForTimeout(1200)

    const cls = await cantGoBtn.getAttribute('class')
    expect(cls).toMatch(/bg-stone-500/)
  })

  test('switching from Going to Maybe changes active button', async ({ page }) => {
    const goingBtn = page.getByRole('button', { name: 'Going' }).first()
    const maybeBtn = page.getByRole('button', { name: 'Maybe' }).first()

    await goingBtn.click()
    await page.waitForTimeout(800)

    await maybeBtn.click()
    await page.waitForTimeout(1200)

    const goingCls = await goingBtn.getAttribute('class')
    const maybeCls = await maybeBtn.getAttribute('class')

    // Going should be deactivated, Maybe should be active
    expect(goingCls).toMatch(/bg-stone-100/)
    expect(maybeCls).toMatch(/bg-lagoon-700/)
  })
})

// ── Event Detail sheet ────────────────────────────────────────────────────────

test.describe('Event Detail sheet', () => {
  test('3-dot button on featured card opens Lake Day detail', async ({ page }) => {
    await goToEvents(page)

    const firstCard = page.locator('.rounded-2xl').first()
    await firstCard.locator('button').last().click()
    await page.waitForTimeout(800)

    // Full-screen detail sheet should show event title
    await expect(page.getByText('Lake Day').first()).toBeVisible({ timeout: 8000 })
  })

  test('event detail shows location: Seth\'s house', async ({ page }) => {
    await goToEvents(page)

    const firstCard = page.locator('.rounded-2xl').first()
    await firstCard.locator('button').last().click()
    await page.waitForTimeout(800)

    await expect(page.getByText(/Seth/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('event detail shows description: Fun night!!', async ({ page }) => {
    await goToEvents(page)

    const firstCard = page.locator('.rounded-2xl').first()
    await firstCard.locator('button').last().click()
    await page.waitForTimeout(800)

    await expect(page.getByText('Fun night!!').first()).toBeVisible({ timeout: 8000 })
  })

  test('event detail has RSVP buttons Going and Maybe', async ({ page }) => {
    await goToEvents(page)

    const firstCard = page.locator('.rounded-2xl').first()
    await firstCard.locator('button').last().click()
    await page.waitForTimeout(800)

    await expect(page.getByRole('button', { name: 'Going' }).first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByRole('button', { name: 'Maybe' }).first()).toBeVisible()
  })

  test('back button closes the detail sheet and returns to events list', async ({ page }) => {
    await goToEvents(page)

    // Open detail
    const firstCard = page.locator('.rounded-2xl').first()
    await firstCard.locator('button').last().click()
    await page.waitForTimeout(800)

    // Verify detail is open
    await expect(page.getByText('Lake Day').first()).toBeVisible({ timeout: 5000 })

    // Click the ArrowLeft (back) button — it is the first SVG button in the detail nav
    await page.locator('button').first().click()
    await page.waitForTimeout(500)

    // Should be back on events list with RSVP buttons visible
    await expect(page.getByRole('button', { name: 'Going' }).first()).toBeVisible({ timeout: 5000 })
  })

  test('compact card tap (Next event) opens its detail sheet', async ({ page }) => {
    await goToEvents(page)

    // "Next event" compact card is a button — clicking opens EventDetail
    await page.getByText('Next event').first().click()
    await page.waitForTimeout(800)

    await expect(page.getByText('Next event').first()).toBeVisible({ timeout: 8000 })
    await expect(page.getByText(/My house/i).first()).toBeVisible() // location
  })
})

// ── Color theme ───────────────────────────────────────────────────────────────

test.describe('Theme compliance', () => {
  test('events tab has no amber gradient (retheme applied)', async ({ page }) => {
    await goToEvents(page)

    const html = await page.content()
    // The retheme removed amber gradient backgrounds entirely
    expect(html).not.toMatch(/from-amber-\d+|to-amber-\d+/)
  })

  test('date badge uses ember tint: bg-ember/10 class', async ({ page }) => {
    await goToEvents(page)

    const badge = page.locator('.bg-ember\\/10').first()
    await expect(badge).toBeVisible({ timeout: 10000 })
  })

  test('Maybe RSVP button uses lagoon-700 (WCAG fix), not amber', async ({ page }) => {
    await goToEvents(page)

    // Clear any previous RSVP so Maybe starts inactive (toggling active → inactive would give bg-stone-100)
    await clearTestUserRsvp(page, LAKE_DAY_ID)
    await page.waitForTimeout(400)

    // Use filter to target the Lake Day card specifically — avoids matching a birthday banner
    const firstCard = page.locator('.rounded-2xl').filter({ hasText: 'Lake Day' }).first()
    await firstCard.locator('button').last().click()
    await page.waitForTimeout(800)

    const maybeBtn = page.getByRole('button', { name: 'Maybe' }).first()
    await maybeBtn.click()
    await page.waitForTimeout(1000)

    const cls = await maybeBtn.getAttribute('class')
    expect(cls).not.toMatch(/bg-amber-/)
    expect(cls).toMatch(/bg-lagoon-700/)

    // Clean up RSVP
    await clearTestUserRsvp(page, LAKE_DAY_ID)
  })
})

// ── Chat view ─────────────────────────────────────────────────────────────────

test.describe('Chat view', () => {
  test('loads without JS errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => {
      const msg = e.message
      if (!msg.includes('supabase') && !msg.includes('fetch') &&
          !msg.includes('Network') && !msg.includes('WebSocket')) {
        errors.push(msg)
      }
    })

    await goToChat(page)
    await page.waitForTimeout(3000)
    expect(errors).toHaveLength(0)
  })

  test('message input is visible', async ({ page }) => {
    await goToChat(page)
    await page.waitForTimeout(2000)

    // /chat shows ConversationList first; click into the main conversation to reveal the textarea
    const mainChat = page.getByText('Main Group Chat').first()
    if (await mainChat.isVisible()) {
      await mainChat.click()
      await page.waitForTimeout(1500)
    }

    // Chat uses a textarea for message input
    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible({ timeout: 10000 })
  })

  test('chat scrolls to bottom on initial load (not stuck at polls)', async ({ page }) => {
    await goToChat(page)
    // Allow polls/events to load and freshLoadRef scrollToBottom to fire
    await page.waitForTimeout(5000)

    const distanceFromBottom = await page.evaluate(() => {
      // The messages container has a scroll position
      const scroller = document.querySelector('[class*="overflow-y-auto"]')
      if (!scroller) return null
      return scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight
    })

    if (distanceFromBottom !== null) {
      // Should be within 300px of the bottom (not at the top)
      expect(distanceFromBottom).toBeLessThan(300)
    }
  })

  test('chat message input accepts text', async ({ page }) => {
    await goToChat(page)
    await page.waitForTimeout(2000)

    // /chat may show ConversationList first; navigate into the main conversation
    const mainChat = page.getByText('Main Group Chat').first()
    if (await mainChat.isVisible()) {
      await mainChat.click()
      await page.waitForTimeout(1500)
    }

    const textarea = page.locator('textarea').first()
    await textarea.click()
    await textarea.fill('E2E test message — please ignore')
    await page.waitForTimeout(300)

    const value = await textarea.inputValue()
    expect(value).toContain('E2E test message')

    // Clear the field — don't actually send
    await textarea.fill('')
  })
})

// ── Prayer tab smoke ──────────────────────────────────────────────────────────

test.describe('Prayer tab', () => {
  test('loads without errors', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => {
      const msg = e.message
      if (!msg.includes('supabase') && !msg.includes('fetch') && !msg.includes('Network')) {
        errors.push(msg)
      }
    })

    await page.goto(BASE + '/prayer', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    expect(errors).toHaveLength(0)
    await expect(bottomNav(page).getByText('Prayer')).toBeVisible()
  })
})
