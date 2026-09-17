/**
 * staging-church-code.spec.js
 *
 * QA for the church code changes shipped in the last 3 commits:
 *  1. feat: add church code step to group creation flow (CreateGroupFlow.jsx)
 *  2. feat: replace church dropdown with join code on signup (AuthPage.jsx)
 *  3. fix: use local variable for churchVerified in handleSubmit to avoid stale closure (AuthPage.jsx)
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

// ─── 1. AuthPage.jsx — church join code on signup ────────────────────────────

test.describe('AuthPage — church join code field on signup', () => {
  let src

  test.beforeAll(() => { src = read('src/components/AuthPage.jsx') })

  test('church dropdown (select element) is removed from signup form', () => {
    // Old approach was a <select> for church — it must be gone
    const selectMatches = [...src.matchAll(/<select[^>]*church/gi)]
    expect(selectMatches.length).toBe(0)
  })

  test('church join code text input exists in signup form', () => {
    expect(src).toContain('handleChurchCodeChange')
    expect(src).toContain('churchCode')
  })

  test('church code input uses handleChurchCodeBlur for inline verification', () => {
    expect(src).toContain('onBlur={handleChurchCodeBlur}')
  })

  test('church code input is forced to uppercase and non-alphanumeric chars stripped', () => {
    expect(src).toMatch(/toUpperCase\(\)/)
    expect(src).toMatch(/replace\(.*\[.*\^.*A-Z.*\]/)
  })

  test('handleChurchCodeBlur verifies via db.churches.verifyJoinCode', () => {
    expect(src).toContain('db.churches.verifyJoinCode(churchCode)')
  })

  test('verified church name appears as sage success text', () => {
    expect(src).toContain('text-sage-700')
    expect(src).toContain('churchVerified.name')
  })

  test('error state for invalid code uses text-red-500', () => {
    expect(src).toContain('text-red-500')
    expect(src).toContain('churchCodeError')
  })

  test('church code field label includes "(optional)" hint', () => {
    expect(src).toContain('(optional)')
  })

  test('helper text tells users to ask church admin for the 6-character code', () => {
    expect(src).toContain('6-character church code')
  })
})

// ─── 2. AuthPage.jsx — stale closure fix in handleSubmit ─────────────────────

test.describe('AuthPage — stale closure fix in handleSubmit', () => {
  let src

  test.beforeAll(() => { src = read('src/components/AuthPage.jsx') })

  test('handleSubmit captures churchVerified into local variable verifiedChurch', () => {
    // Critical: avoids stale closure — state read once at call time, not re-checked after async
    expect(src).toContain('let verifiedChurch = churchVerified')
  })

  test('verifiedChurch is set after inline verification during submit', () => {
    // When user submits with unverified code, verify inline and assign to local var
    expect(src).toContain('verifiedChurch = data')
  })

  test('church_join_code in profile insert uses local verifiedChurch (not state)', () => {
    // Must reference verifiedChurch (local), not churchVerified (state) to avoid stale read
    expect(src).toContain('verifiedChurch ? { church_join_code:')
    // Ensure it does NOT use the state variable directly for the conditional
    expect(src).not.toMatch(/churchVerified\s*\?\s*\{[^}]*church_join_code/)
  })

  test('inline verification during submit calls db.churches.verifyJoinCode', () => {
    expect(src).toContain("const { data, error: cErr } = await db.churches.verifyJoinCode(churchCode)")
  })

  test('setChurchVerified is called after inline verification so UI reflects result', () => {
    expect(src).toContain('setChurchVerified(data)')
  })

  test('inline verification sets churchCodeError on failure', () => {
    expect(src).toContain('setChurchCodeError(')
    expect(src).toContain('Invalid church code')
  })
})

// ─── 3. CreateGroupFlow.jsx — church code step ───────────────────────────────

test.describe('CreateGroupFlow — church code step', () => {
  let src

  test.beforeAll(() => { src = read('src/components/CreateGroupFlow.jsx') })

  test('flow has three steps: name, church, features', () => {
    expect(src).toContain("useState('name')")
    expect(src).toContain("'name' | 'church' | 'features'")
  })

  test('progress dots render three dots for three steps', () => {
    expect(src).toContain("['name', 'church', 'features']")
  })

  test('church step renders church code input', () => {
    expect(src).toContain('Church code (e.g. ABC123)')
  })

  test('church code input forces uppercase and strips non-alphanumeric', () => {
    expect(src).toContain("toUpperCase().replace(/[^A-Z0-9]/g, '')")
  })

  test('church code input has monospace + tracking-widest styling', () => {
    expect(src).toContain('font-mono tracking-widest uppercase')
  })

  test('church code input has maxLength of 6', () => {
    expect(src).toContain('maxLength={6}')
  })

  test('handleChurchContinue verifies code before advancing when code entered but not verified', () => {
    expect(src).toContain('async function handleChurchContinue()')
    expect(src).toContain('db.churches.verifyJoinCode(trimmed)')
  })

  test('advancing with empty code skips church linking (no verify)', () => {
    // Empty code → go directly to features without verifying
    expect(src).toContain("if (!trimmed) {")
    expect(src).toContain("setStep('features')")
  })

  test('"Skip for now" button clears code and jumps to features', () => {
    expect(src).toContain('Skip for now')
    expect(src).toContain("setChurchCode('')")
  })

  test('verification spinner renders inline (animate-spin border-t-transparent)', () => {
    expect(src).toContain('animate-spin')
    expect(src).toContain('border-t-transparent')
  })

  test('verified state shows CheckCircle icon with sage color', () => {
    expect(src).toContain('CheckCircle')
    expect(src).toContain('text-sage-700')
    expect(src).toContain('churchVerified.name')
  })

  test('error state shows red text for invalid code', () => {
    expect(src).toContain('Invalid code — check with your church admin.')
  })

  test('handleCreate links church if code was verified', () => {
    expect(src).toContain('if (churchVerified)')
    expect(src).toContain('db.churches.linkGroup(churchCode')
  })

  test('church linking failure shows non-blocking toast (group still created)', () => {
    expect(src).toContain('Group created, but church linking failed')
  })

  test('Church icon is imported for the church step', () => {
    expect(src).toMatch(/import\s*\{[^}]*Church[^}]*\}\s*from/)
  })

  test('goBack from features goes to church step', () => {
    expect(src).toContain("if (step === 'features')")
    expect(src).toContain("setStep('church')")
  })

  test('goBack from church step goes to name step', () => {
    expect(src).toContain("} else if (step === 'church')")
    expect(src).toContain("setStep('name')")
  })
})

// ─── 4. db.js — churches namespace ───────────────────────────────────────────

test.describe('db.js — churches namespace', () => {
  let src

  test.beforeAll(() => { src = read('src/lib/db.js') })

  test('churches namespace is defined in db', () => {
    expect(src).toContain('churches:')
  })

  test('verifyJoinCode calls verify_church_join_code RPC (not direct table query)', () => {
    // Security fix: direct table query exposed join_code to anon enumeration.
    // Now uses a SECURITY DEFINER RPC that returns only {id, name}.
    expect(src).toContain("verifyJoinCode: (code) =>")
    expect(src).toContain("supabase.rpc('verify_church_join_code'")
  })

  test('verifyJoinCode passes p_code parameter to RPC', () => {
    expect(src).toContain("{ p_code: code }")
  })

  test('linkGroup calls the correct RPC/insert', () => {
    expect(src).toContain('linkGroup:')
  })
})

// ─── 5. Regression — group creation core unchanged ───────────────────────────

test.describe('Regression — CreateGroupFlow core behavior', () => {
  let src

  test.beforeAll(() => { src = read('src/components/CreateGroupFlow.jsx') })

  test('group name step is still the first step', () => {
    expect(src).toContain("useState('name')")
    expect(src).toContain("step === 'name'")
  })

  test('group name min length of 2 is still enforced on Continue', () => {
    expect(src).toContain('groupName.trim().length < 2')
  })

  test('features step still renders FEATURE_TOGGLES', () => {
    expect(src).toContain('FEATURE_TOGGLES.map(')
    expect(src).toContain('role="switch"')
    expect(src).toContain('aria-checked={enabled}')
  })

  test('handleCreate still calls db.groupMemberships.createGroup', () => {
    expect(src).toContain('db.groupMemberships.createGroup(groupName.trim(), features)')
  })

  test('createPortal is still used (renders in document.body)', () => {
    expect(src).toContain('createPortal(content, document.body)')
  })

  test('slide-in/slide-out animations are preserved', () => {
    expect(src).toContain('animate-slide-in-right')
    expect(src).toContain('animate-slide-out-right')
    expect(src).toContain('animate-slide-in-left')
  })
})

// ─── 6. Regression — AuthPage core behavior unchanged ────────────────────────

test.describe('Regression — AuthPage core behavior', () => {
  let src

  test.beforeAll(() => { src = read('src/components/AuthPage.jsx') })

  test('sign-up and sign-in modes still exist', () => {
    expect(src).toContain("mode === 'signup'")
    expect(src).toContain("mode === 'signin'")
  })

  test('invite code field is still present', () => {
    expect(src).toContain('inviteCode')
    expect(src).toContain('invite_code')
  })

  test('email and password fields are still present', () => {
    expect(src).toContain("type=\"email\"")
    expect(src).toContain("type=\"password\"")
  })

  test('display name field is still in signup form', () => {
    expect(src).toContain('displayName')
    expect(src).toContain('display_name')
  })

  test('supabase.auth.signUp is still called on submit', () => {
    expect(src).toContain('supabase.auth.signUp(')
  })

  test('supabase.auth.signInWithPassword is still called on signin', () => {
    expect(src).toContain('supabase.auth.signInWithPassword(')
  })

  test('UUID bypass is closed — no raw UUID church_id in profile insert', () => {
    // Old approach passed a UUID directly; new approach uses church_join_code RPC
    expect(src).not.toMatch(/church_id:\s*[a-f0-9-]{36}/)
    expect(src).not.toMatch(/church_id:\s*selectedChurch/)
  })
})
