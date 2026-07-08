function gtag(...args) {
  if (typeof window.gtag === 'function') window.gtag(...args)
}

export function trackEvent(name, params = {}) {
  gtag('event', name, params)
}

export function trackPageView(path) {
  gtag('event', 'page_view', { page_path: path })
}
