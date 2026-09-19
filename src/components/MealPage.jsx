import { useState, useEffect } from 'react'
import { Plus, PauseCircle, PlayCircle, PencilSimple, MapPin, DotsThreeVertical, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { trackEvent } from '../lib/analytics.js'
import { formatDate } from '../utils/dates.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import SlotCard from './SlotCard.jsx'
import SignupModal from './SignupModal.jsx'
import EditDishesModal from './EditDishesModal.jsx'

const CATEGORY_ORDER  = ['Main', 'Side', 'Dessert']
const CATEGORY_LABELS = { Main: 'Main Dish', Side: 'Side', Dessert: 'Dessert' }
const CATEGORY_COLORS = { Main: 'text-coral-600', Side: 'text-lagoon-600', Dessert: 'text-amber-600' }

export default function MealPage({ page, noun, itemNoun, pageNoun, editLabel, tables, revealKey, pageCount, canGoPrev, canGoNext, onPrevPage, onNextPage, onPageUpdate, onPageDelete, editOpen, onEditClose, onEditOpen, isAdmin = false, supportsCategories = false, Icon = null }) {
  const [signups, setSignups]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [justAddedSlot, setJustAddedSlot] = useState(null)
  const [pausing, setPausing]           = useState(false)
  const [menuOpen, setMenuOpen]         = useState(false)
  const [menuClosing, setMenuClosing]   = useState(false)

  function closeMenu() {
    setMenuClosing(true)
    setTimeout(() => { setMenuOpen(false); setMenuClosing(false) }, 250)
  }
  const { className: headerEntranceClass } = useEntranceAnimation(`${revealKey}-${page?.id}`, 0, { direction: 'left' })

  useEffect(() => {
    if (!page) return
    setLoading(true)

    supabase
      .from(tables.signups)
      .select('*')
      .eq('meal_page_id', page.id)
      .then(({ data }) => {
        setSignups(data ?? [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`${tables.signups}:${page.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tables.signups, filter: `meal_page_id=eq.${page.id}` },
        ({ eventType, new: next, old: prev }) => {
          if (eventType === 'INSERT') {
            setSignups(s => [...s.filter(r => r.slot_number !== next.slot_number), next])
          } else if (eventType === 'UPDATE') {
            setSignups(s => s.map(r => r.id === next.id ? next : r))
          } else if (eventType === 'DELETE') {
            setSignups(s => s.filter(r => r.id !== prev.id))
          }
        },
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [page?.id])

  async function handleSave(slotNumber, { dish, category, ...signupData }) {
    const currentDish     = page.slot_dishes?.[slotNumber - 1] ?? ''
    const currentCategory = page.slot_categories?.[slotNumber - 1] ?? ''
    if (dish !== currentDish || category !== currentCategory) {
      const newDishes = [...(page.slot_dishes ?? [])]
      while (newDishes.length < slotNumber) newDishes.push('')
      newDishes[slotNumber - 1] = dish

      const newCategories = [...(page.slot_categories ?? [])]
      while (newCategories.length < slotNumber) newCategories.push('')
      newCategories[slotNumber - 1] = category

      const { data: updatedPage, error: dishErr } = await supabase
        .from(tables.pages)
        .update({ slot_dishes: newDishes, ...(supportsCategories && { slot_categories: newCategories }) })
        .eq('id', page.id)
        .select()
        .single()
      if (dishErr) throw new Error(dishErr.message)
      onPageUpdate(updatedPage)
    }

    const existing = signups.find(s => s.slot_number === slotNumber)
    if (existing) {
      // Editing an existing signup — always update (name may change, notes may change)
      const { error } = await supabase
        .from(tables.signups)
        .update({ ...signupData, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
      trackEvent('schedule_signup', { page_type: pageNoun.toLowerCase() })
    } else if (signupData.name) {
      // New signup — only insert if a name was provided
      const { error } = await supabase
        .from(tables.signups)
        .insert({ meal_page_id: page.id, slot_number: slotNumber, ...signupData })
      if (error) {
        if (error.code === '23505') throw new Error(`That ${noun.toLowerCase()} was just taken — try another!`)
        throw new Error(error.message)
      }
      trackEvent('schedule_signup', { page_type: pageNoun.toLowerCase() })
    }
    setSelectedSlot(null)
  }

  async function handleRemove(slotNumber) {
    const existing = signups.find(s => s.slot_number === slotNumber)
    if (!existing) return
    const { error } = await supabase.from(tables.signups).delete().eq('id', existing.id)
    if (error) throw new Error(error.message)
    trackEvent('schedule_cancel', { page_type: pageNoun.toLowerCase() })
    setSignups(s => s.filter(r => r.id !== existing.id))
    setSelectedSlot(null)
  }

  async function handleDeleteItem(slotNumber) {
    const { error: delErr } = await supabase
      .from(tables.signups)
      .delete()
      .eq('meal_page_id', page.id)
      .eq('slot_number', slotNumber)
    if (delErr) throw new Error(delErr.message)

    const toShift = signups
      .filter(s => s.slot_number > slotNumber)
      .sort((a, b) => a.slot_number - b.slot_number)
    for (const s of toShift) {
      const { error } = await supabase
        .from(tables.signups)
        .update({ slot_number: s.slot_number - 1 })
        .eq('id', s.id)
      if (error) throw new Error(error.message)
    }

    const newDishes     = (page.slot_dishes ?? []).filter((_, i) => i !== slotNumber - 1)
    const newCategories = (page.slot_categories ?? []).filter((_, i) => i !== slotNumber - 1)
    const { data, error } = await supabase
      .from(tables.pages)
      .update({ slot_count: page.slot_count - 1, slot_dishes: newDishes, ...(supportsCategories && { slot_categories: newCategories }) })
      .eq('id', page.id)
      .select()
      .single()
    if (error) throw new Error(error.message)

    onPageUpdate(data)
    setSignups(s =>
      s
        .filter(r => r.slot_number !== slotNumber)
        .map(r => (r.slot_number > slotNumber ? { ...r, slot_number: r.slot_number - 1 } : r))
    )
    setSelectedSlot(null)
  }

  async function handleAddSlot() {
    const newSlotNumber = page.slot_count + 1
    const newDishes     = [...(page.slot_dishes ?? []), '']
    const newCategories = [...(page.slot_categories ?? []), '']
    const { data, error } = await supabase
      .from(tables.pages)
      .update({ slot_count: newSlotNumber, slot_dishes: newDishes, ...(supportsCategories && { slot_categories: newCategories }) })
      .eq('id', page.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    setJustAddedSlot(newSlotNumber)
    onPageUpdate(data)
  }

  async function handleSaveDishes({ newTitle, newDate, newLocation, newDishes, newCategories, newColumns, removedOrigSlots, renames }) {
    if (removedOrigSlots.length > 0) {
      const { error } = await supabase
        .from(tables.signups)
        .delete()
        .eq('meal_page_id', page.id)
        .in('slot_number', removedOrigSlots)
      if (error) throw new Error(error.message)
    }

    for (const { from, to } of renames) {
      const { error } = await supabase
        .from(tables.signups)
        .update({ slot_number: to })
        .eq('meal_page_id', page.id)
        .eq('slot_number', from)
      if (error) throw new Error(error.message)
    }

    const { data, error } = await supabase
      .from(tables.pages)
      .update({ title: newTitle, week_date: newDate, location: newLocation, slot_count: newDishes.length, slot_dishes: newDishes, slot_columns: newColumns ?? 1, ...(supportsCategories && { slot_categories: newCategories }) })
      .eq('id', page.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    onPageUpdate(data)
    // EditDishesModal animates itself out on success and calls onClose → onEditClose
  }

  async function handleTogglePause() {
    setPausing(true)
    const { error } = await supabase.rpc(tables.pauseRpc, { p_page_id: page.id })
    if (!error) onPageUpdate({ ...page, is_paused: !page.is_paused })
    setPausing(false)
  }

  const slots = Array.from({ length: page.slot_count }, (_, i) => i + 1)
  const selectedDishName     = selectedSlot != null ? (page.slot_dishes?.[selectedSlot - 1] ?? '')     : ''
  const selectedCategory     = selectedSlot != null ? (page.slot_categories?.[selectedSlot - 1] ?? '') : ''

  // Build category groups — only show headers if at least one slot has a category
  // 'Other' and uncategorized ('') are merged into the same trailing bucket
  const hasAnyCategory = slots.some(n => page.slot_categories?.[n - 1])
  const groups = {}
  slots.forEach(n => {
    const rawCat = page.slot_categories?.[n - 1] || ''
    const cat = rawCat === 'Other' ? '' : rawCat
    ;(groups[cat] ??= []).push(n)
  })
  const orderedGroups = hasAnyCategory
    ? [...CATEGORY_ORDER.filter(c => groups[c]), ...(groups[''] ? [''] : [])]
    : ['']

  const isMeal = noun === 'Meal'
  const headerShortDate = (() => {
    const [y, m, d] = (page.week_date ?? '').split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  })()

  return (
    <main className="max-w-3xl mx-auto px-4" style={{ paddingBottom: 'max(80px, calc(var(--sab) + 72px))' }}>
      <div className={`mb-6 bg-white rounded-2xl shadow border border-stone-100 ${headerEntranceClass}`}>
        <div className="p-4 flex items-start gap-4">
          {Icon && (
            <div className={`shrink-0 w-14 h-14 rounded-xl flex items-center justify-center ${isMeal ? 'bg-amber-50' : 'bg-ember/10'}`}>
              <Icon size={28} weight="duotone" className={isMeal ? 'text-amber-500' : 'text-ember'} />
            </div>
          )}
          <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-stone-800 leading-snug truncate">{page.title}</h1>
              <p className="text-stone-500 text-sm mt-0.5">{headerShortDate}</p>
              {page.location && (
                <p className="flex items-center gap-1 text-xs text-stone-400 mt-0.5">
                  <MapPin size={11} weight="fill" className="text-ember shrink-0" />
                  {page.location}
                </p>
              )}
              {page.is_paused && (
                <p className="text-xs text-amber-500 font-medium mt-0.5">No meal signup this week</p>
              )}
            </div>
            {(isAdmin || pageCount > 1) && (
              <div className="shrink-0">
                <button
                  onClick={() => setMenuOpen(true)}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
                  aria-label="More options"
                >
                  <DotsThreeVertical size={18} weight="bold" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {page.is_paused ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PauseCircle size={48} weight="fill" className="text-amber-300 mb-3" />
          <p className="text-lg font-semibold text-stone-700">No meal signup this week</p>
          <p className="text-sm text-stone-400 mt-1">
            {formatDate(page.week_date)}
          </p>
        </div>
      ) : loading ? (
        <div className={`grid ${page.slot_columns === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} gap-3`}>
          {slots.map(n => (
            <div key={n} className="h-24 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {orderedGroups.map(cat => {
            const groupSlots  = groups[cat] ?? []
            const groupFilled = groupSlots.filter(n => signups.some(s => s.slot_number === n)).length
            const groupTotal  = groupSlots.length
            const label       = cat ? (CATEGORY_LABELS[cat] ?? cat) : 'Other'
            return (
            <div key={cat} className="mb-4">
              {hasAnyCategory && groupSlots.length > 0 && (
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${CATEGORY_COLORS[cat] ?? 'text-stone-500'}`}>
                  {label}
                  <span className="text-stone-400 font-medium normal-case tracking-normal ml-1.5">· {groupFilled}/{groupTotal}</span>
                </p>
              )}
              <div className={`grid ${page.slot_columns === 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'} gap-3`}>
                {(groups[cat] ?? []).map(n => (
                  <SlotCard
                    key={`${page.id}-${n}`}
                    slotNumber={n}
                    noun={noun}
                    itemNoun={itemNoun}
                    dishName={page.slot_dishes?.[n - 1] ?? ''}
                    category={page.slot_categories?.[n - 1] ?? ''}
                    signup={signups.find(s => s.slot_number === n)}
                    revealKey={`${revealKey}-${page.id}`}
                    isNew={n === justAddedSlot}
                    onClick={() => setSelectedSlot(n)}
                  />
                ))}
              </div>
            </div>
            )}
          )}
          <button
            onClick={handleAddSlot}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-ember hover:bg-ember-700 active:bg-ember-800 text-white transition-colors"
          >
            <Plus size={16} weight="bold" />
            <span className="text-sm font-medium">Add {noun}</span>
          </button>
        </>
      )}

      {selectedSlot !== null && (
        <SignupModal
          slot={selectedSlot}
          itemNoun={itemNoun}
          dishName={selectedDishName}
          category={selectedCategory}
          signup={signups.find(s => s.slot_number === selectedSlot)}
          onClose={() => setSelectedSlot(null)}
          onSave={data => handleSave(selectedSlot, data)}
          onRemove={() => handleRemove(selectedSlot)}
          onDeleteItem={() => handleDeleteItem(selectedSlot)}
          supportsCategories={supportsCategories}
        />
      )}

      {editOpen && (
        <EditDishesModal
          page={page}
          noun={noun}
          pageNoun={pageNoun}
          signups={signups}
          onClose={onEditClose}
          onSave={handleSaveDishes}
          supportsCategories={supportsCategories}
          onDelete={async () => {
            const { error } = await supabase.from(tables.pages).delete().eq('id', page.id)
            if (error) throw new Error(error.message)
            onEditClose()
            onPageDelete(page.id)
          }}
        />
      )}

      {(menuOpen || menuClosing) && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-end lg:items-center lg:justify-center z-50 ${menuClosing ? 'animate-backdrop-out' : 'animate-overlay-in'}`}
          onClick={closeMenu}
        >
          <div
            className={`bg-white rounded-t-2xl lg:rounded-2xl w-full max-w-sm mx-auto shadow-xl ${menuClosing ? 'animate-sheet-out' : 'animate-modal-in'}`}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mt-3 mb-2" />
            <div className="px-4 pb-4 space-y-1">
              {isAdmin && (
                <>
                  <button
                    onClick={() => { closeMenu(); setTimeout(onEditOpen, 260) }}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors"
                  >
                    <PencilSimple size={20} className="text-stone-500 shrink-0" />
                    <span className="text-base font-medium">Edit {pageNoun}</span>
                  </button>
                  <button
                    onClick={() => { closeMenu(); setTimeout(handleTogglePause, 260) }}
                    disabled={pausing}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl hover:bg-stone-50 active:bg-stone-100 transition-colors disabled:opacity-40"
                  >
                    {page.is_paused
                      ? <><PlayCircle size={20} weight="fill" className="text-ember shrink-0" /><span className="text-base font-medium text-ember">Resume</span></>
                      : <><PauseCircle size={20} weight="fill" className="text-amber-500 shrink-0" /><span className="text-base font-medium text-amber-600">Pause this week</span></>
                    }
                  </button>
                </>
              )}
              {isAdmin && pageCount > 1 && <div className="h-px bg-stone-100 mx-1 my-1" />}
              {pageCount > 1 && (
                <>
                  <button
                    onClick={() => { closeMenu(); setTimeout(onPrevPage, 260) }}
                    disabled={!canGoPrev}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors disabled:opacity-30"
                  >
                    <CaretLeft size={20} className="text-stone-500 shrink-0" />
                    <span className="text-base font-medium">Previous {pageNoun}</span>
                  </button>
                  <button
                    onClick={() => { closeMenu(); setTimeout(onNextPage, 260) }}
                    disabled={!canGoNext}
                    className="flex items-center gap-3 w-full px-4 py-3.5 rounded-xl text-stone-700 hover:bg-stone-50 active:bg-stone-100 transition-colors disabled:opacity-30"
                  >
                    <CaretRight size={20} className="text-stone-500 shrink-0" />
                    <span className="text-base font-medium">Next {pageNoun}</span>
                  </button>
                </>
              )}
              <div className="h-px bg-stone-100 mx-1 my-1" />
              <button
                onClick={closeMenu}
                className="flex items-center justify-center w-full px-4 py-3.5 rounded-xl text-stone-500 hover:bg-stone-50 active:bg-stone-100 transition-colors"
              >
                <span className="text-base font-medium">Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
