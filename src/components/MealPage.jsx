import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { formatDate } from '../utils/dates.js'
import SlotCard from './SlotCard.jsx'
import SignupModal from './SignupModal.jsx'
import EditDishesModal from './EditDishesModal.jsx'

export default function MealPage({ page, noun, itemNoun, editLabel, tables, onPageUpdate, onPageDelete }) {
  const [signups, setSignups]           = useState([])
  const [loading, setLoading]           = useState(true)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [showEditDishes, setShowEditDishes] = useState(false)

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

  async function handleSave(slotNumber, { dish, ...signupData }) {
    const currentDish = page.slot_dishes?.[slotNumber - 1] ?? ''
    if (dish !== currentDish) {
      const newDishes = [...(page.slot_dishes ?? [])]
      while (newDishes.length < slotNumber) newDishes.push('')
      newDishes[slotNumber - 1] = dish
      const { data: updatedPage, error: dishErr } = await supabase
        .from(tables.pages)
        .update({ slot_dishes: newDishes })
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
    setSelectedSlot(null)
  }

  async function handleRemove(slotNumber) {
    const existing = signups.find(s => s.slot_number === slotNumber)
    if (!existing) return
    const { error } = await supabase.from(tables.signups).delete().eq('id', existing.id)
    if (error) throw new Error(error.message)
    setSignups(s => s.filter(r => r.id !== existing.id))
    setSelectedSlot(null)
  }

  async function handleSaveDishes({ newTitle, newDate, newDishes, removedOrigSlots, renames }) {
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
      .update({ title: newTitle, week_date: newDate, slot_count: newDishes.length, slot_dishes: newDishes })
      .eq('id', page.id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    onPageUpdate(data)
    setShowEditDishes(false)
  }

  const slots = Array.from({ length: page.slot_count }, (_, i) => i + 1)
  const filledCount = signups.length
  const selectedDishName = selectedSlot != null ? (page.slot_dishes?.[selectedSlot - 1] ?? '') : ''

  return (
    <main className="max-w-3xl mx-auto px-4 pb-12">
      <div className="mb-6 relative overflow-hidden bg-white rounded-xl shadow-sm border border-stone-100 p-4 flex items-start justify-between gap-4">
        <span className="absolute top-0 left-0 right-0 h-1 bg-coral" />
        <div>
          <h1 className="text-2xl font-bold text-stone-800">{page.title}</h1>
          <p className="text-stone-500 mt-1">{formatDate(page.week_date)}</p>
          <p className="text-sm text-stone-400 mt-0.5">
            {filledCount} / {page.slot_count} {noun.toLowerCase()}s filled
          </p>
        </div>
        <button
          onClick={() => setShowEditDishes(true)}
          className="shrink-0 mt-1 flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-300 rounded-lg hover:bg-stone-50 transition-colors"
        >
          ✎ {editLabel}
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {slots.map(n => (
            <div key={n} className="h-24 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {slots.map(n => (
            <SlotCard
              key={n}
              slotNumber={n}
              noun={noun}
              itemNoun={itemNoun}
              dishName={page.slot_dishes?.[n - 1] ?? ''}
              signup={signups.find(s => s.slot_number === n)}
              onClick={() => setSelectedSlot(n)}
            />
          ))}
        </div>
      )}

      {selectedSlot !== null && (
        <SignupModal
          slot={selectedSlot}
          itemNoun={itemNoun}
          dishName={selectedDishName}
          signup={signups.find(s => s.slot_number === selectedSlot)}
          onClose={() => setSelectedSlot(null)}
          onSave={data => handleSave(selectedSlot, data)}
          onRemove={() => handleRemove(selectedSlot)}
        />
      )}

      {showEditDishes && (
        <EditDishesModal
          page={page}
          noun={noun}
          signups={signups}
          onClose={() => setShowEditDishes(false)}
          onSave={handleSaveDishes}
          onDelete={async () => {
            const { error } = await supabase.from(tables.pages).delete().eq('id', page.id)
            if (error) throw new Error(error.message)
            setShowEditDishes(false)
            onPageDelete(page.id)
          }}
        />
      )}
    </main>
  )
}
