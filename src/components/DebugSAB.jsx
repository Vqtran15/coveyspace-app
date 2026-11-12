import { useEffect, useState } from 'react'

// Temporary debug overlay — remove after root cause is identified
const T0 = performance.now()
const ts = () => ((performance.now() - T0) / 1000).toFixed(2) + 's'

export default function DebugSAB() {
  const [log, setLog] = useState([])

  useEffect(() => {
    // Probe element reads env() directly (not via --sab)
    const probe = document.createElement('div')
    probe.style.cssText =
      'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;opacity:0'
    document.body.appendChild(probe)

    let prev = null

    function snap() {
      const root = document.documentElement
      const sabComputed = getComputedStyle(root).getPropertyValue('--sab').trim() || '—'
      const sabInline   = root.style.getPropertyValue('--sab') || '—'
      const envPx       = Math.round(probe.getBoundingClientRect().height)
      const navEl       = document.querySelector('nav.pill-nav')
      const navBottom   = navEl ? Math.round(parseFloat(getComputedStyle(navEl).bottom)) + 'px' : '(no nav)'
      const navXform    = navEl ? getComputedStyle(navEl).transform : '—'
      const scrollY     = Math.round(window.scrollY)
      return { sabComputed, sabInline, envPx, navBottom, navXform, scrollY }
    }

    function tick() {
      const s = snap()
      const key = JSON.stringify(s)
      if (key === prev) return
      prev = key
      const line =
        `[${ts()}] --sab computed=${s.sabComputed} inline=${s.sabInline} ` +
        `env=${s.envPx}px nav.bottom=${s.navBottom} scrollY=${s.scrollY} ` +
        `xform=${s.navXform.startsWith('matrix') ? 'matrix(…)' : s.navXform}`
      setLog(l => [...l.slice(-12), line])
    }

    tick()
    const id = setInterval(tick, 100)
    return () => { clearInterval(id); document.body.removeChild(probe) }
  }, [])

  return (
    <div
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top, 44px)',
        left: 0,
        right: 0,
        zIndex: 99999,
        background: 'rgba(0,0,0,0.88)',
        color: '#39ff88',
        fontFamily: 'monospace',
        fontSize: 9,
        lineHeight: 1.5,
        padding: '6px 8px',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {log.length === 0 ? 'watching…' : log.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  )
}
