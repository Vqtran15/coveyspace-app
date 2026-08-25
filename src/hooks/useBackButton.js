import { useEffect, useRef, useCallback } from 'react'

// Handles Android hardware/gesture back button for overlays and modals.
// On open: pushes a dummy history entry (same URL, no navigation) so Android
// back pops it instead of leaving the app or navigating React Router routes.
// On Android back (popstate): calls onBack() to close the overlay.
// On JS close (X button, etc.): consumes the dummy history entry via history.back()
// without triggering navigation (same URL → React Router ignores it).
export function useBackButton(isOpen, onBack) {
  const guardRef    = useRef(false)
  const openPathRef = useRef(null)
  const stableBack  = useCallback(onBack, [onBack])

  useEffect(() => {
    if (!isOpen) return

    history.pushState(null, '')
    openPathRef.current = window.location.pathname
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
        guardRef.current = false
        // Only pop the dummy entry if we're still on the same route.
        // If the user navigated to another tab, skip history.back() — calling
        // it from a different path would push them back to this route.
        if (window.location.pathname === openPathRef.current) {
          history.back()
        }
      }
    }
  }, [isOpen, stableBack])
}
