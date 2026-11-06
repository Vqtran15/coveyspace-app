import { useState, useEffect } from 'react'

// Capture the event at module level — fires before React mounts, so we don't miss it
let _deferredPrompt = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _deferredPrompt = e
  })
}

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState(_deferredPrompt)

  useEffect(() => {
    // Pick up if it already fired before this component mounted
    setPrompt(_deferredPrompt)

    function onPrompt(e) {
      e.preventDefault()
      _deferredPrompt = e
      setPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  async function triggerInstall() {
    if (!_deferredPrompt) return 'unavailable'
    _deferredPrompt.prompt()
    const { outcome } = await _deferredPrompt.userChoice
    _deferredPrompt = null
    setPrompt(null)
    return outcome // 'accepted' | 'dismissed'
  }

  return { canPrompt: !!prompt, triggerInstall }
}
