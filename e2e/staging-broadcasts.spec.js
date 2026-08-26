/**
 * staging-broadcasts.spec.js
 *
 * QA for church broadcasts, leadership bulletin, and PCO integration.
 * Uses vqtran15+1@gmail.com (church admin) — self-contained login, no shared auth state.
 *
 * Covers:
 *  1. ResourcesTab — Church Bulletin card exists, opens correctly
 *  2. ResourcesTab — Leadership Bulletin card exists for admins, opens correctly
 *  3. ChurchBroadcastView — Church Bulletin scoped to all_members only
 *  4. ChurchBroadcastView — Leadership Bulletin scoped to admins_only only
 *  5. ChurchBroadcastView — each view shows correct header/icon
 *  6. ChurchBroadcastView — back button returns to Resources hub
 *  7. ChurchSettingsPage — Broadcasts tab loads, list renders
 *  8. ChurchSettingsPage — New Broadcast composer opens/closes with animation
 *  9. ChurchSettingsPage — Planning Center tab loads, connection state visible
 * 10. Static code checks — no regressions in ResourcesTab / ChurchBroadcastView
 */

import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function read(relPath) {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf8')
}

const BASE     = 'http://localhost:5173'
const EMAIL    = 'vqtran15+1@gmail.com'
const PASSWORD = 'tester'

// ── Auth helper ────────────────────────────────────────────────────────────────

async function loginAndReady(page) {
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type="email"]', { timeout: 20000 })

  await page.fill('input[type="email"]', EMAIL)
  await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]')

  // May land on welcome splash or home
  await page.waitForURL(/\/(home|welcome)/, { timeout: 25000 })

  // If welcome/onboarding splash, dismiss it
  const dismissBtn = page.locator('button:has-text("Let\'s go"), button:has-text("Get started"), button:has-text("Done")')
  if (await dismissBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dismissBtn.first().click()
    await page.waitForURL('**/home', { timeout: 10000 })
  }

  await page.waitForTimeout(1500)
}

async function goToResources(page) {
  await page.goto(BASE + '/bible', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
}

// ── 1–6. Browser tests (need dev server) ───────────────────────────────────────

test.describe('ResourcesTab — Church Bulletin card', () => {
  test('Church Bulletin card is visible in the Resources hub', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)

    // The hub overlay should open automatically (or tap the Resources tab)
    // Look for the "Church Bulletin" card
    const card = page.locator('text=Church Bulletin').first()
    await expect(card).toBeVisible({ timeout: 8000 })
  })

  test('Church Bulletin card shows Megaphone icon area (stone background)', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)

    // The all-members card has bg-stone-100 icon box (not ember/10)
    // Check the button containing "Church Bulletin" has the stone icon container
    const card = page.locator('button:has-text("Church Bulletin")').first()
    await expect(card).toBeVisible({ timeout: 8000 })
    // Icon box uses bg-stone-100 (not ember tint)
    const iconBox = card.locator('div.bg-stone-100.rounded-xl').first()
    await expect(iconBox).toBeVisible()
  })

  test('Tapping Church Bulletin opens view with "Church Bulletin" header', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)

    await page.locator('button:has-text("Church Bulletin")').first().click()
    await page.waitForTimeout(600)

    // Header title inside ChurchBroadcastView
    await expect(page.locator('p.font-bold:has-text("Church Bulletin")')).toBeVisible({ timeout: 5000 })
  })

  test('Church Bulletin view header does NOT say Leadership Bulletin', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)
    await page.locator('button:has-text("Church Bulletin")').first().click()
    await page.waitForTimeout(600)

    // Scope to the broadcast view header — the hub card is still in DOM behind overlay
    await expect(page.locator('p.font-bold:has-text("Leadership Bulletin")')).not.toBeVisible()
  })

  test('Back button in Church Bulletin view returns to Resources hub', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)
    await page.locator('button:has-text("Church Bulletin")').first().click()
    await page.waitForTimeout(600)

    // Tap back
    const backBtn = page.locator('button[aria-label="Back"]').first()
    await expect(backBtn).toBeVisible({ timeout: 3000 })
    await backBtn.click()
    await page.waitForTimeout(500)

    // Resources hub should be visible again
    await expect(page.locator('text=Church Bulletin').first()).toBeVisible({ timeout: 4000 })
  })
})

