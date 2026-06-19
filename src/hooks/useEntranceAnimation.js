import { useEffect, useState } from 'react'

const STAGGER_MS = 70
const MAX_STAGGER_STEPS = 10
const DURATION_MS = 600
const BUFFER_MS = 150

export function useEntranceAnimation(revealKey, index = 0, { direction = 'auto' } = {}) {
  const [entering, setEntering] = useState(true)
  const delay = Math.min(index, MAX_STAGGER_STEPS) * STAGGER_MS

  useEffect(() => {
    setEntering(true)
    const t = setTimeout(() => setEntering(false), delay + DURATION_MS + BUFFER_MS)
    return () => clearTimeout(t)
  }, [revealKey])

  const className = entering ? 'animate-stack-in' : ''
  const style = entering ? { animationDelay: `${delay}ms` } : undefined

  return { entering, className, style }
}
