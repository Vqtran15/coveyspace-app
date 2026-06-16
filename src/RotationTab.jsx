import { useState, useEffect, useMemo } from 'react'
import { Pause, GearSix } from '@phosphor-icons/react'
import { supabase } from './lib/supabase.js'
import { getCurrentPotluckTuesday, toDateString } from './utils/dates.js'
import MealPage from './components/MealPage.jsx'
import AddPageModal from './components/AddPageModal.jsx'
import SettingsModal from './components/SettingsModal.jsx'

function resolveCurrentIndex(pages, settings, rotation) {
  if (!pages.length) return 0
  if (!rotation) return pages.length - 1
  if (settings?.rotation_paused && settings.current_page_id) {
    const idx = pages.findIndex(p => p.id === settings.current_page_id)
    if (idx !== -1) return idx
  }
  const activeTuesday = toDateString(getCurrentPotluckTuesday())
  let best = 0
  for (let i = 0; i < pages.length; i++) {
    if (pages[i].week_date <= activeTuesday) best = i
    else break
  }
  return best
}

async function autoFillPages(pages, settings, tables, defaultTitle) {
  if (settings?.rotation_paused || !pages.length) return { pages, settings }

  const originalCount = pages.length
  const cycleLength = settings.cycle_length ?? originalCount
  const activeTuesday = toDateString(getCurrentPotluckTuesday())
  let current = [...pages]
  let safety = 0

  while (current[current.length - 1].week_date <= activeTuesday && safety < 52) {
    safety++
    const source = current[current.length % cycleLength]
    const lastDate = new Date(current[current.length - 1].week_date + 'T12:00:00')
    lastDate.setDate(lastDate.getDate() + 7)
    const nextDateStr = toDateString(lastDate)

    const { data: newPage, error } = await supabase
      .from(tables.pages)
      .insert({
        title: defaultTitle(nextDateStr),
        week_date: nextDateStr,
        slot_count: source.slot_count,
        slot_dishes: source.slot_dishes ?? [],
      })
      .select()
      .single()

    if (error) break
    current = [...current, newPage]
  }

  let updatedSettings = settings
  if (current.length > originalCount && !settings.cycle_length) {
    await supabase.from(tables.settings).update({ cycle_length: originalCount }).eq('id', 1)
    updatedSettings = { ...settings, cycle_length: originalCount }
  }

  return { pages: current, settings: updatedSettings }
}

