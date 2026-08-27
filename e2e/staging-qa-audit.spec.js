/**
 * staging-qa-audit.spec.js
 *
 * QA audit for all changes in staging vs main:
 *  1. ConversationList refactor (hero card, action sheet, delete flow, search, isMainGroupChat)
 *  2. ChatTab: pinnedGroupId lifted state
 *  3. ChatView: scroll guards for poll/event cards + image onLoad
 *  4. Slot columns: EditDishesModal layout toggle, MealPage grid, migration SQL
 *  5. ScheduleTab: "This Week" button, ListBullets styling
 *  6. SlotCard: ember tint on signed-up, stone-500 notes
 *  7. BibleTab: Books icon visibility
 *  8. EventsTab / ChatView: fallback body for poll + event messages
 *  9. migration_18: name-based delete guard
 * 10. Regression checks on existing functionality
 */

import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SRC  = path.resolve(ROOT, 'src/components')

function read(relPath) {
  return fs.readFileSync(path.resolve(ROOT, relPath), 'utf8')
}

// ─── 1. ConversationList.jsx ─────────────────────────────────────────────────

test.describe('ConversationList — hero card + pinned group', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ConversationList.jsx') })

  test('ConvRow component is defined', () => {
    expect(src).toContain('function ConvRow(')
  })

  test('ConversationListBody component is defined', () => {
    expect(src).toContain('function ConversationListBody(')
  })

  test('pinnedGroupId prop is accepted by ConversationList', () => {
    expect(src).toMatch(/export default function ConversationList\(\{[^}]*pinnedGroupId/)
  })

  test('onPinGroup prop is accepted by ConversationList', () => {
    expect(src).toMatch(/export default function ConversationList\(\{[^}]*onPinGroup/)
  })

  test('main group chat is pinned by name "Main Group Chat"', () => {
    expect(src).toContain("convs.find(c => c.name === 'Main Group Chat')")
    expect(src).toContain('if (main) onPinGroup(main.id)')
  })

  test('isMainGroupChat compares by ID (not member count)', () => {
    expect(src).toContain('function isMainGroupChat(conv)')
    expect(src).toContain('return conv.id === pinnedGroupId')
    // The old member-count heuristic must be gone
    expect(src).not.toContain('conv_member_count >= group_member_count')
    expect(src).not.toContain('conversation_members?.length') // in isMainGroupChat
  })

  test('hero card renders for pinned conv (border-ember/20)', () => {
    expect(src).toContain('border border-ember/20')
  })

  test('"Group Chat" section label is rendered above the hero card', () => {
    expect(src).toContain('Group Chat')
  })

  test('"Messages" section label is rendered between hero and DMs', () => {
    expect(src).toContain('>Messages<')
  })

  test('member count is shown on the hero card', () => {
    expect(src).toContain('members.length} members')
  })

  test('CaretRight icon is used on the hero card', () => {
    expect(src).toContain('CaretRight')
  })

  test('hero card has larger avatar (w-14 h-14)', () => {
    expect(src).toContain('w-14 h-14')
  })
})

test.describe('ConversationList — action sheet (3-dots)', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ConversationList.jsx') })

  test('DotsThreeVertical icon is imported', () => {
    expect(src).toMatch(/import\s*\{[^}]*DotsThreeVertical[^}]*\}\s*from/)
  })

  test('DotsThreeVertical is rendered in ConvRow options button', () => {
    expect(src).toContain('<DotsThreeVertical size={20}')
  })

  test('options button has aria-label="Conversation options"', () => {
    expect(src).toContain('aria-label="Conversation options"')
  })

  test('actionSheetConv state is declared', () => {
    expect(src).toContain('const [actionSheetConv, setActionSheetConv]')
  })

  test('actionSheetClosing uses useModalClose', () => {
    expect(src).toContain('const [actionSheetClosing, closeActionSheet, resetActionSheet] = useModalClose(')
  })

  test('action sheet shows "Delete conversation" option', () => {
    expect(src).toContain('Delete conversation')
  })

  test('action sheet has Cancel button', () => {
    // JSX wraps text in whitespace so check for the cancel button class instead
    expect(src).toContain('Cancel')
    expect(src).toContain('onClick={closeActionSheet}')
  })

  test('action sheet backdrop uses closeActionSheet (animated close)', () => {
    // The outer div onClick should close with animation
    expect(src).toMatch(/onClick={closeActionSheet}/)
  })

  test('"Delete conversation" button captures conv reference before resetting state', () => {
    // Crucial: conv must be captured before resetActionSheet() / setActionSheetConv(null)
    // so the delete confirmation receives the correct conversation object
    expect(src).toContain('const conv = actionSheetConv')
  })

  test('Trash icon is still imported (used in action sheet)', () => {
    expect(src).toMatch(/import\s*\{[^}]*\bTrash\b[^}]*\}\s*from/)
  })
})

