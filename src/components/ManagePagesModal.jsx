import { useState, useEffect, useRef } from 'react'
import { DotsSixVertical, Plus, ArrowLeft, DotsThreeVertical, PencilSimple, Trash, Check, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

const ANIM_IN  = 300  // matches slide-in-right 0.3s
const ANIM_OUT = 200  // matches slide-out-right 0.2s

function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  const month = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  return { month, day: d }
}

export default function ManagePagesPage({
  pages, isAdmin, pageNoun, pageNounPlural,
  onReorder, onAddPage, onDeletePage, onRenamePage, onClose,
}) {
  const [exiting, setExiting] = useState(false)
  const [list, setList] = useState(pages)
  const [draggingId, setDraggingId] = useState(null)
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const rowRefs = useRef([])
  const dragInfo = useRef(null)
  const suppressSync = useRef(false)
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (!suppressSync.current) {
      setList(pages)
      // Truncate stale refs left over from deleted rows
      rowRefs.current.length = pages.length
    }
  }, [pages])

  // Fixed date anchors — position 0 is always the earliest date
  const sortedDates = [...pages]
    .sort((a, b) => a.week_date.localeCompare(b.week_date))
    .map(p => p.week_date)

  function handleClose() {
    setExiting(true)
    setTimeout(onClose, ANIM_OUT)
  }

  function clearTransforms() {
    rowRefs.current.forEach(el => { if (el) el.style.transform = '' })
  }

  function handlePointerDown(e, id) {
    if (renamingId) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const index = list.findIndex(p => p.id === id)
    const node = rowRefs.current[index]
    const neighbor = rowRefs.current[index + 1] ?? rowRefs.current[index - 1]
    const spacing = node && neighbor
      ? Math.abs(neighbor.getBoundingClientRect().top - node.getBoundingClientRect().top)
      : 76
    dragInfo.current = { id, startIndex: index, startClientY: e.clientY, spacing, node, lastSteps: 0, length: list.length }
    suppressSync.current = true
    setDraggingId(id)
  }

  function handlePointerMove(e) {
    const info = dragInfo.current
    if (!info) return
    const deltaY = e.clientY - info.startClientY
    if (info.node) info.node.style.transform = `translateY(${deltaY}px) scale(1.02)`

    const rawSteps = Math.round(deltaY / info.spacing)
    const steps = Math.min(Math.max(rawSteps, -info.startIndex), info.length - 1 - info.startIndex)
    if (steps === info.lastSteps) return
    info.lastSteps = steps

    const targetIndex = info.startIndex + steps
    for (let i = 0; i < info.length; i++) {
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

  function startRename(page) {
    setMenuOpenId(null)
    setRenamingId(page.id)
    setRenameValue(page.title)
    setTimeout(() => renameInputRef.current?.focus(), 50)
  }

  async function submitRename() {
    if (!renameValue.trim() || renaming) return
    setRenaming(true)
    try {
      await onRenamePage(renamingId, renameValue.trim())
    } finally {
      setRenaming(false)
      setRenamingId(null)
    }
  }

  async function handleDelete(pageId) {
    if (confirmDeleteId !== pageId) {
      setMenuOpenId(null)
      setConfirmDeleteId(pageId)
      return
    }
    setDeleting(true)
    try {
      await onDeletePage(pageId)
      setList(prev => prev.filter(p => p.id !== pageId))
    } finally {
      setDeleting(false)
      setConfirmDeleteId(null)
    }
  }

  return (
    <div
      className={`fixed inset-0 lg:left-56 z-50 bg-sunrise-50 flex flex-col ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      onClick={() => { setMenuOpenId(null); setConfirmDeleteId(null) }}
    >
      {/* Header — no white bar, sits directly on page background */}
      <div className="max-w-3xl mx-auto w-full px-4 pt-8 pb-4 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <button
            onClick={handleClose}
            aria-label="Back"
            className="w-9 h-9 flex items-center justify-center rounded-full text-stone-500 hover:text-stone-800 hover:bg-stone-200 active:bg-stone-300 transition-colors shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="flex-1 text-3xl font-bold text-stone-800">Manage {pageNounPlural}</h1>
          <button
            onClick={onAddPage}
            aria-label={`Add ${pageNoun}`}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-ember hover:bg-ember-700 active:bg-ember-800 text-white transition-colors shrink-0"
          >
            <Plus size={20} weight="bold" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto" onClick={e => e.stopPropagation()}>
        {list.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-8 text-center">
            <p className="text-stone-500 text-sm mb-5">No {pageNounPlural.toLowerCase()} yet.</p>
            <button
              onClick={onAddPage}
              className="px-5 py-2.5 bg-ember hover:bg-ember-700 text-white font-medium rounded-xl transition-colors"
            >
              + Add {pageNoun}
            </button>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-4 pb-8 flex flex-col gap-3">
            {list.map((page, i) => {
              const isDragging = page.id === draggingId
              const isRenaming = page.id === renamingId
              const isConfirmingDelete = page.id === confirmDeleteId
              const { month, day } = shortDate(sortedDates[i] ?? page.week_date)

              return (
                <div
                  key={page.id}
                  ref={el => (rowRefs.current[i] = el)}
                  style={isDragging ? { position: 'relative', zIndex: 10 } : {}}
                  className={`bg-white rounded-2xl border flex items-center gap-3 px-4 py-3.5 ${
                    isDragging
                      ? 'border-ember shadow-xl'
                      : 'border-stone-100 shadow-sm transition-transform duration-150'
                  }`}
                >
                  {/* Drag handle */}
                  <button
                    onPointerDown={e => handlePointerDown(e, page.id)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className="shrink-0 w-8 h-8 flex items-center justify-center text-stone-300 hover:text-stone-500 cursor-grab active:cursor-grabbing touch-none"
                    aria-label="Drag to reorder"
                  >
                    <DotsSixVertical size={18} weight="bold" />
                  </button>

                  {/* Date badge */}
                  <div className="shrink-0 w-10 h-10 flex flex-col items-center justify-center bg-ember/10 rounded-xl">
                    <span className="text-[10px] font-semibold text-ember uppercase tracking-wide leading-none">{month}</span>
                    <span className="text-base font-bold text-ember leading-tight">{day}</span>
                  </div>

                  {/* Title or rename input */}
                  {isRenaming ? (
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') submitRename()
                        if (e.key === 'Escape') setRenamingId(null)
                      }}
                      className="flex-1 min-w-0 text-sm font-semibold text-stone-800 bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
                    />
                  ) : (
                    <span className="flex-1 min-w-0 text-sm font-semibold text-stone-800 truncate">{page.title}</span>
                  )}

                  {/* Action area */}
                  {isRenaming ? (
                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        onClick={submitRename}
                        disabled={renaming || !renameValue.trim()}
                        className="w-8 h-8 flex items-center justify-center rounded-xl bg-ember text-white disabled:opacity-40 transition-colors"
                        aria-label="Save name"
                      >
                        {renaming
                          ? <div className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          : <Check size={14} weight="bold" />
                        }
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 transition-colors"
                        aria-label="Cancel rename"
                      >
                        <X size={14} weight="bold" />
                      </button>
                    </div>
                  ) : isConfirmingDelete ? (
                    <div className="shrink-0 flex items-center gap-1.5">
                      <button
                        onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                        className="px-2 py-1 text-xs text-stone-400 hover:text-stone-600 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(page.id) }}
                        disabled={deleting}
                        className="px-2.5 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg disabled:opacity-40 transition-colors"
                      >
                        {deleting ? 'Deleting…' : 'Delete'}
                      </button>
                    </div>
                  ) : (
                    <div className="shrink-0 relative" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setMenuOpenId(id => id === page.id ? null : page.id)
                          setConfirmDeleteId(null)
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 active:bg-stone-200 transition-colors"
                        aria-label="Page options"
                      >
                        <DotsThreeVertical size={16} weight="bold" />
                      </button>
                      <AnimatePresence>
                        {menuOpenId === page.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -4 }}
                            transition={{ duration: 0.12 }}
                            style={{ transformOrigin: 'top right' }}
                            className="absolute right-0 top-9 z-10 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden w-36"
                            onClick={e => e.stopPropagation()}
                          >
                            <button
                              onClick={() => startRename(page)}
                              className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                            >
                              <PencilSimple size={14} className="text-stone-500" />
                              Rename
                            </button>
                            {onDeletePage && (
                              <>
                                <div className="h-px bg-stone-100" />
                                <button
                                  onClick={() => handleDelete(page.id)}
                                  className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                                >
                                  <Trash size={14} />
                                  Delete
                                </button>
                              </>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
