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
;(function setDVH() {
  function update() {
    var h = window.innerHeight
    // Guard against 0: iOS briefly reports 0 during a SW-triggered reload
    // before the viewport initializes. Also cap at screen.height to reject
    // inflated values that can occur during PWA launch transitions.
    var max = (window.screen && window.screen.height) || 9999
    if (h > 100 && h <= max) document.documentElement.style.setProperty('--dvh', h + 'px')
  }
  update()
  window.addEventListener('resize', update)
  // Double-rAF: gives iOS two frames to settle innerHeight after initial
  // script execution (e.g. immediately after a service-worker-triggered reload).
  requestAnimationFrame(function () { requestAnimationFrame(update) })
  // Re-probe on foreground return: if a background SW reload captured a
  // transient wrong innerHeight, this corrects it the moment the user sees
  // the app — equivalent to kill+relaunch timing for the viewport metrics.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      requestAnimationFrame(function () { requestAnimationFrame(update) })
    }
  })
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

  // Re-probe on foreground return: corrects any wrong value that was captured
  // during a background SW reload, at the moment the user actually sees the app.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible') return
    window.scrollTo(0, 1)
    setTimeout(function () {
      var sab = measure()
      if (sab > 0) apply(sab)
    }, 150)
  })
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
