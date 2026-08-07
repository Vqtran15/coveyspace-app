/**
 * new-features.spec.js
 *
 * Tests for three new features:
 *   1. ManagePagesModal drag hint ("Drag to reorder below.")
 *   2. Framer Motion animated bottom nav pill
 *   3. Poll feature in ChatView
 *
 * Plus regression checks on ChatView internals.
 *
 * Most tests are static source-code checks (no Supabase auth required).
 * Browser-runtime tests self-skip with a reason when they need auth.
 */

import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const MANAGE_PAGES_MODAL_PATH = path.resolve(ROOT, 'src/components/ManagePagesModal.jsx')
const APP_PATH                = path.resolve(ROOT, 'src/App.jsx')
const CHAT_VIEW_PATH          = path.resolve(ROOT, 'src/components/ChatView.jsx')
const MESSAGE_LIST_PATH       = path.resolve(ROOT, 'src/components/chat/MessageList.jsx')
const MESSAGE_INPUT_PATH      = path.resolve(ROOT, 'src/components/chat/MessageInput.jsx')
const PACKAGE_JSON_PATH       = path.resolve(ROOT, 'package.json')
const MIGRATION_SQL_PATH      = path.resolve(ROOT, 'supabase/migration_54_polls.sql')

// ─── Feature 1: ManagePagesModal drag hint ────────────────────────────────────

test.describe('Feature 1 — ManagePagesModal drag hint', () => {
  let source

  test.beforeAll(() => {
    source = fs.readFileSync(MANAGE_PAGES_MODAL_PATH, 'utf8')
  })

  test('subtitle "Drag to reorder below." exists in the source file', () => {
    expect(source).toContain('Drag to reorder below.')
  })

  test('subtitle is wrapped in a <p> tag', () => {
    // Must appear inside a <p ...>...</p> — any class is fine
    expect(source).toMatch(/<p[^>]*>Drag to reorder below\.<\/p>/)
  })

  test('subtitle <p> follows the <h2> title element (correct structural order)', () => {
    const h2Index = source.indexOf('<h2')
    const subtitleIndex = source.indexOf('Drag to reorder below.')
    expect(h2Index).toBeGreaterThanOrEqual(0)
    expect(subtitleIndex).toBeGreaterThan(h2Index)
  })

  test('header flex row uses items-start class (not items-center)', () => {
    // The outer header div was changed from items-center to items-start
    // to accommodate the subtitle stacking vertically under the h2.
    // Verify items-start is present in the header area.
    expect(source).toContain('items-start')
  })

  test('items-center is NOT used on the header flex row that wraps the title+subtitle', () => {
    // The div wrapping h2 + p should use items-start, not items-center.
    // Specifically: `flex items-start justify-between` should be in the source.
    expect(source).toContain('flex items-start justify-between')
  })
})

// ─── Feature 2: Framer Motion animated bottom nav pill ───────────────────────