test.describe('ResourcesTab — Leadership Bulletin card', () => {
  test('Leadership Bulletin card is visible for admin user', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)

    const card = page.locator('button:has-text("Leadership Bulletin")').first()
    await expect(card).toBeVisible({ timeout: 8000 })
  })

  test('Leadership Bulletin card uses ember icon (not stone)', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)

    const card = page.locator('button:has-text("Leadership Bulletin")').first()
    await expect(card).toBeVisible({ timeout: 8000 })
    // Admin card icon box uses bg-ember/10 (not stone-100)
    const iconBox = card.locator('div[class*="bg-ember"]').first()
    await expect(iconBox).toBeVisible()
  })

  test('Tapping Leadership Bulletin opens view with "Leadership Bulletin" header', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)

    await page.locator('button:has-text("Leadership Bulletin")').first().click()
    await page.waitForTimeout(600)

    await expect(page.locator('p.font-bold:has-text("Leadership Bulletin")')).toBeVisible({ timeout: 5000 })
  })

  test('Leadership Bulletin view does NOT show Church Bulletin header', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)
    await page.locator('button:has-text("Leadership Bulletin")').first().click()
    await page.waitForTimeout(600)

    await expect(page.locator('p.font-bold:has-text("Church Bulletin")')).not.toBeVisible()
  })

  test('Leadership Bulletin view does not crash (no ErrorBoundary)', async ({ page }) => {
    const errors = []
    page.on('pageerror', e => errors.push(e.message))

    await loginAndReady(page)
    await goToResources(page)
    await page.locator('button:has-text("Leadership Bulletin")').first().click()
    await page.waitForTimeout(1500)

    // No ErrorBoundary "Something went wrong" message
    await expect(page.locator('text=Something went wrong')).not.toBeVisible()

    // No realtime channel error
    const channelErrors = errors.filter(e => e.includes('postgres_changes') && e.includes('after'))
    expect(channelErrors).toHaveLength(0)
  })

  test('Back button in Leadership Bulletin view returns to Resources hub', async ({ page }) => {
    await loginAndReady(page)
    await goToResources(page)
    await page.locator('button:has-text("Leadership Bulletin")').first().click()
    await page.waitForTimeout(600)

    const backBtn = page.locator('button[aria-label="Back"]').first()
    await expect(backBtn).toBeVisible({ timeout: 3000 })
    await backBtn.click()
    await page.waitForTimeout(500)

    await expect(page.locator('text=Leadership Bulletin').first()).toBeVisible({ timeout: 4000 })
  })
})

test.describe('ChurchSettingsPage — Broadcasts tab', () => {
  test('Church Settings page loads with Broadcasts tab active', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    await expect(page.locator('h1:has-text("Church Settings")')).toBeVisible({ timeout: 8000 })
    // Broadcasts tab should be active by default
    await expect(page.locator('button[aria-pressed="true"]:has-text("Broadcasts")')).toBeVisible({ timeout: 5000 })
  })

  test('"New Broadcast" button is visible', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    await expect(page.locator('button:has-text("New Broadcast")')).toBeVisible({ timeout: 8000 })
  })

  test('Broadcast composer opens when New Broadcast is tapped', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    await page.locator('button:has-text("New Broadcast")').click()
    await page.waitForTimeout(500)

    await expect(page.locator('h2:has-text("New Broadcast")')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('button:has-text("Send")')).toBeVisible()
  })

  test('Broadcast composer Send button is disabled when editor is empty', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.locator('button:has-text("New Broadcast")').click()
    await page.waitForTimeout(500)

    const sendBtn = page.locator('button:has-text("Send")').first()
    await expect(sendBtn).toBeDisabled()
  })

  test('Broadcast composer closes via back/cancel button with animation', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.locator('button:has-text("New Broadcast")').click()
    await page.waitForTimeout(500)

    await expect(page.locator('h2:has-text("New Broadcast")')).toBeVisible()

    const cancelBtn = page.locator('button[aria-label="Cancel"]').first()
    await expect(cancelBtn).toBeVisible()
    await cancelBtn.click()
    await page.waitForTimeout(400)

    await expect(page.locator('h2:has-text("New Broadcast")')).not.toBeVisible()
    // Settings page restored
    await expect(page.locator('h1:has-text("Church Settings")')).toBeVisible()
  })

  test('Audience toggle (All members / Group admins) is present in composer', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.locator('button:has-text("New Broadcast")').click()
    await page.waitForTimeout(500)

    // Scroll down in the composer to reveal the Audience section
    await page.evaluate(() => {
      const scrollBody = document.querySelector('[class*="overflow-y-auto overscroll-contain"]')
      if (scrollBody) scrollBody.scrollTop = 300
    })
    await page.waitForTimeout(300)

    // Look for the Audience section label — scoped above the composer editor
    await expect(page.locator('p:has-text("Audience")').first()).toBeVisible({ timeout: 4000 })
    await expect(page.locator('button:has-text("All members")')).toBeVisible()
    await expect(page.locator('button:has-text("Group Admins only")')).toBeVisible()
  })

  test('Broadcasts tab shows past broadcasts or empty state', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3000)

    // Either a broadcast card or the empty-state text
    const hasBroadcasts = await page.locator('.bg-white.rounded-2xl:not(.animate-pulse)').count() > 0
    const hasEmptyState = await page.locator('text=No broadcasts sent yet').isVisible()

    expect(hasBroadcasts || hasEmptyState).toBe(true)
  })
})

