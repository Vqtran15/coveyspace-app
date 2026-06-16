import { useEffect, useRef, useState } from 'react'

export default function SlotCard({ slotNumber, noun, itemNoun, dishName, signup, revealKey, onClick }) {
  const filled = Boolean(signup)
  const fromLeft = (slotNumber - 1) % 2 === 0
  const [pulse, setPulse] = useState(false)
  const [entering, setEntering] = useState(true)
  const prevRef = useRef({ dishName, signupId: signup?.id, signupName: signup?.name })

  useEffect(() => {
    setEntering(true)
    const t = setTimeout(() => setEntering(false), 2600)
    return () => clearTimeout(t)
  }, [revealKey])

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
      style={entering ? { animationDelay: `${Math.min(slotNumber - 1, 10) * 170}ms` } : undefined}
      className={`group relative overflow-hidden text-left w-full p-4 rounded-xl border-2 shadow-sm transition-all duration-150 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-jade ${
        filled
          ? 'bg-lagoon-50 border-lagoon-200 hover:border-lagoon'
          : 'bg-sunrise-50 border-stone-200 hover:border-jade'
      } ${entering ? (fromLeft ? 'animate-card-slide-left' : 'animate-card-slide-right') : ''} ${pulse ? 'animate-card-pulse' : ''}`}
    >
      {filled && <span className="absolute left-0 top-0 h-full w-1 bg-jade" />}

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
