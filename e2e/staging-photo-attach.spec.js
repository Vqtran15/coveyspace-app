/**
 * staging-photo-attach.spec.js
 *
 * Tests for the photo attachment fix in ChatView:
 *   1. Preview appears after attaching a PNG
 *   2. Overlay buttons (camera + trash) are visible on the preview
 *   3. Trash button removes the preview
 *   4. Camera button clears the current preview
 *   5. Send still works after removing image (text-only message, no upload)
 *   6. File input value is reset after attaching and sending
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const BASE         = 'http://localhost:5173'
const SUPABASE_URL = 'https://ktmlyzwpgvhrwfgyoeiq.supabase.co'
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bWx5endwZ3ZocndmZ3lvZWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTMxMTMsImV4cCI6MjA5NzEyOTExM30.qFR30pKp1gm9k_SAmWHj-yKzwW4fBRoNZK8N6BeBV8k'
const TEST_IMG     = path.resolve('/private/tmp/claude-501/-Users-vuongtran/ae7ed8fa-38fa-4b1b-8473-0bd2cc6286d5/scratchpad/test_image.png')

function isUploadRequest(req) {
  const url    = req.url()
  const method = req.method()
  return url.includes('chat-images') &&
    !url.includes('/object/public/') &&
    (method === 'POST' || method === 'PUT')
}

async function openMainGroupChat(page) {
  await page.goto(BASE + '/chat', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const mainChat = page.getByText('Main Group Chat').first()
  if (await mainChat.isVisible()) {
    await mainChat.click()
    await page.waitForTimeout(1500)
  }
  await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 })
}

async function attachImage(page) {
  const fileInput = page.locator('input[type="file"][accept="image/*"]').first()
  await fileInput.setInputFiles(TEST_IMG)
  await page.waitForTimeout(800)
}

async function cleanupTestUploads(page) {
  await page.evaluate(async ({ supabaseUrl, anonKey }) => {
    const sessionKey = 'sb-ktmlyzwpgvhrwfgyoeiq-auth-token'
    let token = anonKey
    try {
      const raw = localStorage.getItem(sessionKey)
      if (raw) { const p = JSON.parse(raw); token = (Array.isArray(p) ? p[0] : p)?.access_token || token }
    } catch (_) {}

    const headers = { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

    // Delete messages with image_url sent by the test user (in the last 5 minutes)
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    await fetch(`${supabaseUrl}/rest/v1/messages?user_id=eq.e58ad88e-6622-4bb6-9a0f-af7297a1bea9&image_url=not.is.null&created_at=gte.${since}`, {
      method: 'DELETE', headers,
    })

    // List and delete storage files in test user's folder
    const listRes = await fetch(`${supabaseUrl}/storage/v1/object/list/chat-images/e58ad88e-6622-4bb6-9a0f-af7297a1bea9`, {
      method: 'GET', headers,
    })
    const files = await listRes.json().catch(() => [])
    if (Array.isArray(files) && files.length) {
      await fetch(`${supabaseUrl}/storage/v1/object/chat-images`, {
        method: 'DELETE', headers,
        body: JSON.stringify({ prefixes: files.map(f => `e58ad88e-6622-4bb6-9a0f-af7297a1bea9/${f.name}`) }),
      })
    }
  }, { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY })
}

// ── Test 1: Preview appears ────────────────────────────────────────────────────

test('photo-attach: preview image appears after attaching a PNG', async ({ page }) => {
  await openMainGroupChat(page)
  await attachImage(page)

  await expect(page.locator('img[alt="preview"]').first()).toBeVisible({ timeout: 5000 })

  // Clean up: trash the preview so no upload happens when we leave
  const trashBtn = page.locator('img[alt="preview"]').first()
    .locator('..') // .relative.shrink-0.group div
    .locator('button:last-child')
  await trashBtn.click()
  await expect(page.locator('img[alt="preview"]')).toHaveCount(0)
})

// ── Test 2: Overlay buttons visible ───────────────────────────────────────────

test('photo-attach: camera and trash overlay buttons are visible on preview', async ({ page }) => {
  await openMainGroupChat(page)
  await attachImage(page)

  const previewWrapper = page.locator('img[alt="preview"]').first().locator('..')
  // The overlay is the only sibling div inside the wrapper
  const overlay = previewWrapper.locator('div.absolute')

  // Camera button: first button inside overlay
  const cameraBtn = overlay.locator('button').first()
  // Trash button: last button inside overlay
  const trashBtn  = overlay.locator('button').last()

  await expect(cameraBtn).toBeVisible({ timeout: 5000 })
  await expect(trashBtn).toBeVisible({ timeout: 5000 })

  // Both should be 28px circles (w-7 h-7 = 1.75rem = 28px)
  const cameraBtnBox = await cameraBtn.boundingBox()
  const trashBtnBox  = await trashBtn.boundingBox()
  expect(cameraBtnBox.width).toBeCloseTo(28, 0)
  expect(trashBtnBox.width).toBeCloseTo(28, 0)

  // Clean up
  await trashBtn.click()
  await expect(page.locator('img[alt="preview"]')).toHaveCount(0)
})

// ── Test 3: Trash button removes preview ──────────────────────────────────────

test('photo-attach: trash button removes the preview', async ({ page }) => {
  await openMainGroupChat(page)
  await attachImage(page)

  await expect(page.locator('img[alt="preview"]').first()).toBeVisible({ timeout: 5000 })

  const previewWrapper = page.locator('img[alt="preview"]').first().locator('..')
  const trashBtn = previewWrapper.locator('div.absolute button').last()
  await trashBtn.click()

  // Preview should be gone
  await expect(page.locator('img[alt="preview"]')).toHaveCount(0, { timeout: 3000 })

  // File input should have no value (was already reset or never set in DOM sense)
  const inputVal = await page.locator('input[type="file"][accept="image/*"]').first().inputValue()
  expect(inputVal).toBe('')
})

// ── Test 4: Camera button clears the current preview ─────────────────────────

test('photo-attach: camera button removes the current preview', async ({ page }) => {
  await openMainGroupChat(page)
  await attachImage(page)

  await expect(page.locator('img[alt="preview"]').first()).toBeVisible({ timeout: 5000 })

  const previewWrapper = page.locator('img[alt="preview"]').first().locator('..')
  const cameraBtn = previewWrapper.locator('div.absolute button').first()
  await cameraBtn.click()

  // Preview for that slot should be gone (picker opens but we cannot assert on native OS dialog)
  await expect(page.locator('img[alt="preview"]')).toHaveCount(0, { timeout: 3000 })
})

// ── Test 5: Send still works after removing image (text-only, no upload) ──────

test('photo-attach: text-only message sends after trashing the attached image', async ({ page }) => {
  const uploadedUrls = []
  page.on('request', req => { if (isUploadRequest(req)) uploadedUrls.push(req.url()) })

  await openMainGroupChat(page)
  await attachImage(page)

  await expect(page.locator('img[alt="preview"]').first()).toBeVisible({ timeout: 5000 })

  // Trash the image
  const previewWrapper = page.locator('img[alt="preview"]').first().locator('..')
  const trashBtn = previewWrapper.locator('div.absolute button').last()
  await trashBtn.click()
  await expect(page.locator('img[alt="preview"]')).toHaveCount(0, { timeout: 3000 })

  // Type and send a text-only message
  const textarea = page.locator('textarea').first()
  await textarea.fill('e2e-test-text-only-no-image')
  await expect(textarea).toHaveValue('e2e-test-text-only-no-image')

  // Send button: bg-ember, type=button, no disabled state now that text is present
  const sendBtn = page.locator('button[type="button"].bg-ember').last()
  await expect(sendBtn).toBeEnabled({ timeout: 5000 })
  await sendBtn.click()

  await page.waitForTimeout(3000)

  // No storage upload should have occurred
  expect(uploadedUrls).toHaveLength(0)

  // Clean up the text-only message (no image_url, so use a body-based approach)
  await page.evaluate(async ({ supabaseUrl, anonKey }) => {
    const sessionKey = 'sb-ktmlyzwpgvhrwfgyoeiq-auth-token'
    let token = anonKey
    try {
      const raw = localStorage.getItem(sessionKey)
      if (raw) { const p = JSON.parse(raw); token = (Array.isArray(p) ? p[0] : p)?.access_token || token }
    } catch (_) {}
    const headers = { apikey: anonKey, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    await fetch(`${supabaseUrl}/rest/v1/messages?user_id=eq.e58ad88e-6622-4bb6-9a0f-af7297a1bea9&body=eq.e2e-test-text-only-no-image&created_at=gte.${since}`, {
      method: 'DELETE', headers,
    })
  }, { supabaseUrl: SUPABASE_URL, anonKey: ANON_KEY })
})

// ── Test 6: File input value reset after attaching and sending ────────────────

test('photo-attach: file input value is empty after attach-and-send cycle', async ({ page }) => {
  await openMainGroupChat(page)
  await attachImage(page)
  await expect(page.locator('img[alt="preview"]').first()).toBeVisible({ timeout: 5000 })

  // Send the image
  const sendBtn = page.locator('button[type="button"].bg-ember').last()
  await expect(sendBtn).toBeEnabled({ timeout: 5000 })
  await sendBtn.click()

  // Wait for send to complete and UI to reset
  await page.waitForTimeout(3000)

  // Preview should be cleared after send
  await expect(page.locator('img[alt="preview"]')).toHaveCount(0, { timeout: 5000 })

  // The file input's value should be empty (reset by the onClick fix)
  const inputVal = await page.evaluate(() => {
    const el = document.querySelector('input[type="file"][accept="image/*"]')
    return el ? el.value : null
  })
  expect(inputVal).toBe('')

  await cleanupTestUploads(page)
})