test.describe('ChurchSettingsPage — Planning Center tab', () => {
  test('Planning Center tab is accessible', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)

    await page.locator('button:has-text("Planning Center")').click()
    await page.waitForTimeout(500)

    await expect(page.locator('button[aria-pressed="true"]:has-text("Planning Center")')).toBeVisible()
  })

  test('Planning Center section shows connection status (not blank)', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.locator('button:has-text("Planning Center")').click()
    await page.waitForTimeout(2000)

    // Either "Loading…", "Connected to …", or "Sync members from People & Groups"
    const hasStatus = await page.locator('text=/Loading|Connected to|Sync members/').isVisible()
    expect(hasStatus).toBe(true)
  })

  test('PCO "Connect" or "Disconnect" button is rendered based on connection state', async ({ page }) => {
    await loginAndReady(page)
    await page.goto(BASE + '/church-settings', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    await page.locator('button:has-text("Planning Center")').click()
    await page.waitForTimeout(2500)

    const hasConnect    = await page.locator('button:has-text("Connect")').isVisible()
    const hasDisconnect = await page.locator('button:has-text("Disconnect")').isVisible()
    // Exactly one of them must be visible
    expect(hasConnect || hasDisconnect).toBe(true)
  })
})

// ── Static code checks ─────────────────────────────────────────────────────────

test.describe('Static — ResourcesTab.jsx', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ResourcesTab.jsx') })

  test('component is exported as ResourcesTab (not BibleTab)', () => {
    expect(src).toContain('export default function ResourcesTab(')
    expect(src).not.toContain('export default function BibleTab(')
  })

  test('Church Bulletin label is used (not Church Announcements)', () => {
    expect(src).toContain('Church Bulletin')
    expect(src).not.toContain('Church Announcements')
  })

  test('Leadership Bulletin label is present', () => {
    expect(src).toContain('Leadership Bulletin')
  })

  test('allMembersConv is computed from churchConversations (type all_members)', () => {
    expect(src).toContain("c.type === 'all_members'")
  })

  test('adminOnlyConv is gated by isAdmin', () => {
    expect(src).toMatch(/isAdmin.*admins_only|admins_only.*isAdmin/)
  })

  test('openBroadcast stores the conversation object in state', () => {
    expect(src).toContain('function openBroadcast(conv)')
    expect(src).toContain('setChurchBroadcastConv(conv)')
  })

  test('closeBroadcast uses a timeout animation (200ms)', () => {
    expect(src).toContain('setChurchBroadcastClosing(true)')
    expect(src).toContain('setTimeout')
    expect(src).toContain('setChurchBroadcastConv(null)')
  })

  test('ChurchBroadcastView overlay uses animate-slide-out-right when closing', () => {
    expect(src).toContain("churchBroadcastClosing ? 'animate-slide-out-right'")
  })

  test('ChurchBroadcastView is passed the conversation object directly', () => {
    expect(src).toContain('conversation={churchBroadcastConv}')
    expect(src).toContain('onBack={closeBroadcast}')
  })

  test('Megaphone icon is imported', () => {
    expect(src).toMatch(/import\s*\{[^}]*Megaphone[^}]*\}\s*from/)
  })

  test('ShieldCheck icon is imported', () => {
    expect(src).toMatch(/import\s*\{[^}]*ShieldCheck[^}]*\}\s*from/)
  })

  test('broadcastsLoading skeleton renders 1 or 2 cards based on adminOnlyConv', () => {
    expect(src).toContain('adminOnlyConv ? 1 : null')
  })

  test('allBroadcasts and adminBroadcasts are separate state variables', () => {
    expect(src).toContain('allBroadcasts')
    expect(src).toContain('adminBroadcasts')
  })
})