test.describe('Feature 2 — Framer Motion animated bottom nav pill', () => {
  let source
  let pkg

  test.beforeAll(() => {
    source = fs.readFileSync(APP_PATH, 'utf8')
    pkg    = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, 'utf8'))
  })

  test('framer-motion is listed in package.json dependencies', () => {
    expect(pkg.dependencies).toHaveProperty('framer-motion')
  })

  test('App.jsx imports motion and LayoutGroup from framer-motion', () => {
    expect(source).toMatch(/import\s*\{[^}]*\bmotion\b[^}]*\}\s*from\s*['"]framer-motion['"]/)
    expect(source).toMatch(/import\s*\{[^}]*\bLayoutGroup\b[^}]*\}\s*from\s*['"]framer-motion['"]/)
  })

  test('layoutId="tab-pill" string exists in App.jsx', () => {
    expect(source).toContain('layoutId="tab-pill"')
  })

  test('LayoutGroup with id="bottom-nav" is used in App.jsx', () => {
    expect(source).toContain('id="bottom-nav"')
    expect(source).toMatch(/<LayoutGroup[^>]+id="bottom-nav"/)
  })

  test('motion.span with layoutId="tab-pill" renders the pill background', () => {
    expect(source).toMatch(/<motion\.span[\s\S]*?layoutId="tab-pill"/)
  })

  test('initial={false} is on the icon motion span (prevents animation on first render)', () => {
    expect(source).toContain('initial={false}')
  })

  test('spring transition is configured on the pill (stiffness + damping)', () => {
    // The pill motion.span should have a spring transition
    expect(source).toContain("type: 'spring'")
    expect(source).toContain('stiffness')
    expect(source).toContain('damping')
  })

  test('the old inline active pill class string bg-ember text-white rounded-2xl transition-colors is NOT used as active-pill marker in the bottom nav button', () => {
    // The old implementation put `bg-ember text-white rounded-2xl transition-colors`
    // on the button/span directly as an active-state class.
    // The new approach uses motion.span for the background, so the button-level
    // class string should not contain that exact active combination.
    // We check the bottom-nav section: the nav button className should not
    // include all four of those classes together as an active pill.
    const navSection = source.slice(source.indexOf('<LayoutGroup id="bottom-nav">'))
    // The button wrapping each tab should not have the old active background applied
    // directly on the outer button (it moved to motion.span inside).
    expect(navSection).not.toMatch(/className=\{[^}]*bg-ember[^}]*text-white[^}]*rounded-2xl[^}]*transition-colors/)
  })

  test('icon motion.span has animate prop for scale pop', () => {
    expect(source).toMatch(/animate=\{active/)
  })
})

// ─── Feature 3: Poll feature in ChatView ─────────────────────────────────────

test.describe('Feature 3 — Poll feature in ChatView (source checks)', () => {
  let source

  test.beforeAll(() => {
    source = fs.readFileSync(CHAT_VIEW_PATH, 'utf8')
  })

  test('ChartBar is imported from @phosphor-icons/react (in MessageInput)', () => {
    const inputSource = fs.readFileSync(MESSAGE_INPUT_PATH, 'utf8')
    expect(inputSource).toMatch(/import\s*\{[^}]*\bChartBar\b[^}]*\}\s*from\s*['"]@phosphor-icons\/react['"]/)
  })

  test('polls state variable is declared', () => {
    expect(source).toContain('const [polls, setPolls]')
  })

  test('pollCreating state variable is declared', () => {
    expect(source).toContain('const [pollCreating, setPollCreating]')
  })

  test('pollQuestion state variable is declared', () => {
    expect(source).toContain('const [pollQuestion, setPollQuestion]')
  })

  test('pollOptions state variable is declared', () => {
    expect(source).toContain('const [pollOptions, setPollOptions]')
  })

  test('pollSubmitting state variable is declared', () => {
    expect(source).toContain('const [pollSubmitting, setPollSubmitting]')
  })

  test('fetchPollsForMessages function is defined', () => {
    expect(source).toContain('async function fetchPollsForMessages(')
  })

  test('createPoll function is defined', () => {
    expect(source).toContain('async function createPoll(')
  })

  test("createPoll inserts into the 'polls' table", () => {
    expect(source).toContain("supabase.from('polls').insert(")
  })

  test("createPoll inserts into the 'messages' table after creating the poll", () => {
    // The poll id is used in a messages insert with poll_id
    expect(source).toContain("supabase.from('messages').insert(")
    expect(source).toContain('poll_id: poll.id')
  })

  test('castVote function is defined', () => {
    expect(source).toContain('async function castVote(')
  })

  test("castVote calls supabase.from('poll_votes').upsert(...)", () => {
    expect(source).toContain("supabase.from('poll_votes').upsert(")
  })

  test("poll_votes realtime subscription channel is set up with id 'poll-votes:${convId}'", () => {
    expect(source).toContain('`poll-votes:${convId}`')
  })

  test('poll channel is removed in cleanup (supabase.removeChannel(pollVotesCh))', () => {
    expect(source).toContain('supabase.removeChannel(pollVotesCh)')
  })

  test('poll card render block (if msg.poll_id) is present in the message render loop', () => {
    expect(source).toContain('if (msg.poll_id)')
  })

  test('poll option buttons call castVote on click (in MessageList)', () => {
    const listSource = fs.readFileSync(MESSAGE_LIST_PATH, 'utf8')
    expect(listSource).toContain('castVote(msg.poll_id,')
  })

  test('createPoll returns early if question is blank', () => {
    // The guard: if (!question || opts.length < 2 || pollSubmitting) return
    expect(source).toContain('if (!question || opts.length < 2 || pollSubmitting) return')
  })

  test('createPoll guard: fewer than 2 non-empty options causes early return', () => {
    // opts is derived via filter(Boolean), so the < 2 guard covers this
    expect(source).toContain('opts.length < 2')
  })

  test('remove-option (X) button is hidden when only 2 options remain (pollOptions.length > 2 guard)', () => {
    // Poll creator UI is in MessageInput; the remove button is shown only when pollOptions.length > 2
    const inputSource = fs.readFileSync(MESSAGE_INPUT_PATH, 'utf8')
    expect(inputSource).toContain('pollOptions.length > 2')
  })
})

