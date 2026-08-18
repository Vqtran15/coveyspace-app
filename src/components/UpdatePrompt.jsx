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
      setInterval(() => registration?.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => { needRefreshRef.current = needRefresh }, [needRefresh])

  // Reload whenever a new SW takes control of a page that already had a SW.
  // Tracking the SW instance prevents reload loops: if the page loads with a
  // controller already set, a subsequent claim event for the *same* SW won't
  // change the identity and won't trigger a reload.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function onControllerChange() {
      const prev = prevControllerRef.current
      const curr = navigator.serviceWorker?.controller ?? null
      prevControllerRef.current = curr
      if (prev !== null && curr !== null && prev !== curr) window.location.reload()
    }
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
  }, [])

  // Check for updates on foreground return; apply immediately if one is waiting
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (needRefreshRef.current) {
        updateServiceWorker(true)
      } else {
        swRegistrationRef.current?.update()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Silent auto-apply: no banner — apply the moment a new SW is detected
  useEffect(() => {
    if (needRefresh) updateServiceWorker(true)
  }, [needRefresh])

  return null
}
