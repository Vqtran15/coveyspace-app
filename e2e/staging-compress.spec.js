/**
 * staging-compress.spec.js
 *
 * Tests for the compressImage fix in ChatView:
 *   1. Normal path  — PNG is converted to JPEG and uploaded (not raw PNG)
 *   2. Null-toBlob path — when toBlob always returns null, message shows
 *      as failed instead of silently uploading the raw file
 */

import { test, expect } from '@playwright/test'
import path from 'path'

const BASE         = 'http://localhost:5173'
const SUPABASE_URL = 'https://ktmlyzwpgvhrwfgyoeiq.supabase.co'
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bWx5endwZ3ZocndmZ3lvZWlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NTMxMTMsImV4cCI6MjA5NzEyOTExM30.qFR30pKp1gm9k_SAmWHj-yKzwW4fBRoNZK8N6BeBV8k'
const TEST_IMG     = path.resolve('/private/tmp/claude-501/-Users-vuongtran/ae7ed8fa-38fa-4b1b-8473-0bd2cc6286d5/scratchpad/test_image.png')

// Upload requests go to /storage/v1/object/{bucket}/{path} (no "public" in URL).
// Reads go to /storage/v1/object/public/... — exclude those.
function isUploadRequest(req) {
  const url = req.url()
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

async function attachAndSend(page) {
  const fileInput = page.locator('input[type="file"][accept="image/*"]').first()
  await fileInput.setInputFiles(TEST_IMG)
  await page.waitForTimeout(800) // preview renders

  // Send button: ember bg, type=button, in the message input bar
  const sendBtn = page.locator('button[type="button"].bg-ember').last()
  await expect(sendBtn).toBeEnabled({ timeout: 5000 })
  await sendBtn.click()
}

// Clean up test messages and storage files sent by the test user
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

// ── Test 1: Normal compression ─────────────────────────────────────────────────

test('compressImage: PNG is converted to JPEG and uploaded (not raw PNG)', async ({ page }) => {
  const uploadedUrls = []
  page.on('request', req => { if (isUploadRequest(req)) uploadedUrls.push(req.url()) })

  await openMainGroupChat(page)
  await attachAndSend(page)
  await page.waitForTimeout(5000) // allow compression + upload to complete

  // At least one upload to chat-images must have happened
  expect(uploadedUrls.length).toBeGreaterThan(0)

  // The upload path must end in .jpg — confirms toBlob ran and renamed the file
  const uploadUrl = uploadedUrls[uploadedUrls.length - 1]
  expect(uploadUrl).toMatch(/\.jpg($|\?|\/|&)/)
  expect(uploadUrl).not.toMatch(/\.png($|\?|\/|&)/)

  await cleanupTestUploads(page)
})

// ── Test 2: toBlob null → failed message, nothing uploaded ────────────────────

test('compressImage: when toBlob returns null, message shows as failed (not uploaded)', async ({ page }) => {
  const uploadedUrls = []
  page.on('request', req => { if (isUploadRequest(req)) uploadedUrls.push(req.url()) })

  // Patch toBlob BEFORE page load so it's in place when compressImage runs
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      value: (cb) => cb(null),
      writable: true,
      configurable: true,
    })
  })

  await openMainGroupChat(page)
  await attachAndSend(page)

  // Allow time for both retry attempts (1200→600px) to fail
  await page.waitForTimeout(5000)

  // Nothing should have been uploaded to storage
  expect(uploadedUrls).toHaveLength(0)

  // The failed message UI should be visible
  await expect(page.getByText('Tap to retry').first()).toBeVisible({ timeout: 8000 })
  await expect(page.getByText('Failed to send').first()).toBeVisible({ timeout: 5000 })

  // No cleanup needed — nothing was uploaded and the failed message has no DB row
})
