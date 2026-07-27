import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Books, MagnifyingGlass, Copy, Check, X, ArrowLeft,
  Plus, PencilSimple, Trash, DotsSixVertical, PenNib, DotsThreeVertical,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { haptic } from '../lib/haptic.js'
import { useToast } from '../lib/toast.jsx'

const BIBLE_API = 'https://bible.helloao.org/api'
const TRANSLATION = 'BSB'

const BOOKS = {
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

const OT_BOOKS = [
  { id: 'GEN', name: 'Genesis', chapters: 50 },
  { id: 'EXO', name: 'Exodus', chapters: 40 },
  { id: 'LEV', name: 'Leviticus', chapters: 27 },
  { id: 'NUM', name: 'Numbers', chapters: 36 },
  { id: 'DEU', name: 'Deuteronomy', chapters: 34 },
  { id: 'JOS', name: 'Joshua', chapters: 24 },
  { id: 'JDG', name: 'Judges', chapters: 21 },
  { id: 'RUT', name: 'Ruth', chapters: 4 },
  { id: '1SA', name: '1 Samuel', chapters: 31 },
  { id: '2SA', name: '2 Samuel', chapters: 24 },
  { id: '1KI', name: '1 Kings', chapters: 22 },
  { id: '2KI', name: '2 Kings', chapters: 25 },
  { id: '1CH', name: '1 Chronicles', chapters: 29 },
  { id: '2CH', name: '2 Chronicles', chapters: 36 },
  { id: 'EZR', name: 'Ezra', chapters: 10 },
  { id: 'NEH', name: 'Nehemiah', chapters: 13 },
  { id: 'EST', name: 'Esther', chapters: 10 },
  { id: 'JOB', name: 'Job', chapters: 42 },
  { id: 'PSA', name: 'Psalms', chapters: 150 },
  { id: 'PRO', name: 'Proverbs', chapters: 31 },
  { id: 'ECC', name: 'Ecclesiastes', chapters: 12 },
  { id: 'SNG', name: 'Song of Solomon', chapters: 8 },
  { id: 'ISA', name: 'Isaiah', chapters: 66 },
  { id: 'JER', name: 'Jeremiah', chapters: 52 },
  { id: 'LAM', name: 'Lamentations', chapters: 5 },
  { id: 'EZK', name: 'Ezekiel', chapters: 48 },
  { id: 'DAN', name: 'Daniel', chapters: 12 },
  { id: 'HOS', name: 'Hosea', chapters: 14 },
  { id: 'JOL', name: 'Joel', chapters: 3 },
  { id: 'AMO', name: 'Amos', chapters: 9 },
  { id: 'OBA', name: 'Obadiah', chapters: 1 },
  { id: 'JON', name: 'Jonah', chapters: 4 },
  { id: 'MIC', name: 'Micah', chapters: 7 },
  { id: 'NAH', name: 'Nahum', chapters: 3 },
  { id: 'HAB', name: 'Habakkuk', chapters: 3 },
  { id: 'ZEP', name: 'Zephaniah', chapters: 3 },
  { id: 'HAG', name: 'Haggai', chapters: 2 },
  { id: 'ZEC', name: 'Zechariah', chapters: 14 },
  { id: 'MAL', name: 'Malachi', chapters: 4 },
]

const NT_BOOKS = [
  { id: 'MAT', name: 'Matthew', chapters: 28 },
  { id: 'MRK', name: 'Mark', chapters: 16 },
  { id: 'LUK', name: 'Luke', chapters: 24 },
  { id: 'JHN', name: 'John', chapters: 21 },
  { id: 'ACT', name: 'Acts', chapters: 28 },
  { id: 'ROM', name: 'Romans', chapters: 16 },
  { id: '1CO', name: '1 Corinthians', chapters: 16 },
  { id: '2CO', name: '2 Corinthians', chapters: 13 },
  { id: 'GAL', name: 'Galatians', chapters: 6 },
  { id: 'EPH', name: 'Ephesians', chapters: 6 },
  { id: 'PHP', name: 'Philippians', chapters: 4 },
  { id: 'COL', name: 'Colossians', chapters: 4 },
  { id: '1TH', name: '1 Thessalonians', chapters: 5 },
  { id: '2TH', name: '2 Thessalonians', chapters: 3 },
  { id: '1TI', name: '1 Timothy', chapters: 6 },
  { id: '2TI', name: '2 Timothy', chapters: 4 },
  { id: 'TIT', name: 'Titus', chapters: 3 },
  { id: 'PHM', name: 'Philemon', chapters: 1 },
  { id: 'HEB', name: 'Hebrews', chapters: 13 },
  { id: 'JAS', name: 'James', chapters: 5 },
  { id: '1PE', name: '1 Peter', chapters: 5 },
  { id: '2PE', name: '2 Peter', chapters: 3 },
  { id: '1JN', name: '1 John', chapters: 5 },
  { id: '2JN', name: '2 John', chapters: 1 },
  { id: '3JN', name: '3 John', chapters: 1 },
  { id: 'JUD', name: 'Jude', chapters: 1 },
  { id: 'REV', name: 'Revelation', chapters: 22 },
]

const ALL_BOOKS = [...OT_BOOKS, ...NT_BOOKS]

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

// ─── AddEditSheet ──────────────────────────────────────────────────────────

function AddEditSheet({ initial, onSave, onClose }) {
  const [refStr, setRefStr] = useState(initial ? initial.label : '')
  const [label, setLabel] = useState(initial ? initial.label : '')
  const [labelEdited, setLabelEdited] = useState(false)
  const [validity, setValidity] = useState(initial ? 'valid' : null)
  const [kbOffset, setKbOffset] = useState(0)
  const validityTimer = useRef(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onVVResize() {
      setKbOffset(Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0)))
    }
    vv.addEventListener('resize', onVVResize)
    return () => vv.removeEventListener('resize', onVVResize)
  }, [])

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
    if (!parsed) { setValidity('invalid'); return }
    onSave({ id: initial?.id ?? newId(), label: label.trim() || refStr.trim(), ...parsed })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: -kbOffset, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white rounded-t-3xl"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-stone-200" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-base">
            {initial ? 'Edit Passage' : 'Add Passage'}
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
                  validity === 'invalid' ? 'border-red-300 focus:ring-red-200'
                    : validity === 'valid' ? 'border-jade/50 focus:ring-jade/20'
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
              <p className="text-xs text-red-500 mt-1">Try a reference like John 3:16 or Psalm 23</p>
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

