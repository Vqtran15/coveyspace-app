import { useState, useEffect, useRef } from 'react'
import { ListBullets } from '@phosphor-icons/react'
import { supabase } from './lib/supabase.js'
import { patchTitleDate, toDateString } from './utils/dates.js'
import { haptic } from './lib/haptic.js'
import MealPage from './components/MealPage.jsx'
import AddPageModal from './components/AddPageModal.jsx'
import PagesModal from './components/PagesModal.jsx'
import ManagePagesModal from './components/ManagePagesModal.jsx'

const FUTURE_BUFFER = 2  // always keep at least this many pages with dates after today
const AUTO_FILL_LIMIT = 10 // safety cap per load

async function autoFillPages(existingPages, tables, defaultTitle) {
  if (!existingPages.length) return existingPages

  const today = toDateString(new Date())
  if (existingPages.filter(p => p.week_date > today).length >= FUTURE_BUFFER) return existingPages

  // Snapshot sorted oldest→newest — this is the cycling pool
  const pool = [...existingPages].sort((a, b) => a.week_date.localeCompare(b.week_date))
  const result = [...existingPages]
  let k = 0

  while (result.filter(p => p.week_date > today).length < FUTURE_BUFFER && k < AUTO_FILL_LIMIT) {
    const lastPage = result[result.length - 1]
    const lastDate = new Date(lastPage.week_date + 'T12:00:00')
    lastDate.setDate(lastDate.getDate() + 7)
    const nextDateStr = toDateString(lastDate)

    const template = pool[k % pool.length]

    const { data: newPage, error } = await supabase
      .from(tables.pages)
      .insert({
        title: defaultTitle(nextDateStr),
        week_date: nextDateStr,
        slot_count: template.slot_count,
        slot_dishes: template.slot_dishes ?? [],
        position: result.length,
      })
      .select()
      .single()

    if (error) break
    result.push(newPage)
    k++
  }

  return result
}

