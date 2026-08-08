import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './lib/toast.jsx'
import { GlobalErrorListeners, ErrorBoundary } from './components/ErrorReporter.jsx'

// iOS PWA / WebKit bug: env(safe-area-inset-*) resets to 0 after every
// client-side navigation. Cache the real values once at startup as inline
// custom properties on <html> — JS-set inline styles survive navigation and
// win the cascade over any CSS rule that references env() directly.
;(function cacheLayoutMetrics() {
  function setVH() {
    document.documentElement.style.setProperty('--dvh', `${window.innerHeight}px`)
  }
  setVH()
  window.addEventListener('resize', setVH)

  // Read safe-area insets via probe elements after the first paint so that
  // the browser has resolved the env() values for this device.
  requestAnimationFrame(() => {
    const probeB = document.createElement('div')
    probeB.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden'
    document.body.appendChild(probeB)
    document.documentElement.style.setProperty('--sab', `${probeB.getBoundingClientRect().height}px`)
    document.body.removeChild(probeB)

    const probeT = document.createElement('div')
    probeT.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);pointer-events:none;visibility:hidden'
    document.body.appendChild(probeT)
    document.documentElement.style.setProperty('--sat', `${probeT.getBoundingClientRect().height}px`)
    document.body.removeChild(probeT)
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
      const oy = window.getComputedStyle(el).overflowY
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return true
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
