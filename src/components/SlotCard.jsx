import { useEffect, useRef, useState } from 'react'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'

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

  return (
    <button
      onClick={onClick}
      style={entranceStyle}
      className={`group text-left w-full p-4 rounded-xl border-2 shadow transition-all duration-150 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ember ${
        filled
          ? 'bg-ember/10 border-ember/25 hover:border-ember/40'
          : 'bg-white border-stone-200 hover:border-ember'
      } ${entranceClass} ${pulse ? 'animate-card-pulse' : ''}`}
    >
      {dishName ? (
        <div className="font-semibold text-stone-800 truncate mb-1">{dishName}</div>
      ) : (
        <div className="text-sm text-stone-400 italic mb-1">Add a new {itemNoun.toLowerCase()}</div>
      )}

      {filled ? (
        <>
          <div className="text-sm text-ember font-medium truncate">→ {signup.name}</div>
          {signup.notes && (
            <div className="text-xs text-stone-500 mt-1.5 line-clamp-1 italic">{signup.notes}</div>
          )}
        </>
      ) : (
        <span className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border border-ember/40 text-ember bg-white group-hover:bg-ember group-hover:text-white group-hover:border-ember transition-all">
          + Sign up
        </span>
      )}
    </button>
  )
}
