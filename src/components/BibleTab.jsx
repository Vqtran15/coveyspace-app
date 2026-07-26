import { useState, useEffect, useRef } from 'react'
import { BookOpen, MagnifyingGlass, Copy, Check, X, GearSix, ArrowLeft } from '@phosphor-icons/react'
import { haptic } from '../lib/haptic.js'
import { useToast } from '../lib/toast.jsx'

const BIBLE_API = 'https://bible.helloao.org/api'
const TRANSLATIONS = ['WEB', 'KJV', 'BSB']

// Canonical map: lowercased name/abbreviation → USFM book ID
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

const QUICK_PASSAGES = [
  { label: 'Psalm 23',         ref: { bookId: 'PSA', chapter: 23, startVerse: null, endVerse: null } },
  { label: 'Romans 8:28-39',   ref: { bookId: 'ROM', chapter: 8,  startVerse: 28,   endVerse: 39  } },
  { label: 'John 14:1-6',      ref: { bookId: 'JHN', chapter: 14, startVerse: 1,    endVerse: 6   } },
  { label: 'Isaiah 40:28-31',  ref: { bookId: 'ISA', chapter: 40, startVerse: 28,   endVerse: 31  } },
  { label: '1 Cor 13:4-7',     ref: { bookId: '1CO', chapter: 13, startVerse: 4,    endVerse: 7   } },
  { label: 'Phil 4:6-7',       ref: { bookId: 'PHP', chapter: 4,  startVerse: 6,    endVerse: 7   } },
  { label: 'John 3:16',        ref: { bookId: 'JHN', chapter: 3,  startVerse: 16,   endVerse: null } },
  { label: 'Prov 3:5-6',       ref: { bookId: 'PRO', chapter: 3,  startVerse: 5,    endVerse: 6   } },
]

// Returns { bookId, chapter, startVerse, endVerse } or null
function parseRef(input) {
  const s = input.trim()
  const m = s.match(/^(\d\s+)?([a-zA-Z\s]+?)\s+(\d+)(?::(\d+)(?:-(\d+))?)?$/)
  if (!m) return null
  const prefix = m[1] ? m[1].trim() : ''
  const rawBook = m[2].trim().toLowerCase()
  const key = prefix ? `${prefix} ${rawBook}` : rawBook
  const bookId = BOOKS[key] ?? BOOKS[rawBook] ?? null
  if (!bookId) return null
  return {
    bookId,
    chapter: parseInt(m[3], 10),
    startVerse: m[4] ? parseInt(m[4], 10) : null,
    endVerse: m[5] ? parseInt(m[5], 10) : null,
  }
}

