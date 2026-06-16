import { useEffect, useRef, useState } from 'react'
import { DotsSixVertical, Plus } from '@phosphor-icons/react'
import { useModalClose } from '../hooks/useModalClose.js'

const ROW_HEIGHT = 52

function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function ManagePagesModal({ pages, onReorder, onAddPage, onClose }) {
  const [closing, close] = useModalClose(onClose)
  const [list, setList] = useState(pages)
  const [draggingId, setDraggingId] = useState(null)
  const rowRefs = useRef([])
  const dragInfo = useRef(null) // { id, startIndex, startClientY, spacing, node, lastSteps, length }
  const suppressSync = useRef(false)

  useEffect(() => {
    if (!suppressSync.current) setList(pages)
  }, [pages])

  // The date column is a fixed, sorted reference — it never reorders.
  const sortedDates = [...pages].sort((a, b) => a.week_date.localeCompare(b.week_date)).map(p => p.week_date)

  function clearTransforms() {
    for (const el of rowRefs.current) {
      if (el) el.style.transform = ''
    }
  }

  function handlePointerDown(e, id) {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const index = list.findIndex(p => p.id === id)
    const node = rowRefs.current[index]
    const neighbor = rowRefs.current[index + 1] ?? rowRefs.current[index - 1]
    const spacing = node && neighbor
      ? Math.abs(neighbor.getBoundingClientRect().top - node.getBoundingClientRect().top)
      : ROW_HEIGHT + 8
    dragInfo.current = { id, startIndex: index, startClientY: e.clientY, spacing, node, lastSteps: 0, length: list.length }
    suppressSync.current = true
    setDraggingId(id)
  }

  function handlePointerMove(e) {
    const info = dragInfo.current
    if (!info) return
    const deltaY = e.clientY - info.startClientY
    if (info.node) info.node.style.transform = `translateY(${deltaY}px)`

    const rawSteps = Math.round(deltaY / info.spacing)
    const steps = Math.min(Math.max(rawSteps, -info.startIndex), info.length - 1 - info.startIndex)
    if (steps === info.lastSteps) return
    info.lastSteps = steps

    const targetIndex = info.startIndex + steps
    for (let i = 0; i < rowRefs.current.length; i++) {
      if (i === info.startIndex) continue
      const el = rowRefs.current[i]
      if (!el) continue
      let shift = 0
      if (targetIndex > info.startIndex && i > info.startIndex && i <= targetIndex) shift = -info.spacing
      else if (targetIndex < info.startIndex && i < info.startIndex && i >= targetIndex) shift = info.spacing
      el.style.transform = shift ? `translateY(${shift}px)` : ''
    }
  }

  async function handlePointerUp() {
    const info = dragInfo.current
    if (!info) return
    dragInfo.current = null
    clearTransforms()
    setDraggingId(null)

    const targetIndex = info.startIndex + info.lastSteps
    if (targetIndex === info.startIndex) {
      suppressSync.current = false
      return
    }

    setList(prev => {
      const next = [...prev]
      const [item] = next.splice(info.startIndex, 1)
      next.splice(targetIndex, 0, item)
      return next
    })

    try {
      await onReorder(info.startIndex, targetIndex)
    } catch {
      setList(pages)
    } finally {
      suppressSync.current = false
    }
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[80vh] flex flex-col ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-4 shrink-0">
          <h2 className="text-lg font-bold text-stone-800">Manage Pages</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={onAddPage}
              className="text-stone-400 hover:text-jade w-8 h-8 flex items-center justify-center rounded-full hover:bg-lagoon-50"
            >
              <Plus size={18} weight="bold" />
            </button>
            <button
              onClick={close}
              className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
            >
              &times;
            </button>
          </div>
        </div>

        {list.length === 0 ? (
          <div className="px-5 pb-8 text-center">
            <p className="text-stone-500 text-sm mb-4">No pages yet.</p>
            <button
              onClick={onAddPage}
              className="px-5 py-2.5 bg-jade hover:bg-jade-700 text-white font-medium rounded-lg transition-colors"
            >
              + Add Page
            </button>
          </div>
        ) : (
          <div className="px-5 pb-5 flex gap-3 overflow-y-auto">
            <div className="flex flex-col gap-2 pr-3 border-r border-stone-200 shrink-0">
              {sortedDates.map((dateStr, i) => (
                <div
                  key={i}
                  style={{ height: ROW_HEIGHT }}
                  className="flex items-center justify-end text-xs font-medium text-stone-400 tabular-nums whitespace-nowrap"
                >
                  {shortDate(dateStr)}
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col gap-2 min-w-0">
              {list.map((page, i) => {
                const dragging = page.id === draggingId
                return (
                  <div
                    key={page.id}
                    ref={el => (rowRefs.current[i] = el)}
                    style={{ height: ROW_HEIGHT, ...(dragging ? { position: 'relative', zIndex: 10 } : null) }}
                    className={`flex items-center gap-2 px-3 rounded-xl border-2 bg-white ${
                      dragging ? 'border-jade shadow-lg' : 'border-stone-200 transition-transform'
                    }`}
                  >
                    <button
                      onPointerDown={e => handlePointerDown(e, page.id)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                      className="shrink-0 w-8 h-8 flex items-center justify-center text-stone-400 hover:text-stone-600 cursor-grab active:cursor-grabbing touch-none"
                    >
                      <DotsSixVertical size={18} weight="bold" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-stone-800 truncate">{page.title}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
