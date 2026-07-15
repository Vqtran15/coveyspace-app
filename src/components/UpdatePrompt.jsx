import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt({ splashActive = false }) {
  const registrationRef = useRef(null)
  const needRefreshRef  = useRef(false)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_, registration) {
      registrationRef.current = registration
      setInterval(() => registration?.update(), 60 * 60 * 1000)
    },
  })

  useEffect(() => { needRefreshRef.current = needRefresh }, [needRefresh])

  // Check for updates whenever the app comes back to the foreground.
  // If a new SW is already waiting, apply it immediately at that natural moment.
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (needRefreshRef.current) {
        updateServiceWorker(true)
      } else {
        registrationRef.current?.update()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Auto-apply immediately if a new SW arrives while the splash is still up.
  useEffect(() => {
    if (needRefresh && splashActive) updateServiceWorker(true)
  }, [needRefresh, splashActive])

  return null
}