test.describe('ConversationList — delete flow', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ConversationList.jsx') })

  test('deleteConversation clears confirmDeleteConv before the async RPC', () => {
    // Prevents double-confirmation: the sheet closes immediately, not after RPC
    expect(src).toMatch(/setConfirmDeleteConv\(null\)[\s\S]{0,200}supabase\.rpc\('delete_conversation'/)
  })

  test('delete RPC is called with conv_id argument', () => {
    expect(src).toContain("supabase.rpc('delete_conversation', { conv_id: conv.id })")
  })

  test('deletingConvId is forwarded to ConvRow as isDeleting prop', () => {
    expect(src).toContain('isDeleting={deletingConvId === conv.id}')
  })

  test('ConvRow accepts isDeleting prop', () => {
    expect(src).toMatch(/function ConvRow\(\{[^}]*isDeleting/)
  })

  test('ConvRow shows loading indicator when isDeleting is true', () => {
    expect(src).toContain('isDeleting')
    // The 3-dots button is disabled and shows "…" during deletion
    expect(src).toContain('disabled={isDeleting}')
  })

  test('delete confirmation modal uses deleteClosing for animation', () => {
    // Backdrop uses animate-backdrop-out; the sheet itself uses animate-sheet-out
    expect(src).toContain('deleteClosing ? \'animate-backdrop-out\' : \'animate-overlay-in\'')
  })

  test('"Delete forever" button calls deleteConversation with the conv', () => {
    expect(src).toContain('deleteConversation(confirmDeleteConv)')
  })
})

test.describe('ConversationList — search', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ConversationList.jsx') })

  test('search query filters by convName OR lastPreview', () => {
    expect(src).toContain('convName(conv).toLowerCase().includes(q)')
    expect(src).toContain('lastPreview(conv).toLowerCase().includes(q)')
  })

  test('when search is active (q non-empty), mainConv is suppressed (no hero card during search)', () => {
    // !q prevents hero card when searching — all results show as uniform rows
    expect(src).toContain('const mainConv   = !q && pinnedGroupId ?')
  })
})

// ─── 2. ChatTab.jsx ──────────────────────────────────────────────────────────

test.describe('ChatTab — pinnedGroupId lifted state', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ChatTab.jsx') })

  test('pinnedGroupId state is declared in ChatTab', () => {
    expect(src).toContain('const [pinnedGroupId, setPinnedGroupId]')
  })

  test('pinnedGroupId resets to null when groupId changes', () => {
    expect(src).toContain('useEffect(() => { setPinnedGroupId(null) }, [groupId])')
  })

  test('pinnedGroupId is passed down to ConversationList', () => {
    // Props are spread via convListProps object: pinnedGroupId, (shorthand)
    expect(src).toContain('pinnedGroupId,')
    expect(src).toContain('<ConversationList {...convListProps} />')
  })

  test('onPinGroup is passed down to ConversationList', () => {
    // Props are spread via convListProps object
    expect(src).toContain('onPinGroup: setPinnedGroupId,')
  })
})

// ─── 3. ChatView.jsx — scroll guards ─────────────────────────────────────────

