import { useEffect, useRef } from 'react'

const COLORS = ['#C4622D', '#E8A838', '#A1CCA6', '#B85A3A', '#6BA3BE', '#F0C987', '#D97559']

export default function FullScreenConfetti({ onDone }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: 6 + Math.random() * 6,
      h: 10 + Math.random() * 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      vx: (Math.random() - 0.5) * 2.5,
      vy: 2.5 + Math.random() * 3.5,
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    }))

    const startTime = performance.now()
    const duration  = 4000
    let raf

    function draw(now) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (const p of pieces) {
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.spin
        p.vy += 0.04
        if (progress > 0.65) p.opacity = Math.max(0, 1 - (progress - 0.65) / 0.35)

        ctx.save()
        ctx.globalAlpha = p.opacity
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (progress < 1) {
        raf = requestAnimationFrame(draw)
      } else {
        onDone?.()
      }
    }

    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [onDone])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-20 pointer-events-none"
      aria-hidden="true"
    />
  )
}