async function fetchChapter(translation, bookId, chapter) {
  const res = await fetch(`${BIBLE_API}/${translation}/${bookId}/${chapter}.json`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function getDailyPassage() {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 1)
  const dayOfYear = Math.floor((now - start) / 86400000)
  return QUICK_PASSAGES[dayOfYear % QUICK_PASSAGES.length]
}

function verseNum(v) {
  return v.number ?? v.verse
}

export default function BibleTab({ onOpenSettings }) {
  const toast = useToast()
  const [translation, setTranslation] = useState('WEB')
  const [query, setQuery] = useState('')
  const [searchError, setSearchError] = useState(null)
  // chapter state: { bookId, chapter, startVerse, endVerse, data } | null
  const [openChapter, setOpenChapter] = useState(null)
  const [loading, setLoading] = useState(false)
  const [dailyData, setDailyData] = useState(null)
  const [dailyLoading, setDailyLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const searchTimerRef = useRef(null)
  const openIdRef = useRef(0)
  const highlightRef = useRef(null)

  const dailyPassage = getDailyPassage()

  // Load daily passage on mount and when translation changes
  useEffect(() => {
    let cancelled = false
    setDailyLoading(true)
    fetchChapter(translation, dailyPassage.ref.bookId, dailyPassage.ref.chapter)
      .then(data => { if (!cancelled) setDailyData(data) })
      .catch(() => { if (!cancelled) setDailyData(null) })
      .finally(() => { if (!cancelled) setDailyLoading(false) })
    return () => { cancelled = true }
  }, [translation])

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimeout(searchTimerRef.current), [])

  // Scroll to first highlighted verse when chapter opens
  useEffect(() => {
    if (openChapter && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [openChapter])

  function handleSearch(value) {
    setQuery(value)
    setSearchError(null)
    clearTimeout(searchTimerRef.current)
    if (!value.trim()) return
    searchTimerRef.current = setTimeout(() => {
      const ref = parseRef(value)
      if (!ref) {
        setSearchError('Try a reference like "John 3:16" or "Psalm 23"')
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
    try {
      const data = await fetchChapter(translation, ref.bookId, ref.chapter)
      if (id !== openIdRef.current) return
      setOpenChapter({ ...ref, data })
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

  function handleCopyChapter() {
    const verses = getDisplayVerses()
    const bookName = openChapter?.data?.book?.name ?? ''
    const chNum = openChapter?.chapter ?? ''
    const verseLines = verses.map(v => `${verseNum(v)}. ${v.text}`).join('\n')
    const text = `${bookName} ${chNum}\n\n${verseLines}\n\n(${translation})`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast('Copied!', 'success')
    })
  }

  function handleCopyVerse(v) {
    const bookName = openChapter?.data?.book?.name ?? ''
    const chNum = openChapter?.chapter ?? ''
    const text = `${bookName} ${chNum}:${verseNum(v)} — ${v.text} (${translation})`
    navigator.clipboard.writeText(text).then(() => toast('Verse copied!', 'success'))
  }

  function getDisplayVerses() {
    const verses = openChapter?.data?.chapter?.verses ?? []
    if (openChapter?.startVerse == null) return verses
    return verses.filter(v => {
      const n = verseNum(v)
      if (openChapter.endVerse != null) return n >= openChapter.startVerse && n <= openChapter.endVerse
      return n === openChapter.startVerse
    })
  }

  function getHighlightSet() {
    if (!openChapter?.startVerse) return new Set()
    const s = new Set()
    const end = openChapter.endVerse ?? openChapter.startVerse
    for (let i = openChapter.startVerse; i <= end; i++) s.add(i)
    return s
  }

  function getDailyVerses() {
    const verses = dailyData?.chapter?.verses ?? []
    const { startVerse, endVerse } = dailyPassage.ref
    if (startVerse == null) return verses
    return verses.filter(v => {
      const n = verseNum(v)
      if (endVerse != null) return n >= startVerse && n <= endVerse
      return n === startVerse
    })
  }

  function switchTranslation(t) {
    haptic()
    setTranslation(t)
    setOpenChapter(null)
    setQuery('')
    setSearchError(null)
  }

  const displayVerses = openChapter ? getDisplayVerses() : []
  const highlightSet = getHighlightSet()
  const firstHighlight = highlightSet.size > 0 ? Math.min(...highlightSet) : null
  const chapterTitle = openChapter
    ? `${openChapter.data?.book?.name ?? ''} ${openChapter.chapter}`
    : null

  return (
    <div className="px-4 pt-4 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          {openChapter && (
            <button
              onClick={handleBack}
              className="w-8 h-8 flex items-center justify-center -ml-1 rounded-full text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            >
              <ArrowLeft size={20} weight="bold" />
            </button>
          )}
          <h1 className="text-3xl font-bold text-stone-800">
            {chapterTitle ?? 'Bible'}
          </h1>
        </div>
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
        >
          <GearSix size={20} />
        </button>
      </div>

      {/* Translation pills */}
      <div className="flex gap-2 mb-4">
        {TRANSLATIONS.map(t => (
          <button
            key={t}
            onClick={() => switchTranslation(t)}
            className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors ${
              translation === t
                ? 'bg-jade text-white'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {t}
          </button>
        ))}
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
          placeholder='John 3:16, Romans 8:28-39, Psalm 23…'
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

      {/* Chapter view */}
      {openChapter && !loading && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-stone-400 font-medium">{translation}</p>
            <button
              onClick={handleCopyChapter}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-stone-200 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
            >
              {copied
                ? <Check size={13} className="text-jade" />
                : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          <div className="space-y-0.5">
            {displayVerses.map(v => {
              const n = verseNum(v)
              const isHighlighted = highlightSet.has(n)
              const isFirst = n === firstHighlight
              return (
                <div
                  key={n}
                  ref={isFirst ? highlightRef : null}
                  onClick={() => handleCopyVerse(v)}
                  className={`group flex gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isHighlighted
                      ? 'bg-jade/10 hover:bg-jade/15'
                      : 'hover:bg-stone-50'
                  }`}
                >
                  <span className="font-bold text-jade text-xs pt-0.5 w-5 shrink-0 text-right select-none">
                    {n}
                  </span>
                  <span className="text-sm leading-relaxed text-stone-700">{v.text}</span>
                  <Copy
                    size={13}
                    className="shrink-0 mt-0.5 text-stone-300 opacity-0 group-hover:opacity-100 transition-opacity self-start"
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Home view: daily verse + quick passages */}
      {!openChapter && !loading && (
        <div className="mt-4 space-y-5">
          {/* Daily verse card */}
          <div className="bg-jade rounded-2xl p-5 shadow-sm">
            <p className="text-xs font-semibold text-white/60 uppercase tracking-wide mb-1">Today's Passage</p>
            <p className="text-sm font-semibold text-white mb-3">{dailyPassage.label}</p>
            {dailyLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map(i => (
                  <div key={i} className="h-3.5 bg-white/20 rounded-lg animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                ))}
              </div>
            ) : getDailyVerses().length > 0 ? (
              <>
                <p className="text-white/90 text-sm leading-relaxed line-clamp-4">
                  {getDailyVerses().map(v => v.text).join(' ')}
                </p>
                <button
                  onClick={() => openPassage(dailyPassage.ref)}
                  className="mt-3 text-xs font-semibold text-white/70 hover:text-white transition-colors"
                >
                  Read full passage →
                </button>
              </>
            ) : (
              <p className="text-white/60 text-sm">Couldn't load verse. Check your connection.</p>
            )}
          </div>

          {/* Quick passages */}
          <div>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Quick Access</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_PASSAGES.map(p => (
                <button
                  key={p.label}
                  onClick={() => { haptic(); openPassage(p.ref) }}
                  className="text-left px-3.5 py-3.5 bg-white border border-stone-200 rounded-2xl hover:border-jade/40 hover:bg-stone-50 transition-colors"
                >
                  <BookOpen size={18} className="text-jade mb-1.5" />
                  <p className="text-sm font-medium text-stone-700">{p.label}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