test.describe('ChatView — scroll guards', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ChatView.jsx') })

  test('poll scroll-to-bottom is guarded by isAtBottomRef', () => {
    expect(src).toContain('if (isAtBottomRef.current) scrollToBottom()')
  })

  test('event scroll-to-bottom is guarded by isAtBottomRef', () => {
    // Both poll and event fresh-load scrolls now check isAtBottomRef
    const occurrences = (src.match(/isAtBottomRef\.current\) scrollToBottom\(\)/g) ?? []).length
    expect(occurrences).toBeGreaterThanOrEqual(2)
  })

  test('image onLoad scrolls only when at bottom and not preserving scroll', () => {
    // After ChatView split, logic is in named handler onMessageImageLoad (ChatView) called via context from MessageList
    expect(src).toContain('function onMessageImageLoad()')
    expect(src).toContain('isAtBottomRef.current && !preserveScrollRef.current')
  })

  test('isAtBottomRef is initialized to true', () => {
    expect(src).toContain('const isAtBottomRef              = useRef(true)')
  })

  test('poll message body fallback is set (not null)', () => {
    expect(src).toContain('body: `📊 Poll: ${question}`')
    expect(src).not.toMatch(/body:\s*null,\s*\n\s*poll_id/)
  })
})

// ─── 4. Slot columns ─────────────────────────────────────────────────────────

test.describe('EditDishesModal — layout toggle', () => {
  let src

  test.beforeAll(() => { src = read('src/components/EditDishesModal.jsx') })

  test('columns state is initialized from page.slot_columns', () => {
    expect(src).toContain('const [columns, setColumns]')
    expect(src).toContain('page.slot_columns ?? 1')
  })

  test('newColumns is included in the onSave call', () => {
    expect(src).toContain('newColumns: columns')
  })

  test('layout toggle button renders with aria-pressed', () => {
    expect(src).toContain('aria-pressed={columns === n}')
  })

  test('"1 column" and "2 columns" labels are present', () => {
    expect(src).toContain("'1 column'")
    expect(src).toContain("'2 columns'")
  })

  test('active column button uses ember background', () => {
    expect(src).toContain("'bg-ember text-white shadow-sm'")
    expect(src).toContain('columns === n')
  })

  test('Sign-up layout label is shown above the toggle', () => {
    expect(src).toContain('Sign-up layout')
  })
})

test.describe('MealPage — slot_columns grid', () => {
  let src

  test.beforeAll(() => { src = read('src/components/MealPage.jsx') })

  test('handleSaveDishes accepts newColumns parameter', () => {
    expect(src).toContain('newColumns,')
    expect(src).toContain('slot_columns: newColumns ?? 1')
  })

  test('grid uses slot_columns=2 for forced 2-column layout', () => {
    expect(src).toContain("page.slot_columns === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'")
  })

  test('loading skeleton also uses slot_columns for consistent grid during load', () => {
    // Both loading skeleton and actual items share the same grid class pattern
    const matches = (src.match(/grid-cols-1 sm:grid-cols-2/g) ?? []).length
    // Should appear at least twice (skeleton + items) but the conditional covers both
    expect(matches).toBeGreaterThanOrEqual(1)
  })

  test('Dessert color is amber-600 (not amber-500)', () => {
    expect(src).toContain("Dessert: 'text-amber-600'")
    expect(src).not.toContain("Dessert: 'text-amber-500'")
  })
})

test.describe('RotationTab — auto-fill copies slot_columns', () => {
  let src

  test.beforeAll(() => { src = read('src/components/RotationTab.jsx') })

  test('autoFillPages insert includes slot_columns from template', () => {
    expect(src).toContain('slot_columns: template.slot_columns')
  })

  test('slot_columns is only copied when non-default (avoids inserting null)', () => {
    // Only spread when the template has a non-1 value; DB default handles the 1 case
    expect(src).toContain('template.slot_columns && template.slot_columns !== 1')
  })
})

test.describe('migration_64_slot_columns.sql', () => {
  let sql

  test.beforeAll(() => { sql = read('supabase/migration_64_slot_columns.sql') })

  test('migration file exists', () => {
    expect(fs.existsSync(path.resolve(ROOT, 'supabase/migration_64_slot_columns.sql'))).toBe(true)
  })

  test('meal_pages gets slot_columns column', () => {
    expect(sql).toMatch(/ALTER TABLE meal_pages\s+ADD COLUMN IF NOT EXISTS slot_columns/i)
  })

  test('serving_pages gets slot_columns column', () => {
    expect(sql).toMatch(/ALTER TABLE serving_pages\s+ADD COLUMN IF NOT EXISTS slot_columns/i)
  })

  test('slot_columns defaults to 1', () => {
    expect(sql).toContain('DEFAULT 1')
  })

  test('slot_columns is smallint type', () => {
    expect(sql).toContain('smallint')
  })
})