// ─── BibleBrowser ─────────────────────────────────────────────────────────

function BookButton({ book, onSelect }) {
  return (
    <button
      onClick={() => onSelect(book)}
      className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-stone-50 hover:bg-jade/8 hover:border-jade/30 border border-transparent transition-colors active:scale-95 text-left w-full"
    >
      <span className="text-sm font-medium text-stone-700 truncate pr-2">{book.name}</span>
      <span className="text-xs text-stone-400 shrink-0">{book.chapters}</span>
    </button>
  )
}

function BibleBrowser({ onSelectChapter, onClose }) {
  const [selectedBook, setSelectedBook] = useState(null)
  const [booksReady, setBooksReady] = useState(false)

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.85 }}
      onAnimationComplete={() => setBooksReady(true)}
      className="fixed inset-0 z-[60] bg-sunrise-50 flex flex-col"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 bg-white shrink-0">
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={selectedBook ? () => setSelectedBook(null) : onClose}
            className="w-9 h-9 flex items-center justify-center -ml-1 rounded-full text-stone-500 hover:bg-stone-100 transition-colors"
          >
            <ArrowLeft size={20} weight="bold" />
          </motion.button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-stone-800 truncate">
              {selectedBook ? selectedBook.name : 'Browse Bible'}
            </h1>
          </div>
          <span className="text-xs font-medium text-stone-400">BSB</span>
        </div>

        {/* Sliding panels */}
        <div className="flex-1 min-h-0 relative" style={{ overflow: 'hidden' }}>

          {/* Books panel */}
          <motion.div
            initial={false}
            animate={{ x: selectedBook ? '-100%' : '0%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="absolute inset-0 overflow-y-auto"
          >
            <div className="px-4 py-3 pb-6">
              {booksReady ? (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18 }}
                  >
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 px-1">
                      Old Testament
                    </p>
                    <div className="grid grid-cols-2 gap-1.5 mb-5">
                      {OT_BOOKS.map(book => <BookButton key={book.id} book={book} onSelect={setSelectedBook} />)}
                    </div>
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, delay: 0.07 }}
                  >
                    <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2 px-1">
                      New Testament
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {NT_BOOKS.map(book => <BookButton key={book.id} book={book} onSelect={setSelectedBook} />)}
                    </div>
                  </motion.div>
                </>
              ) : (
                <div className="space-y-2 pt-1">
                  {[...Array(10)].map((_, i) => (
                    <div
                      key={i}
                      className="h-10 bg-stone-100 rounded-xl animate-pulse"
                      style={{ animationDelay: `${i * 25}ms` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Chapters panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: selectedBook ? '0%' : '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className="absolute inset-0 overflow-y-auto"
          >
            {selectedBook && (
              <div className="px-4 py-4 pb-6">
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(ch => (
                    <motion.button
                      key={ch}
                      whileTap={{ scale: 0.88 }}
                      onClick={() => onSelectChapter(selectedBook.id, ch)}
                      className="aspect-square rounded-xl bg-white border border-stone-200 text-sm font-semibold text-stone-700 hover:bg-jade hover:border-jade hover:text-white transition-colors flex items-center justify-center"
                    >
                      {ch}
                    </motion.button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

        </div>
    </motion.div>
  )
}

// ─── Main BibleTab ────────────────────────────────────────────────────────

export default function BibleTab({ userId }) {
  const toast = useToast()

  // navigation: 'home' | 'chapter'
  const [viewMode, setViewMode] = useState('home')
  const [openChapter, setOpenChapter] = useState(null)   // null = loading
  const [chapterLoading, setChapterLoading] = useState(false)
  const [chapterError, setChapterError] = useState(null)

  // browser
  const [showBrowser, setShowBrowser] = useState(false)

  // search
  const [query, setQuery] = useState('')
  const [searchError, setSearchError] = useState(null)

  // copy
  const [copied, setCopied] = useState(false)

  // user passages
  const [userPassages, setUserPassages] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [addEditSheet, setAddEditSheet] = useState(null)

  const [dndState, setDndState] = useState(null)
  const [dropTick, setDropTick] = useState(0)
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState(null)
  const [cardMenuIdx, setCardMenuIdx] = useState(null)
  const dndPosRef = useRef(null)
  const ghostRef = useRef(null)

  const searchTimerRef = useRef(null)
  const saveTimerRef = useRef(null)
  const openIdRef = useRef(0)
  const cardRefs = useRef([])
  const gridRef = useRef(null)
  const highlightRef = useRef(null)

  // ── Load user passages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    supabase
      .from('profiles')
      .select('bible_passages')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => setUserPassages(data?.bible_passages ?? [...DEFAULT_PASSAGES]))
      .catch(() => setUserPassages([...DEFAULT_PASSAGES]))
  }, [userId])


  // ── Cleanup timers ─────────────────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(searchTimerRef.current)
    clearTimeout(saveTimerRef.current)
  }, [])

  // ── Scroll to highlighted verse ────────────────────────────────────────
  useEffect(() => {
    if (viewMode === 'chapter' && !chapterLoading && openChapter && highlightRef.current) {
      setTimeout(() => {
        highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 120)
    }
  }, [openChapter, chapterLoading, viewMode])

  // ── Grid drag-and-drop (pointer events + fixed ghost card) ──────────────────
  function handleDndStart(idx, e) {
    if (!editMode) return
    e.preventDefault()
    const rect = e.currentTarget.getBoundingClientRect()
    haptic()
    dndPosRef.current = {
      fromIdx: idx, toIdx: idx,
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      initX: rect.left, initY: rect.top,
      cardW: rect.width, cardH: rect.height,
    }
    setDndState({ fromIdx: idx, toIdx: idx })
  }

  const isDragging = dndState !== null

  useEffect(() => {
    if (!isDragging) return
    function onMove(e) {
      const p = dndPosRef.current
      if (!p) return
      const x = e.clientX, y = e.clientY
      if (ghostRef.current) {
        ghostRef.current.style.transform = `translate(${x - p.offsetX}px, ${y - p.offsetY}px)`
      }
      let toIdx = p.fromIdx, nearestDist = Infinity
      cardRefs.current.forEach((card, j) => {
        if (!card) return
        const r = card.getBoundingClientRect()
        const dist = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2))
        if (dist < nearestDist) { nearestDist = dist; toIdx = j }
      })
      if (toIdx !== p.toIdx) {
        dndPosRef.current = { ...p, toIdx }
        setDndState({ fromIdx: p.fromIdx, toIdx })
      }
    }
    function onUp() {
      const p = dndPosRef.current
      dndPosRef.current = null
      setDndState(null)
      if (p && p.fromIdx !== p.toIdx) {
        setUserPassages(prev => {
          const next = [...prev]
          const [item] = next.splice(p.fromIdx, 1)
          next.splice(p.toIdx, 0, item)
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => {
            if (userId) supabase.from('profiles').update({ bible_passages: next }).eq('user_id', userId)
          }, 600)
          return next
        })
        setDropTick(v => v + 1)
      }
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    document.addEventListener('pointercancel', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
      document.removeEventListener('pointercancel', onUp)
    }
  }, [isDragging])

  // ── Passage CRUD ───────────────────────────────────────────────────────
  function persistPassages(passages) {
    if (!userId) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      supabase.from('profiles').update({ bible_passages: passages }).eq('user_id', userId)
    }, 600)
  }

  function handleSavePassage(passage) {
    const next = addEditSheet?.mode === 'edit' && addEditSheet.index != null
      ? userPassages.map((p, i) => i === addEditSheet.index ? passage : p)
      : [...(userPassages ?? []), passage]
    setUserPassages(next)
    persistPassages(next)
    setAddEditSheet(null)
  }

  function handleDeletePassage(index) {
    const next = userPassages.filter((_, i) => i !== index)
    setUserPassages(next)
    persistPassages(next)
  }

  // ── Search ─────────────────────────────────────────────────────────────
  function handleSearch(value) {
    setQuery(value)
    setSearchError(null)
    clearTimeout(searchTimerRef.current)
    if (!value.trim()) return
    searchTimerRef.current = setTimeout(() => {
      const ref = parseRef(value)
      if (!ref) { setSearchError('Try a reference like John 3:16 or Psalm 23'); return }
      openPassage(ref)
    }, 600)
  }

  // ── Navigation ─────────────────────────────────────────────────────────
  async function openPassage(ref) {
    const id = ++openIdRef.current
    haptic()
    setViewMode('chapter')
    setOpenChapter(null)
    setChapterLoading(true)
    setChapterError(null)
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
        bookName: data.book?.name ?? ALL_BOOKS.find(b => b.id === ref.bookId)?.name ?? '',
        chapterNum: ref.chapter,
        startVerse: ref.startVerse,
        endVerse: ref.endVerse,
        verses,
        allVerses: all,
      })
    } catch {
      if (id !== openIdRef.current) return
      setChapterError('Could not load that passage. Check your connection.')
    } finally {
      if (id === openIdRef.current) setChapterLoading(false)
    }
  }

  function handleBack() {
    setViewMode('home')
    setQuery('')
    setSearchError(null)
  }

  // ── Copy ───────────────────────────────────────────────────────────────
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

  // ── Highlight set ──────────────────────────────────────────────────────
  const highlightSet = openChapter?.startVerse != null
    ? new Set(
        Array.from(
          { length: (openChapter.endVerse ?? openChapter.startVerse) - openChapter.startVerse + 1 },
          (_, i) => openChapter.startVerse + i
        )
      )
    : new Set()
  const firstHighlight = highlightSet.size > 0 ? Math.min(...highlightSet) : null

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pt-4 pb-4">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-3xl font-bold text-stone-800">Bible</h1>
      </div>

      {/* Search + Browse row */}
      <div className="flex items-center gap-2 mb-1">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            weight="bold"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="John 3:16, Psalm 23…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-white border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent transition"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setViewMode('home'); setOpenChapter(null); setSearchError(null) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowBrowser(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-jade text-white hover:opacity-90 transition-opacity shrink-0"
        >
          <Books size={15} />
          <span className="text-xs font-semibold">Browse</span>
        </button>
      </div>
      {searchError && (
        <p className="text-xs text-coral mt-1 mb-3 px-1">{searchError}</p>
      )}

      {/* Home content */}
      <div className="mt-4">

        {/* Quick Access */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Quick Access</p>
            <div className="flex items-center gap-1">
              {userPassages !== null && userPassages.length > 0 && (
                <button
                  onClick={() => { setEditMode(m => !m); setCardMenuIdx(null) }}
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
                onClick={() => setAddEditSheet({ mode: 'add' })}
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
                <div key={i} className="h-20 bg-stone-100 rounded-2xl animate-pulse"
                  style={{ animationDelay: `${i * 60}ms` }} />
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
                onClick={() => setAddEditSheet({ mode: 'add' })}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-jade text-white text-sm font-semibold"
              >
                <Plus size={16} weight="bold" />
                Add passage
              </motion.button>
            </motion.div>
          )}

          {/* Unified 2-col grid */}
          {userPassages !== null && userPassages.length > 0 && (
            <div ref={gridRef} className="grid grid-cols-2 gap-2">
              {userPassages.map((p, i) => {
                const isSource = dndState?.fromIdx === i
                const isTarget = dndState?.toIdx === i && dndState.fromIdx !== i
                return (
                  <motion.div
                    key={p.id + '-' + dropTick}
                    initial={dropTick > 0 ? { opacity: 0.7 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18 }}
                    ref={el => { cardRefs.current[i] = el }}
                    onPointerDown={e => editMode && handleDndStart(i, e)}
                    className={[
                      'relative group bg-white border rounded-2xl select-none shadow-sm',
                      isSource ? 'opacity-30 border-dashed border-stone-400'
                        : isTarget ? 'border-jade border-2'
                        : 'border-stone-200',
                      editMode ? 'cursor-grab active:cursor-grabbing' : '',
                      cardMenuIdx === i ? 'z-[50]' : '',
                    ].join(' ')}
                    style={{ touchAction: editMode ? 'none' : 'auto' }}
                  >
                    {/* Drag-handle affordance */}
                    {editMode && (
                      <DotsSixVertical size={14} className="absolute top-2 left-2 text-stone-300 pointer-events-none" />
                    )}

                    {/* Tap area */}
                    <motion.button
                      whileTap={!editMode ? { scale: 0.96 } : undefined}
                      onClick={() => !editMode && openPassage(p)}
                      className={['w-full text-left rounded-2xl px-3.5 py-3.5', editMode ? 'pl-7 cursor-grab' : ''].join(' ')}
                    >
                      <BookOpen size={18} weight="bold" className="text-jade mb-1.5" />
                      <p className={['text-sm font-semibold text-stone-800 leading-snug', editMode ? 'pr-9' : 'pr-5'].join(' ')}>{p.label}</p>
                    </motion.button>

                    {/* Three-dots menu */}
                    {editMode && (
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={e => { e.stopPropagation(); setCardMenuIdx(cardMenuIdx === i ? null : i) }}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                        >
                          <DotsThreeVertical size={16} weight="bold" />
                        </button>
                        {cardMenuIdx === i && (
                          <>
                            <div
                              className="fixed inset-0 z-[49]"
                              onClick={e => { e.stopPropagation(); setCardMenuIdx(null) }}
                            />
                            <div className="absolute right-0 top-8 z-[50] bg-white rounded-xl shadow-lg border border-stone-100 overflow-hidden w-32">
                              <button
                                onClick={e => { e.stopPropagation(); setCardMenuIdx(null); setAddEditSheet({ mode: 'edit', index: i, passage: p }) }}
                                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                              >
                                <PencilSimple size={14} />
                                Edit
                              </button>
                              <div className="h-px bg-stone-100" />
                              <button
                                onClick={e => { e.stopPropagation(); setCardMenuIdx(null); setDeleteConfirmIdx(i) }}
                                className="flex items-center gap-2 w-full px-3 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                              >
                                <Trash size={14} />
                                Remove
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Chapter overlay (slides in from right, fixed full-screen) ─────── */}
      <AnimatePresence>
        {viewMode === 'chapter' && (
          <motion.div
            key="chapter-overlay"
            initial={{ x: '100%' }}
            animate={{ x: '0%' }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.85 }}
            className="fixed inset-0 z-[70] bg-sunrise-50 flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Sticky header */}
            <div className="px-4 pt-4 pb-3 flex items-center justify-between shrink-0 border-b border-stone-200/60">
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleBack}
                    className="w-8 h-8 flex items-center justify-center -ml-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  >
                    <ArrowLeft size={20} weight="bold" />
                  </motion.button>
                  <h1 className="text-2xl font-bold text-stone-800 leading-tight">
                    {chapterLoading
                      ? 'Loading…'
                      : openChapter
                      ? `${openChapter.bookName} ${openChapter.chapterNum}`
                      : chapterError ? 'Error' : ''}
                  </h1>
                </div>
                {!chapterLoading && openChapter && !chapterError && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 text-xs font-medium text-stone-600 hover:bg-stone-200 transition-colors"
                  >
                    {copied ? <Check size={13} className="text-jade" /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy all'}
                  </motion.button>
                )}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-8">
              {/* Loading spinner */}
              {chapterLoading && (
                <div className="flex justify-center py-20">
                  <div className="w-7 h-7 border-2 border-jade border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Error */}
              {chapterError && (
                <div className="flex flex-col items-center gap-3 py-20 text-center">
                  <p className="text-sm text-stone-500">{chapterError}</p>
                  <button
                    onClick={handleBack}
                    className="text-sm font-semibold text-jade"
                  >
                    Go back
                  </button>
                </div>
              )}

              {/* Verse count */}
              {!chapterLoading && openChapter && !chapterError && (
                <>
                  <p className="text-xs text-stone-400 font-medium mb-3">
                    {openChapter.verses.length} {openChapter.verses.length === 1 ? 'verse' : 'verses'}
                    {openChapter.startVerse != null && (
                      <span>
                        {' '}(ch. {openChapter.chapterNum}
                        {openChapter.startVerse != null
                          ? ` · v${openChapter.startVerse}${openChapter.endVerse != null && openChapter.endVerse !== openChapter.startVerse ? `–${openChapter.endVerse}` : ''}`
                          : ''}
                        )
                      </span>
                    )}
                  </p>

                  {/* Verse list */}
                  <div className="space-y-0.5">
                    {openChapter.verses.map((v, idx) => {
                      const isHighlighted = highlightSet.has(v.number)
                      const isFirst = v.number === firstHighlight
                      return (
                        <motion.div
                          key={v.number}
                          ref={isFirst ? highlightRef : null}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: Math.min(idx * 0.018, 0.28), duration: 0.18 }}
                          whileTap={{ scale: 0.99 }}
                          onClick={() => handleCopyVerse(v)}
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
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bible Browser sheet ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBrowser && (
          <BibleBrowser
            onSelectChapter={(bookId, ch) => {
              openPassage({ bookId, chapter: ch, startVerse: null, endVerse: null })
            }}
            onClose={() => setShowBrowser(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Add / Edit sheet ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {addEditSheet && (
          <AddEditSheet
            key={addEditSheet.mode + (addEditSheet.index ?? 'new')}
            initial={addEditSheet.passage}
            onSave={handleSavePassage}
            onClose={() => setAddEditSheet(null)}
          />
        )}
      </AnimatePresence>


      {/* ── Delete confirmation sheet ─────────────────────────────────────── */}
      <AnimatePresence>
        {deleteConfirmIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/30"
            onClick={() => setDeleteConfirmIdx(null)}
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
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-9 h-1 rounded-full bg-stone-200" />
              </div>
              <div className="px-5 py-4">
                <p className="text-base font-bold text-stone-800 mb-1">Remove passage?</p>
                <p className="text-sm text-stone-500 mb-5">
                  {userPassages?.[deleteConfirmIdx]?.label} will be removed from your quick access.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteConfirmIdx(null)}
                    className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => { handleDeletePassage(deleteConfirmIdx); setDeleteConfirmIdx(null) }}
                    className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Drag ghost card (pointer-events DnD) ─────────────────────────── */}
      {isDragging && dndState && userPassages?.[dndState.fromIdx] && (
        <div
          ref={el => {
            ghostRef.current = el
            if (el && dndPosRef.current) {
              el.style.transform = `translate(${dndPosRef.current.initX}px, ${dndPosRef.current.initY}px)`
            }
          }}
          style={{
            position: 'fixed', top: 0, left: 0,
            width: dndPosRef.current?.cardW ?? 0,
            height: dndPosRef.current?.cardH ?? 0,
            pointerEvents: 'none', zIndex: 9999, willChange: 'transform',
          }}
          className="bg-white border-2 border-jade rounded-2xl shadow-2xl px-3.5 py-3.5 opacity-92"
        >
          <BookOpen size={18} weight="bold" className="text-jade mb-1.5" />
          <p className="text-sm font-semibold text-stone-800 leading-snug">
            {userPassages[dndState.fromIdx]?.label}
          </p>
        </div>
      )}
    </div>
  )
}
