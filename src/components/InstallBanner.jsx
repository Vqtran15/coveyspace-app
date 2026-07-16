import { useState } from 'react'
import { DeviceMobile, X, CaretDown, CaretUp } from '@phosphor-icons/react'
import { getCookie, setCookie } from '../lib/cookies.js'

const COOKIE_KEY = 'installBannerDismissed'

function detectPlatform() {
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && window.navigator.standalone === true)
  if (isStandalone) return 'standalone'
  const ua = navigator.userAgent
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return null // desktop — don't show
}

const STEPS = {
  ios: [
    'Open app.coveyspace.com in Safari (not Chrome or Firefox — the option only appears in Safari)',
    'Tap the Share button (□↑) at the bottom of the screen',
    'Scroll down and tap "Add to Home Screen"',
    'Tap "Add" in the top right to confirm',
  ],
  android: [
    'Open app.coveyspace.com in Chrome',
    'Tap the three-dot menu (⋮) in the top right corner',
    'Tap "Add to Home Screen" or "Install App"',
    'Tap "Add" to confirm',
  ],
}

const PLATFORM_LABEL = { ios: 'iPhone / iPad', android: 'Android' }

export default function InstallBanner() {
  const [platform] = useState(detectPlatform)
  const [dismissed, setDismissed] = useState(() => getCookie(COOKIE_KEY))
  const [expanded, setExpanded] = useState(false)
  const [closing, setClosing] = useState(false)

  if (!platform || platform === 'standalone' || dismissed) return null

  function handleDismiss() {
    setClosing(true)
    setTimeout(() => {
      setCookie(COOKIE_KEY)
      setDismissed(true)
    }, 250)
  }

  return (
    <div
      className={`rounded-2xl border border-jade/30 bg-jade/5 p-4 mb-3 animate-stack-in transition-opacity duration-[250ms] ${closing ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-jade/15 flex items-center justify-center shrink-0">
          <DeviceMobile size={18} weight="fill" className="text-jade" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-stone-800 leading-snug">Add to your home screen</p>
          <p className="text-xs text-stone-500 mt-0.5">Get the full app experience — no App Store required.</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded(e => !e)}
            className="text-xs font-semibold text-jade px-2.5 py-1.5 rounded-lg hover:bg-jade/10 active:bg-jade/20 transition-colors flex items-center gap-1"
          >
            {expanded ? 'Hide' : 'How?'}
            {expanded
              ? <CaretUp size={12} weight="bold" />
              : <CaretDown size={12} weight="bold" />
            }
          </button>
          <button
            onClick={handleDismiss}
            aria-label="Dismiss"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 active:bg-stone-200 transition-colors"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-jade/20">
          <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-widest mb-3">
            {PLATFORM_LABEL[platform]}
          </p>
          <ol className="flex flex-col gap-3">
            {STEPS[platform].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-jade text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-stone-600 leading-snug">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
