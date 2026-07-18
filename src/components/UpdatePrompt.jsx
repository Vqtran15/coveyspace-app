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

  if (false && (!needRefresh || splashActive)) return null // TEMP: force-show for staging preview

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
          viewBox="0 0 1440 72"
          preserveAspectRatio="none"
          className="absolute bottom-0 left-0 w-full translate-y-full fill-jade pointer-events-none"
          style={{ height: '72px' }}
          aria-hidden="true"
        >
          <path d="M0,0 L1440,0 C1410,4 1370,6 1320,5 C1290,4 1270,4 1250,46 C1230,62 1200,68 1170,64 C1145,60 1130,8 1100,5 C1060,2 1000,4 940,5 C905,6 890,5 872,42 C854,58 836,64 810,60 C788,56 776,8 748,5 C710,2 650,4 580,5 C545,6 525,5 508,52 C490,66 465,72 435,66 C410,60 398,8 368,5 C332,2 268,4 210,6 C180,8 162,5 144,40 C130,54 116,60 94,56 C74,52 66,8 42,5 L0,5 Z" />
        </svg>
      </div>
    </div>
  )
}
