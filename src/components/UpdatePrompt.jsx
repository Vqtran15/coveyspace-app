import { useEffect, useRef } from 'react'
import { ArrowClockwise } from '@phosphor-icons/react'
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

  if (!needRefresh || splashActive) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] animate-toast-in"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="relative bg-jade">
        <button
          onClick={() => updateServiceWorker(true)}
          className="w-full flex items-center gap-3 px-4 py-3 text-white active:bg-jade-700 transition-colors"
        >
          <ArrowClockwise size={16} weight="bold" className="shrink-0" />
          <span className="text-sm font-medium flex-1 text-left">Update available</span>
          <span className="text-sm font-semibold shrink-0">Tap to refresh →</span>
        </button>

        {/* Wavy bottom edge */}
        <svg
          viewBox="0 0 1440 20"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full translate-y-full fill-jade pointer-events-none"
          style={{ height: '20px' }}
          aria-hidden="true"
        >
          <path d="M0,0 L1440,0 C1350,18 1200,4 1080,14 C900,20 720,4 540,18 C360,20 180,4 0,14 Z" />
        </svg>
      </div>
    </div>
  )
}
