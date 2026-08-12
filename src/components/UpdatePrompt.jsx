import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { swRegistrationRef } from '../lib/swRegistration.js'

export default function UpdatePrompt() {
  const needRefreshRef   = useRef(false)
  const hadControllerRef = useRef(typeof navigator !== 'undefined' && !!navigator.serviceWorker?.controller)

  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_, registration) {
      swRegistrationRef.current = registration
      setInterval(() => registration?.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => { needRefreshRef.current = needRefresh }, [needRefresh])

  // Reload whenever a new SW takes control
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function onControllerChange() {
      if (hadControllerRef.current) window.location.reload()
      hadControllerRef.current = true
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
