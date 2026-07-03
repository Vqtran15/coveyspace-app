import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const registrationRef = useRef(null)
  const mountTimeRef = useRef(Date.now())
  const [autoApplied, setAutoApplied] = useState(false)
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_, registration) {
      registrationRef.current = registration
    },
  })

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        registrationRef.current?.update()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // If a new SW is found within 5s of launch (during splash), auto-reload silently.
  // After that, show the banner so we don't interrupt an active session.
  useEffect(() => {
    if (!needRefresh) return
    const elapsed = Date.now() - mountTimeRef.current
    if (elapsed < 5000) {
      setAutoApplied(true)
      updateServiceWorker(true)
    }
  }, [needRefresh])

  if (!needRefresh || autoApplied) return null

  return (
    <div
      className="fixed inset-x-0 lg:left-56 z-50 flex justify-center px-4 animate-toast-in bottom-[calc(env(safe-area-inset-bottom)+62px)] lg:bottom-6"
    >
      <div className="flex items-center gap-3 bg-stone-800 text-white text-sm font-medium pl-4 pr-2 py-2.5 rounded-xl shadow-lg">
        <span>New version available</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-white text-stone-800 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
