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

        {/* Paint drip bottom edge */}
        <svg
          viewBox="0 0 1440 86"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full translate-y-full fill-jade pointer-events-none"
          style={{ height: '86px' }}
          aria-hidden="true"
        >
          <path d="M0,0 L1440,0 C1420,4 1360,6 1310,5 C1295,4 1282,5 1270,28 C1264,46 1248,56 1220,56 C1192,56 1176,46 1170,28 C1158,5 1145,4 1130,5 C1090,3 1020,4 980,5 C960,5 945,5 930,28 C918,52 908,70 896,74 C882,82 860,84 840,84 C820,84 798,82 784,74 C772,70 762,52 750,28 C735,5 720,5 700,5 C670,3 580,4 540,5 C520,5 510,5 500,18 C495,26 480,30 460,30 C440,30 424,26 420,18 C410,5 400,5 385,5 C350,3 280,4 230,5 C215,4 202,5 200,18 C196,36 186,58 172,68 C164,76 154,78 140,78 C126,78 116,76 108,68 C94,58 84,36 80,18 C78,5 65,4 50,5 C30,4 10,5 0,5 Z" />
        </svg>
      </div>
    </div>
  )
}
