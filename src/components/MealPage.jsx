import { useState, useEffect } from 'react'
import { Plus, PauseCircle, PlayCircle, PencilSimple } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { trackEvent } from '../lib/analytics.js'
import { formatDate } from '../utils/dates.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import SlotCard from './SlotCard.jsx'
import SignupModal from './SignupModal.jsx'
import EditDishesModal from './EditDishesModal.jsx'

const CATEGORY_ORDER  = ['Main', 'Side', 'Dessert']
const CATEGORY_LABELS = { Main: 'Main Dish', Side: 'Side', Dessert: 'Dessert' }
const CATEGORY_COLORS = { Main: 'text-coral-600', Side: 'text-lagoon-600', Dessert: 'text-amber-500' }

export default function MealPage({ page, noun, itemNoun, pageNoun, editLabel, tables, revealKey, pageCount, canGoPrev, canGoNext, onPrevPage, onNextPage, onPageUpdate, onPageDelete, editOpen, onEditClose, onEditOpen, isAdmin = false, supportsCategories = false }) {
  const [signups, setSignups]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [justAddedSlot, setJustAddedSlot] = useState(null)
  const [pausing, setPausing]           = useState(false)
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
      const { error } = await supabase
        .from(tables.signups)
        .update({ ...signupData, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
      if (error) throw new Error(error.message)
    } else {
      const { error } = await supabase
        .from(tables.signups)
        .insert({ meal_page_id: page.id, slot_number: slotNumber, ...signupData })
      if (error) {
        if (error.code === '23505') throw new Error(`That ${noun.toLowerCase()} was just taken — try another!`)
        throw new Error(error.message)
      }
    }
    trackEvent('schedule_signup', { page_type: pageNoun.toLowerCase() })
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

  async function handleSaveDishes({ newTitle, newDate, newDishes, newCategories, removedOrigSlots, renames }) {
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
      .update({ title: newTitle, week_date: newDate, slot_count: newDishes.length, slot_dishes: newDishes, ...(supportsCategories && { slot_categories: newCategories }) })
      .eq('id', page.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    onPageUpdate(data)
    onEditClose()
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

  return (
    <main className="max-w-3xl lg:max-w-5xl mx-auto px-4 pb-12">
      <div className={`mb-6 relative overflow-hidden bg-white rounded-xl shadow-sm border border-stone-100 ${headerEntranceClass}`}>
        <span className="absolute top-0 left-0 right-0 h-1 bg-coral" />

        <div className="p-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-stone-800">{page.title}</h1>
            <p className="text-stone-500 mt-1">{formatDate(page.week_date)}</p>
            {page.is_paused && (
              <p className="text-sm text-amber-500 font-medium mt-0.5">No meal signup this week</p>
            )}
          </div>
          {(isAdmin || pageCount > 1) && (
            <div className="shrink-0 flex flex-col items-end gap-2">
              {isAdmin && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={onEditOpen}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-stone-200 text-stone-500 hover:border-jade hover:text-jade hover:bg-jade/5"
                  >
                    <PencilSimple size={13} weight="bold" /> Edit
                  </button>
                  <button
                    onClick={handleTogglePause}
                    disabled={pausing}
                    title={page.is_paused ? 'Resume signup' : 'Pause signup'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 border border-stone-200 text-stone-500 hover:border-amber-300 hover:text-amber-500 hover:bg-amber-50"
                  >
                    {page.is_paused
                      ? <><PlayCircle size={14} weight="fill" /> Resume</>
                      : <><PauseCircle size={14} weight="fill" /> Pause</>
                    }
                  </button>
                </div>
              )}
              {pageCount > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={e => { e.currentTarget.blur(); onPrevPage(); }}
                    disabled={!canGoPrev}
                    className="w-7 h-7 flex items-center justify-center rounded-full border-2 border-stone-200 text-stone-500 hover:border-jade hover:text-jade disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
                  >‹</button>
                  <button
                    onClick={e => { e.currentTarget.blur(); onNextPage(); }}
                    disabled={!canGoNext}
                    className="w-7 h-7 flex items-center justify-center rounded-full border-2 border-stone-200 text-stone-500 hover:border-jade hover:text-jade disabled:opacity-30 disabled:cursor-not-allowed transition-colors touch-manipulation"
                  >›</button>
                </div>
              )}
            </div>
          )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {slots.map(n => (
            <div key={n} className="h-24 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {orderedGroups.map(cat => (
            <div key={cat} className="mb-4">
              {hasAnyCategory && cat && (
                <p className={`text-xs font-bold uppercase tracking-widest mb-2 px-1 ${CATEGORY_COLORS[cat] ?? 'text-stone-500'}`}>
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
              )}
              {hasAnyCategory && !cat && groups['']?.length > 0 && (
                <p className="text-xs font-bold uppercase tracking-widest text-stone-500 mb-2 px-1">Other</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
          ))}
          <button
            onClick={handleAddSlot}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-jade hover:bg-jade-700 active:bg-jade-800 text-white transition-colors"
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
          onDelete={async () => {
            const { error } = await supabase.from(tables.pages).delete().eq('id', page.id)
            if (error) throw new Error(error.message)
            onEditClose()
            onPageDelete(page.id)
          }}
        />
      )}
    </main>
  )
}