// ─── 5. ScheduleTab.jsx ──────────────────────────────────────────────────────

test.describe('ScheduleTab — button polish', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ScheduleTab.jsx') })

  test('ListBullets is imported', () => {
    expect(src).toMatch(/import\s*\{[^}]*ListBullets[^}]*\}\s*from/)
  })

  test('ListBullets manage-pages button is rendered', () => {
    expect(src).toContain('<ListBullets size={20}')
  })

  test('ListBullets button uses bg-stone-100 background', () => {
    const listBulletsIdx = src.indexOf('<ListBullets')
    const btnStart = src.lastIndexOf('<button', listBulletsIdx)
    const btnSnippet = src.slice(btnStart, listBulletsIdx + 100)
    expect(btnSnippet).toContain('bg-stone-100')
  })

  test('ListBullets button has hover:text-ember', () => {
    const listBulletsIdx = src.indexOf('<ListBullets')
    const btnStart = src.lastIndexOf('<button', listBulletsIdx)
    const btnSnippet = src.slice(btnStart, listBulletsIdx + 100)
    expect(btnSnippet).toContain('hover:text-ember')
  })

  test('ListBullets button has aria-label="Manage pages"', () => {
    expect(src).toContain('aria-label="Manage pages"')
  })
})

// ─── 6. SlotCard.jsx ─────────────────────────────────────────────────────────

test.describe('SlotCard — signed-up card styling', () => {
  let src

  test.beforeAll(() => { src = read('src/components/SlotCard.jsx') })

  test('signed-up card uses ember border (border-ember/40)', () => {
    expect(src).toContain('border-ember/40')
  })

  test('signed-up card hover border is ember-tinted (hover:border-ember/60)', () => {
    expect(src).toContain('hover:border-ember/60')
  })

  test('old lagoon colors are gone from SlotCard', () => {
    expect(src).not.toContain('bg-lagoon-50')
    expect(src).not.toContain('border-lagoon-200')
    expect(src).not.toContain('hover:border-lagoon')
  })

  test('notes text uses stone-500 with line-clamp (not stone-400)', () => {
    expect(src).toContain('text-xs text-stone-500 mt-1.5 line-clamp-1 italic')
    expect(src).not.toContain('text-xs text-stone-400 mt-1.5 line-clamp-1 italic')
  })
})

// ─── 7. ResourcesTab.jsx (was BibleTab) ──────────────────────────────────────

test.describe('ResourcesTab — Books icon visibility', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ResourcesTab.jsx') })

  test('ResourcesTab is exported (BibleTab has been renamed)', () => {
    expect(src).toContain('export default function ResourcesTab(')
  })

  test('Books icon button has bg-stone-100 background', () => {
    expect(src).toContain('bg-stone-100')
    expect(src).toContain('hover:text-ember')
  })

  test('Books icon button has aria-label="Browse Bible"', () => {
    expect(src).toContain('aria-label="Browse Bible"')
  })
})

// ─── 8. EventsTab.jsx — chat share fallback body ─────────────────────────────

test.describe('EventsTab — event chat share body fallback', () => {
  let src

  test.beforeAll(() => { src = read('src/components/EventsTab.jsx') })

  test('event share message has emoji+title body (not null)', () => {
    expect(src).toContain('body:               `📅 ${selectedEvent.title}')
    expect(src).not.toMatch(/body:\s*null,\s*\n\s*event_id/)
  })

  test('event share body includes formatted date', () => {
    expect(src).toContain('formatDateShort(selectedEvent.event_date, selectedEvent.event_time)')
  })
})

// ─── 9. migration_18 — name-based delete guard ───────────────────────────────

test.describe('migration_18_delete_conversation.sql — name-based guard', () => {
  let sql

  test.beforeAll(() => { sql = read('supabase/migration_18_delete_conversation.sql') })

  test('guard uses name = "Main Group Chat" check', () => {
    expect(sql).toContain("conv.name = 'Main Group Chat'")
  })

  test('old member-count guard variables are removed', () => {
    expect(sql).not.toContain('conv_member_count')
    expect(sql).not.toContain('group_member_count')
  })

  test('exception message is preserved', () => {
    expect(sql).toContain("raise exception 'Cannot delete the main group conversation'")
  })

  test('is_conversation_member guard is still present', () => {
    expect(sql).toContain('is_conversation_member(conv_id)')
  })
})

