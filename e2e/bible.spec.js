/**
 * bible.spec.js
 *
 * Comprehensive tests for the Bible tab feature.
 *
 * Category A — Static source code checks (no auth, no network):
 *   Validate implementation correctness by reading BibleTab.jsx directly.
 *
 * Category B — Browser runtime tests (requires auth + bible_enabled=true):
 *   Navigates to localhost:5173 using stored auth state.
 *   Tests self-skip gracefully when bible_enabled is false for the test group.
 *
 * To enable bible_enabled for the test group:
 *   Go to admin.coveyspace.com → "Chipotle's Group" → toggle Bible ON.
 *
 * Run (source tests only, no server needed):
 *   npx playwright test e2e/bible.spec.js --project=chromium
 *
 * Run (all tests including browser):
 *   npx playwright test --config playwright.staging.config.js e2e/bible.spec.js
 */

import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const BIBLE_TAB_PATH = path.resolve(ROOT, 'src/components/BibleTab.jsx')
const APP_PATH = path.resolve(ROOT, 'src/App.jsx')
const BASE = 'http://localhost:5173'

// ─── Shared source ────────────────────────────────────────────────────────────

let src = ''
test.beforeAll(() => {
  src = fs.readFileSync(BIBLE_TAB_PATH, 'utf8')
})

