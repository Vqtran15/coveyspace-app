import { useState, useEffect, useRef } from 'react'

const THRESHOLD = 72

export function usePullToRefresh(onRefresh, enabled = true) {
  const [pullDistance, setPullDistance] = useState(0)
  const [refreshing, setRefreshing]     = useState(false)
  const startY        = useRef(null)
  const distRef       = useRef(0)
  const refreshingRef = useRef(false)
  const onRefreshRef  = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    if (!enabled) return

    function onTouchStart(e) {
      if (window.scrollY === 0) startY.current = e.touches[0].clientY
    }

    function onTouchMove(e) {
      if (startY.current === null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > 0) {
        const dist = Math.min(delta * 0.45, THRESHOLD + 16)
        distRef.current = dist
        setPullDistance(dist)
      }
    }

    async function onTouchEnd() {
      if (startY.current === null) return
      const dist = distRef.current
      startY.current = null
      distRef.current = 0
      setPullDistance(0)
      if (dist >= THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true
        setRefreshing(true)
        await onRefreshRef.current()
        refreshingRef.current = false
        setRefreshing(false)
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: true })
    window.addEventListener('touchend',   onTouchEnd,   { passive: true })
    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [enabled])

  return { pullDistance, refreshing, threshold: THRESHOLD }
}
