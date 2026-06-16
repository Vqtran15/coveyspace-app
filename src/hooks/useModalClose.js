import { useState } from 'react'

export function useModalClose(onClose, duration = 220) {
  const [closing, setClosing] = useState(false)

  function close() {
    setClosing(true)
    setTimeout(onClose, duration)
  }

  return [closing, close]
}
