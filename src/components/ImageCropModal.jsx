import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cropImageToBlob } from '../lib/cropImage.js'

const CROP_SIZE = 280

export default function ImageCropModal({ file, onConfirm, onCancel }) {
  const [imageSrc, setImageSrc]   = useState(null)
  const [naturalSize, setNatural] = useState(null)
  const [saving, setSaving]       = useState(false)

  // Single ref tracks all drag/zoom state; DOM is written directly to avoid re-renders during drag
  const posRef = useRef({ x: 0, y: 0, s: 1 })
  const imgRef = useRef(null)

  function move(x, y, s) {
    posRef.current = { x, y, s }
    if (imgRef.current) imgRef.current.style.transform = `translate(${x}px, ${y}px) scale(${s})`
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
    dragRef.current = { startX: e.clientX, startY: e.clientY, startOX: posRef.current.x, startOY: posRef.current.y }
  }
  function onPointerMove(e) {
    if (e.pointerType === 'touch') return
    if (!dragRef.current) return
    const { x, y } = clampOffset(dragRef.current.startOX + (e.clientX - dragRef.current.startX), dragRef.current.startOY + (e.clientY - dragRef.current.startY), posRef.current.s)
    move(x, y, posRef.current.s)
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
      pinchRef.current = { dist: touchDist(e.touches), startScale: posRef.current.s }
      dragRef.current = null
    } else if (e.touches.length === 1) {
      dragRef.current = { startX: e.touches[0].clientX, startY: e.touches[0].clientY, startOX: posRef.current.x, startOY: posRef.current.y }
      pinchRef.current = null
    }
  }
  function onTouchMove(e) {
    e.preventDefault()
    if (e.touches.length === 2 && pinchRef.current) {
      const newScale = Math.min(4, Math.max(1, pinchRef.current.startScale * (touchDist(e.touches) / pinchRef.current.dist)))
      const { x, y } = clampOffset(posRef.current.x, posRef.current.y, newScale)
      move(x, y, newScale)
    } else if (e.touches.length === 1 && dragRef.current) {
      const { x, y } = clampOffset(dragRef.current.startOX + (e.touches[0].clientX - dragRef.current.startX), dragRef.current.startOY + (e.touches[0].clientY - dragRef.current.startY), posRef.current.s)
      move(x, y, posRef.current.s)
    }
  }
  function onTouchEnd(e) {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) dragRef.current = null
  }

  function onWheel(e) {
    e.preventDefault()
    const newScale = Math.min(4, Math.max(1, posRef.current.s + (e.deltaY > 0 ? -0.1 : 0.1)))
    const { x, y } = clampOffset(posRef.current.x, posRef.current.y, newScale)
    move(x, y, newScale)
  }

  async function handleConfirm() {
    setSaving(true)
    try {
      const blob = await cropImageToBlob(file, { offsetX: posRef.current.x, offsetY: posRef.current.y, scale: posRef.current.s, cropSize: CROP_SIZE })
      onConfirm(blob)
    } catch {
      setSaving(false)
    }
  }

  if (!imageSrc) return null

  const r = CROP_SIZE / 2

  // Portal renders directly in document.body, bypassing any ancestor transform
  // stacking contexts that would make `fixed` behave like `absolute`.
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-black flex flex-col select-none">

      {/* ── Drag zone: takes all space above the button bar ── */}
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
        {/* Image centered and panned/zoomed within the drag zone */}
        <div className="absolute inset-0 flex items-center justify-center">
          <img
            ref={imgRef}
            src={imageSrc}
            alt=""
            draggable={false}
            className="max-w-none"
            style={{
              width: naturalSize ? `${naturalSize.w * (CROP_SIZE / Math.min(naturalSize.w, naturalSize.h))}px` : '100%',
              transform: 'translate(0px, 0px) scale(1)',
              transformOrigin: 'center center',
              pointerEvents: 'none',
            }}
          />
        </div>

        {/* Dark overlay with circular cutout — radial-gradient works correctly under overflow-hidden */}
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

      {/* ── Button bar: sits below the drag zone, never overlaps it ── */}
      <div
        className="shrink-0 bg-black px-6 pt-5 flex gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}
      >
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="flex-1 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Use Photo'}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl border border-white/20 text-white/70 text-sm font-medium active:bg-white/10 transition-colors"
        >
          Cancel
        </button>
      </div>

    </div>,
    document.body
  )
}
