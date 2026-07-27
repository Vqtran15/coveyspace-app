import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { ToastProvider } from './lib/toast.jsx'
import { GlobalErrorListeners, ErrorBoundary } from './components/ErrorReporter.jsx'

// Prevent iOS PWA elastic/rubber-band scroll at the document boundary.
// overscroll-behavior-y:none is unreliable in WKWebView; touchmove
// preventDefault is the universal fallback. Skips elements inside
// explicit overflow:auto/scroll containers so inner scrollable areas
// (chapter reader, browser list, form sheets) still work normally.
;(function preventElasticScroll() {
  function isInsideScrollable(el) {
    while (el && el !== document.body) {
      const oy = window.getComputedStyle(el).overflowY
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return true
      el = el.parentElement
    }
    return false
  }
  document.addEventListener('touchmove', function (e) {
    if (isInsideScrollable(e.target)) return
    const root = document.scrollingElement || document.documentElement
    if (root.scrollTop <= 0 || root.scrollTop + root.clientHeight >= root.scrollHeight) {
      e.preventDefault()
    }
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
