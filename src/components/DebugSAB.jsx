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

    function matrixTY(transform) {
      // Extract translateY from matrix(a,b,c,d,tx,ty) or matrix3d(...)
      if (!transform || transform === 'none') return '0'
      const m = transform.match(/matrix(?:3d)?\(([^)]+)\)/)
      if (!m) return transform
      const vals = m[1].split(',').map(v => parseFloat(v.trim()))
      // matrix(a,b,c,d,tx,ty) → ty is index 5; matrix3d → ty is index 13
      const ty = vals.length >= 16 ? vals[13] : vals[5]
      return ty != null ? Math.round(ty) + 'px' : '?'
    }

    function snap() {
      const root = document.documentElement
      const sabComputed = getComputedStyle(root).getPropertyValue('--sab').trim() || '—'
      const sabInline   = root.style.getPropertyValue('--sab') || '—'
      const envPx       = Math.round(probe.getBoundingClientRect().height)
      const navEl       = document.querySelector('nav.pill-nav')
      const navBottom   = navEl ? Math.round(parseFloat(getComputedStyle(navEl).bottom)) + 'px' : '(no nav)'
      const navTY       = navEl ? matrixTY(getComputedStyle(navEl).transform) : '—'
      const scrollY     = Math.round(window.scrollY)

      // Track the pill-active indicator and its containing button
      const pillActive  = navEl ? navEl.querySelector('.bg-ember.absolute') : null
      const pillRect    = pillActive ? pillActive.getBoundingClientRect() : null
      const pillPos     = pillRect ? `y=${Math.round(pillRect.top)}` : '—'
      const pillTY      = pillActive ? matrixTY(getComputedStyle(pillActive).transform) : '—'

      // Check the button that contains the indicator and its direct parent
      const activeBtn    = pillActive ? pillActive.closest('button') : null
      const btnY         = activeBtn ? Math.round(activeBtn.getBoundingClientRect().top) : '—'
      const btnTY        = activeBtn ? matrixTY(getComputedStyle(activeBtn).transform) : '—'
      const pillParentTag = pillActive ? pillActive.parentElement?.tagName?.toLowerCase() : '—'

      return { sabComputed, sabInline, envPx, navBottom, navTY, scrollY, pillPos, pillTY, btnY, btnTY, pillParentTag }
    }

    function tick() {
      const s = snap()
      const key = JSON.stringify(s)
      if (key === prev) return
      prev = key
      const line =
        `[${ts()}] sab=${s.sabComputed} bot=${s.navBottom} nav.ty=${s.navTY} ` +
        `pill.y=${s.pillPos} pill.ty=${s.pillTY} btn.y=${s.btnY} btn.ty=${s.btnTY} par=${s.pillParentTag} scrollY=${s.scrollY}`
      setLog(l => [...l.slice(-12), line])
    }

    tick()
    const id = setInterval(tick, 50)
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
