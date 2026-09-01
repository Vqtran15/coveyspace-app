import { useEffect, useRef } from 'react'

const SWIPE_THRESHOLD = 60

function hasHorizontalScrollableAncestor(el) {
  while (el && el !== document.body) {
    const ox = getComputedStyle(el).overflowX
    if ((ox === 'scroll' || ox === 'auto') && el.scrollWidth > el.clientWidth + 2) return true
    el = el.parentElement
  }
  return false
}

export function useSwipeNavigation({ enabled = true, onSwipeLeft, onSwipeRight }) {
  const startRef = useRef(null)
  const leftRef  = useRef(onSwipeLeft)
  const rightRef = useRef(onSwipeRight)

  useEffect(() => { leftRef.current  = onSwipeLeft  }, [onSwipeLeft])
  useEffect(() => { rightRef.current = onSwipeRight }, [onSwipeRight])

  useEffect(() => {
    if (!enabled) return

    function onTouchStart(e) {
      const t = e.touches[0]
      startRef.current = { x: t.clientX, y: t.clientY, target: e.target }
    }

    function onTouchEnd(e) {
      const start = startRef.current
      if (!start) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.x
      const dy = t.clientY - start.y
      startRef.current = null

      if (Math.abs(dx) < SWIPE_THRESHOLD) return
      if (Math.abs(dy) > Math.abs(dx)) return
      if (hasHorizontalScrollableAncestor(start.target)) return

      if (dx < 0) leftRef.current?.()
      else rightRef.current?.()
    }

    function onTouchCancel() { startRef.current = null }

    document.addEventListener('touchstart',  onTouchStart,  { passive: true })
    document.addEventListener('touchend',    onTouchEnd,    { passive: true })
    document.addEventListener('touchcancel', onTouchCancel, { passive: true })
    return () => {
      document.removeEventListener('touchstart',  onTouchStart)
      document.removeEventListener('touchend',    onTouchEnd)
      document.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [enabled])
}
