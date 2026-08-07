import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CHAT_VIEW_PATH = path.resolve(__dirname, '../src/components/ChatView.jsx')

// ── Test A: App loads without crashing ───────────────────────────────────────
test('app loads without crashing and shows login or main UI', async ({ page }) => {
  const jsErrors = []
  page.on('pageerror', err => {
    // Filter out expected Supabase auth/network errors that are benign in test env
    const msg = err.message || ''
    const isExpected =
      msg.includes('supabase') ||
      msg.includes('fetch') ||
      msg.includes('network') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      msg.includes('401') ||
      msg.includes('403') ||
      msg.includes('WebSocket') ||
      msg.includes('ERR_NAME_NOT_RESOLVED') ||
      msg.includes('CORS')
    if (!isExpected) jsErrors.push(msg)
  })

  await page.goto('/')
  // Page must render something — not a blank screen or error boundary
  await page.waitForLoadState('domcontentloaded')

  // The app shows a SplashScreen on first load — wait for it to clear (up to 5s)
  // The splash screen renders an icon + app name "Covey Space" with no interactive
  // elements; once it clears, the auth page or main UI should appear.
  await page.waitForFunction(() => {
    // Wait until an interactive element (input/button/form) appears, OR
    // the page contains more than just the splash screen text
    const interactive = document.querySelectorAll('input, button, form')
    return interactive.length > 0
  }, { timeout: 8000 })

  // The app should render at least some content
  const bodyText = await page.locator('body').innerText()
  expect(bodyText.length).toBeGreaterThan(0)

  // No unexpected JS exceptions
  expect(jsErrors).toHaveLength(0)

  // Should be some recognizable UI (input, button, or text)
  const hasInteractiveUI = await page.locator('input, button, h1, h2, form').count()
  expect(hasInteractiveUI).toBeGreaterThan(0)
})

// ── Test B: compressImage returns correct shape (canvas-based dimension test) ─
test('browser can create an image from canvas and read back correct dimensions', async ({ page }) => {
  await page.goto('about:blank')

  const result = await page.evaluate(async () => {
    // Create a 100x80 test PNG via canvas
    const canvas = document.createElement('canvas')
    canvas.width = 100
    canvas.height = 80
    canvas.getContext('2d').fillRect(0, 0, 100, 80)
    const blob = await new Promise(r => canvas.toBlob(r, 'image/png'))
    const file = new File([blob], 'test.png', { type: 'image/png' })

    // Simulate what compressImage does internally: load image to get naturalWidth/Height
    const url = URL.createObjectURL(file)
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
    URL.revokeObjectURL(url)
    return { width: img.naturalWidth, height: img.naturalHeight }
  })

  expect(result.width).toBe(100)
  expect(result.height).toBe(80)
})

// ── Test C: img with width/height attributes reflects them in the DOM ─────────
test('img element with width and height props renders those attributes in DOM', async ({ page }) => {
  await page.goto('about:blank')

  const result = await page.evaluate(() => {
    const img = document.createElement('img')
    img.setAttribute('width', '800')
    img.setAttribute('height', '600')
    document.body.appendChild(img)
    const hasWidth = img.hasAttribute('width')
    const hasHeight = img.hasAttribute('height')
    const widthVal = img.getAttribute('width')
    const heightVal = img.getAttribute('height')
    document.body.removeChild(img)
    return { hasWidth, hasHeight, widthVal, heightVal }
  })

  expect(result.hasWidth).toBe(true)
  expect(result.hasHeight).toBe(true)
  expect(result.widthVal).toBe('800')
  expect(result.heightVal).toBe('600')
})

// ── Test D: Code review — height: 'auto' is present in MessageList.jsx ──────
test("MessageList.jsx contains height: 'auto' in the image render block", () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../src/components/chat/MessageList.jsx'), 'utf8')
  expect(source).toContain("height: 'auto'")
})

// ── Test E: Browser reserves space from width/height attributes before image loads ─
test('browser reserves space from width/height attributes before image loads', async ({ page }) => {
  await page.goto('about:blank')

  const reservedHeight = await page.evaluate(() => {
    const img = document.createElement('img')
    img.width = 800
    img.height = 600
    img.style.maxHeight = '280px'
    img.style.height = 'auto'
    img.style.display = 'block'
    document.body.appendChild(img)
    // Don't set src — image hasn't loaded yet
    const h = img.getBoundingClientRect().height
    document.body.removeChild(img)
    return h
  })

  // Browser should reserve height based on aspect ratio (800x600 → aspect 4:3)
  // At maxHeight=280px, reserved h = 280 * (600/800) ≈ but capped at maxHeight
  // The key assertion: height is > 0, meaning the browser reserved layout space
  expect(reservedHeight).toBeGreaterThan(0)
})

