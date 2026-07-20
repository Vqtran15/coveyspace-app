import { useEffect, useRef, useState } from 'react'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'

const CATEGORY_CHIP = {
  Main:    'bg-coral/15 text-coral-700',
  Side:    'bg-lagoon/15 text-lagoon-700',
  Dessert: 'bg-amber-50 text-amber-600',
  Other:   'bg-stone-100 text-stone-500',
}

export default function SlotCard({ slotNumber, noun, itemNoun, dishName, category, signup, revealKey, isNew = false, onClick }) {
  const filled = Boolean(signup)
  const [pulse, setPulse] = useState(false)
  const prevRef = useRef({ dishName, signupId: signup?.id, signupName: signup?.name })
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation(revealKey, isNew ? 0 : slotNumber - 1)

  useEffect(() => {
    const prev = prevRef.current
    const changed = prev.dishName !== dishName || prev.signupId !== signup?.id || prev.signupName !== signup?.name
    prevRef.current = { dishName, signupId: signup?.id, signupName: signup?.name }
    if (!changed) return
    setPulse(true)
    const t = setTimeout(() => setPulse(false), 650)
    return () => clearTimeout(t)
  }, [dishName, signup?.id, signup?.name])

  const chipStyle = category ? CATEGORY_CHIP[category] : null

  return (
    <button
      onClick={onClick}
      style={entranceStyle}
      className={`group relative overflow-hidden text-left w-full p-4 rounded-xl border-2 shadow-sm transition-all duration-150 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-jade ${
        filled
          ? 'bg-lagoon-50 border-lagoon-200 hover:border-lagoon'
          : 'bg-sunrise-50 border-stone-200 hover:border-jade'
      } ${entranceClass} ${pulse ? 'animate-card-pulse' : ''}`}
    >
      {filled && <span className="absolute left-0 top-0 h-full w-1 bg-jade" />}

      {chipStyle && (
        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold mb-1 ${chipStyle}`}>
          {category}
        </span>
      )}

      {dishName ? (
        <div className="font-semibold text-stone-800 truncate mb-1">{dishName}</div>
      ) : (
        <div className="text-sm text-stone-400 italic mb-1">Add a new {itemNoun.toLowerCase()}</div>
      )}

      {filled ? (
        <>
          <div className="text-sm text-jade font-medium truncate">→ {signup.name}</div>
          {signup.notes && (
            <div className="text-xs text-stone-400 mt-1.5 line-clamp-1 italic">{signup.notes}</div>
          )}
        </>
      ) : (
        <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-jade/40 text-jade bg-white group-hover:bg-jade group-hover:text-white group-hover:border-jade transition-all">
          + Sign up
        </span>
      )}
    </button>
  )
}
