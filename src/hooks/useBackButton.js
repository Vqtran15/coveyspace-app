import { useEffect, useRef, useCallback } from 'react'

// Handles Android hardware/gesture back button for overlays and modals.
// On open: pushes a dummy history entry (same URL, no navigation) so Android
// back pops it instead of leaving the app or navigating React Router routes.
// On Android back (popstate): calls onBack() to close the overlay.
// On JS close (X button, etc.): consumes the dummy history entry via history.back()
// without triggering navigation (same URL → React Router ignores it).
export function useBackButton(isOpen, onBack) {
  const guardRef   = useRef(false)
  const stableBack = useCallback(onBack, [onBack])

  useEffect(() => {
    if (!isOpen) return

    history.pushState(null, '')
    guardRef.current = true

    function handlePop() {
      if (guardRef.current) {
        guardRef.current = false
        stableBack()
      }
    }

    window.addEventListener('popstate', handlePop)

    return () => {
      window.removeEventListener('popstate', handlePop)
      if (guardRef.current) {
        // Overlay was closed by JS, not by Android back — consume the dummy
        // history entry so it doesn't linger. history.back() with same URL is
        // ignored by React Router (URL unchanged).
        guardRef.current = false
        history.back()
      }
    }
  }, [isOpen, stableBack])
}
