import { useEffect, useRef } from 'react'

// Keeps a bottom sheet above the iOS virtual keyboard.
// Returns a ref to attach to the sheet's outermost fixed container.
// Uses the Visual Viewport API to translateY the container up by the
// keyboard height so flex items-end correctly places the sheet above the keyboard.
export function useKeyboardAvoid() {
  const ref = useRef(null)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv || !ref.current) return

    function update() {
      if (!ref.current) return
      const offset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      ref.current.style.transform = offset > 0 ? `translateY(-${offset}px)` : ''
    }

    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    update()

    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return ref
}
