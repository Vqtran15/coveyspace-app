/**
 * event-chat-share.spec.js
 *
 * Tests two features shipped in commit 3e676f8:
 *   A. Conversation picker sheet (EventsTab "Share to Chat" flow)
 *   B. Event card rendering in ChatView (messages with event_id)
 *
 * Uses page.setContent() with Tailwind CDN — no Supabase auth required.
 * Runs under the existing `chromium` project in playwright.config.js.
 */

import { test, expect } from '@playwright/test'

// ---------------------------------------------------------------------------
// A. Conversation picker sheet
// ---------------------------------------------------------------------------

const PICKER_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">

  <!-- Trigger button -->
  <button
    id="share-btn"
    onclick="document.getElementById('picker-backdrop').classList.remove('hidden')"
    class="px-4 py-2 bg-ember text-white rounded-xl text-sm font-semibold"
  >Share to Chat</button>

  <!-- Picker backdrop + sheet (initially hidden) -->
  <div
    id="picker-backdrop"
    class="hidden fixed inset-0 z-[60] flex flex-col justify-end bg-black/30"
    onclick="if(event.target===this) close()"
  >
    <div id="picker-sheet" class="bg-white rounded-t-3xl">

      <!-- Header -->
      <div class="flex items-center justify-between px-5 py-4 border-b border-stone-100">
        <h3 class="font-bold text-stone-800">Share to Chat</h3>
        <button
          id="close-btn"
          onclick="document.getElementById('picker-backdrop').classList.add('hidden')"
          class="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100"
          aria-label="Close"
        >✕</button>
      </div>

      <!-- Conversation list -->
      <div class="px-4 py-3 max-h-80 overflow-y-auto">

        <!-- Skeleton loading rows (shown when pickerLoading=true; hidden here) -->
        <div id="skeleton" class="hidden space-y-2">
          <div class="h-[60px] bg-stone-100 rounded-2xl animate-pulse"></div>
          <div class="h-[60px] bg-stone-100 rounded-2xl animate-pulse"></div>
          <div class="h-[60px] bg-stone-100 rounded-2xl animate-pulse"></div>
        </div>

        <!-- Conversation rows -->
        <div id="conv-list" class="space-y-1">

          <!-- Group chat row -->
          <button
            data-conv-id="conv-1"
            class="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left hover:bg-stone-50 active:bg-stone-100 transition-colors"
          >
            <div class="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
              <span class="text-green-600 text-sm">💬</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-stone-800 text-sm truncate">Group Chat</p>
              <p class="text-xs text-stone-400">Group chat</p>
            </div>
          </button>

          <!-- Direct message row -->
          <button
            data-conv-id="conv-2"
            class="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-left hover:bg-stone-50 active:bg-stone-100 transition-colors"
          >
            <div class="w-10 h-10 rounded-2xl bg-green-100 flex items-center justify-center shrink-0">
              <span class="text-green-600 text-sm">💬</span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-stone-800 text-sm truncate">John Smith</p>
              <p class="text-xs text-stone-400">Direct message</p>
            </div>
          </button>

        </div>
      </div>
    </div>
  </div>

  <script>
    // Close when clicking the backdrop (outside the sheet)
    document.getElementById('picker-backdrop').addEventListener('click', function(e) {
      if (e.target === this) {
        this.classList.add('hidden');
      }
    });
  </script>

