import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import { ListBullets } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { patchTitleDate, toDateString, mealCutoffDate } from '../utils/dates.js'
import { nextScheduledDate } from '../utils/schedule.js'
import { haptic } from '../lib/haptic.js'
import MealPage from './MealPage.jsx'
import AddPageModal from './AddPageModal.jsx'
import ManagePagesModal from './ManagePagesModal.jsx'

const FUTURE_BUFFER = 2  // always keep at least this many pages with dates after today
const AUTO_FILL_LIMIT = 10 // safety cap per load

async function autoFillPages(existingPages, tables, defaultTitle, intervalDays = 7, targetDow = null, weekOccurrences = null) {
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

    const hasDow = targetDow != null && (!Array.isArray(targetDow) || targetDow.length > 0)
    let nextDate
    if (weekOccurrences && weekOccurrences.length > 0 && hasDow) {
      nextDate = nextScheduledDate(lastDate, targetDow, weekOccurrences)
      if (!nextDate) break
    } else {
      nextDate = new Date(lastDate)
      nextDate.setDate(nextDate.getDate() + intervalDays)
      if (hasDow) {
        const dows = Array.isArray(targetDow) ? targetDow : [targetDow]
        const diff = dows.reduce((best, t) => {
          const gap = (t - nextDate.getDay() + 7) % 7
          return gap < best ? gap : best
        }, 7)
        nextDate.setDate(nextDate.getDate() + diff)
      }
    }
    const nextDateStr = toDateString(nextDate)

    const template = pool[k % pool.length]

    const { data: newPage, error } = await supabase
      .from(tables.pages)
      .insert({
        title: defaultTitle(nextDateStr),
        week_date: nextDateStr,
        slot_count: template.slot_count,
        slot_dishes: template.slot_dishes ?? [],
        ...(Array.isArray(template.slot_categories) && { slot_categories: template.slot_categories }),
        ...(template.slot_columns && template.slot_columns !== 1 && { slot_columns: template.slot_columns }),
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

const RotationTab = forwardRef(function RotationTab({ config, revealKey, groupName = '', displayName = '', onOpenSettings, isAdmin = false, compact = false, cutoffDate }, ref) {
  const { label, Icon, editLabel, editSubLabel, noun, itemNoun, pageNoun, pageNounPlural, tables, defaultTitle, supportsCategories = false, autoFill = false, intervalDays = 7, targetDow = null, weekOccurrences = null } = config
  const effectiveCutoff = cutoffDate ?? toDateString(new Date())

  const [pages, setPages]       = useState([])
  const [viewIndex, setViewIndex] = useState(0)
  const [homeIdx, setHomeIdx]   = useState(0)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [showAddModal, setShowAddModal]       = useState(false)
  const [showManagePages, setShowManagePages] = useState(false)
  const [showEditPage, setShowEditPage]       = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase.from(tables.pages).select('*').order('position')
    if (err) { setError(err.message); setLoading(false); return }
    const filled = autoFill ? await autoFillPages(data ?? [], tables, defaultTitle, intervalDays, targetDow, weekOccurrences) : (data ?? [])

    // Pages must always be in date order. Heal any drift (e.g. a page added out-of-order).
    const sorted = [...filled].sort((a, b) => a.week_date.localeCompare(b.week_date))
    const outOfOrder = sorted.some((p, i) => p.position !== i)
    if (outOfOrder) {
      await Promise.all(
        sorted.map((p, i) => p.position !== i
          ? supabase.from(tables.pages).update({ position: i }).eq('id', p.id)
          : null
        ).filter(Boolean)
      )
      sorted.forEach((p, i) => { p.position = i })
    }

    const upcomingIdx = sorted.findIndex(p => p.week_date >= effectiveCutoff)
    const resolvedIdx = upcomingIdx === -1 ? Math.max(0, sorted.length - 1) : upcomingIdx
    setPages(sorted)
    setViewIndex(resolvedIdx)
    setHomeIdx(resolvedIdx)
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

    const sorted = [...pages, newPage].sort((a, b) => a.week_date.localeCompare(b.week_date))
    const newIndex = sorted.findIndex(p => p.id === newPage.id)

    if (newIndex < sorted.length - 1) {
      // New page landed in the middle — update positions so they match date order
      await Promise.all(
        sorted.map((p, i) => {
          const origPos = p.id === newPage.id ? pages.length : pages.find(x => x.id === p.id)?.position
          return origPos !== i ? supabase.from(tables.pages).update({ position: i }).eq('id', p.id) : null
        }).filter(Boolean)
      )
    }

    setPages(sorted.map((p, i) => ({ ...p, position: i })))
    setViewIndex(newIndex)
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

  useImperativeHandle(ref, () => ({
    jumpToToday() {
      const idx = pages.findIndex(p => p.week_date >= effectiveCutoff)
      setViewIndex(idx === -1 ? pages.length - 1 : idx)
      window.scrollTo({ top: 0, behavior: 'instant' })
    },
    openManagePages() { setShowManagePages(true) },
  }))

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 pb-12">
        {!compact && (
          <div className="pt-8 pb-4 flex items-center justify-between">
            <div className="h-9 w-24 bg-stone-200 rounded-lg animate-pulse" />
            <div className="w-11 h-11 rounded-xl bg-stone-100 animate-pulse" />
          </div>
        )}
        <div className="pt-2 space-y-3">
          <div className="bg-white rounded-2xl shadow border border-stone-100 p-4 mb-3 animate-pulse">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-xl bg-stone-200 shrink-0" />
              <div className="flex-1 pt-1 space-y-2">
                <div className="h-5 bg-stone-200 rounded w-2/5" />
                <div className="h-3.5 bg-stone-100 rounded w-1/4" />
              </div>
            </div>
          </div>
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="bg-white border-2 border-stone-200 rounded-xl p-4 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="h-4 bg-stone-200 rounded w-1/2 mb-2.5" />
              <div className="h-5 bg-stone-100 rounded-full w-20" />
            </div>
          ))}
        </div>
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
            className="mt-4 px-4 py-2 bg-ember hover:bg-ember-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      {!compact && (
        <div className="max-w-3xl mx-auto px-4 pt-8 pb-2 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-stone-800">{label}</h1>
          <button
            onClick={() => setShowManagePages(true)}
            aria-label="Manage pages"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-ember transition-colors"
          >
            <ListBullets size={20} weight="regular" />
          </button>
        </div>
      )}

      {viewIndex !== homeIdx && pages.length > 1 && (
        <div className="max-w-3xl mx-auto px-4 pt-1 pb-1">
          <button
            onClick={() => { setViewIndex(homeIdx); window.scrollTo({ top: 0, behavior: 'instant' }); haptic() }}
            className="w-full py-2.5 rounded-xl bg-ember/8 border border-ember/20 text-ember text-sm font-semibold transition-colors hover:bg-ember/15 active:bg-ember/20"
          >
            ← Back to this week
          </button>
        </div>
      )}

      <div className="pt-2" onTouchStart={handleSwipeTouchStart} onTouchEnd={handleSwipeTouchEnd}>
        {viewedPage ? (
          <MealPage
            page={viewedPage}
            noun={noun}
            itemNoun={itemNoun}
            pageNoun={pageNoun}
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
            onEditOpen={() => setShowEditPage(true)}
            isAdmin={isAdmin}
            supportsCategories={supportsCategories}
            Icon={Icon}
          />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-20 text-center">
            <div className="flex justify-center mb-4"><Icon size={56} weight="fill" className="text-stone-300" /></div>
            <h2 className="text-xl font-semibold text-stone-700 mb-2">No {pageNounPlural.toLowerCase()} yet</h2>
            <p className="text-stone-500 text-sm mb-2">Add your first {pageNoun.toLowerCase()} to get started.</p>
            {autoFill && (
              <p className="text-stone-400 text-xs mb-6 max-w-xs mx-auto">
                Once you have {pageNounPlural.toLowerCase()}, new {pageNounPlural.toLowerCase()} are automatically scheduled {intervalDays >= 28 ? 'each month' : weekOccurrences && weekOccurrences.length <= 2 ? 'biweekly' : 'each week'} using your existing {pageNounPlural.toLowerCase()} as a rotating template — so upcoming dates are always ready.
              </p>
            )}
            {!autoFill && <div className="mb-6" />}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-5 py-2.5 bg-ember hover:bg-ember-700 text-white font-medium rounded-lg transition-colors"
            >
              + Add First {pageNoun}
            </button>
          </div>
        )}
      </div>

      {showManagePages && (
        <ManagePagesModal
          pages={pages}
          pageNoun={pageNoun}
          pageNounPlural={pageNounPlural}
          onReorder={handleReorderPages}
          onAddPage={() => { setShowManagePages(false); setShowAddModal(true) }}
          onDeletePage={async (pageId) => {
            const { error } = await supabase.from(tables.pages).delete().eq('id', pageId)
            if (error) throw new Error(error.message)
            handlePageDeleted(pageId)
          }}
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
          targetDow={targetDow}
          intervalDays={intervalDays}
          weekOccurrences={weekOccurrences}
        />
      )}
    </>
  )
})

export default RotationTab
