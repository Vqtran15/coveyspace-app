import { useState, useCallback } from 'react'

export function useAnimatedOverlay(duration = 200) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const close = useCallback(() => {
    setClosing(true)
    setTimeout(() => { setOpen(false); setClosing(false) }, duration)
  }, [duration])
  return { open, setOpen, closing, close }
}
