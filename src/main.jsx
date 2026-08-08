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
    document.documentElement.style.setProperty('--dvh', `${window.innerHeight}px`)
  }
  update()
  window.addEventListener('resize', update)
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
