import { useCallback, useEffect, useRef, useState } from 'react'
import { cropImageToBlob } from '../lib/cropImage.js'

const CROP_SIZE = 280

export default function ImageCropModal({ file, onConfirm, onCancel }) {
  const [imageSrc, setImageSrc]   = useState(null)
  const [naturalSize, setNatural] = useState(null)
  const [offsetX, setOffsetX]     = useState(0)
  const [offsetY, setOffsetY]     = useState(0)
  const [scale, setScale]         = useState(1)
  const [saving, setSaving]       = useState(false)

  const xRef = useRef(0)
  const yRef = useRef(0)
  const sRef = useRef(1)

  function move(x, y, s) {
    xRef.current = x; yRef.current = y; sRef.current = s
    setOffsetX(x); setOffsetY(y); setScale(s)
  }

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    const img = new Image()
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const clampOffset = useCallback((ox, oy, sc) => {
    if (!naturalSize) return { x: ox, y: oy }
    const baseScale  = CROP_SIZE / Math.min(naturalSize.w, naturalSize.h)
    const totalScale = baseScale * sc
    const displayedW = naturalSize.w * totalScale
    const displayedH = naturalSize.h * totalScale
    const maxX = Math.max(0, (displayedW - CROP_SIZE) / 2)
    const maxY = Math.max(0, (displayedH - CROP_SIZE) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, ox)),
      y: Math.min(maxY, Math.max(-maxY, oy)),
    }
  }, [naturalSize])

  const dragRef  = useRef(null)
  const pinchRef = useRef(null)

  function onPointerDown(e) {
    if (e.pointerType === 'touch') return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOX: xRef.current, startOY: yRef.current }
  }
  function onPointerMove(e) {
    if (e.pointerType === 'touch') return
    if (!dragRef.current) return
    const { x, y } = clampOffset(dragRef.current.startOX + (e.clientX - dragRef.current.startX), dragRef.current.startOY + (e.clientY - dragRef.current.startY), sRef.current)
    move(x, y, sRef.current)
  }
  function onPointerUp(e) {
    if (e.pointerType === 'touch') return
    dragRef.current = null
  }

  function touchDist(t) {
    return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  }
  function onTouchStart(e) {
    e.preventDefault()
    if (e.touches.length === 2) {
      pinchRef.current = { dist: touchDist(e.touches), startScale: sRef.current }
      dragRef.current = null
    } else if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, startOX: xRef.current, startOY: yRef.current }
      pinchRef.current = null
    }
  }
  function onTouchMove(e) {
    e.preventDefault()
    if (e.touches.length === 2 && pinchRef.current) {
      const newScale = Math.min(4, Math.max(1, pinchRef.current.startScale * (touchDist(e.touches) / pinchRef.current.dist)))
      const { x, y } = clampOffset(xRef.current, yRef.current, newScale)
      move(x, y, newScale)
    } else if (e.touches.length === 1 && dragRef.current) {
      const { x, y } = clampOffset(dragRef.current.startOX + (e.touches[0].clientX - dragRef.current.startX), dragRef.current.startOY + (e.touches[0].clientY - dragRef.current.startY), sRef.current)
      move(x, y, sRef.current)
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) dragRef.current = null
  }

  function onWheel(e) {
    e.preventDefault()
    const newScale = Math.min(4, Math.max(1, sRef.current + (e.deltaY > 0 ? -0.1 : 0.1)))
    const { x, y } = clampOffset(xRef.current, yRef.current, newScale)
    move(x, y, newScale)
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      const blob = await cropImageToBlob(file, { offsetX: xRef.current, offsetY: yRef.current, scale: sRef.current, cropSize: CROP_SIZE })
      onConfirm(blob)
    } catch {
      setSaving(false)
    }
  }

  if (!imageSrc) return null

  const r = CROP_SIZE / 2

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col select-none">

      {/* ── Drag zone: image only renders here, clipped by overflow-hidden ── */}
      <div
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
      >
        {/* Image, panned/zoomed within the drag zone */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            src={imageSrc}
            alt=""
            draggable={false}
            className="max-w-none"
            style={{
              width: naturalSize ? `${naturalSize.w * (CROP_SIZE / Math.min(naturalSize.w, naturalSize.h))}px` : '100%',
              transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
              transformOrigin: 'center center',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Dark overlay with circular cutout — radial-gradient renders correctly under overflow-hidden */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle ${r}px at 50% 50%, transparent ${r - 1}px, rgba(0,0,0,0.65) ${r}px)`,
          }}
        />

        {/* Circle border ring */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: CROP_SIZE,
            height: CROP_SIZE,
            borderRadius: '50%',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            border: '2px solid rgba(255,255,255,0.35)',
          }}
        />
      </div>

      {/* ── Buttons: separate section below the image frame ── */}
      <div
        className="shrink-0 bg-black px-6 pt-5 flex gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl border border-white/20 text-white/70 text-sm font-medium active:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="flex-1 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Use Photo'}
        </button>
      </div>

    </div>
  )
}