export default function RotationTab({ config, revealKey, groupName = '', displayName = '', onOpenSettings, isAdmin = false, compact = false }) {
  const { label, Icon, editLabel, noun, itemNoun, pageNoun, pageNounPlural, tables, defaultTitle, autoFill = false } = config

  const [pages, setPages]       = useState([])
  const [viewIndex, setViewIndex] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [showAddModal, setShowAddModal]       = useState(false)
  const [showPages, setShowPages]             = useState(false)
  const [showManagePages, setShowManagePages] = useState(false)
  const [showEditPage, setShowEditPage]       = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.from(tables.pages).select('*').order('position')
    if (err) { setError(err.message); setLoading(false); return }
    const filled = autoFill ? await autoFillPages(data ?? [], tables, defaultTitle) : (data ?? [])
    const today = toDateString(new Date())
    const upcomingIdx = filled.findIndex(p => p.week_date >= today)
    setPages(filled)
    setViewIndex(upcomingIdx === -1 ? Math.max(0, filled.length - 1) : upcomingIdx)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
  const canGoNextRef = useRef(canGoNext)
  const canGoPrevRef = useRef(canGoPrev)
  useEffect(() => { canGoNextRef.current = canGoNext }, [canGoNext])
  useEffect(() => { canGoPrevRef.current = canGoPrev }, [canGoPrev])

  const swipeTouchXRef = useRef(null)
  const swipeTouchYRef = useRef(null)

  function handleSwipeTouchStart(e) {
    swipeTouchXRef.current = e.touches[0].clientX
    swipeTouchYRef.current = e.touches[0].clientY
  }

  function handleSwipeTouchEnd(e) {
    if (swipeTouchXRef.current === null) return
    const dx = e.changedTouches[0].clientX - swipeTouchXRef.current
    const dy = e.changedTouches[0].clientY - swipeTouchYRef.current
    swipeTouchXRef.current = null
    swipeTouchYRef.current = null
    if (Math.abs(dy) > Math.abs(dx) * 0.8 || Math.abs(dx) < 55) return
    if (dx < 0 && canGoNextRef.current) {
      setViewIndex(i => i + 1)
      window.scrollTo({ top: 0, behavior: 'instant' })
      haptic()
    } else if (dx > 0 && canGoPrevRef.current) {
      setViewIndex(i => i - 1)
      window.scrollTo({ top: 0, behavior: 'instant' })
      haptic()
    }
  }

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
          <p className="text-red-600 font-medium mb-2">Failed to load</p>
          <p className="text-stone-500 text-sm">{error}</p>
          <button
            onClick={load}
            className="mt-4 px-4 py-2 bg-jade hover:bg-jade-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className={`max-w-3xl mx-auto px-4 ${compact ? 'pt-2' : 'pt-8'} pb-2 flex items-center justify-between`}>
        <button
          onClick={() => {
            const today = toDateString(new Date())
            const idx = pages.findIndex(p => p.week_date >= today)
            setViewIndex(idx === -1 ? pages.length - 1 : idx)
            window.scrollTo({ top: 0, behavior: 'instant' })
          }}
          className="flex items-center gap-3 active:opacity-60 transition-opacity"
        >
          <Icon size={32} weight="fill" className="text-jade shrink-0" />
          <h1 className="text-3xl font-bold text-stone-800">{label}</h1>
        </button>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowPages(true)}
            className="flex items-center gap-2 px-2 py-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors"
          >
            <ListBullets size={20} weight="regular" />
          </button>
        </div>
      </div>

      <div className="pt-2" onTouchStart={handleSwipeTouchStart} onTouchEnd={handleSwipeTouchEnd}>
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
            onPrevPage={() => { setViewIndex(i => i - 1); window.scrollTo({ top: 0, behavior: 'instant' }); haptic() }}
            onNextPage={() => { setViewIndex(i => i + 1); window.scrollTo({ top: 0, behavior: 'instant' }); haptic() }}
            onPageUpdate={p => setPages(prev => prev.map(x => x.id === p.id ? p : x))}
            onPageDelete={handlePageDeleted}
            editOpen={showEditPage}
            onEditClose={() => setShowEditPage(false)}
            isAdmin={isAdmin}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-20 text-center">
            <div className="flex justify-center mb-4"><Icon size={56} weight="fill" className="text-stone-300" /></div>
            <h2 className="text-xl font-semibold text-stone-700 mb-2">No {pageNounPlural.toLowerCase()} yet</h2>
            <p className="text-stone-500 text-sm mb-2">Add your first {pageNoun.toLowerCase()} to get started.</p>
            {autoFill && (
              <p className="text-stone-400 text-xs mb-6 max-w-xs mx-auto">
                Once you have {pageNounPlural.toLowerCase()}, new {pageNounPlural.toLowerCase()} are automatically scheduled each week using your existing {pageNounPlural.toLowerCase()} as a rotating template — so upcoming weeks are always ready.
              </p>
            )}
            {!autoFill && <div className="mb-6" />}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-jade hover:bg-jade-700 text-white font-medium rounded-lg transition-colors"
            >
              + Add First {pageNoun}
            </button>
          </div>
        )}
      </div>

      {showPages && (
        <PagesModal
          editLabel={editLabel}
          pageNounPlural={pageNounPlural}
          onEditPage={viewedPage ? () => { setShowPages(false); setShowEditPage(true) } : undefined}
          onManagePages={() => { setShowPages(false); setShowManagePages(true) }}
          onClose={() => setShowPages(false)}
        />
      )}

      {showManagePages && (
        <ManagePagesModal
          pages={pages}
          pageNoun={pageNoun}
          pageNounPlural={pageNounPlural}
          onReorder={handleReorderPages}
          onAddPage={() => { setShowManagePages(false); setShowAddModal(true) }}
          onClose={() => setShowManagePages(false)}
        />
      )}

      {showAddModal && (
        <AddPageModal
          noun={noun}
          pageNoun={pageNoun}
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
