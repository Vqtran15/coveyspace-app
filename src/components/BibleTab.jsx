import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion'
import {
  BookOpen, MagnifyingGlass, Copy, Check, X, GearSix, ArrowLeft,
  Plus, PencilSimple, Trash, DotsSixVertical, PenNib,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { haptic } from '../lib/haptic.js'
import { useToast } from '../lib/toast.jsx'

const BIBLE_API = 'https://bible.helloao.org/api'
const TRANSLATION = 'BSB'

const BOOKS = {
  // Old Testament
  'genesis': 'GEN', 'gen': 'GEN',
  'exodus': 'EXO', 'exo': 'EXO', 'ex': 'EXO',
  'leviticus': 'LEV', 'lev': 'LEV',
  'numbers': 'NUM', 'num': 'NUM',
  'deuteronomy': 'DEU', 'deut': 'DEU', 'deu': 'DEU', 'dt': 'DEU',
  'joshua': 'JOS', 'josh': 'JOS', 'jos': 'JOS',
  'judges': 'JDG', 'judg': 'JDG', 'jdg': 'JDG',
  'ruth': 'RUT', 'rut': 'RUT',
  '1 samuel': '1SA', '1samuel': '1SA', '1sam': '1SA', '1sa': '1SA',
  '2 samuel': '2SA', '2samuel': '2SA', '2sam': '2SA', '2sa': '2SA',
  '1 kings': '1KI', '1kings': '1KI', '1ki': '1KI', '1kgs': '1KI',
  '2 kings': '2KI', '2kings': '2KI', '2ki': '2KI', '2kgs': '2KI',
  '1 chronicles': '1CH', '1chronicles': '1CH', '1chr': '1CH', '1ch': '1CH', '1chron': '1CH',
  '2 chronicles': '2CH', '2chronicles': '2CH', '2chr': '2CH', '2ch': '2CH', '2chron': '2CH',
  'ezra': 'EZR', 'ezr': 'EZR',
  'nehemiah': 'NEH', 'neh': 'NEH',
  'esther': 'EST', 'est': 'EST', 'esth': 'EST',
  'job': 'JOB',
  'psalms': 'PSA', 'psalm': 'PSA', 'ps': 'PSA', 'psa': 'PSA', 'pss': 'PSA',
  'proverbs': 'PRO', 'prov': 'PRO', 'pro': 'PRO', 'prv': 'PRO',
  'ecclesiastes': 'ECC', 'eccl': 'ECC', 'ecc': 'ECC', 'qoh': 'ECC',
  'song of solomon': 'SNG', 'song of songs': 'SNG', 'song': 'SNG', 'sos': 'SNG', 'ss': 'SNG',
  'isaiah': 'ISA', 'isa': 'ISA',
  'jeremiah': 'JER', 'jer': 'JER',
  'lamentations': 'LAM', 'lam': 'LAM',
  'ezekiel': 'EZK', 'ezek': 'EZK', 'ezk': 'EZK',
  'daniel': 'DAN', 'dan': 'DAN',
  'hosea': 'HOS', 'hos': 'HOS',
  'joel': 'JOL', 'jol': 'JOL',
  'amos': 'AMO', 'amo': 'AMO',
  'obadiah': 'OBA', 'oba': 'OBA', 'ob': 'OBA',
  'jonah': 'JON', 'jon': 'JON',
  'micah': 'MIC', 'mic': 'MIC',
  'nahum': 'NAH', 'nah': 'NAH',
  'habakkuk': 'HAB', 'hab': 'HAB',
  'zephaniah': 'ZEP', 'zep': 'ZEP', 'zeph': 'ZEP',
  'haggai': 'HAG', 'hag': 'HAG',
  'zechariah': 'ZEC', 'zech': 'ZEC', 'zec': 'ZEC',
  'malachi': 'MAL', 'mal': 'MAL',
  // New Testament
  'matthew': 'MAT', 'matt': 'MAT', 'mat': 'MAT', 'mt': 'MAT',
  'mark': 'MRK', 'mrk': 'MRK', 'mk': 'MRK',
  'luke': 'LUK', 'luk': 'LUK', 'lk': 'LUK',
  'john': 'JHN', 'jhn': 'JHN', 'jn': 'JHN',
  'acts': 'ACT', 'act': 'ACT',
  'romans': 'ROM', 'rom': 'ROM',
  '1 corinthians': '1CO', '1corinthians': '1CO', '1cor': '1CO', '1co': '1CO',
  '2 corinthians': '2CO', '2corinthians': '2CO', '2cor': '2CO', '2co': '2CO',
  'galatians': 'GAL', 'gal': 'GAL',
  'ephesians': 'EPH', 'eph': 'EPH',
  'philippians': 'PHP', 'phil': 'PHP', 'php': 'PHP',
  'colossians': 'COL', 'col': 'COL',
  '1 thessalonians': '1TH', '1thessalonians': '1TH', '1thess': '1TH', '1th': '1TH',
  '2 thessalonians': '2TH', '2thessalonians': '2TH', '2thess': '2TH', '2th': '2TH',
  '1 timothy': '1TI', '1timothy': '1TI', '1tim': '1TI', '1ti': '1TI',
  '2 timothy': '2TI', '2timothy': '2TI', '2tim': '2TI', '2ti': '2TI',
  'titus': 'TIT', 'tit': 'TIT',
  'philemon': 'PHM', 'phm': 'PHM', 'phlm': 'PHM',
  'hebrews': 'HEB', 'heb': 'HEB',
  'james': 'JAS', 'jas': 'JAS', 'jam': 'JAS',
  '1 peter': '1PE', '1peter': '1PE', '1pet': '1PE', '1pe': '1PE',
  '2 peter': '2PE', '2peter': '2PE', '2pet': '2PE', '2pe': '2PE',
  '1 john': '1JN', '1john': '1JN', '1jn': '1JN',
  '2 john': '2JN', '2john': '2JN', '2jn': '2JN',
  '3 john': '3JN', '3john': '3JN', '3jn': '3JN',
  'jude': 'JUD', 'jud': 'JUD',
  'revelation': 'REV', 'rev': 'REV', 'apoc': 'REV',
}

// Default passages shown before the user customizes
const DEFAULT_PASSAGES = [
  { id: 'dft-1', label: 'Psalm 23',        bookId: 'PSA', chapter: 23, startVerse: null, endVerse: null },
  { id: 'dft-2', label: 'Romans 8:28-39',  bookId: 'ROM', chapter: 8,  startVerse: 28,   endVerse: 39   },
  { id: 'dft-3', label: 'John 14:1-6',     bookId: 'JHN', chapter: 14, startVerse: 1,    endVerse: 6    },
  { id: 'dft-4', label: 'Isaiah 40:28-31', bookId: 'ISA', chapter: 40, startVerse: 28,   endVerse: 31   },
  { id: 'dft-5', label: '1 Cor 13:4-7',    bookId: '1CO', chapter: 13, startVerse: 4,    endVerse: 7    },
  { id: 'dft-6', label: 'Phil 4:6-7',      bookId: 'PHP', chapter: 4,  startVerse: 6,    endVerse: 7    },
  { id: 'dft-7', label: 'John 3:16',       bookId: 'JHN', chapter: 3,  startVerse: 16,   endVerse: null },
  { id: 'dft-8', label: 'Prov 3:5-6',      bookId: 'PRO', chapter: 3,  startVerse: 5,    endVerse: 6    },
]

function newId() {
  return Math.random().toString(36).slice(2, 9)
}

function extractText(content) {
  const parts = []
  for (const c of content) {
    if (typeof c === 'string') parts.push(c)
    else if (c?.text) parts.push(c.text)
  }
  return parts.reduce((acc, part) => {
    if (!acc) return part
    // Suppress space only when the part is pure punctuation (lone closing quote or comma etc.)
    if (/^["'“”‘’,.;:!?)\]\}\s]+$/.test(part)) return acc + part
    return acc + String.fromCharCode(32) + part
  }, [].join(String.fromCharCode())).trim()
}

function parseVerses(data) {
  return (data?.chapter?.content ?? [])
    .filter(item => item.type === 'verse')
    .map(item => ({ number: item.number, text: extractText(item.content) }))
}

function parseRef(input) {
  const s = input.trim()
  const m = s.match(/^(\d\s*)?([a-zA-Z][a-zA-Z\s]*?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/)
  if (!m) return null
  const prefix = m[1] ? m[1].trim() : ''
  const rawBook = m[2].trim().toLowerCase()
  const key = prefix ? `${prefix} ${rawBook}` : rawBook
  const bookId = BOOKS[key] ?? BOOKS[key.replace(/\s/g, '')] ?? BOOKS[rawBook] ?? null
  if (!bookId) return null
  return {
    bookId,
    chapter: parseInt(m[3], 10),
    startVerse: m[4] ? parseInt(m[4], 10) : null,
    endVerse: m[5] ? parseInt(m[5], 10) : null,
  }
}

async function fetchChapter(bookId, chapter) {
  const res = await fetch(`${BIBLE_API}/${TRANSLATION}/${bookId}/${chapter}.json`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function getDailyPassage() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((now - start) / 86400000)
  return DEFAULT_PASSAGES[dayOfYear % DEFAULT_PASSAGES.length]
}

// ─── AddEditSheet ────────────────────────────────────────────────────────────

function AddEditSheet({ initial, onSave, onClose }) {
  const [refStr, setRefStr] = useState(initial ? initial.label : '')
  const [label, setLabel] = useState(initial ? initial.label : '')
  const [labelEdited, setLabelEdited] = useState(false)
  const [validity, setValidity] = useState(initial ? 'valid' : null)
  const validityTimer = useRef(null)

  function handleRefChange(val) {
    setRefStr(val)
    if (!labelEdited) setLabel(val)
    setValidity(null)
    clearTimeout(validityTimer.current)
    if (!val.trim()) return
    validityTimer.current = setTimeout(() => {
      setValidity(parseRef(val.trim()) ? 'valid' : 'invalid')
    }, 350)
  }

  function handleLabelChange(val) {
    setLabel(val)
    setLabelEdited(true)
  }

  function handleSave() {
    const parsed = parseRef(refStr.trim())
    if (!parsed) {
      setValidity('invalid')
      return
    }
    onSave({
      id: initial?.id ?? newId(),
      label: label.trim() || refStr.trim(),
      ...parsed,
    })
  }

  const isEditing = !!initial

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white rounded-t-3xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-stone-200" />
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-base">
            {isEditing ? 'Edit Passage' : 'Add Passage'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 pt-4 pb-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">
              Reference
            </label>
            <div className="relative">
              <input
                autoFocus
                value={refStr}
                onChange={e => handleRefChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="John 3:16, Psalm 23, Romans 8:28-39"
                className={[
                  'w-full px-4 py-2.5 pr-10 rounded-xl border text-sm text-stone-800',
                  'placeholder:text-stone-400 focus:outline-none focus:ring-2 transition',
                  validity === 'invalid'
                    ? 'border-red-300 focus:ring-red-200'
                    : validity === 'valid'
                    ? 'border-jade/50 focus:ring-jade/20'
                    : 'border-stone-200 focus:ring-jade/20',
                ].join(' ')}
              />
              {validity === 'valid' && (
                <Check size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-jade" />
              )}
              {validity === 'invalid' && (
                <X size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400" />
              )}
            </div>
            {validity === 'invalid' && (
              <p className="text-xs text-red-500 mt-1">
                Try a reference like John 3:16 or Psalm 23
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">
              Label <span className="font-normal normal-case text-stone-400">(optional)</span>
            </label>
            <input
              value={label}
              onChange={e => handleLabelChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Custom name for this passage"
              className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade/20 transition"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={validity === 'invalid'}
              className="flex-1 py-2.5 rounded-xl bg-jade text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── DraggableCard (edit-mode list item) ────────────────────────────────────

function DraggableCard({ passage, onEdit, onDelete }) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={passage}
      dragListener={false}
      dragControls={controls}
      className="bg-white border border-stone-200 rounded-2xl"
    >
      <div className="flex items-center gap-3 px-3 py-3">
        <div
          onPointerDown={e => { e.preventDefault(); controls.start(e) }}
          className="touch-none cursor-grab active:cursor-grabbing p-0.5 text-stone-300 hover:text-stone-500 transition-colors"
        >
          <DotsSixVertical size={22} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-700 truncate">{passage.label}</p>
        </div>
        <button
          onClick={onEdit}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <PencilSimple size={16} />
        </button>
        <button
          onClick={onDelete}
          className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash size={16} />
        </button>
      </div>
    </Reorder.Item>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────

export default function BibleTab({ userId, onOpenSettings }) {
  const toast = useToast()

  // search / chapter state
  const [query, setQuery] = useState('')
  const [searchError, setSearchError] = useState(null)
  const [openChapter, setOpenChapter] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  // daily verse state
  const [dailyVerses, setDailyVerses] = useState(null)

  // user-customizable passages: null = loading, array = loaded
  const [userPassages, setUserPassages] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [addEditSheet, setAddEditSheet] = useState(null) // null | { mode, index?, passage? }

  const searchTimerRef = useRef(null)
  const saveTimerRef = useRef(null)
  const openIdRef = useRef(0)
  const highlightRef = useRef(null)

  const dailyPassage = getDailyPassage()

  // ── Load user passages ───────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      .select('bible_passages')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setUserPassages(data?.bible_passages ?? [...DEFAULT_PASSAGES])
      })
      .catch(() => setUserPassages([...DEFAULT_PASSAGES]))
  }, [userId])

  // ── Load daily passage on mount ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    fetchChapter(dailyPassage.bookId, dailyPassage.chapter)
      .then(data => {
        if (cancelled) return
        const all = parseVerses(data)
        const sv = dailyPassage.startVerse
        const ev = dailyPassage.endVerse
        const filtered = sv == null
          ? all
          : all.filter(v => ev != null ? v.number >= sv && v.number <= ev : v.number === sv)
        setDailyVerses(filtered)
      })
      .catch(() => { if (!cancelled) setDailyVerses([]) })
    return () => { cancelled = true }
  }, [])

  // ── Cleanup timers on unmount ────────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(searchTimerRef.current)
    clearTimeout(saveTimerRef.current)
  }, [])

  // ── Scroll to highlighted verse ──────────────────────────────────────────
  useEffect(() => {
    if (openChapter && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [openChapter])

  // ── Passage save helpers ─────────────────────────────────────────────────
  function persistPassages(passages) {
    if (!userId) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      supabase
        .from('profiles')
        .update({ bible_passages: passages })
        .eq('user_id', userId)
        .then(({ error }) => { if (error) console.warn('bible_passages save failed', error) })
    }, 600)
  }

  function handleReorder(newOrder) {
    setUserPassages(newOrder)
    persistPassages(newOrder)
  }

  function handleSavePassage(passage) {
    let next
    if (addEditSheet?.mode === 'edit' && addEditSheet.index != null) {
      next = userPassages.map((p, i) => i === addEditSheet.index ? passage : p)
    } else {
      next = [...(userPassages ?? []), passage]
    }
    setUserPassages(next)
    persistPassages(next)
    setAddEditSheet(null)
  }

  function handleDeletePassage(index) {
    const next = userPassages.filter((_, i) => i !== index)
    setUserPassages(next)
    persistPassages(next)
  }

  // ── Search / navigation ──────────────────────────────────────────────────
  function handleSearch(value) {
    setQuery(value)
    setSearchError(null)
    clearTimeout(searchTimerRef.current)
    if (!value.trim()) return
    searchTimerRef.current = setTimeout(() => {
      const ref = parseRef(value)
      if (!ref) {
        setSearchError('Try a reference like John 3:16 or Psalm 23')
        return
      }
      openPassage(ref)
    }, 600)
  }

  async function openPassage(ref) {
    const id = ++openIdRef.current
    setLoading(true)
    setOpenChapter(null)
    setSearchError(null)
    haptic()
    try {
      const data = await fetchChapter(ref.bookId, ref.chapter)
      if (id !== openIdRef.current) return
      const all = parseVerses(data)
      const verses = ref.startVerse == null
        ? all
        : all.filter(v => ref.endVerse != null
            ? v.number >= ref.startVerse && v.number <= ref.endVerse
            : v.number === ref.startVerse)
      setOpenChapter({
        bookName: data.book?.name ?? '',
        chapterNum: ref.chapter,
        startVerse: ref.startVerse,
        endVerse: ref.endVerse,
        verses,
        allVerses: all,
      })
    } catch {
      if (id !== openIdRef.current) return
      setSearchError('Could not load that passage. Check your connection and try again.')
    } finally {
      if (id === openIdRef.current) setLoading(false)
    }
  }

  function handleBack() {
    setOpenChapter(null)
    setQuery('')
    setSearchError(null)
  }

  // ── Copy helpers ─────────────────────────────────────────────────────────
  function handleCopyAll() {
    if (!openChapter) return
    const lines = openChapter.verses.map(v => `${v.number}. ${v.text}`).join('\n')
    const text = `${openChapter.bookName} ${openChapter.chapterNum}\n\n${lines}\n\n(${TRANSLATION})`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast('Copied!', 'success')
    })
  }

  function handleCopyVerse(v) {
    if (!openChapter) return
    const ref = `${openChapter.bookName} ${openChapter.chapterNum}:${v.number}`
    navigator.clipboard.writeText(`${ref} — ${v.text} (${TRANSLATION})`)
      .then(() => toast('Verse copied!', 'success'))
  }

  // ── Derived values ───────────────────────────────────────────────────────
  const highlightSet = openChapter?.startVerse != null
    ? new Set(
        Array.from(
          { length: (openChapter.endVerse ?? openChapter.startVerse) - openChapter.startVerse + 1 },
          (_, i) => openChapter.startVerse + i
        )
      )
    : new Set()
  const firstHighlight = highlightSet.size > 0 ? Math.min(...highlightSet) : null
  const chapterTitle = openChapter ? `${openChapter.bookName} ${openChapter.chapterNum}` : null

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <AnimatePresence>
            {openChapter && (
              <motion.button
                key="back"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                onClick={handleBack}
                className="w-8 h-8 flex items-center justify-center -ml-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
              >
                <ArrowLeft size={20} weight="bold" />
              </motion.button>
            )}
          </AnimatePresence>
          <motion.h1
            layout
            className="text-3xl font-bold text-stone-800"
          >
            {chapterTitle ?? 'Bible'}
          </motion.h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-stone-400 bg-stone-100 px-2.5 py-1 rounded-full">BSB</span>
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <GearSix size={20} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-1">
        <MagnifyingGlass
          size={16}
          weight="bold"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
        />
        <input
          type="text"
          value={query}
          onChange={e => handleSearch(e.target.value)}
          placeholder="John 3:16, Romans 8:28-39, Psalm 23…"
          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent transition"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setOpenChapter(null); setSearchError(null) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
          >
            <X size={16} />
          </button>
        )}
      </div>
      {searchError && (
        <p className="text-xs text-coral mt-1 mb-3 px-1">{searchError}</p>
      )}

      {/* Loading spinner */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-jade border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Animated content area ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait" initial={false}>
        {!loading && openChapter && (
          <motion.div
            key="chapter"
            initial={{ x: 32, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 32, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <ChapterView
              openChapter={openChapter}
              highlightSet={highlightSet}
              firstHighlight={firstHighlight}
              copied={copied}
              highlightRef={highlightRef}
              onCopyAll={handleCopyAll}
              onCopyVerse={handleCopyVerse}
            />
          </motion.div>
        )}

        {!loading && !openChapter && (
          <motion.div
            key="home"
            initial={{ x: -12, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -12, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <HomeView
              dailyPassage={dailyPassage}
              dailyVerses={dailyVerses}
              userPassages={userPassages}
              editMode={editMode}
              onOpenPassage={openPassage}
              onToggleEditMode={() => setEditMode(m => !m)}
              onAddPassage={() => setAddEditSheet({ mode: 'add' })}
              onEditPassage={(index, passage) => setAddEditSheet({ mode: 'edit', index, passage })}
              onDeletePassage={handleDeletePassage}
              onReorder={handleReorder}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Add / Edit sheet ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {addEditSheet && (
          <AddEditSheet
            key={addEditSheet.mode + (addEditSheet.index ?? '')}
            initial={addEditSheet.passage}
            onSave={handleSavePassage}
            onClose={() => setAddEditSheet(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── ChapterView ─────────────────────────────────────────────────────────────

function ChapterView({ openChapter, highlightSet, firstHighlight, copied, highlightRef, onCopyAll, onCopyVerse }) {
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-stone-400 font-medium">
          {openChapter.verses.length} {openChapter.verses.length === 1 ? 'verse' : 'verses'}
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onCopyAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          {copied ? <Check size={13} className="text-jade" /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy all'}
        </motion.button>
      </div>

      <div className="space-y-0.5">
        {openChapter.verses.map(v => {
          const isHighlighted = highlightSet.has(v.number)
          const isFirst = v.number === firstHighlight
          return (
            <motion.div
              key={v.number}
              ref={isFirst ? highlightRef : null}
              whileTap={{ scale: 0.99, backgroundColor: isHighlighted ? 'rgba(196,98,45,0.12)' : 'rgba(0,0,0,0.03)' }}
              onClick={() => onCopyVerse(v)}
              className={[
                'group flex gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors',
                isHighlighted ? 'bg-jade/10 hover:bg-jade/15' : 'hover:bg-stone-50',
              ].join(' ')}
            >
              <span className="font-bold text-jade text-xs pt-0.5 w-5 shrink-0 text-right select-none">
                {v.number}
              </span>
              <span className="text-sm leading-relaxed text-stone-700">{v.text}</span>
              <Copy
                size={13}
                className="shrink-0 mt-0.5 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity self-start"
              />
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── HomeView ────────────────────────────────────────────────────────────────

function HomeView({
  dailyPassage, dailyVerses,
  userPassages, editMode,
  onOpenPassage, onToggleEditMode, onAddPassage,
  onEditPassage, onDeletePassage, onReorder,
}) {
  const dp = dailyPassage

  return (
    <div className="mt-4 space-y-5">
      {/* Today's Passage card */}
      <div className="bg-jade rounded-2xl p-5 shadow-sm">
        <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1">
          {"Today’s Passage"}
        </p>
        <p className="text-sm font-semibold text-white mb-3">{dailyPassage.label}</p>

        {dailyVerses === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="h-3.5 bg-white/20 rounded-lg animate-pulse"
                style={{ animationDelay: `${i * 80}ms` }}
              />
            ))}
          </div>
        ) : dailyVerses.length > 0 ? (
          <>
            <p className="text-white/90 text-sm leading-relaxed line-clamp-4">
              {dailyVerses.map(v => v.text).join(' ')}
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => onOpenPassage(dp)}
              className="mt-3 text-xs font-semibold text-white/70 hover:text-white transition-colors"
            >
              {"Read full passage →"}
            </motion.button>
          </>
        ) : (
          <p className="text-white/60 text-sm">{"Couldn’t load passage. Check your connection."}</p>
        )}
      </div>

      {/* Quick Access section */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Quick Access</p>
          <div className="flex items-center gap-1">
            {userPassages !== null && userPassages.length > 0 && (
              <button
                onClick={onToggleEditMode}
                className={[
                  'px-3 py-1 rounded-lg text-xs font-semibold transition-colors',
                  editMode
                    ? 'bg-jade text-white'
                    : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100',
                ].join(' ')}
              >
                {editMode ? 'Done' : 'Edit'}
              </button>
            )}
            <button
              onClick={onAddPassage}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-jade hover:bg-stone-100 transition-colors"
            >
              <Plus size={18} weight="bold" />
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {userPassages === null && (
          <div className="grid grid-cols-2 gap-2">
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                className="h-20 bg-stone-100 rounded-2xl animate-pulse"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {userPassages !== null && userPassages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 py-8 text-center"
          >
            <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center">
              <PenNib size={22} className="text-stone-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-600">No passages yet</p>
              <p className="text-xs text-stone-400 mt-0.5">Tap + to add your favourite verses</p>
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={onAddPassage}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade text-white text-sm font-semibold"
            >
              <Plus size={16} weight="bold" />
              Add passage
            </motion.button>
          </motion.div>
        )}

        {/* Edit mode: drag list */}
        {userPassages !== null && userPassages.length > 0 && editMode && (
          <Reorder.Group
            axis="y"
            values={userPassages}
            onReorder={onReorder}
            className="space-y-2"
          >
            {userPassages.map((p, index) => (
              <DraggableCard
                key={p.id}
                passage={p}
                onEdit={() => onEditPassage(index, p)}
                onDelete={() => onDeletePassage(index)}
              />
            ))}
          </Reorder.Group>
        )}

        {/* Normal mode: 2-column grid */}
        {userPassages !== null && userPassages.length > 0 && !editMode && (
          <div className="grid grid-cols-2 gap-2">
            {userPassages.map(p => (
              <motion.button
                key={p.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => onOpenPassage(p)}
                className="text-left px-3.5 py-3.5 bg-white border border-stone-200 rounded-2xl hover:border-jade/40 hover:bg-stone-50 transition-colors"
              >
                <BookOpen size={18} className="text-jade mb-1.5" />
                <p className="text-sm font-medium text-stone-700 leading-snug">{p.label}</p>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
