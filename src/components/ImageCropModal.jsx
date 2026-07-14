import { useCallback, useEffect, useRef, useState } from 'react'
import { cropImageToBlob } from '../lib/cropImage.js'

const CROP_SIZE = 280

export default function ImageCropModal({ file, onConfirm, onCancel }) {
  const [imageSrc, setImageSrc]   = useState(null)
  const [naturalSize, setNatural] = useState(null) // { w, h }
  const [offsetX, setOffsetX]     = useState(0)
  const [offsetY, setOffsetY]     = useState(0)
  const [scale, setScale]         = useState(1)
  const [saving, setSaving]       = useState(false)

  // Refs mirror state for synchronous reads inside rapid event handlers
  const xRef = useRef(0)
  const yRef = useRef(0)
  const sRef = useRef(1)

  function move(x, y, s) {
    xRef.current = x; yRef.current = y; sRef.current = s
    setOffsetX(x); setOffsetY(y); setScale(s)
  }

  // Load the file as an object URL
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setImageSrc(url)
    const img = new Image()
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // Compute clamp bounds to keep the crop circle always covered
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

  // ── Pointer drag (mouse only — touch is handled separately) ──────────────────
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
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    const { x, y } = clampOffset(dragRef.current.startOX + dx, dragRef.current.startOY + dy, sRef.current)
    move(x, y, sRef.current)
  }
  function onPointerUp(e) {
    if (e.pointerType === 'touch') return
    dragRef.current = null
  }

  // ── Touch (pinch + pan) ───────────────────────────────────────────────────────
  function touchDist(t) {
    const dx = t[0].clientX - t[1].clientX
    const dy = t[0].clientY - t[1].clientY
    return Math.hypot(dx, dy)
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
      const ratio    = touchDist(e.touches) / pinchRef.current.dist
      const newScale = Math.min(4, Math.max(1, pinchRef.current.startScale * ratio))
      const { x, y } = clampOffset(xRef.current, yRef.current, newScale)
      move(x, y, newScale)
    } else if (e.touches.length === 1 && dragRef.current) {
      const dx = e.touches[0].clientX - dragRef.current.startX
      const dy = e.touches[0].clientY - dragRef.current.startY
      const { x, y } = clampOffset(dragRef.current.startOX + dx, dragRef.current.startOY + dy, sRef.current)
      move(x, y, sRef.current)
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) pinchRef.current = null
    if (e.touches.length === 0) dragRef.current = null
  }

  // ── Scroll to zoom ────────────────────────────────────────────────────────────
  function onWheel(e) {
    e.preventDefault()
    const delta    = e.deltaY > 0 ? -0.1 : 0.1
    const newScale = Math.min(4, Math.max(1, sRef.current + delta))
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

  return (
    <div
      className="fixed inset-0 z-[80] bg-black flex flex-col overflow-hidden touch-none select-none"
      onWheel={onWheel}
    >
      {/* Image layer */}
      <div
        className="absolute inset-0 flex items-center justify-center cursor-grab active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
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

      {/* Circular mask — box-shadow darkens everything outside the circle */}
      <div
        className="absolute pointer-events-none"
        style={{
          width:  CROP_SIZE,
          height: CROP_SIZE,
          borderRadius: '50%',
          top:  '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)',
          border: '2px solid rgba(255,255,255,0.25)',
        }}
      />

      {/* Header */}
      <div
        className="relative z-10 flex items-center justify-between px-5 py-3"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <button
          onClick={onCancel}
          className="text-white text-sm font-medium px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
        >
          Cancel
        </button>
        <p className="text-white text-sm font-semibold">Move and scale</p>
        <div className="w-20" />
      </div>

      {/* Footer */}
      <div
        className="relative z-10 mt-auto px-6 py-4"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <button
          onClick={handleConfirm}
          disabled={saving}
          className="w-full py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Use Photo'}
        </button>
      </div>
    </div>
  )
}
