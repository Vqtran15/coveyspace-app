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

class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    reportError(error, {
      component: 'ErrorBoundary',
      metadata: { componentStack: info.componentStack },
    })
  }

  render() {
    if (this.state.hasError) {
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
