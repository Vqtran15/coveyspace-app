import { useState, useEffect } from 'react'

export function useModalClose(onClose, duration = 180) {
  const [closing, setClosing] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  function close() {
    setClosing(true)
    setTimeout(onClose, duration)
  }

  return [closing, close, mounted]
}
