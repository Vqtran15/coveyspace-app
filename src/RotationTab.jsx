import { useState, useEffect } from 'react'
import { GearSix } from '@phosphor-icons/react'
import { supabase } from './lib/supabase.js'
import { patchTitleDate } from './utils/dates.js'
import MealPage from './components/MealPage.jsx'
import AddPageModal from './components/AddPageModal.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import ManagePagesModal from './components/ManagePagesModal.jsx'

export default function RotationTab({ config, revealKey }) {
  const { label, Icon, editLabel, noun, itemNoun, tables, defaultTitle } = config

  const [pages, setPages]       = useState([])
  const [viewIndex, setViewIndex] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [showAddModal, setShowAddModal]     = useState(false)
  const [showSettings, setShowSettings]     = useState(false)
  const [showManagePages, setShowManagePages] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error: err } = await supabase.from(tables.pages).select('*').order('position')
      if (err) { setError(err.message); setLoading(false); return }
      setPages(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function handleAddPage(data) {
    const { data: newPage, error: err } = await supabase
      .from(tables.pages)
      .insert({ ...data, position: pages.length })
      .select()
      .single()
    if (err) throw new Error(err.message)
    const updated = [...pages, newPage]
    setPages(updated)
    setViewIndex(updated.length - 1)
    setShowAddModal(false)
  }

  function handlePageDeleted(pageId) {
    const deletedIndex = pages.findIndex(p => p.id === pageId)
    const updated = pages.filter(p => p.id !== pageId)
    setPages(updated)
    setViewIndex(updated.length === 0 ? 0 : Math.min(deletedIndex, updated.length - 1))
  }

  async function handleReorderPages(fromIndex, toIndex) {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= pages.length) return

    const reordered = [...pages]
    const [moved] = reordered.splice(fromIndex, 1)
    reordered.splice(toIndex, 0, moved)

    // Dates are fixed anchors — reordering reassigns which meal occupies each
    // date, but the set of dates (and their order) never changes. Re-sync the
    // whole list (not just the dragged range) so any prior drift self-heals.
    const anchorDates = [...pages].map(p => p.week_date).sort((a, b) => a.localeCompare(b))
    const updates = reordered.map((p, i) => ({
      id: p.id,
      position: i,
      week_date: anchorDates[i],
      title: patchTitleDate(p.title, p.week_date, anchorDates[i]),
    }))

    const viewedId = pages[viewIndex]?.id

    const results = await Promise.all(
      updates.map(u =>
        supabase.from(tables.pages)
          .update({ position: u.position, week_date: u.week_date, title: u.title })
          .eq('id', u.id)
          .select()
          .single()
      )
    )
    const failed = results.find(r => r.error)
    if (failed) throw new Error(failed.error.message)

    const updatedById = new Map(results.map(r => [r.data.id, r.data]))
    const newPages = reordered.map(p => updatedById.get(p.id) ?? p)
    setPages(newPages)
    if (viewedId) setViewIndex(newPages.findIndex(p => p.id === viewedId))
  }

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
        <div className="flex items-center gap-3">
          <Icon size={32} weight="fill" className="text-jade shrink-0" />
          <h1 className="text-3xl font-bold text-stone-800">{label}</h1>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors"
        >
          <GearSix size={20} weight="regular" />
        </button>
      </div>

      <div className="pt-2">
        {viewedPage ? (
          <MealPage
            page={viewedPage}
            noun={noun}
            itemNoun={itemNoun}
            editLabel={editLabel}
            tables={tables}
            revealKey={revealKey}
            pageCount={pages.length}
            canGoPrev={canGoPrev}
            canGoNext={canGoNext}
            onPrevPage={() => { setViewIndex(i => i - 1); window.scrollTo({ top: 0, behavior: 'instant' }) }}
            onNextPage={() => { setViewIndex(i => i + 1); window.scrollTo({ top: 0, behavior: 'instant' }) }}
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
      </div>

      {showSettings && (
        <SettingsModal
          onManagePages={() => { setShowSettings(false); setShowManagePages(true) }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showManagePages && (
        <ManagePagesModal
          pages={pages}
          onReorder={handleReorderPages}
          onAddPage={() => { setShowManagePages(false); setShowAddModal(true) }}
          onClose={() => setShowManagePages(false)}
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
