import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen, Books, MagnifyingGlass, Copy, X, ArrowLeft,
  Plus, PencilSimple, Trash, DotsSixVertical, PenNib, DotsThreeVertical,
  CaretLeft, CaretRight, Bookmark,
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
  const [bookId, setBookId] = useState(initial?.bookId ?? '')
  const [chapterStr, setChapterStr] = useState(initial?.chapter ? String(initial.chapter) : '')
  const [startVerseStr, setStartVerseStr] = useState(initial?.startVerse ? String(initial.startVerse) : '')
  const [endVerseStr, setEndVerseStr] = useState(
    initial?.endVerse && initial.endVerse !== initial.startVerse ? String(initial.endVerse) : ''
  )
  const [label, setLabel] = useState(initial?.label ?? '')
  const [labelEdited, setLabelEdited] = useState(!!initial?.id)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [verseExistsError, setVerseExistsError] = useState(null)

  const overlayRef = useRef(null)
  const sheetRef = useRef(null)

  const selectedBook = ALL_BOOKS.find(b => b.id === bookId) ?? null

  function buildAutoLabel(bid, ch, sv, ev) {
    const book = ALL_BOOKS.find(b => b.id === bid)
    if (!book || !ch) return ''
    const chNum = parseInt(ch, 10)
    if (isNaN(chNum)) return ''
    const base = `${book.name} ${chNum}`
    if (!sv) return base
    const svNum = parseInt(sv, 10)
    if (isNaN(svNum)) return base
    if (!ev) return `${base}:${svNum}`
    const evNum = parseInt(ev, 10)
    if (isNaN(evNum) || evNum <= svNum) return `${base}:${svNum}`
    return `${base}:${svNum}–${evNum}`
  }

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function update() {
      if (!overlayRef.current || !sheetRef.current) return
      const offset = Math.max(0, window.innerHeight - vv.height - (vv.offsetTop || 0))
      if (offset > 0) {
        overlayRef.current.style.paddingBottom = `${offset}px`
        sheetRef.current.style.maxHeight = `${vv.height - 16}px`
      } else {
        overlayRef.current.style.paddingBottom = ''
        sheetRef.current.style.maxHeight = ''
      }
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  function handleBookChange(bid) {
    setBookId(bid)
    setErrors(e => ({ ...e, book: false }))
    setVerseExistsError(null)
    const book = ALL_BOOKS.find(b => b.id === bid)
    const ch = parseInt(chapterStr, 10)
    const shouldResetChapter = book && !isNaN(ch) && ch > book.chapters
    if (shouldResetChapter) setChapterStr('')
    if (!labelEdited) setLabel(buildAutoLabel(bid, shouldResetChapter ? '' : chapterStr, startVerseStr, endVerseStr))
  }

  function handleChapterChange(val) {
    setChapterStr(val)
    setErrors(e => ({ ...e, chapter: false }))
    setVerseExistsError(null)
    if (!labelEdited) setLabel(buildAutoLabel(bookId, val, startVerseStr, endVerseStr))
  }

  function handleStartVerseChange(val) {
    setStartVerseStr(val)
    setErrors(e => ({ ...e, startVerse: false }))
    setVerseExistsError(null)
    if (!labelEdited) setLabel(buildAutoLabel(bookId, chapterStr, val, endVerseStr))
  }

  function handleEndVerseChange(val) {
    setEndVerseStr(val)
    setErrors(e => ({ ...e, endVerse: false }))
    setVerseExistsError(null)
    if (!labelEdited) setLabel(buildAutoLabel(bookId, chapterStr, startVerseStr, val))
  }

  function handleLabelChange(val) {
    setLabel(val)
    setLabelEdited(true)
    setVerseExistsError(null)
  }

  async function handleSave() {
    setVerseExistsError(null)
    const newErrors = {}
    const book = ALL_BOOKS.find(b => b.id === bookId)
    if (!book) newErrors.book = true
    const ch = parseInt(chapterStr, 10)
    if (!book || isNaN(ch) || ch < 1 || ch > (book?.chapters ?? 0)) newErrors.chapter = true
    let startVerse = null, endVerse = null
    if (startVerseStr.trim()) {
      const sv = parseInt(startVerseStr, 10)
      if (isNaN(sv) || sv < 1) {
        newErrors.startVerse = true
      } else {
        startVerse = sv
      }
    }
    if (endVerseStr.trim()) {
      const ev = parseInt(endVerseStr, 10)
      if (isNaN(ev) || ev < 1) {
        newErrors.endVerse = true
      } else if (startVerse !== null && ev <= startVerse) {
        newErrors.endVerse = true
      } else {
        endVerse = ev
      }
    }
    if (Object.values(newErrors).some(Boolean)) { setErrors(newErrors); return }

    if (startVerse !== null) {
      setSaving(true)
      try {
        const data = await fetchChapter(bookId, ch)
        const all = parseVerses(data)
        const lastVerseNum = all.length > 0 ? all[all.length - 1].number : 0
        if (!all.find(v => v.number === startVerse)) {
          setVerseExistsError(`Verse ${startVerse} doesn't exist in ${book.name} ${ch}`)
          return
        }
        if (endVerse !== null && endVerse > lastVerseNum) {
          setVerseExistsError(`Verse ${endVerse} doesn't exist in ${book.name} ${ch}`)
          return
        }
      } catch {
        setVerseExistsError('Could not verify the verse — check your connection')
        return
      } finally {
        setSaving(false)
      }
    }

    const finalLabel = label.trim() || buildAutoLabel(bookId, chapterStr, startVerseStr, endVerseStr)
    onSave({ id: initial?.id ?? newId(), label: finalLabel, bookId, chapter: ch, startVerse, endVerse })
  }

  return (
    <motion.div
      ref={overlayRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[70] flex flex-col justify-end bg-black/30"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        ref={sheetRef}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="bg-white rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-9 h-1 rounded-full bg-stone-200" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-base">
            {initial?.id ? 'Edit Passage' : 'Add to Quick Access'}
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pt-4 pb-5 space-y-4 overflow-y-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
          {/* Book */}
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">
              Book
            </label>
            <select
              value={bookId}
              onChange={e => handleBookChange(e.target.value)}
              className={[
                'w-full px-4 py-2.5 rounded-xl border text-sm bg-white appearance-none',
                'focus:outline-none focus:ring-2 transition',
                errors.book ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-jade/20',
                !bookId ? 'text-stone-400' : 'text-stone-800',
              ].join(' ')}
            >
              <option value="" disabled>Select a book…</option>
              <optgroup label="Old Testament">
                {OT_BOOKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
              <optgroup label="New Testament">
                {NT_BOOKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </optgroup>
            </select>
            {errors.book && <p className="text-xs text-red-500 mt-1">Please select a book</p>}
          </div>

          {/* Chapter + From verse + To verse */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">
                Chapter
              </label>
              <input
                type="number"
                min={1}
                max={selectedBook?.chapters ?? 999}
                value={chapterStr}
                onChange={e => handleChapterChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="1"
                className={[
                  'w-full px-3 py-2.5 rounded-xl border text-sm text-stone-800',
                  'placeholder:text-stone-400 focus:outline-none focus:ring-2 transition',
                  errors.chapter ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-jade/20',
                ].join(' ')}
              />
              {errors.chapter && (
                <p className="text-xs text-red-500 mt-1">
                  {selectedBook ? `1–${selectedBook.chapters}` : 'Required'}
                </p>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">
                From <span className="font-normal normal-case text-stone-400">(opt)</span>
              </label>
              <input
                type="number"
                min={1}
                value={startVerseStr}
                onChange={e => handleStartVerseChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="16"
                className={[
                  'w-full px-3 py-2.5 rounded-xl border text-sm text-stone-800',
                  'placeholder:text-stone-400 focus:outline-none focus:ring-2 transition',
                  errors.startVerse || verseExistsError ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-jade/20',
                ].join(' ')}
              />
              {(errors.startVerse || verseExistsError) && (
                <p className="text-xs text-red-500 mt-1">{verseExistsError ?? 'Invalid'}</p>
              )}
            </div>
            <div className="flex-1">
              <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">
                To <span className="font-normal normal-case text-stone-400">(opt)</span>
              </label>
              <input
                type="number"
                min={startVerseStr ? parseInt(startVerseStr, 10) + 1 : 2}
                value={endVerseStr}
                onChange={e => handleEndVerseChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="39"
                className={[
                  'w-full px-3 py-2.5 rounded-xl border text-sm text-stone-800',
                  'placeholder:text-stone-400 focus:outline-none focus:ring-2 transition',
                  errors.endVerse ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-jade/20',
                ].join(' ')}
              />
              {errors.endVerse && (
                <p className="text-xs text-red-500 mt-1">Must be &gt; From</p>
              )}
            </div>
          </div>

          {/* Label */}
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
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-jade text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving ? 'Checking…' : 'Save'}
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
  const [bookSearch, setBookSearch] = useState('')

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
                  {/* Book search */}
                  <div className="relative mb-3">
                    <MagnifyingGlass size={15} weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type="text"
                      value={bookSearch}
                      onChange={e => setBookSearch(e.target.value)}
                      placeholder="Search books…"
                      className="w-full pl-8 pr-8 py-2 rounded-xl bg-stone-100 border border-transparent text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade/30 transition"
                    />
                    {bookSearch && (
                      <button onClick={() => setBookSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400">
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  {bookSearch.trim() ? (
                    (() => {
                      const q = bookSearch.trim().toLowerCase()
                      const matches = [...OT_BOOKS, ...NT_BOOKS].filter(b => b.name.toLowerCase().includes(q))
                      return matches.length > 0 ? (
                        <div className="grid grid-cols-2 gap-1.5">
                          {matches.map(book => <BookButton key={book.id} book={book} onSelect={b => { setSelectedBook(b); setBookSearch('') }} />)}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-400 text-center py-8">No books match "{bookSearch}"</p>
                      )
                    })()
                  ) : (
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
                  )}
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

// ─── Page-turn animation variants ────────────────────────────────────────
const pageVariants = {
  enter: (dir) => ({
    x: dir === 'forward' ? '100%' : dir === 'backward' ? '-100%' : 0,
    opacity: dir ? 1 : 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({
    x: dir === 'forward' ? '-25%' : dir === 'backward' ? '25%' : 0,
    opacity: 0,
  }),
}

// ─── Main BibleTab ────────────────────────────────────────────────────────

export default function BibleTab({ userId }) {
  const toast = useToast()

  // navigation: 'home' | 'chapter'
  const [viewMode, setViewMode] = useState('home')
  const [openChapter, setOpenChapter] = useState(null)   // null = not yet loaded or error
  const [chapterLoading, setChapterLoading] = useState(false)
  const [chapterError, setChapterError] = useState(null)

  // browser
  const [showBrowser, setShowBrowser] = useState(false)

  // search
  const [query, setQuery] = useState('')
  const [searchError, setSearchError] = useState(null)

  // user passages
  const [userPassages, setUserPassages] = useState(null)
  const [editMode, setEditMode] = useState(false)
  const [addEditSheet, setAddEditSheet] = useState(null)

  const [dndState, setDndState] = useState(null)
  const [deleteConfirmIdx, setDeleteConfirmIdx] = useState(null)
  const [cardMenuIdx, setCardMenuIdx] = useState(null)
  const [previews, setPreviews] = useState({})
  const [navDirection, setNavDirection] = useState(null)
  const dndPosRef = useRef(null)
  const ghostRef = useRef(null)

  const searchTimerRef = useRef(null)
  const saveTimerRef = useRef(null)
  const openIdRef = useRef(0)
  const cardRefs = useRef([])
  const gridRef = useRef(null)
  const highlightRef = useRef(null)
  const fetchedPreviewsRef = useRef(new Set())

  // ── Load user passages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const storageKey = `bible_passages_${userId}`
    supabase
      .from('profiles')
      .select('bible_passages')
      .eq('user_id', userId)
      .single()
      .then(({ data, error }) => {
        if (error) console.error('[BibleTab] load error:', error.message)
        if (data?.bible_passages != null) {
          setUserPassages(data.bible_passages)
          localStorage.setItem(storageKey, JSON.stringify(data.bible_passages))
        } else {
          const cached = localStorage.getItem(storageKey)
          if (cached) {
            try { setUserPassages(JSON.parse(cached)) }
            catch { setUserPassages([...DEFAULT_PASSAGES]) }
          } else {
            setUserPassages([...DEFAULT_PASSAGES])
          }
        }
      })
      .catch(err => {
        console.error('[BibleTab] load failed:', err)
        const cached = localStorage.getItem(storageKey)
        if (cached) {
          try { setUserPassages(JSON.parse(cached)) }
          catch { setUserPassages([...DEFAULT_PASSAGES]) }
        } else {
          setUserPassages([...DEFAULT_PASSAGES])
        }
      })
  }, [userId])


  // ── Cleanup timers ─────────────────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(searchTimerRef.current)
    clearTimeout(saveTimerRef.current)
  }, [])

  // ── Scroll to top when Add/Edit sheet closes ───────────────────────────
  // iOS scrolls the body when the keyboard appears inside a fixed overlay.
  // When the sheet closes we undo that drift so newly-added cards are
  // visible at the top of the page. Using scrollTo(0,0) — the two-arg
  // form is reliable on all iOS versions including 15.0–15.3.
  useEffect(() => {
    if (!addEditSheet) return
    return () => window.scrollTo(0, 0)
  }, [addEditSheet])

  // ── Fetch first-verse previews for quick access cards ──────────────────
  useEffect(() => {
    if (!userPassages?.length) return
    userPassages.forEach(p => {
      if (fetchedPreviewsRef.current.has(p.id)) return
      fetchedPreviewsRef.current.add(p.id)
      fetchChapter(p.bookId, p.chapter)
        .then(data => {
          const all = parseVerses(data)
          const v = p.startVerse != null ? all.find(v => v.number === p.startVerse) : all[0]
          setPreviews(prev => ({ ...prev, [p.id]: v?.text ?? '' }))
        })
        .catch(() => { fetchedPreviewsRef.current.delete(p.id) })
    })
  }, [userPassages])

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
          if (userId) localStorage.setItem(`bible_passages_${userId}`, JSON.stringify(next))
          clearTimeout(saveTimerRef.current)
          saveTimerRef.current = setTimeout(() => {
            if (userId) supabase.from('profiles').update({ bible_passages: next }).eq('user_id', userId)
              .then(({ error }) => { if (error) console.error('[BibleTab] save error:', error.message) })
          }, 600)
          return next
        })
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

  // ── Persist passages: localStorage first, DB async ────────────────────
  function persistPassages(next) {
    if (!userId) return
    localStorage.setItem(`bible_passages_${userId}`, JSON.stringify(next))
    supabase.from('profiles').update({ bible_passages: next }).eq('user_id', userId)
      .then(({ error }) => { if (error) console.error('[BibleTab] save error:', error.message) })
  }

  // ── Passage CRUD ───────────────────────────────────────────────────────
  function handleSavePassage(passage) {
    const next = addEditSheet?.mode === 'edit' && addEditSheet.index != null
      ? userPassages.map((p, i) => i === addEditSheet.index ? passage : p)
      : [...(userPassages ?? []), passage]
    setUserPassages(next)
    setAddEditSheet(null)
    clearTimeout(saveTimerRef.current)
    persistPassages(next)
  }

  function handleDeletePassage(index) {
    const next = userPassages.filter((_, i) => i !== index)
    setUserPassages(next)
    clearTimeout(saveTimerRef.current)
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
  async function openPassage(ref, direction = null) {
    const id = ++openIdRef.current
    haptic()
    setNavDirection(direction)
    setViewMode('chapter')
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
        bookId: ref.bookId,
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
      setOpenChapter(null)
    } finally {
      if (id === openIdRef.current) setChapterLoading(false)
    }
  }

  function handleBack() {
    setViewMode('home')
    setQuery('')
    setSearchError(null)
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
  const maxChapters = openChapter ? (ALL_BOOKS.find(b => b.id === openChapter.bookId)?.chapters ?? 1) : 1
  const isAlreadySaved = openChapter != null && (userPassages ?? []).some(p =>
    p.bookId === openChapter.bookId &&
    p.chapter === openChapter.chapterNum &&
    p.startVerse === openChapter.startVerse &&
    p.endVerse === openChapter.endVerse
  )

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
                <div key={i} className="h-[92px] bg-stone-100 rounded-2xl animate-pulse"
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
                Add to Quick Access
              </motion.button>
            </motion.div>
          )}

          {/* Unified 2-col grid */}
          {userPassages !== null && userPassages.length > 0 && (
            <div ref={gridRef} className="grid grid-cols-2 gap-2">
              <AnimatePresence mode="popLayout">
              {userPassages.map((p, i) => {
                const isSource = dndState?.fromIdx === i
                const isTarget = dndState?.toIdx === i && dndState.fromIdx !== i
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
                    transition={{ duration: 0.18 }}
                    ref={el => { cardRefs.current[i] = el }}
                    onPointerDown={e => editMode && handleDndStart(i, e)}
                    className={[
                      'relative group bg-white border rounded-2xl select-none shadow-sm h-[92px]',
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
                      className={['w-full h-full text-left rounded-2xl px-3 py-2.5', editMode ? 'pl-7 cursor-grab' : ''].join(' ')}
                    >
                      <BookOpen size={16} weight="bold" className="text-jade mb-1" />
                      <p className={['text-sm font-semibold text-stone-800 leading-snug line-clamp-1', editMode ? 'pr-9' : 'pr-4'].join(' ')}>{p.label}</p>
                      {!editMode && previews[p.id] && (
                        <p className="text-xs text-stone-400 leading-snug line-clamp-2 mt-0.5">{previews[p.id]}</p>
                      )}
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
              </AnimatePresence>
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
            <div className="px-4 pt-4 pb-3 flex items-center gap-2 shrink-0 border-b border-stone-200/60">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleBack}
                    className="w-8 h-8 flex items-center justify-center -ml-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors shrink-0"
                  >
                    <ArrowLeft size={20} weight="bold" />
                  </motion.button>
                  <h1 className="text-2xl font-bold text-stone-800 leading-tight truncate">
                    {chapterLoading
                      ? 'Loading…'
                      : openChapter
                      ? `${openChapter.bookName} ${openChapter.chapterNum}`
                      : chapterError ? 'Error' : ''}
                  </h1>
                </div>
                {openChapter && !chapterError && (
                  <div className="flex items-center gap-0.5 shrink-0">
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={chapterLoading || isAlreadySaved ? undefined : () => setAddEditSheet({ mode: 'add', passage: {
                        bookId: openChapter.bookId,
                        chapter: openChapter.chapterNum,
                        startVerse: openChapter.startVerse,
                        endVerse: openChapter.endVerse,
                        label: openChapter.startVerse != null
                          ? `${openChapter.bookName} ${openChapter.chapterNum}:${openChapter.startVerse}${openChapter.endVerse && openChapter.endVerse !== openChapter.startVerse ? '-' + openChapter.endVerse : ''}`
                          : `${openChapter.bookName} ${openChapter.chapterNum}`,
                      }})}
                      className={['w-8 h-8 flex items-center justify-center rounded-full transition-colors', chapterLoading ? 'opacity-30 cursor-default' : isAlreadySaved ? 'text-jade cursor-default' : 'text-stone-400 hover:text-jade hover:bg-stone-100'].join(' ')}
                    >
                      <Bookmark size={18} weight={isAlreadySaved ? 'fill' : 'regular'} />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => openPassage({ bookId: openChapter.bookId, chapter: openChapter.chapterNum - 1, startVerse: null, endVerse: null }, 'backward')}
                      disabled={chapterLoading || openChapter.chapterNum <= 1}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-30"
                    >
                      <CaretLeft size={18} weight="bold" />
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => openPassage({ bookId: openChapter.bookId, chapter: openChapter.chapterNum + 1, startVerse: null, endVerse: null }, 'forward')}
                      disabled={chapterLoading || openChapter.chapterNum >= maxChapters}
                      className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-30"
                    >
                      <CaretRight size={18} weight="bold" />
                    </motion.button>
                  </div>
                )}
            </div>

            {/* Scrollable content with page-turn animation */}
            <div className="flex-1 min-h-0 relative overflow-hidden">
              {/* Loading overlay — appears above current page, no key change */}
              <AnimatePresence>
                {chapterLoading && (
                  <motion.div
                    key="loading-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="absolute inset-0 z-10 flex items-center justify-center bg-sunrise-50/80 pointer-events-none"
                  >
                    <div className="w-7 h-7 border-2 border-jade border-t-transparent rounded-full animate-spin" />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Animated page — key changes per chapter, drives page-turn */}
              <AnimatePresence custom={navDirection}>
                <motion.div
                  key={openChapter ? `${openChapter.bookId}-${openChapter.chapterNum}` : (chapterError ? 'error' : 'empty')}
                  custom={navDirection}
                  variants={pageVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 350, damping: 36, mass: 0.8 }}
                  className="absolute inset-0 overflow-y-auto px-4 pt-4 pb-8"
                >
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

                  {/* Verse count + list */}
                  {openChapter && !chapterError && (
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
                      <div className="space-y-1.5">
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
                                className="shrink-0 mt-0.5 text-stone-300 opacity-40 transition-opacity self-start"
                              />
                            </motion.div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bible Browser sheet ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showBrowser && (
          <BibleBrowser
            onSelectChapter={(bookId, ch) => {
              setShowBrowser(false)
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
          className="bg-white border-2 border-jade rounded-2xl shadow-2xl px-3 py-2.5 opacity-92"
        >
          <BookOpen size={16} weight="bold" className="text-jade mb-1" />
          <p className="text-sm font-semibold text-stone-800 leading-snug line-clamp-1 pr-4">
            {userPassages[dndState.fromIdx]?.label}
          </p>
        </div>
      )}
    </div>
  )
}