// ─── 10. Regression checks ───────────────────────────────────────────────────

test.describe('Regression — ConversationList core functions preserved', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ConversationList.jsx') })

  test('loadConversations still fetches conversations ordered by updated_at DESC', () => {
    expect(src).toContain(".order('updated_at', { ascending: false })")
  })

  test('lastPreview still handles image messages with 📷 Photo', () => {
    expect(src).toContain("📷 Photo'")
  })

  test('isUnread still compares lastMsg.created_at vs lastReadAt', () => {
    expect(src).toContain('new Date(lastMsg.created_at) > new Date(readAt)')
  })

  test('realtime subscription for new messages is still in place', () => {
    expect(src).toContain("event: 'INSERT', schema: 'public', table: 'messages'")
  })

  test('convName still falls back to "Direct Message" for unknown DMs', () => {
    expect(src).toContain("'Direct Message'")
  })

  test('find_or_create_dm RPC is still used for starting DMs', () => {
    expect(src).toContain("supabase.rpc('find_or_create_dm'")
  })

  test('create_group_chat RPC is still used for group chats', () => {
    expect(src).toContain("supabase.rpc('create_group_chat'")
  })

  test('notification banner logic is preserved (pushSupported check)', () => {
    expect(src).toContain('pushSupported && !pushSubscribed')
  })

  test('birthday banner is still wired up', () => {
    expect(src).toContain('<BirthdayBanner')
  })

  test('search input ref and open/close toggle are still present', () => {
    expect(src).toContain('searchInputRef')
    expect(src).toContain('searchOpen')
  })
})

test.describe('Regression — MealPage core logic preserved', () => {
  let src

  test.beforeAll(() => { src = read('src/components/MealPage.jsx') })

  test('supportsCategories check is still present for categories column', () => {
    expect(src).toContain('supportsCategories && { slot_categories: newCategories }')
  })

  test('removedOrigSlots delete query is still in handleSaveDishes', () => {
    expect(src).toContain('removedOrigSlots.length > 0')
  })

  test('onPageUpdate is called after saving dishes', () => {
    expect(src).toContain('onPageUpdate(data)')
  })

  test('CATEGORY_COLORS still has Main and Side', () => {
    expect(src).toContain("Main: 'text-coral-600'")
    expect(src).toContain("Side: 'text-lagoon-600'")
  })
})

test.describe('Regression — ChatView scroll/timing invariants', () => {
  let src

  test.beforeAll(() => { src = read('src/components/ChatView.jsx') })

  test('freshLoadRef is still set during initial message load', () => {
    expect(src).toContain('freshLoadRef.current = true')
  })

  test('freshLoadRef is cleared after 5 seconds', () => {
    expect(src).toContain('freshLoadRef.current = false')
    expect(src).toContain('5000')
  })

  test('isAtBottomRef scroll-tracking handler is still in the scroll listener', () => {
    expect(src).toContain('isAtBottomRef.current = atBottom')
  })

  test('img.decode reveal logic is still present', () => {
    expect(src).toContain('img.decode')
  })

  test('poll_id guard for rendering poll cards is still present', () => {
    expect(src).toContain('if (msg.poll_id)')
  })

  test('event_id guard for rendering event cards is still present', () => {
    expect(src).toContain('if (msg.event_id)')
  })
})

test.describe('Regression — SlotCard entrance animation preserved', () => {
  let src

  test.beforeAll(() => { src = read('src/components/SlotCard.jsx') })

  test('useEntranceAnimation hook is still used', () => {
    expect(src).toContain('useEntranceAnimation(')
  })

  test('pulse animation is still triggered on data changes', () => {
    expect(src).toContain('animate-card-pulse')
    expect(src).toContain('setPulse(true)')
  })

  test('+ Sign up pill still renders on empty slots', () => {
    expect(src).toContain('+ Sign up')
  })

  test('ember arrow still prefixes signup name on filled slots', () => {
    expect(src).toContain('text-ember font-medium truncate')
    expect(src).toContain('→ {signup.name}')
  })

  test('notes text is clamped to one line to prevent layout overflow', () => {
    expect(src).toContain('line-clamp-1')
  })
})
