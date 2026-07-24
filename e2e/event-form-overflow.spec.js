/**
 * event-form-overflow.spec.js
 *
 * Verifies that date and time inputs in the New Event form do not overflow
 * their container on an iPhone viewport. Uses page.setContent() with
 * Tailwind CDN so no Supabase auth is required.
 *
 * Runs against a WebKit (Safari-engine) iPhone 14 emulation to catch
 * iOS-specific replaced-element overflow.
 */

import { test, expect, devices } from '@playwright/test'

const IPHONE = devices['iPhone 14']

// Must be top-level — browserName forces a new worker and can't be inside describe
test.use({ ...IPHONE, browserName: 'webkit' })

// Inline the exact HTML structure from EventsTab EventForm + the sheet wrapper.
// Matches the DOM as rendered: overflow-hidden outer div > scrollable inner div > form.
const HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    /* Replicate the custom border colour used in focus-within */
    .focus-within\\:ring-jade:focus-within { --tw-ring-color: #2d9e6b; }
  </style>
</head>
<body class="bg-gray-100">
  <!-- Mirrors the form sheet: overflow-hidden outer, scrollable inner, p-5 -->
  <div id="sheet" class="bg-white rounded-t-3xl overflow-hidden" style="max-width:390px; margin:0 auto;">
    <div class="overflow-y-auto p-5">

      <!-- Date field -->
      <div class="mb-3">
        <label class="block text-xs font-semibold text-stone-500 mb-1">Date</label>
        <div id="date-wrapper" class="overflow-hidden rounded-xl border border-stone-200">
          <input
            id="date-input"
            type="date"
            value="2026-07-24"
            style="width:100%; box-sizing:border-box; display:block;"
            class="px-3 py-2.5 text-sm text-stone-800 focus:outline-none bg-white"
          />
        </div>
      </div>

      <!-- Time field -->
      <div class="mb-3">
        <label class="block text-xs font-semibold text-stone-500 mb-1">Time</label>
        <div id="time-wrapper" class="overflow-hidden rounded-xl border border-stone-200">
          <input
            id="time-input"
            type="time"
            value="19:00"
            style="width:100%; box-sizing:border-box; display:block;"
            class="px-3 py-2.5 text-sm text-stone-800 focus:outline-none bg-white"
          />
        </div>
      </div>

      <!-- Title field for comparison (plain text input, known-good) -->
      <div class="mb-3">
        <label class="block text-xs font-semibold text-stone-500 mb-1">Title</label>
        <input
          id="title-input"
          type="text"
          placeholder="Event name"
          class="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800"
        />
      </div>

    </div>
  </div>
</body>
</html>`

test.describe('Event form — date/time input overflow (iPhone 14)', () => {
  test('date input does not overflow its wrapper', async ({ page }) => {
    await page.setContent(HTML, { waitUntil: 'networkidle' })

    const overflow = await page.evaluate(() => {
      const wrapper = document.getElementById('date-wrapper')
      const input   = document.getElementById('date-input')
      return {
        wrapperWidth: wrapper.getBoundingClientRect().width,
        inputWidth:   input.getBoundingClientRect().width,
        inputScrollW: input.scrollWidth,
      }
    })

    console.log('date field:', overflow)
    expect(overflow.inputWidth).toBeLessThanOrEqual(overflow.wrapperWidth + 1) // +1px rounding tolerance
  })

  test('time input does not overflow its wrapper', async ({ page }) => {
    await page.setContent(HTML, { waitUntil: 'networkidle' })

    const overflow = await page.evaluate(() => {
      const wrapper = document.getElementById('time-wrapper')
      const input   = document.getElementById('time-input')
      return {
        wrapperWidth: wrapper.getBoundingClientRect().width,
        inputWidth:   input.getBoundingClientRect().width,
        inputScrollW: input.scrollWidth,
      }
    })

    console.log('time field:', overflow)
    expect(overflow.inputWidth).toBeLessThanOrEqual(overflow.wrapperWidth + 1)
  })

  test('date and time inputs are no wider than the title text input', async ({ page }) => {
    await page.setContent(HTML, { waitUntil: 'networkidle' })

    const widths = await page.evaluate(() => ({
      title: document.getElementById('title-input').getBoundingClientRect().width,
      date:  document.getElementById('date-input').getBoundingClientRect().width,
      time:  document.getElementById('time-input').getBoundingClientRect().width,
    }))

    console.log('widths:', widths)
    expect(widths.date).toBeLessThanOrEqual(widths.title + 1)
    expect(widths.time).toBeLessThanOrEqual(widths.title + 1)
  })
})