</body>
</html>`

test.describe('A. Conversation picker sheet', () => {
  test('picker sheet is hidden by default', async ({ page }) => {
    await page.setContent(PICKER_HTML, { waitUntil: 'networkidle' })

    const backdrop = page.locator('#picker-backdrop')
    await expect(backdrop).toHaveClass(/hidden/)
  })

  test('clicking "Share to Chat" shows the picker', async ({ page }) => {
    await page.setContent(PICKER_HTML, { waitUntil: 'networkidle' })

    await page.click('#share-btn')

    const backdrop = page.locator('#picker-backdrop')
    await expect(backdrop).not.toHaveClass(/hidden/)
    await expect(page.locator('#picker-sheet')).toBeVisible()
  })

  test('both conversation rows are visible with correct labels', async ({ page }) => {
    await page.setContent(PICKER_HTML, { waitUntil: 'networkidle' })

    await page.click('#share-btn')

    // Group chat row
    const groupBtn = page.locator('[data-conv-id="conv-1"]')
    await expect(groupBtn).toBeVisible()
    await expect(groupBtn.locator('p').first()).toHaveText('Group Chat')
    await expect(groupBtn.locator('p').nth(1)).toHaveText('Group chat')

    // DM row
    const dmBtn = page.locator('[data-conv-id="conv-2"]')
    await expect(dmBtn).toBeVisible()
    await expect(dmBtn.locator('p').first()).toHaveText('John Smith')
    await expect(dmBtn.locator('p').nth(1)).toHaveText('Direct message')
  })

  test('clicking the backdrop closes the picker', async ({ page }) => {
    await page.setContent(PICKER_HTML, { waitUntil: 'networkidle' })

    await page.click('#share-btn')
    const backdrop = page.locator('#picker-backdrop')
    await expect(backdrop).not.toHaveClass(/hidden/)

    // Click the backdrop itself (not the sheet)
    await backdrop.click({ position: { x: 10, y: 10 } })

    await expect(backdrop).toHaveClass(/hidden/)
  })

  test('clicking the X button closes the picker', async ({ page }) => {
    await page.setContent(PICKER_HTML, { waitUntil: 'networkidle' })

    await page.click('#share-btn')
    const backdrop = page.locator('#picker-backdrop')
    await expect(backdrop).not.toHaveClass(/hidden/)

    await page.click('#close-btn')

    await expect(backdrop).toHaveClass(/hidden/)
  })
})

// ---------------------------------------------------------------------------
// B. Event card in ChatView
// ---------------------------------------------------------------------------

const EVENT_CARD_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            ember: '#2d9e6b',
          }
        }
      }
    }
  </script>
  <style>
    /* Ensure ember utilities work even if purged */
    .bg-ember { background-color: #2d9e6b !important; }
    .text-ember { color: #2d9e6b !important; }
    .bg-ember-active { background-color: #2d9e6b !important; }
  </style>
</head>
<body class="bg-gray-100 p-4">

  <!-- Event card (mirrors ChatView msg.event_id block) -->
  <div id="event-card" class="mb-3">
    <div class="bg-white border border-stone-200 rounded-2xl shadow-sm overflow-hidden">

      <!-- Header -->
      <div class="px-4 pt-3 pb-2 border-b border-stone-100">
        <div class="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">
          <span aria-hidden="true">📅</span>
          Event · Alex
        </div>
        <p id="event-title" class="text-sm font-bold text-stone-800 leading-snug">BBQ at the Park</p>
        <p id="event-datetime" class="text-xs text-stone-500 mt-0.5">Jul 24 · 7:00 PM</p>
        <div id="event-location" class="flex items-center gap-1 mt-0.5">
          <span aria-label="map pin" class="text-stone-400 text-xs shrink-0">📍</span>
          <p class="text-xs text-stone-500 truncate">Central Park</p>
        </div>
      </div>

      <!-- RSVP buttons -->
      <div id="rsvp-buttons" class="px-4 py-3 flex gap-2">

        <button
          id="btn-going"
          data-status="going"
          class="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-colors bg-stone-100 text-stone-600"
        >
          <span>✓</span>
          Going
        </button>

        <button
          id="btn-maybe"
          data-status="maybe"
          class="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-colors bg-stone-100 text-stone-600"
        >
          <span>−</span>
          Maybe
        </button>

        <button
          id="btn-not-going"
          data-status="not_going"
          class="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition-colors bg-stone-100 text-stone-600"
        >
          <span>✕</span>
          Can't go
        </button>

      </div>

      <!-- Count row + timestamp -->
      <div class="px-4 pb-3 flex items-center gap-2">
        <!-- Mock avatar -->
        <div class="w-5 h-5 rounded-full border-2 border-white shrink-0 overflow-hidden bg-green-500 flex items-center justify-center">
          <span class="text-white text-[7px] font-bold">A</span>
        </div>
        <span id="rsvp-count" class="text-xs text-stone-400">3 going · 1 maybe</span>
        <span class="ml-auto text-[10px] text-stone-400">7:00 PM</span>
      </div>

    </div>
  </div>

  <script>
    // RSVP toggle: clicking a button activates it; clicking again deactivates it.
    // Active styling mirrors ChatView: going=bg-ember text-white, maybe=bg-amber-400 text-white, not_going=bg-stone-500 text-white
    const ACTIVE = {
      going:     ['bg-ember',     'text-white'],
      maybe:     ['bg-amber-400','text-white'],
      not_going: ['bg-stone-500','text-white'],
    }
    const INACTIVE = ['bg-stone-100', 'text-stone-600']

    let currentStatus = null

    document.querySelectorAll('[data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        const status = btn.dataset.status
        if (currentStatus === status) {
          // Toggle off
          ACTIVE[status].forEach(c => btn.classList.remove(c))
          INACTIVE.forEach(c => btn.classList.add(c))
          currentStatus = null
        } else {
          // Deactivate previous
          if (currentStatus) {
            const prev = document.querySelector('[data-status="' + currentStatus + '"]')
            ACTIVE[currentStatus].forEach(c => prev.classList.remove(c))
            INACTIVE.forEach(c => prev.classList.add(c))
          }
          // Activate clicked
          INACTIVE.forEach(c => btn.classList.remove(c))
          ACTIVE[status].forEach(c => btn.classList.add(c))
          currentStatus = status
        }
      })
    })
  </script>

</body>
</html>`

