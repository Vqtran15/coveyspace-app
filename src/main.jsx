import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './lib/toast.jsx'
import { GlobalErrorListeners, ErrorBoundary } from './components/ErrorReporter.jsx'

// iOS PWA: env(safe-area-inset-bottom) returns 0 when the document is shorter
// than the viewport (non-scrollable pages). Keeping the document 1px taller
// than the viewport (via root div minHeight in App.jsx) keeps iOS returning
// the correct env() values. --dvh gives us the reliable window.innerHeight.
//
// NOTE: --dvh is no longer used for any critical layout in the PWA:
// - Non-chat tabs use position:fixed (top:--sat, bottom:0) — immune to --dvh
// - Chat container uses 100dvh CSS unit instead of var(--dvh)
// - Outer wrapper minHeight uses --dvh only as a SAB probe scaffold (harmless if wrong)
// --dvh is still used for the non-PWA browser chat (html:not(.is-pwa) .chat-container).
// We still set it on load and resize so it stays correct for that case and for
// any future use, but we do NOT update it on visibilitychange — iOS WKWebView
// reports wrong window.innerHeight values during background→foreground transitions
// (returns full-screen height instead of the layout-viewport height below the status
// bar), and updating --dvh at that moment was the source of the chat input cut-off bug.
;(function setDVH() {
  var CACHE_KEY = 'covey_dvh'

  function update() {
    if (document.visibilityState === 'hidden') return
    var h = window.innerHeight
    var max = (window.screen && window.screen.height) || 9999
    if (h > 100 && h <= max) {
      document.documentElement.style.setProperty('--dvh', h + 'px')
      try { localStorage.setItem(CACHE_KEY, String(h)) } catch (e) {}
    }
  }

  var cached = parseInt(localStorage.getItem(CACHE_KEY) || '0', 10)
  if (cached > 100) document.documentElement.style.setProperty('--dvh', cached + 'px')

  update()
  window.addEventListener('resize', update)
  requestAnimationFrame(function () { requestAnimationFrame(update) })
  // No visibilitychange listener — iOS WKWebView returns wrong window.innerHeight
  // values during the background→foreground transition, and --dvh is no longer
  // load-bearing for any PWA layout so there is nothing to gain by re-reading it.
}())

// iOS PWA safe-area-inset-bottom probe — runs synchronously before React mounts
// so that the first render already has the correct --sab value.
//
// Two failure modes we guard against:
// 1. Cold launch: env() returns 0 until iOS processes a native scroll event.
//    We do scrollTo(0,1) then wait 150ms. Retry at 500ms if still 0.
// 2. SW-triggered reload while ChatView had body.overflow='hidden': iOS can
//    carry that overflow state into the new page's initialization window,
//    making env() return 0 even after the scroll. We clear body.overflow
//    here (before any React effect can re-set it) and also cache the last
//    good measurement in localStorage so a post-reload probe failure falls
//    back to a known-good value.
;(function setSAB() {
  var CACHE_KEY = 'covey_sab'

  // Clear any overflow iOS may have carried from the previous page load.
  document.body.style.overflow = ''

  function measure() {
    var el = document.createElement('div')
    el.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;opacity:0'
    document.body.appendChild(el)
    var h = el.getBoundingClientRect().height
    document.body.removeChild(el)
    return h
  }

  function apply(sab) {
    document.documentElement.style.setProperty('--sab', sab + 'px')
    try { localStorage.setItem(CACHE_KEY, String(sab)) } catch (e) {}
  }

  // Apply cached value immediately so first React render uses the right value.
  var cached = parseFloat(localStorage.getItem(CACHE_KEY) || '0')
  if (cached > 0) document.documentElement.style.setProperty('--sab', cached + 'px')

  window.scrollTo(0, 1)
  setTimeout(function () {
    var sab = measure()
    if (sab > 0) {
      apply(sab)
    } else {
      // Retry once at 500ms total
      setTimeout(function () {
        sab = measure()
        if (sab > 0) {
          apply(sab)
        } else if (cached > 0) {
          // Both probes returned 0 (e.g. SW reload with delayed viewport init).
          // Re-affirm cached value — it was applied above but the CSS env()
          // default may have overwritten it since then.
          apply(cached)
        }
      }, 350)
    }
  }, 150)

}())

// Prevent iOS PWA elastic/rubber-band scroll at the document boundary.
// overscroll-behavior-y:none is unreliable in WKWebView; touchmove
// preventDefault is the universal fallback. Skips elements inside
// explicit overflow:auto/scroll containers so inner scrollable areas
// (chapter reader, browser list, form sheets) still work normally.
// Tracks touch direction so we only block the bounce direction —
// never block scrolling INTO content (e.g. scrolling down from top).
;(function preventElasticScroll() {
  let lastTouchY = 0

  function isInsideScrollable(el) {
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el)
      const oy = style.overflowY
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return true
      // Fixed containers (overlays, sheets) manage their own scroll/overscroll
      if (style.position === 'fixed') return true
      el = el.parentElement
    }
    return false
  }

  document.addEventListener('touchstart', function (e) {
    lastTouchY = e.touches[0].clientY
  }, { passive: true })

  document.addEventListener('touchmove', function (e) {
    if (isInsideScrollable(e.target)) return
    const currentY = e.touches[0].clientY
    const deltaY = currentY - lastTouchY
    lastTouchY = currentY
    const root = document.scrollingElement || document.documentElement
    // deltaY > 0 = finger moving down = content scrolling up = would bounce at top
    if (deltaY > 0 && root.scrollTop <= 0) { e.preventDefault(); return }
    // deltaY < 0 = finger moving up = content scrolling down = would bounce at bottom
    if (deltaY < 0 && root.scrollTop + root.clientHeight >= root.scrollHeight) { e.preventDefault() }
  }, { passive: false })
}())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <GlobalErrorListeners />
          <App />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