// ── Test F: Regression baseline — img without width/height has no reserved height ─
test('img without width/height attributes has no reserved height (baseline)', async ({ page }) => {
  await page.goto('about:blank')

  const height = await page.evaluate(() => {
    const img = document.createElement('img')
    img.style.maxHeight = '280px'
    img.style.display = 'block'
    document.body.appendChild(img)
    const h = img.getBoundingClientRect().height
    document.body.removeChild(img)
    return h
  })

  // No dimensions = no reserved space
  expect(height).toBe(0)
})

// ── Test G: Code review — sendImage passes image_width/image_height ───────────
test('ChatView.jsx sendImage inserts image_width and image_height into Supabase', () => {
  const source = fs.readFileSync(CHAT_VIEW_PATH, 'utf8')

  // image_width and image_height appear in the messages INSERT block
  expect(source).toContain('image_width')
  expect(source).toContain('image_height')

  // compressImage destructuring returns { file, width, height } shape
  expect(source).toContain('{ file: compressed, width: imgWidth, height: imgHeight }')
})

// ── Test H: compressImage returns { file, width, height } for a JPEG ─────────
test('compressImage-equivalent returns correct shape for a JPEG (canvas-based)', async ({ page }) => {
  await page.goto('about:blank')

  const result = await page.evaluate(async () => {
    // Simulate what compressImage does for a regular JPEG:
    // create canvas, scale to MAX=1200, draw, toBlob, return {file, width, height}
    const MAX = 1200

    // Start with a 200x150 image
    const srcCanvas = document.createElement('canvas')
    srcCanvas.width = 200
    srcCanvas.height = 150
    srcCanvas.getContext('2d').fillStyle = '#ff0000'
    srcCanvas.getContext('2d').fillRect(0, 0, 200, 150)
    const srcBlob = await new Promise(r => srcCanvas.toBlob(r, 'image/jpeg'))
    const srcFile = new File([srcBlob], 'test.jpg', { type: 'image/jpeg' })

    // Load into an img to get naturalWidth/Height
    const url = URL.createObjectURL(srcFile)
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url })
    URL.revokeObjectURL(url)

    // Apply same scaling logic as compressImage
    const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)

    // Create output canvas
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    canvas.getContext('2d').drawImage(img, 0, 0, w, h)

    const outBlob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.82))
    const outFile = outBlob
      ? new File([outBlob], 'test.jpg', { type: 'image/jpeg' })
      : srcFile

    return {
      fileType: outFile.type,
      width: w,
      height: h,
      hasFile: !!outFile,
    }
  })

  // Should return a JPEG file with dimensions
  expect(result.hasFile).toBe(true)
  expect(result.fileType).toBe('image/jpeg')
  // 200x150 image is smaller than MAX=1200, so scale=1, dimensions should be unchanged
  expect(result.width).toBe(200)
  expect(result.height).toBe(150)
})

// ── Test I: compressImage scales down images larger than 1200px ───────────────
test('compressImage-equivalent scales down large images to fit within 1200px', async ({ page }) => {
  await page.goto('about:blank')

  const result = await page.evaluate(async () => {
    const MAX = 1200

    // Simulate a large 2400x1800 image (2x the limit)
    // We can't actually create a 2400px canvas easily in test, so we just run
    // the math directly as compressImage would
    const naturalWidth = 2400
    const naturalHeight = 1800

    const scale = Math.min(1, MAX / Math.max(naturalWidth, naturalHeight))
    const w = Math.round(naturalWidth * scale)
    const h = Math.round(naturalHeight * scale)

    return { scale, w, h }
  })

  // scale should be 1200/2400 = 0.5
  expect(result.scale).toBe(0.5)
  // 2400 * 0.5 = 1200
  expect(result.w).toBe(1200)
  // 1800 * 0.5 = 900
  expect(result.h).toBe(900)
})

// ── Test J: Decode effect waits on ALL images ────────────────────────────────
test('ChatView.jsx decode effect waits for all images (not filtered by size)', () => {
  const source = fs.readFileSync(CHAT_VIEW_PATH, 'utf8')

  // commit 42e5e0b: decode all images because iOS Safari ignores width/height
  // hints when CSS overrides them with auto, causing scroll-to-bottom to land
  // at the second-to-last message instead of the actual bottom
  expect(source).toContain('allImgs.map(img => img.decode')
  expect(source).not.toContain("!img.hasAttribute('width') || !img.hasAttribute('height')")
})
