import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { swRegistrationRef } from '../lib/swRegistration.js'

export default function UpdatePrompt() {
  const needRefreshRef  = useRef(false)
  // Track the SW instance itself (not just a boolean) so we only reload when
  // the controller changes from one SW to a *different* SW. Going from null →
  // SW (first install, or initial claim on a fresh load) is not a change that
  // warrants a reload.
  const prevControllerRef = useRef(
    typeof navigator !== 'undefined' ? (navigator.serviceWorker?.controller ?? null) : null
  )

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_, registration) {
      swRegistrationRef.current = registration
      setInterval(() => registration?.update().catch(() => {}), 60 * 60 * 1000)
    },
  })

  useEffect(() => { needRefreshRef.current = needRefresh }, [needRefresh])

  // Reload whenever a new SW takes control of a page that already had a SW.
  // Tracking the SW instance prevents reload loops.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function onControllerChange() {
      const prev = prevControllerRef.current
      const curr = navigator.serviceWorker?.controller ?? null
      prevControllerRef.current = curr
      if (prev !== null && curr !== null && prev !== curr) {
        document.body.style.overflow = ''
        window.location.reload()
      }
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  // Apply updates in the background, not on return to foreground.
  //
  // Previously: updateServiceWorker(true) fired when the app became visible
  // (or immediately when needRefresh was set). This caused location.reload()
  // to run while the WKWebView viewport was in a "returning from background"
  // transition — the worst possible moment for window.innerHeight and
  // env(safe-area-inset-bottom) to be read, producing wrong --dvh/--sab values
  // that persisted until the app was killed.
  //
  // Now: we apply the update when the app goes to the background. The
  // WKWebView reloads while the user isn't looking. When they return, the
  // page is already fresh with a fully settled viewport — equivalent to a
  // kill + relaunch from the layout's perspective.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        // Going to background: apply any pending update now
        if (needRefreshRef.current) updateServiceWorker(true)
      } else {
        // Returning to foreground: check for updates but don't apply yet
        swRegistrationRef.current?.update().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  return null
}