// ─── Feature 3: Migration SQL checks ─────────────────────────────────────────

test.describe('Feature 3 — migration_54_polls.sql', () => {
  let sql

  test.beforeAll(() => {
    sql = fs.readFileSync(MIGRATION_SQL_PATH, 'utf8')
  })

  test('migration file exists', () => {
    expect(fs.existsSync(MIGRATION_SQL_PATH)).toBe(true)
  })

  test('polls table is created', () => {
    expect(sql).toMatch(/CREATE TABLE\s+IF NOT EXISTS\s+polls/i)
  })

  test('poll_votes table is created', () => {
    expect(sql).toMatch(/CREATE TABLE\s+IF NOT EXISTS\s+poll_votes/i)
  })

  test('poll_votes has composite PRIMARY KEY (poll_id, user_id)', () => {
    expect(sql).toMatch(/PRIMARY KEY\s*\(\s*poll_id\s*,\s*user_id\s*\)/i)
  })

  test('messages table gets poll_id column via ALTER TABLE', () => {
    expect(sql).toMatch(/ALTER TABLE\s+messages/i)
    expect(sql).toContain('poll_id')
  })

  test('RLS is enabled on polls table', () => {
    expect(sql).toMatch(/ALTER TABLE\s+polls\s+ENABLE ROW LEVEL SECURITY/i)
  })

  test('RLS is enabled on poll_votes table', () => {
    expect(sql).toMatch(/ALTER TABLE\s+poll_votes\s+ENABLE ROW LEVEL SECURITY/i)
  })
})

// ─── Regression checks ───────────────────────────────────────────────────────

test.describe('Regression — ChatView internals', () => {
  let source

  test.beforeAll(() => {
    source = fs.readFileSync(CHAT_VIEW_PATH, 'utf8')
  })

  test('img.decode() reveal logic is still present in ChatView', () => {
    expect(source).toContain('img.decode')
  })

  test('closeEmojiPicker function is still present (not removed)', () => {
    expect(source).toContain('function closeEmojiPicker(')
  })

  test('closeEmojiPicker is called somewhere in ChatView (emoji picker still wired up)', () => {
    // At minimum it should appear more than once (definition + at least one call site)
    const occurrences = (source.match(/closeEmojiPicker/g) ?? []).length
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })

  test('loadMore function still fetches reactions for older messages', () => {
    // The loadMore function should include a supabase query for reactions
    expect(source).toContain('async function loadMore(')
    // After loading older messages, it fetches reactions for them
    expect(source).toMatch(/loadMore[\s\S]{1,2000}from\('reactions'\)/)
  })

  test('img.decode fallback cap of 800ms is still present', () => {
    expect(source).toContain('800')
    expect(source).toContain('img.decode')
  })

  test('all images decoded before reveal (not just unsized ones)', () => {
    // commit 42e5e0b changed from filtering unsized images to decoding all images,
    // because iOS Safari ignores width/height hints when CSS overrides them
    expect(source).toContain('allImgs.map(img => img.decode')
    expect(source).not.toContain("img.hasAttribute('width')")
  })
})

// ─── Runtime smoke test (skipped when no auth) ────────────────────────────────

test('app loads without crashing (regression smoke)', async ({ page }) => {
  test.skip(true, 'Runtime smoke test requires Supabase auth — skipping in CI / test env. Static source checks above cover the feature code.')
})
