/**
 * rebrand-and-animations.spec.js
 *
 * QA audit for three feature sets:
 *   1. Rebrand: "Covey Space" → "Coveyspace" across all source files
 *   2. Greeting animation: SVG underline with correct structure, timing, positioning
 *   3. Card tap feedback: whileTap={{ scale: 0.975 }} on all tappable cards
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

function exists(relPath) {
  return fs.existsSync(path.resolve(ROOT, relPath))
}

// ─── 1. Rebrand ───────────────────────────────────────────────────────────────

test.describe('Rebrand — no "Covey Space" (two words) remaining', () => {
  const filesToCheck = [
    'index.html',
    'public/manifest.json',
    'src/sw.js',
    'src/App.jsx',
    'src/components/AuthPage.jsx',
    'src/components/SplashScreen.jsx',
    'src/components/AdminPage.jsx',
    'src/components/OverviewTab.jsx',
    'src/components/WelcomeSplash.jsx',
    'src/components/SettingsModal.jsx',
    'src/components/FeedbackModal.jsx',
  ]

  for (const file of filesToCheck) {
    test(`${file} contains no "Covey Space" (two words)`, () => {
      const src = read(file)
      expect(src).not.toContain('Covey Space')
    })
  }

  test('manifest.json name is "Coveyspace"', () => {
    const manifest = JSON.parse(read('public/manifest.json'))
    expect(manifest.name).toBe('Coveyspace')
    expect(manifest.short_name).toBe('Coveyspace')
  })

  test('index.html title is "Coveyspace"', () => {
    const src = read('index.html')
    expect(src).toContain('<title>Coveyspace</title>')
  })

  test('index.html apple-mobile-web-app-title is "Coveyspace"', () => {
    const src = read('index.html')
    expect(src).toContain('content="Coveyspace"')
  })

  test('sw.js default push notification title is "Coveyspace"', () => {
    const src = read('src/sw.js')
    expect(src).toContain("'Coveyspace'")
  })

  test('SettingsModal Support section uses "Coveyspace"', () => {
    const src = read('src/components/SettingsModal.jsx')
    expect(src).toContain('Support Coveyspace')
    expect(src).toContain('Coveyspace is community-funded')
  })

  test('AdminPage share sheet uses "Coveyspace"', () => {
    const src = read('src/components/AdminPage.jsx')
    expect(src).toContain('Join my group on Coveyspace')
  })

  test('OverviewTab invite button uses "Coveyspace"', () => {
    const src = read('src/components/OverviewTab.jsx')
    expect(src).toContain('Join my group on Coveyspace')
  })

  test('WelcomeSplash share uses "Coveyspace"', () => {
    const src = read('src/components/WelcomeSplash.jsx')
    expect(src).toContain('Join my group on Coveyspace')
  })

  test('FeedbackModal uses "Coveyspace"', () => {
    const src = read('src/components/FeedbackModal.jsx')
    expect(src).toContain('Coveyspace')
  })

  test('AuthPage heading uses "Coveyspace"', () => {
    const src = read('src/components/AuthPage.jsx')
    expect(src).toContain('Coveyspace')
  })

  test('SplashScreen logo text uses "Coveyspace"', () => {
    const src = read('src/components/SplashScreen.jsx')
    expect(src).toContain('Coveyspace')
  })

  test('App.jsx wordmark uses "Coveyspace"', () => {
    const src = read('src/App.jsx')
    expect(src).toContain('Coveyspace')
  })
})

// ─── 2. Greeting animation ────────────────────────────────────────────────────

test.describe('Greeting animation — OverviewTab.jsx', () => {
  let src

  test.beforeAll(() => { src = read('src/components/OverviewTab.jsx') })

  test('greetingDone is declared at module level (after all imports)', () => {
    // All imports must precede the greetingDone declaration
    const lastImportIdx = src.lastIndexOf('\nimport ')
    const greetingDoneIdx = src.indexOf('let greetingDone = false')
    expect(greetingDoneIdx).toBeGreaterThan(-1)
    expect(greetingDoneIdx).toBeGreaterThan(lastImportIdx)
  })

  test('greetingDone is NOT placed between import statements', () => {
    const lines = src.split('\n')
    // Find the line number of greetingDone and the last import
    let lastImportLineIdx = -1
    let greetingDoneLineIdx = -1
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith('import ')) lastImportLineIdx = i
      if (lines[i].includes('let greetingDone')) greetingDoneLineIdx = i
    }
    expect(greetingDoneLineIdx).toBeGreaterThan(-1)
    expect(lastImportLineIdx).toBeGreaterThan(-1)
    // greetingDone must appear AFTER the last import line
    expect(greetingDoneLineIdx).toBeGreaterThan(lastImportLineIdx)
    // The line immediately before greetingDone must NOT be an import
    const prevLine = lines[greetingDoneLineIdx - 1]?.trim() ?? ''
    expect(prevLine.startsWith('import ')).toBe(false)
  })

  test('useAnimation is imported from framer-motion', () => {
    expect(src).toMatch(/import\s*\{[^}]*useAnimation[^}]*\}\s*from\s*['"]framer-motion['"]/)
  })

  test('greetingReady prop is declared with default false', () => {
    expect(src).toContain('greetingReady = false')
  })

  test('shouldAnimate is derived from !greetingDone via useState initializer', () => {
    expect(src).toContain('useState(() => !greetingDone)')
  })

  test('greetingControls is created with useAnimation()', () => {
    expect(src).toContain('const greetingControls = useAnimation()')
  })

  test('announceShake state is declared', () => {
    expect(src).toContain('const [announceShake, setAnnounceShake] = useState(false)')
  })

  test('greeting useEffect depends on [greetingReady]', () => {
    expect(src).toContain('}, [greetingReady])')
  })

  test('greeting useEffect guards on shouldAnimate && greetingReady', () => {
    expect(src).toContain('if (!shouldAnimate || !greetingReady) return')
  })

  test('greetingDone is set to true inside the effect (prevents replay)', () => {
    expect(src).toContain('greetingDone = true')
  })

  test('clipPath reveal animation starts left-to-right (inset right→0)', () => {
    expect(src).toContain("clipPath: 'inset(0 0% 0 0)'")
  })

  test('initial clipPath clips from right (inset 100%)', () => {
    expect(src).toContain("clipPath: 'inset(0 100% 0 0)'")
  })

  test('fade out fires after reveal completes (~650ms)', () => {
    expect(src).toContain('650')
    expect(src).toContain("opacity: 0")
  })

  test('announceShake fires at 1100ms after greetingReady', () => {
    expect(src).toContain('setAnnounceShake(true),  1100')
  })

  test('announceShake clears at 1700ms', () => {
    expect(src).toContain('setAnnounceShake(false), 1700')
  })

  test('all three timer IDs are cleared on unmount', () => {
    expect(src).toContain('clearTimeout(fadeId)')
    expect(src).toContain('clearTimeout(shakeId)')
    expect(src).toContain('clearTimeout(clearId)')
  })

  test('SVG is only rendered when shouldAnimate is true', () => {
    expect(src).toContain('{shouldAnimate && (')
    expect(src).toContain('<motion.svg')
  })

  test('SVG has aria-hidden="true"', () => {
    expect(src).toContain('aria-hidden="true"')
  })

  test('SVG is positioned with top-full (below greeting text)', () => {
    expect(src).toContain('className="absolute top-full left-0"')
  })

  test('greeting SVG does NOT use -bottom positioning (which would intersect text)', () => {
    // Extract just the motion.svg block to scope the check
    const svgStart = src.indexOf('<motion.svg')
    const svgEnd = src.indexOf('</motion.svg>') + '</motion.svg>'.length
    const svgBlock = src.slice(svgStart, svgEnd)
    expect(svgBlock).not.toContain('-bottom-')
  })

  test('SVG has preserveAspectRatio="none" for responsive width', () => {
    expect(src).toContain('preserveAspectRatio="none"')
  })

  test('linearGradient for taper is defined in defs', () => {
    expect(src).toContain('id="greeting-taper"')
    expect(src).toContain('stopOpacity="0"')
    expect(src).toContain('stopOpacity="1"')
  })

  test('thin trace path (1.5px) is rendered for the arc shape', () => {
    expect(src).toContain('strokeWidth="1.5"')
  })

  test('thick overlay path (4.5px) references the taper gradient', () => {
    expect(src).toContain('strokeWidth="4.5"')
    expect(src).toContain('stroke="url(#greeting-taper)"')
  })

  test('both paths use vectorEffect="non-scaling-stroke"', () => {
    const occurrences = (src.match(/vectorEffect="non-scaling-stroke"/g) ?? []).length
    expect(occurrences).toBe(2)
  })

  test('arc path starts low and curves up (M 0 14 C ...)', () => {
    expect(src).toContain('d="M 0 14 C 14 3 30 4 200 4"')
  })

  test('announceShake class is applied state-driven (not inline style)', () => {
    expect(src).toContain("announceShake ? 'animate-announcement-shake' : ''")
    // The old hardcoded inline animation style should not be present
    expect(src).not.toContain("style={{ animation: 'announcement-shake")
  })

  test('greeting SVG animate prop uses greetingControls', () => {
    expect(src).toContain('animate={greetingControls}')
  })
})

test.describe('Greeting animation — App.jsx greetingReady wiring', () => {
  let src

  test.beforeAll(() => { src = read('src/App.jsx') })

  test('greetingReady is passed as !splashVisible && !showWelcome', () => {
    expect(src).toContain('greetingReady={!splashVisible && !showWelcome}')
  })

  test('splashVisible state is declared', () => {
    expect(src).toContain('const [splashVisible, setSplashVisible]')
  })

  test('showWelcome state is declared', () => {
    expect(src).toContain('const [showWelcome, setShowWelcome]')
  })
})

// ─── 3. Card tap feedback — whileTap ─────────────────────────────────────────

test.describe('whileTap — OverviewTab Card component', () => {
  let src

  test.beforeAll(() => { src = read('src/components/OverviewTab.jsx') })

  test('Card component uses motion.button', () => {
    expect(src).toMatch(/function Card\([^)]+\)[\s\S]{0,200}<motion\.button/)
  })

  test('Card has whileTap={{ scale: 0.975 }}', () => {
    expect(src).toContain('whileTap={{ scale: 0.975 }}')
  })

  test('Card has spring transition', () => {
    expect(src).toContain("type: 'spring'")
    expect(src).toContain('stiffness: 400')
    expect(src).toContain('damping: 25')
  })

  test('motion is imported from framer-motion in OverviewTab', () => {
    expect(src).toMatch(/import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*['"]framer-motion['"]/)
  })
})

test.describe('whileTap — BirthdayCard.jsx', () => {
  let src

  test.beforeAll(() => { src = read('src/components/BirthdayCard.jsx') })

  test('BirthdayCard uses motion.button', () => {
    expect(src).toContain('<motion.button')
  })

  test('BirthdayCard has whileTap={{ scale: 0.975 }}', () => {
    expect(src).toContain('whileTap={{ scale: 0.975 }}')
  })

  test('BirthdayCard has spring transition', () => {
    expect(src).toContain("type: 'spring'")
    expect(src).toContain('stiffness: 400')
    expect(src).toContain('damping: 25')
  })

  test('motion is imported from framer-motion in BirthdayCard', () => {
    expect(src).toMatch(/import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*['"]framer-motion['"]/)
  })
})

test.describe('whileTap — PrayerTab.jsx', () => {
  let src

  test.beforeAll(() => { src = read('src/components/PrayerTab.jsx') })

  test('PrayerTab MemberCard uses motion.button', () => {
    expect(src).toContain('<motion.button')
  })

  test('PrayerTab has whileTap={{ scale: 0.975 }} (at least 2 instances)', () => {
    const count = (src.match(/whileTap=\{\{ scale: 0\.975 \}\}/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('PrayerTab has spring transition on tap cards', () => {
    expect(src).toContain("type: 'spring'")
    expect(src).toContain('stiffness: 400')
    expect(src).toContain('damping: 25')
  })

  test('motion is imported from framer-motion in PrayerTab', () => {
    expect(src).toMatch(/import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*['"]framer-motion['"]/)
  })
})

test.describe('whileTap — ConversationList.jsx', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ConversationList.jsx') })

  test('ConversationList has whileTap={{ scale: 0.975 }} on ConvRow', () => {
    expect(src).toContain('whileTap={{ scale: 0.975 }}')
  })

  test('ConversationList has spring transition on tap cards', () => {
    expect(src).toContain("type: 'spring'")
    expect(src).toContain('stiffness: 400')
    expect(src).toContain('damping: 25')
  })

  test('motion is imported from framer-motion in ConversationList', () => {
    expect(src).toMatch(/import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*['"]framer-motion['"]/)
  })
})