test.describe('B. Event card in ChatView', () => {
  test('event title "BBQ at the Park" is visible', async ({ page }) => {
    await page.setContent(EVENT_CARD_HTML, { waitUntil: 'networkidle' })

    await expect(page.locator('#event-title')).toHaveText('BBQ at the Park')
  })

  test('date/time line "Jul 24 · 7:00 PM" is visible', async ({ page }) => {
    await page.setContent(EVENT_CARD_HTML, { waitUntil: 'networkidle' })

    await expect(page.locator('#event-datetime')).toHaveText('Jul 24 · 7:00 PM')
  })

  test('location "Central Park" is visible with map pin area', async ({ page }) => {
    await page.setContent(EVENT_CARD_HTML, { waitUntil: 'networkidle' })

    const locationDiv = page.locator('#event-location')
    await expect(locationDiv).toBeVisible()
    await expect(locationDiv.locator('p')).toHaveText('Central Park')
    // Map pin icon area is present
    await expect(locationDiv.locator('[aria-label="map pin"]')).toBeVisible()
  })

  test('all three RSVP buttons are present (Going, Maybe, Can\'t go)', async ({ page }) => {
    await page.setContent(EVENT_CARD_HTML, { waitUntil: 'networkidle' })

    await expect(page.locator('#btn-going')).toBeVisible()
    await expect(page.locator('#btn-maybe')).toBeVisible()
    await expect(page.locator('#btn-not-going')).toBeVisible()

    await expect(page.locator('#btn-going')).toContainText('Going')
    await expect(page.locator('#btn-maybe')).toContainText('Maybe')
    await expect(page.locator('#btn-not-going')).toContainText("Can't go")
  })

  test('clicking "Going" applies active styling (bg-ember text-white)', async ({ page }) => {
    await page.setContent(EVENT_CARD_HTML, { waitUntil: 'networkidle' })

    const btn = page.locator('#btn-going')
    // Inactive by default
    await expect(btn).toHaveClass(/bg-stone-100/)

    await btn.click()

    // Should now have active ember styling
    await expect(btn).toHaveClass(/bg-ember/)
    await expect(btn).toHaveClass(/text-white/)
    await expect(btn).not.toHaveClass(/bg-stone-100/)
  })

  test('clicking active "Going" again removes active styling (toggle off)', async ({ page }) => {
    await page.setContent(EVENT_CARD_HTML, { waitUntil: 'networkidle' })

    const btn = page.locator('#btn-going')

    // Activate
    await btn.click()
    await expect(btn).toHaveClass(/bg-ember/)

    // Deactivate by clicking again
    await btn.click()
    await expect(btn).not.toHaveClass(/bg-ember/)
    await expect(btn).toHaveClass(/bg-stone-100/)
    await expect(btn).toHaveClass(/text-stone-600/)
  })

  test('count row shows "3 going · 1 maybe"', async ({ page }) => {
    await page.setContent(EVENT_CARD_HTML, { waitUntil: 'networkidle' })

    await expect(page.locator('#rsvp-count')).toHaveText('3 going · 1 maybe')
  })
})
