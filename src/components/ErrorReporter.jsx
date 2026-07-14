import { Component, useEffect } from 'react'
import { reportError } from '../lib/error-reporter'

function GlobalErrorListeners() {
  useEffect(() => {
    const onError = e => {
      if (e.error) reportError(e.error, { component: 'global' })
    }
    const onRejection = e => {
      const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason ?? 'Unhandled rejection'))
      reportError(err, { component: 'unhandledrejection' })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])
  return null
}

function isChunkError(error) {
  if (!error) return false
  const msg = error.message ?? ''
  return (
    error.name === 'ChunkLoadError' ||
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('is not a valid JavaScript MIME type') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  )
}

class ErrorBoundary extends Component {
  state = { hasError: false, isChunkError: false }

  static getDerivedStateFromError(error) {
    return { hasError: true, isChunkError: isChunkError(error) }
  }

  componentDidCatch(error, info) {
    if (isChunkError(error)) {
      // New deployment changed chunk hashes — reload to get the latest bundle
      window.location.reload()
      return
    }
    reportError(error, {
      component: 'ErrorBoundary',
      metadata: { componentStack: info.componentStack },
    })
  }

  render() {
    if (this.state.hasError && !this.state.isChunkError) {
      return (
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#57534e', background: '#fafaf9' }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</p>
            <p style={{ fontSize: '0.875rem', color: '#a8a29e' }}>Please refresh the page to continue.</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export { GlobalErrorListeners, ErrorBoundary }