export default function RotationTab({ config }) {
  const { label, Icon, editLabel, noun, itemNoun, tables, defaultTitle, rotation = true } = config

  const [pages, setPages]       = useState([])
  const [settings, setSettings] = useState(null)
  const [viewIndex, setViewIndex] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [showAddModal, setShowAddModal]     = useState(false)
  const [showSettings, setShowSettings]     = useState(false)

  const currentIndex = useMemo(() => resolveCurrentIndex(pages, settings, rotation), [pages, settings, rotation])

  useEffect(() => {
    async function load() {
      if (!rotation) {
        const { data, error: err } = await supabase.from(tables.pages).select('*').order('week_date')
        if (err) { setError(err.message); setLoading(false); return }
        setPages(data ?? [])
        setLoading(false)
        return
      }

      const [pagesRes, settingsRes] = await Promise.all([
        supabase.from(tables.pages).select('*').order('week_date'),
        supabase.from(tables.settings).select('*').eq('id', 1).single(),
      ])
      if (pagesRes.error) { setError(pagesRes.error.message); setLoading(false); return }

      const rawSettings = settingsRes.data ?? { rotation_paused: false, current_page_id: null }
      const { pages: filled, settings: filledSettings } =
        await autoFillPages(pagesRes.data ?? [], rawSettings, tables, defaultTitle)

      setPages(filled)
      setSettings(filledSettings)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => { setViewIndex(currentIndex) }, [currentIndex])

  async function togglePause() {
    const newPaused = !settings.rotation_paused
    const patch = {
      rotation_paused: newPaused,
      current_page_id: newPaused ? (pages[viewIndex]?.id ?? null) : null,
    }
    const { error: err } = await supabase.from(tables.settings).update(patch).eq('id', 1)
    if (!err) setSettings(s => ({ ...s, ...patch }))
  }

  async function handleAddPage(data) {
    const { data: newPage, error: err } = await supabase
      .from(tables.pages).insert(data).select().single()
    if (err) throw new Error(err.message)
    const updated = [...pages, newPage].sort((a, b) => a.week_date.localeCompare(b.week_date))
    setPages(updated)
    setViewIndex(updated.findIndex(p => p.id === newPage.id))
    setShowAddModal(false)
  }

  function handlePageDeleted(pageId) {
    const deletedIndex = pages.findIndex(p => p.id === pageId)
    const updated = pages.filter(p => p.id !== pageId)
    setPages(updated)
    setViewIndex(updated.length === 0 ? 0 : Math.min(deletedIndex, updated.length - 1))
  }

  const isPaused = settings?.rotation_paused
  const isViewingCurrent = viewIndex === currentIndex
  const canGoPrev = viewIndex > 0
  const canGoNext = viewIndex < pages.length - 1
  const viewedPage = pages[viewIndex]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-stone-400 text-sm animate-pulse">Loading…</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-24 px-4">
        <div className="bg-white rounded-xl p-6 max-w-md text-center shadow">
          <p className="text-red-600 font-medium mb-2">Failed to connect</p>
          <p className="text-stone-500 text-sm">{error}</p>
          <p className="text-stone-400 text-xs mt-3">Check your .env file has the correct Supabase URL and anon key.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-2 flex items-center justify-between">
        <button
          onClick={() => setViewIndex(currentIndex)}
          className="flex items-center gap-3 text-left active:opacity-60 transition-opacity"
        >
          <Icon size={32} weight="fill" className="text-jade shrink-0" />
          <h1 className="text-3xl font-bold text-stone-800">{label}</h1>
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors"
        >
          <GearSix size={20} weight="regular" />
        </button>
      </div>

      {rotation && isPaused && (
        <div className="bg-sunrise-50 border-b border-sunrise">
          <div className="max-w-3xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sunrise-800 text-sm font-medium">
              <Pause size={16} weight="fill" />
              Rotation is paused — the page won't auto-advance the day after each potluck.
            </div>
            <button
              onClick={togglePause}
              className="text-sm text-sunrise-800 underline underline-offset-2 hover:text-sunrise-900 whitespace-nowrap"
            >
              Resume
            </button>
          </div>
        </div>
      )}

      <div className="pt-2">
        {viewedPage ? (
          <MealPage
            page={viewedPage}
            noun={noun}
            itemNoun={itemNoun}
            editLabel={editLabel}
            tables={tables}
            onPageUpdate={p => setPages(prev => prev.map(x => x.id === p.id ? p : x))}
            onPageDelete={handlePageDeleted}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-20 text-center">
            <p className="text-5xl mb-4">🍽</p>
            <h2 className="text-xl font-semibold text-stone-700 mb-2">No pages yet</h2>
            <p className="text-stone-500 text-sm mb-6">Add your first page to get started.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-jade hover:bg-jade-700 text-white font-medium rounded-lg transition-colors"
            >
              + Add First Page
            </button>
          </div>
        )}

        {pages.length > 0 && (
          <div className="max-w-3xl mx-auto px-4 py-6 flex items-center justify-center gap-4">
            <button
              onClick={() => { setViewIndex(i => i - 1); window.scrollTo({ top: 0, behavior: 'instant' }) }}
              disabled={!canGoPrev}
              className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-stone-200 text-stone-500 text-lg hover:border-jade hover:text-jade disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >‹</button>
            <span className="text-sm font-medium text-stone-400 tabular-nums min-w-[3rem] text-center">
              {viewIndex + 1} / {pages.length}
            </span>
            <button
              onClick={() => { setViewIndex(i => i + 1); window.scrollTo({ top: 0, behavior: 'instant' }) }}
              disabled={!canGoNext}
              className="w-10 h-10 flex items-center justify-center rounded-full border-2 border-stone-200 text-stone-500 text-lg hover:border-jade hover:text-jade disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >›</button>
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsModal
          rotation={rotation}
          isPaused={isPaused}
          onTogglePause={togglePause}
          onAddPage={() => { setShowSettings(false); setShowAddModal(true) }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAddModal && (
        <AddPageModal
          noun={noun}
          defaultTitle={defaultTitle}
          pages={pages}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddPage}
          existingDates={pages.map(p => p.week_date)}
        />
      )}
    </>
  )
}