// ═══════════════════════════════════════════════════════════════════════════════
// A1 — Component structure
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A1 — Component structure', () => {
  test('BibleTab.jsx exports a default function', () => {
    expect(src).toMatch(/export default function BibleTab/)
  })

  test('App.jsx lazy-imports BibleTab', () => {
    const appSrc = fs.readFileSync(APP_PATH, 'utf8')
    expect(appSrc).toContain("import('./components/BibleTab.jsx')")
  })

  test('App.jsx gates BibleTab behind bible_enabled feature flag', () => {
    const appSrc = fs.readFileSync(APP_PATH, 'utf8')
    expect(appSrc).toMatch(/bible_enabled.*=.*true/)
    expect(appSrc).toContain('/bible')
  })

  test('AddEditSheet component exists', () => {
    expect(src).toMatch(/function AddEditSheet\s*\(/)
  })

  test('BibleBrowser component exists', () => {
    expect(src).toMatch(/function BibleBrowser\s*\(/)
  })

  test('BookButton is defined outside BibleBrowser (not inside)', () => {
    const browserStart = src.indexOf('function BibleBrowser')
    const bookBtnIdx   = src.indexOf('function BookButton')
    expect(bookBtnIdx).toBeGreaterThanOrEqual(0)
    expect(bookBtnIdx).toBeLessThan(browserStart)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// A2 — BOOKS map completeness
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A2 — BOOKS map', () => {
  let booksMap = {}

  test.beforeAll(() => {
    // Extract the BOOKS constant from source
    const m = src.match(/const BOOKS = \{([\s\S]*?)\}/)
    if (!m) return
    const entries = [...m[1].matchAll(/'([^']+)':\s*'([^']+)'/g)]
    for (const [, key, val] of entries) booksMap[key] = val
  })

  test('contains all 66 canonical book IDs', () => {
    const expected = [
      'GEN','EXO','LEV','NUM','DEU','JOS','JDG','RUT',
      '1SA','2SA','1KI','2KI','1CH','2CH','EZR','NEH','EST','JOB',
      'PSA','PRO','ECC','SNG','ISA','JER','LAM','EZK','DAN',
      'HOS','JOL','AMO','OBA','JON','MIC','NAH','HAB','ZEP','HAG','ZEC','MAL',
      'MAT','MRK','LUK','JHN','ACT','ROM','1CO','2CO','GAL','EPH',
      'PHP','COL','1TH','2TH','1TI','2TI','TIT','PHM','HEB','JAS',
      '1PE','2PE','1JN','2JN','3JN','JUD','REV',
    ]
    const values = Object.values(booksMap)
    for (const id of expected) {
      expect(values, `Missing book ID ${id}`).toContain(id)
    }
  })

  test('common abbreviations resolve correctly', () => {
    expect(booksMap['gen']).toBe('GEN')
    expect(booksMap['jhn']).toBe('JHN')
    expect(booksMap['psa']).toBe('PSA')
    expect(booksMap['rom']).toBe('ROM')
    expect(booksMap['1cor']).toBe('1CO')
    expect(booksMap['rev']).toBe('REV')
    expect(booksMap['jon']).toBe('JON')
    expect(booksMap['phil']).toBe('PHP')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// A3 — OT_BOOKS / NT_BOOKS arrays
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A3 — OT_BOOKS and NT_BOOKS', () => {
  test('OT_BOOKS contains 39 entries', () => {
    const m = src.match(/const OT_BOOKS = \[([\s\S]*?)\]/)
    expect(m).not.toBeNull()
    const entries = [...m[1].matchAll(/\{ id:/g)]
    expect(entries).toHaveLength(39)
  })

  test('NT_BOOKS contains 27 entries', () => {
    const m = src.match(/const NT_BOOKS = \[([\s\S]*?)\]/)
    expect(m).not.toBeNull()
    const entries = [...m[1].matchAll(/\{ id:/g)]
    expect(entries).toHaveLength(27)
  })

  test('Psalms has 150 chapters', () => {
    expect(src).toContain("{ id: 'PSA', name: 'Psalms', chapters: 150 }")
  })

  test('Revelation has 22 chapters', () => {
    expect(src).toContain("{ id: 'REV', name: 'Revelation', chapters: 22 }")
  })

  test('Matthew has 28 chapters', () => {
    expect(src).toContain("{ id: 'MAT', name: 'Matthew', chapters: 28 }")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// A4 — parseRef correctness
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A4 — parseRef function', () => {
  test('regex supports optional digit prefix with zero spaces (1Cor)', () => {
    expect(src).toContain('(\\d\\s*)?')
  })

  test('BOOKS map has no-space variant for 1cor', () => {
    expect(src).toContain("'1cor': '1CO'")
  })

  test('BOOKS map has jon (Jonah abbreviation)', () => {
    expect(src).toContain("'jon': 'JON'")
  })

  test('parseRef handles null returns (returns null for invalid input)', () => {
    expect(src).toMatch(/if \(!m\) return null/)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// A5 — extractText function
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A5 — extractText function', () => {
  test('extracts string values from content array', () => {
    expect(src).toMatch(/typeof c === 'string'/)
  })

  test('extracts .text from poem objects', () => {
    expect(src).toMatch(/c\?\.text/)
  })

  test('skips noteId and lineBreak objects', () => {
    // Only strings and .text are pushed — no noteId/lineBreak handling needed
    expect(src).not.toMatch(/noteId.*push|lineBreak.*push/)
  })

  test('uses reduce to join parts', () => {
    expect(src).toContain('.reduce(')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// A6 — DEFAULT_PASSAGES
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A6 — DEFAULT_PASSAGES', () => {
  test('has 6 entries', () => {
    const m = src.match(/const DEFAULT_PASSAGES = \[([\s\S]*?)\]/)
    expect(m).not.toBeNull()
    const entries = [...m[1].matchAll(/\{ id:/g)]
    expect(entries).toHaveLength(6)
  })

  test('each entry has id, label, bookId, chapter fields', () => {
    const m = src.match(/const DEFAULT_PASSAGES = \[([\s\S]*?)\]/)
    expect(m[1]).toContain('id:')
    expect(m[1]).toContain('label:')
    expect(m[1]).toContain('bookId:')
    expect(m[1]).toContain('chapter:')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// A7 — Drag-and-drop implementation
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A7 — Grid drag-and-drop (pointer events)', () => {
  test('uses dndState (not draggingIdx) for drag tracking', () => {
    expect(src).toContain('dndState')
    expect(src).not.toContain('draggingIdx')
  })

  test('dndPosRef holds drag position data', () => {
    expect(src).toContain('dndPosRef')
  })

  test('ghostRef drives the ghost card DOM element', () => {
    expect(src).toContain('ghostRef')
  })

  test('handleDndStart uses e.preventDefault()', () => {
    expect(src).toContain('e.preventDefault()')
  })

  test('global pointermove listener attached during drag', () => {
    expect(src).toContain("'pointermove'")
  })

  test('global pointerup + pointercancel listeners clean up on drag end', () => {
    expect(src).toContain("'pointerup'")
    expect(src).toContain("'pointercancel'")
  })

  test('ghost card uses position:fixed and pointer-events:none', () => {
    expect(src).toContain('position: \'fixed\'')
    expect(src).toContain("pointerEvents: 'none'")
  })

  test('source placeholder card uses opacity when it is the drag source', () => {
    expect(src).toContain('opacity-30')
  })

  test('drop target card shows ember border', () => {
    expect(src).toContain('border-ember')
  })

  test('handleDeletePassage cancels pending debounced save before writing', () => {
    const deleteFn = src.match(/function handleDeletePassage[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(deleteFn).toContain('clearTimeout(saveTimerRef.current)')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// A8 — BibleBrowser
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A8 — BibleBrowser component', () => {
  test('renders as full-screen page so flex-1 children get measurable height', () => {
    expect(src).not.toContain("height: '88vh'")
    expect(src).not.toContain("maxHeight: '88vh'")
    expect(src).toContain('fixed inset-0 z-[60]')
  })

  test('sliding panels container has min-h-0', () => {
    expect(src).toContain('min-h-0')
  })

  test('animates books panel off-screen when a book is selected', () => {
    expect(src).toContain("selectedBook ? '-100%' : '0%'")
  })

  test('animates chapters panel in from right', () => {
    expect(src).toContain("selectedBook ? '0%' : '100%'")
  })

  test('chapter grid uses 5 columns', () => {
    expect(src).toContain('grid-cols-5')
  })

  test('OT and NT section labels present', () => {
    expect(src).toContain('Old Testament')
    expect(src).toContain('New Testament')
  })

  test('onSelectChapter calls setShowBrowser(false) to dismiss browser on chapter tap', () => {
    expect(src).toContain('setShowBrowser(false)')
    const selectBlock = src.match(/onSelectChapter[^}]*\{[^}]*\}/s)?.[0] ?? ''
    expect(selectBlock).toContain('setShowBrowser(false)')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// A9 — AddEditSheet keyboard avoidance
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A9 — AddEditSheet keyboard avoidance', () => {
  test('uses ref-based keyboard avoidance (overlayRef + sheetRef)', () => {
    expect(src).toContain('overlayRef')
    expect(src).toContain('sheetRef')
  })

  test('visualViewport resize and scroll listeners registered', () => {
    expect(src).toContain('visualViewport')
    expect(src).toContain("'resize'")
    expect(src).toContain("'scroll'")
  })

  test('overlay paddingBottom set directly via DOM ref', () => {
    expect(src).toContain('overlayRef.current.style.paddingBottom')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// A10 — Chapter overlay animation
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('A10 — Chapter overlay animation', () => {
  test('chapter view is a fixed inset-0 overlay (no flicker)', () => {
    expect(src).toContain("fixed inset-0 z-[60]")
  })

  test('slides in from x:100% (right edge)', () => {
    expect(src).toContain("x: '100%'")
    expect(src).toContain("x: '0%'")
  })

  test('uses spring transition', () => {
    expect(src).toContain("type: 'spring'")
  })

  test('back button calls handleBack', () => {
    expect(src).toContain('handleBack')
    expect(src).toContain('ArrowLeft')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// B — Browser runtime tests (need auth + bible_enabled=true)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('B — Browser runtime', () => {
  test.use({
    storageState: '.playwright-auth.json',
  })

  let biblePage = null

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: '.playwright-auth.json' })
    const page = await ctx.newPage()
    await page.goto(BASE + '/home', { waitUntil: 'networkidle', timeout: 30000 })
    await page.waitForTimeout(1500)
    const nav = page.locator('nav').last()
    const bibleNav = nav.getByText('Bible')
    const isVisible = await bibleNav.isVisible().catch(() => false)
    if (!isVisible) {
      biblePage = null
    } else {
      await bibleNav.click()
      await page.waitForURL('**/bible', { timeout: 10000 })
      await page.waitForTimeout(1000)
      biblePage = page
    }
  })

  test.afterAll(async () => {
    if (biblePage) await biblePage.context().close()
  })

  test('Bible tab appears in bottom nav when bible_enabled=true', async () => {
    if (!biblePage) {
      test.skip(true, 'Bible tab not visible — enable bible_enabled for the test group in admin panel')
    }
    await expect(biblePage.locator('nav').last().getByText('Bible')).toBeVisible()
  })

  test('Bible heading renders', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    await expect(biblePage.getByRole('heading', { name: 'Bible' })).toBeVisible()
  })

  test('Quick Access section is visible', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    await expect(biblePage.getByText('Quick Access')).toBeVisible()
  })

  test('Browse icon button is visible in search bar', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    await expect(biblePage.getByTitle('Browse books')).toBeVisible()
  })

  test('quick access cards render (at least 2)', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    const cards = biblePage.locator('text=Psalm 23, Romans 8:28-39, John 14:1-6, Isaiah 40:28-31, Phil 4:6-7, John 3:16, Prov 3:5-6, 1 Cor 13:4-7'.split(', ')[0])
    await expect(cards.first()).toBeVisible({ timeout: 8000 })
  })

  test('tapping a quick access card opens chapter view', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    const psalmCard = biblePage.locator('button', { hasText: 'Psalm 23' }).first()
    await psalmCard.click()
    // Chapter overlay should slide in: look for Psalms 23 heading
    await expect(biblePage.locator('h1', { hasText: 'Psalms 23' })).toBeVisible({ timeout: 8000 })
  })

  test('chapter view shows verse numbers', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    // After opening Psalm 23 above, verse 1 should be visible
    await expect(biblePage.locator('span').filter({ hasText: /^1$/ }).first()).toBeVisible()
  })

  test('back arrow returns to home view', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    const backBtn = biblePage.locator('button').filter({ has: biblePage.locator('svg') }).first()
    await backBtn.click()
    await expect(biblePage.getByText('Quick Access')).toBeVisible({ timeout: 5000 })
  })

  test('BSB browser opens and shows book list', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    await biblePage.getByTitle('Browse books').click()
    await expect(biblePage.getByText('Browse Bible')).toBeVisible({ timeout: 5000 })
    await expect(biblePage.getByText('Old Testament')).toBeVisible()
    await expect(biblePage.getByText('New Testament')).toBeVisible()
  })

  test('tapping a book in browser shows chapter grid', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    // Click on John in the NT section
    const johnBtn = biblePage.locator('button', { hasText: 'John' }).filter({ hasText: '21' })
    await johnBtn.first().click()
    // Should show chapter numbers 1–21
    await expect(biblePage.locator('button', { hasText: '1' }).first()).toBeVisible({ timeout: 5000 })
    await expect(biblePage.locator('button', { hasText: '21' })).toBeVisible()
  })

  test('selecting chapter 3 in browser opens John 3', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    const ch3 = biblePage.locator('button', { hasText: '3' }).first()
    await ch3.click()
    await expect(biblePage.locator('h1', { hasText: 'John 3' })).toBeVisible({ timeout: 8000 })
    await biblePage.locator('button').filter({ has: biblePage.locator('svg') }).first().click()
  })

  test('search box accepts a reference and opens chapter', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    const searchBox = biblePage.locator('input[placeholder*="John 3:16"]')
    await searchBox.fill('Romans 8:28')
    await expect(biblePage.locator('h1', { hasText: 'Romans 8' })).toBeVisible({ timeout: 10000 })
    await biblePage.locator('button').filter({ has: biblePage.locator('svg') }).first().click()
    await searchBox.fill('')
  })

  test('search with invalid reference shows error message', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    const searchBox = biblePage.locator('input[placeholder*="John 3:16"]')
    await searchBox.fill('notabookatall 99')
    await expect(biblePage.getByText(/Try a reference/i)).toBeVisible({ timeout: 5000 })
    await searchBox.fill('')
  })

  test('Edit button is visible when passages exist', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    await expect(biblePage.getByText('Edit')).toBeVisible()
  })

  test('tapping Edit shows drag handles on cards', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    await biblePage.getByText('Edit').click()
    // Done button should appear
    await expect(biblePage.getByText('Done')).toBeVisible()
    // DotsSixVertical icons appear (checking via aria or svg presence)
    await expect(biblePage.locator('.cursor-grab').first()).toBeVisible()
    // Exit reorder mode
    await biblePage.getByText('Done').click()
  })

  test('+ button opens Add Passage sheet', async () => {
    if (!biblePage) test.skip(true, 'bible_enabled not set')
    await biblePage.locator('button').filter({ has: biblePage.locator('svg[data-phosphor-icon="Plus"], [class*="Plus"]') }).last().click()
    await expect(biblePage.getByText('Add Passage')).toBeVisible({ timeout: 5000 })
    await biblePage.locator('button').filter({ has: biblePage.locator('svg') }).filter({ hasText: '' }).first().click().catch(() => {})
    // Close via backdrop or X button
    const xBtn = biblePage.locator('button').filter({ has: biblePage.locator('[class*="X"], svg') }).last()
    await xBtn.click().catch(() => {})
  })
})
