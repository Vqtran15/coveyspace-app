import { useState, useEffect, useRef } from 'react'

export function useModalClose(onClose, duration = 250) {
  const [closing, setClosing] = useState(false)
  const timerRef = useRef(null)

  function close() {
    setClosing(true)
    timerRef.current = setTimeout(onClose, duration)
  }

  function reset() {
    setClosing(false)
  }

  useEffect(() => () => clearTimeout(timerRef.current), [])

  return [closing, close, reset]
}
