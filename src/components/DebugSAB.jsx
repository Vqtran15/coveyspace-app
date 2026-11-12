import { useEffect, useState, useRef } from 'react'

// Temporary debug overlay — remove after root cause is identified
const T0 = performance.now()
const ts = () => ((performance.now() - T0) / 1000).toFixed(2) + 's'

export default function DebugSAB() {
  const [log, setLog] = useState([])
  const [copied, setCopied] = useState(false)
  const logRef = useRef([])

  function handleCopy() {
    navigator.clipboard.writeText(logRef.current.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

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
      const navEl       = document.querySelector('nav.pill-nav')
      const navRect     = navEl ? navEl.getBoundingClientRect() : null
      const navH        = navRect ? Math.round(navRect.height) : '—'
      const navTop      = navRect ? Math.round(navRect.top) : '—'
      const navBottom   = navEl ? Math.round(parseFloat(getComputedStyle(navEl).bottom)) + 'px' : '(no nav)'
      const navTY       = navEl ? matrixTY(getComputedStyle(navEl).transform) : '—'
      const winH        = Math.round(window.innerHeight)
      const scrollY     = Math.round(window.scrollY)

      const pillActive  = navEl ? navEl.querySelector('.bg-ember.absolute') : null
      const pillRect    = pillActive ? pillActive.getBoundingClientRect() : null
      const pillPos     = pillRect ? `y=${Math.round(pillRect.top)}` : '—'
      const pillTY      = pillActive ? matrixTY(getComputedStyle(pillActive).transform) : '—'

      const activeBtn    = pillActive ? pillActive.closest('button') : null
      const btnY         = activeBtn ? Math.round(activeBtn.getBoundingClientRect().top) : '—'
      const btnTY        = activeBtn ? matrixTY(getComputedStyle(activeBtn).transform) : '—'

      return { sabComputed, navH, navTop, navBottom, navTY, winH, scrollY, pillPos, pillTY, btnY, btnTY }
    }

    function tick() {
      const s = snap()
      const key = JSON.stringify(s)
      if (key === prev) return
      prev = key
      const line =
        `[${ts()}] sab=${s.sabComputed} win.h=${s.winH} nav.h=${s.navH} nav.top=${s.navTop} bot=${s.navBottom} nav.ty=${s.navTY} ` +
        `btn.y=${s.btnY} btn.ty=${s.btnTY} pill.y=${s.pillPos} scrollY=${s.scrollY}`
      setLog(l => {
        const next = [...l.slice(-14), line]
        logRef.current = next
        return next
      })
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
      <button
        onClick={handleCopy}
        style={{ pointerEvents: 'auto', background: copied ? '#39ff88' : '#fff3', color: copied ? '#000' : '#39ff88', border: '1px solid #39ff88', borderRadius: 4, padding: '2px 8px', marginBottom: 4, fontSize: 10, cursor: 'pointer' }}
      >
        {copied ? 'Copied!' : 'Copy all'}
      </button>
      {log.length === 0 ? 'watching…' : log.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  )
}