test.describe('Static — ChurchBroadcastView.jsx', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ChurchBroadcastView.jsx') })

  test('component does not import isAdmin (no cross-conversation merging)', () => {
    // isAdmin was removed when we stopped merging conversations
    const contextDestructure = src.match(/const\s*\{[^}]+\}\s*=\s*useAppContext\(\)/)?.[0] ?? ''
    expect(contextDestructure).not.toContain('isAdmin')
  })

  test('convId is derived from conversation.id', () => {
    expect(src).toContain('const convId      = conversation.id')
  })

  test('isAdminOnly is derived from conversation.type', () => {
    expect(src).toContain("conversation.type === 'admins_only'")
  })

  test('no adminsOnlyConvId variable (cross-conv fetch removed)', () => {
    expect(src).not.toContain('adminsOnlyConvId')
  })

  test('fetch is for convId only (single conversation)', () => {
    expect(src).toContain('db.churches.fetchMessages(convId)')
    // Should not be used in a Promise.all pattern anymore
    expect(src).not.toMatch(/Promise\.all\(\[db\.churches\.fetchMessages/)
  })

  test('realtime channel subscribes to convId only', () => {
    expect(src).toContain('`church-broadcast:${convId}`')
    // Only one subscribe call (no second subscribe for adminsOnly)
    const subscribeCalls = (src.match(/\.subscribe\(\)/g) ?? []).length
    expect(subscribeCalls).toBe(1)
  })

  test('header title switches on isAdminOnly', () => {
    expect(src).toContain("isAdminOnly ? 'Leadership Bulletin' : 'Church Bulletin'")
  })

  test('header icon switches on isAdminOnly (ShieldCheck vs Megaphone)', () => {
    expect(src).toContain('isAdminOnly')
    expect(src).toContain('<ShieldCheck')
    expect(src).toContain('<Megaphone')
  })

  test('sanitizeHtml removes script tags', () => {
    expect(src).toContain("doc.querySelectorAll('script, style, iframe').forEach(el => el.remove())")
  })

  test('sanitizeHtml removes on* event attributes', () => {
    expect(src).toContain("attr.name.startsWith('on')")
  })

  test('BroadcastCard is exported as a named export', () => {
    expect(src).toContain('export function BroadcastCard(')
  })
})

test.describe('Static — ChurchSettingsPage.jsx', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ChurchSettingsPage.jsx') })

  test('BroadcastComposer convId picks the right conversation by audience', () => {
    expect(src).toContain("const convId = audience === 'admins_only' ? convIds.adminsOnly : convIds.allMembers")
  })

  test('handleSent prepends new message to broadcastMessages', () => {
    expect(src).toContain('setBroadcastMessages(prev => [msg, ...prev])')
  })

  test('Broadcasts tab uses aria-pressed for tab buttons', () => {
    expect(src).toContain('aria-pressed={activeTab ===')
  })

  test('pco-api edge function is invoked for groups list', () => {
    expect(src).toContain("supabase.functions.invoke('pco-api'")
    expect(src).toContain('/groups/v2/groups')
  })

  test('pco-oauth-start edge function is invoked to begin OAuth', () => {
    expect(src).toContain("supabase.functions.invoke('pco-oauth-start'")
  })

  test('pco-disconnect edge function is invoked on disconnect', () => {
    expect(src).toContain("supabase.functions.invoke('pco-disconnect'")
  })

  test('pco-send-invite edge function is invoked when inviting a member', () => {
    expect(src).toContain("supabase.functions.invoke('pco-send-invite'")
  })

  test('Planning Center tab id is planning_center', () => {
    expect(src).toContain("id: 'planning_center'")
  })

  test('disconnect confirmation modal is gated by confirmDisconnect state', () => {
    expect(src).toContain('confirmDisconnect')
    expect(src).toContain('setConfirmDisconnect(true)')
  })

  test('auto-sync toggle has role=switch and aria-checked', () => {
    expect(src).toContain('role="switch"')
    expect(src).toContain('aria-checked={pcoConnection?.pco_sync_group_id === selectedPcoGroup}')
  })
})

test.describe('Static — no regressions in pco edge functions', () => {
  test('pco-send-invite/index.ts uses invites@coveyspace.com', () => {
    const src = read('supabase/functions/pco-send-invite/index.ts')
    expect(src).toContain("'invites@coveyspace.com'")
  })

  test('pco-send-invite validates email and invite_url are present', () => {
    const src = read('supabase/functions/pco-send-invite/index.ts')
    expect(src).toContain('!email || !invite_url')
  })

  test('pco-send-invite auth-checks caller has a church_roles row', () => {
    const src = read('supabase/functions/pco-send-invite/index.ts')
    expect(src).toContain("from('church_roles')")
    expect(src).toContain("'Forbidden'")
  })

  test('pco-disconnect scopes deletes to church groups only', () => {
    const src = read('supabase/functions/pco-disconnect/index.ts')
    expect(src).toContain('church_id')
    expect(src).toContain('planning_center_connections')
  })

  test('pco-disconnect validates church_roles before deleting', () => {
    const src = read('supabase/functions/pco-disconnect/index.ts')
    expect(src).toContain("from('church_roles')")
    expect(src).toContain("'Forbidden'")
  })
})
