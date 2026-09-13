import { useState, useEffect, useRef } from 'react'

export function Dots() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-2.5 h-2.5 rounded-full bg-ember animate-dot-bounce" style={{ animationDelay: '0ms' }} />
      <div className="w-2.5 h-2.5 rounded-full bg-ember animate-dot-bounce" style={{ animationDelay: '160ms' }} />
      <div className="w-2.5 h-2.5 rounded-full bg-ember animate-dot-bounce" style={{ animationDelay: '320ms' }} />
    </div>
  )
}

// Ensures the loader stays visible for at least one full dot-bounce cycle (1100ms).
// Pass the raw loading boolean; returns a derived boolean safe to gate rendering.
export function useMinLoader(loading, minMs = 1100) {
  const [showing, setShowing] = useState(loading)
  const startRef = useRef(loading ? Date.now() : null)

  useEffect(() => {
    if (loading) {
      setShowing(true)
      startRef.current = Date.now()
      return
    }
    if (startRef.current === null) {
      setShowing(false)
      return
    }
    const elapsed = Date.now() - startRef.current
    const remaining = Math.max(0, minMs - elapsed)
    if (remaining <= 0) {
      setShowing(false)
      return
    }
    const t = setTimeout(() => setShowing(false), remaining)
    return () => clearTimeout(t)
  }, [loading, minMs])

  return showing
}

// Page-level: full-screen overlay with app background — sits below nav (z-40) so nav
// stays visible; padding offsets match the content area so dots land at visual center.
export default function LoadingDots() {
  return (
    <div
      className="fixed inset-0 z-[39] flex items-center justify-center bg-sunrise-50"
      style={{
        paddingTop: 'var(--sat)',
        paddingBottom: 'calc(max(16px, var(--sab) + 8px) + 68px)',
      }}
    >
      <Dots />
    </div>
  )
}

// Inline: centered within a constrained panel (PrayerProfile, ResourcesTab sub-panels)
export function InlineLoadingDots() {
  return (
    <div className="flex items-center justify-center w-full py-12">
      <Dots />
    </div>
  )
}
