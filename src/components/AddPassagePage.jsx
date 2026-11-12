import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { haptic } from '../lib/haptic.js'
import { OT_BOOKS, NT_BOOKS, ALL_BOOKS, fetchChapter, parseVerses, newId } from '../lib/bibleData.js'

const inputCls = 'w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent bg-white'
const labelCls = 'block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5'
const numInputCls = 'w-full px-3 py-3 rounded-xl border text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:border-transparent bg-white'

export default function AddPassagePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userId } = useAppContext()

  const state = location.state
  if (!userId || state === null) {
    navigate('/bible', { replace: true })
    return null
  }

  const { mode = 'add', index = null, initial = null } = state
  const isEdit = mode === 'edit'
  const pageTitle = isEdit ? 'Edit Passage' : 'Add to Quick Access'

  function readPassages() {
    try {
      const raw = localStorage.getItem(`bible_passages_${userId}`)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  function persistPassages(next) {
    try { localStorage.setItem(`bible_passages_${userId}`, JSON.stringify(next)) } catch {}
    supabase.from('profiles').update({ bible_passages: next }).eq('user_id', userId)
      .then(({ error }) => { if (error) console.error('[AddPassagePage] save error:', error.message) })
  }

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

  const [bookId,         setBookId]         = useState(initial?.bookId ?? '')
  const [chapterStr,     setChapterStr]     = useState(initial?.chapter ? String(initial.chapter) : '')
  const [startVerseStr,  setStartVerseStr]  = useState(initial?.startVerse ? String(initial.startVerse) : '')
  const [endVerseStr,    setEndVerseStr]    = useState(
    initial?.endVerse && initial.endVerse !== initial.startVerse ? String(initial.endVerse) : ''
  )
  const [label,          setLabel]          = useState(initial?.label ?? '')
  const [labelEdited,    setLabelEdited]    = useState(!!initial?.id)
  const [errors,         setErrors]         = useState({})
  const [saving,         setSaving]         = useState(false)
  const [verseError,     setVerseError]     = useState(null)

  const selectedBook = ALL_BOOKS.find(b => b.id === bookId) ?? null

  function handleBookChange(bid) {
    setBookId(bid)
    setErrors(e => ({ ...e, book: false }))
    setVerseError(null)
    const book = ALL_BOOKS.find(b => b.id === bid)
    const ch = parseInt(chapterStr, 10)
    const shouldReset = book && !isNaN(ch) && ch > book.chapters
    if (shouldReset) setChapterStr('')
    if (!labelEdited) setLabel(buildAutoLabel(bid, shouldReset ? '' : chapterStr, startVerseStr, endVerseStr))
  }

  function handleChapterChange(val) {
    setChapterStr(val)
    setErrors(e => ({ ...e, chapter: false }))
    setVerseError(null)
    if (!labelEdited) setLabel(buildAutoLabel(bookId, val, startVerseStr, endVerseStr))
  }

  function handleStartVerseChange(val) {
    setStartVerseStr(val)
    setErrors(e => ({ ...e, startVerse: false }))
    setVerseError(null)
    if (!labelEdited) setLabel(buildAutoLabel(bookId, chapterStr, val, endVerseStr))
  }

  function handleEndVerseChange(val) {
    setEndVerseStr(val)
    setErrors(e => ({ ...e, endVerse: false }))
    setVerseError(null)
    if (!labelEdited) setLabel(buildAutoLabel(bookId, chapterStr, startVerseStr, val))
  }

  function handleLabelChange(val) {
    setLabel(val)
    setLabelEdited(true)
    setVerseError(null)
  }

  async function handleSave() {
    setVerseError(null)
    const newErrors = {}
    const book = ALL_BOOKS.find(b => b.id === bookId)
    if (!book) newErrors.book = true
    const ch = parseInt(chapterStr, 10)
    if (!book || isNaN(ch) || ch < 1 || ch > (book?.chapters ?? 0)) newErrors.chapter = true
    let startVerse = null, endVerse = null
    if (startVerseStr.trim()) {
      const sv = parseInt(startVerseStr, 10)
      if (isNaN(sv) || sv < 1) newErrors.startVerse = true
      else startVerse = sv
    }
    if (endVerseStr.trim()) {
      const ev = parseInt(endVerseStr, 10)
      if (isNaN(ev) || ev < 1) newErrors.endVerse = true
      else if (startVerse !== null && ev <= startVerse) newErrors.endVerse = true
      else endVerse = ev
    }
    if (Object.values(newErrors).some(Boolean)) { setErrors(newErrors); return }

    if (startVerse !== null) {
      setSaving(true)
      try {
        const data = await fetchChapter(bookId, ch)
        const all = parseVerses(data)
        const lastVerseNum = all.length > 0 ? all[all.length - 1].number : 0
        if (!all.find(v => v.number === startVerse)) {
          setVerseError(`Verse ${startVerse} doesn't exist in ${book.name} ${ch}`)
          return
        }
        if (endVerse !== null && endVerse > lastVerseNum) {
          setVerseError(`Verse ${endVerse} doesn't exist in ${book.name} ${ch}`)
          return
        }
      } catch {
        setVerseError('Could not verify the verse — check your connection')
        return
      } finally {
        setSaving(false)
      }
    }

    const finalLabel = label.trim() || buildAutoLabel(bookId, chapterStr, startVerseStr, endVerseStr)
    const passage = { id: initial?.id ?? newId(), label: finalLabel, bookId, chapter: ch, startVerse, endVerse }

    const existing = readPassages()
    const next = isEdit && index != null
      ? existing.map((p, i) => i === index ? passage : p)
      : [...existing, passage]
    persistPassages(next)
    haptic()
    navigate(-1)
  }

  return (
    <div className="min-h-screen bg-sunrise-50">
      <div className="max-w-md mx-auto px-4 pt-8 pb-12">

        {/* Header */}
        <div className="flex items-center gap-1 min-w-0 -ml-2 mb-6">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-3xl font-bold text-stone-800">{pageTitle}</h1>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow p-5 flex flex-col gap-5">

          {/* Book */}
          <div>
            <label className={labelCls}>Book</label>
            <select
              value={bookId}
              onChange={e => handleBookChange(e.target.value)}
              className={[
                'w-full px-4 py-3 rounded-xl border text-sm bg-white appearance-none',
                'focus:outline-none focus:ring-2 focus:border-transparent transition',
                errors.book ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-ember',
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
              <label className={labelCls}>Chapter</label>
              <input
                type="number"
                min={1}
                max={selectedBook?.chapters ?? 999}
                value={chapterStr}
                onChange={e => handleChapterChange(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
                placeholder="1"
                className={[
                  numInputCls,
                  errors.chapter ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-ember',
                ].join(' ')}
              />
              {errors.chapter && (
                <p className="text-xs text-red-500 mt-1">
                  {selectedBook ? `1–${selectedBook.chapters}` : 'Required'}
                </p>
              )}
            </div>
            <div className="flex-1">
              <label className={labelCls}>
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
                  numInputCls,
                  (errors.startVerse || verseError) ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-ember',
                ].join(' ')}
              />
              {(errors.startVerse || verseError) && (
                <p className="text-xs text-red-500 mt-1">{verseError ?? 'Invalid'}</p>
              )}
            </div>
            <div className="flex-1">
              <label className={labelCls}>
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
                  numInputCls,
                  errors.endVerse ? 'border-red-300 focus:ring-red-200' : 'border-stone-200 focus:ring-ember',
                ].join(' ')}
              />
              {errors.endVerse && (
                <p className="text-xs text-red-500 mt-1">Must be &gt; From</p>
              )}
            </div>
          </div>

          {/* Label */}
          <div>
            <label className={labelCls}>
              Label <span className="text-stone-400 normal-case font-normal tracking-normal">optional</span>
            </label>
            <input
              value={label}
              onChange={e => handleLabelChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSave()}
              placeholder="Custom name for this passage"
              className={inputCls}
            />
          </div>

          {verseError && !errors.startVerse && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {verseError}
            </p>
          )}

        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!bookId || !chapterStr || saving}
          className="mt-4 w-full py-3.5 rounded-xl bg-ember text-white font-semibold text-sm hover:bg-ember-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Checking…' : 'Save'}
        </button>

      </div>
    </div>
  )
}
