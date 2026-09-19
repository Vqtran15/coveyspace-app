import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, LayoutGroup } from 'framer-motion'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import LinkExt from '@tiptap/extension-link'
import TextAlignExt from '@tiptap/extension-text-align'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, PaperPlaneRight, Megaphone, Church, Check, X,
  ListBullets, ListNumbers, LinkSimple, CaretDown,
  TextAlignLeft, TextAlignCenter, TextAlignRight,
  TextB, TextItalic, TextUnderline, TextStrikethrough,
  TextIndent, TextOutdent, ArrowsClockwise, CheckCircle, Copy, Envelope,
  MagnifyingGlass, ClockCounterClockwise,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { db } from '../lib/db.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { useToast } from '../lib/toast.jsx'
import { BroadcastCard } from './ChurchBroadcastView.jsx'

// ── Toolbar helpers ────────────────────────────────────────────────────────────

function TBtn({ active, disabled, onActivate, title, children }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); if (!disabled) onActivate() }}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors select-none shrink-0 ${
        active
          ? 'bg-ember text-white'
          : 'text-stone-500 hover:bg-stone-100 active:bg-stone-200 disabled:opacity-25 disabled:pointer-events-none'
      }`}
    >
      {children}
    </button>
  )
}

function TSep() {
  return <div className="w-px h-5 bg-stone-200 mx-0.5 shrink-0" />
}

// ── Confirm-send modal ─────────────────────────────────────────────────────────

function ConfirmSendModal({ sending, summary, onCancel, onConfirm, closing }) {
  return (
    <>
      <div className={`fixed inset-0 bg-black/40 z-[45] ${closing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`} onClick={onCancel} />
      <div
        className={`fixed inset-x-4 bottom-4 lg:inset-x-0 lg:mx-auto lg:w-full lg:max-w-sm lg:bottom-8 z-[46] bg-white rounded-2xl shadow-xl px-5 pt-5 ${closing ? 'animate-sheet-out' : 'animate-modal-in'}`}
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-bold text-stone-800 mb-1">Send Announcement?</h3>
        <p className="text-sm text-stone-500 mb-5">{summary}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-600 text-sm font-semibold hover:bg-stone-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={sending}
            className="flex-1 py-3 rounded-xl bg-ember text-white text-sm font-semibold hover:bg-ember-700 transition-colors disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </>
  )
}

// ── Broadcast composer ─────────────────────────────────────────────────────────
// convIds: { allMembers: string, adminsOnly: string }
// Picks the right conversation based on the audience the admin selects.

function BroadcastComposer({ churchId, convIds, groupsInChurch, displayName, userId, onSent, onClose }) {
  const [targetMode, setTargetMode]             = useState('all')
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set())
  const [audience, setAudience]                 = useState('all_members')
  const [sending, setSending]                   = useState(false)
  const [exiting, setExiting]                   = useState(false)
  const [confirmOpen, setConfirmOpen]           = useState(false)
  const [confirmClosing, setConfirmClosing]     = useState(false)
  const [previewMode, setPreviewMode]           = useState(false)
  const [linkDialogOpen, setLinkDialogOpen]     = useState(false)
  const [linkDialogClosing, setLinkDialogClosing] = useState(false)
  const [linkUrl, setLinkUrl]                   = useState('')
  const [linkText, setLinkText]                 = useState('')
  const [savedRange, setSavedRange]             = useState(null)
  const linkTextInputRef = useRef(null)
  const linkUrlInputRef  = useRef(null)
  const composerRef      = useRef(null)
  const scrollBodyRef    = useRef(null)

  useEffect(() => {
    // Lock body scroll so iOS doesn't scroll the underlying page into view
    // when the Tiptap contenteditable receives focus
    const prevBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const vp = window.visualViewport
    if (!vp) {
      if (composerRef.current) {
        composerRef.current.style.top = '0px'
        composerRef.current.style.height = `${window.innerHeight}px`
      }
      return () => { document.body.style.overflow = prevBodyOverflow }
    }

    let prevH = vp.height
    const sync = () => {
      if (!composerRef.current) return
      // top and height are both set via JS so that no conflicting CSS bottom:0
      // constraint interferes, and so that offsetTop (the visual viewport's
      // position within the layout viewport) is tracked when the keyboard opens.
      composerRef.current.style.top = `${vp.offsetTop}px`
      composerRef.current.style.height = `${vp.height}px`
      if (vp.height < prevH) {
        scrollBodyRef.current?.scrollTo({ top: scrollBodyRef.current.scrollHeight })
      }
      prevH = vp.height
    }
    sync() // initialize immediately so the initial render doesn't rely on the JSX expression
    vp.addEventListener('resize', sync)
    vp.addEventListener('scroll', sync)
    return () => {
      vp.removeEventListener('resize', sync)
      vp.removeEventListener('scroll', sync)
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  const [editorEmpty, setEditorEmpty] = useState(true)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2] } }),
      UnderlineExt,
      LinkExt.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      TextAlignExt.configure({ types: ['heading', 'paragraph'] }),
    ],
    editorProps: {
      attributes: { class: 'broadcast-editor outline-none min-h-[240px] text-sm text-stone-800 leading-relaxed' },
    },
    onUpdate: ({ editor }) => setEditorEmpty(editor.isEmpty),
  })

  function handleClose() {
    setExiting(true)
    setTimeout(onClose, 200)
  }

  async function doSend() {
    if (!editor) return
    setSending(true)
    const body = editor.getHTML()
    const targetGroupIds = targetMode === 'select' && selectedGroupIds.size > 0
      ? [...selectedGroupIds] : null
    const convId = audience === 'admins_only' ? convIds.adminsOnly : convIds.allMembers
    const { data, error } = await db.churches.sendMessage({
      churchId, convId, userId, displayName, body, audience, targetGroupIds,
    })
    setSending(false)
    if (!error && data) { onSent(data); handleClose() }
  }

  function openLinkDialog() {
    if (!editor) return
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, ' ')
    const existingHref = editor.getAttributes('link').href ?? ''
    setLinkText(selectedText)
    setLinkUrl(existingHref)
    setSavedRange({ from, to })
    setLinkDialogOpen(true)
    setTimeout(() => {
      if (selectedText) linkUrlInputRef.current?.focus()
      else linkTextInputRef.current?.focus()
    }, 40)
  }

  function closeConfirm() {
    setConfirmClosing(true)
    setTimeout(() => { setConfirmOpen(false); setConfirmClosing(false) }, 250)
  }

  function closeLinkDialog() {
    setLinkDialogClosing(true)
    setTimeout(() => {
      setLinkDialogOpen(false)
      setLinkDialogClosing(false)
      setLinkUrl('')
      setLinkText('')
      setSavedRange(null)
    }, 220)
  }

  function applyLinkDialog() {
    if (!editor || !savedRange) return
    const url  = linkUrl.trim()
    const text = linkText.trim()
    const normalizedUrl = url && !url.match(/^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//) ? `https://${url}` : url

    if (!normalizedUrl) {
      editor.chain().focus().setTextSelection(savedRange).unsetLink().run()
    } else if (text) {
      editor.chain()
        .focus()
        .setTextSelection(savedRange)
        .insertContent({ type: 'text', text, marks: [{ type: 'link', attrs: { href: normalizedUrl, target: '_blank', rel: 'noopener noreferrer' } }] })
        .run()
    } else {
      editor.chain().focus().setTextSelection(savedRange).setLink({ href: normalizedUrl }).run()
    }
    closeLinkDialog()
  }

  function removeLinkDialog() {
    if (!editor || !savedRange) return
    editor.chain().focus().setTextSelection(savedRange).unsetLink().run()
    closeLinkDialog()
  }

  function toggleGroup(id) {
    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const sendDisabled = editorEmpty || sending || (targetMode === 'select' && selectedGroupIds.size === 0)

  const headingLevel = editor?.isActive('heading', { level: 1 }) ? '1'
    : editor?.isActive('heading', { level: 2 }) ? '2'
    : ''

  const groupNames = targetMode === 'select' && selectedGroupIds.size > 0
    ? [...selectedGroupIds].map(id => groupsInChurch.find(g => g.id === id)?.name).filter(Boolean)
    : null
  const confirmSummary = `To: ${groupNames ? groupNames.join(', ') : 'All groups'} · ${
    audience === 'admins_only' ? 'Group Admins only' : 'All members'
  }`

  return createPortal(
    <>
    <div
      className="fixed left-0 right-0 bg-sunrise-50 z-[69]"
      style={{ top: 0, height: 'calc(100dvh + 400px)' }}
      aria-hidden="true"
    />
    <div
      ref={composerRef}
      className={`fixed left-0 right-0 z-[70] bg-sunrise-50 flex flex-col ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)', top: 0, height: '100dvh' }}
    >
      {/* Header */}
      <div className="shrink-0 py-3">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3">
          <button
            onClick={handleClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 transition-colors"
            aria-label="Cancel"
          >
            <ArrowLeft size={22} weight="bold" />
          </button>
          <h2 className="flex-1 text-lg font-bold text-stone-800">New Announcement</h2>
          <button
            onClick={() => !sendDisabled && setConfirmOpen(true)}
            disabled={sendDisabled}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-ember hover:bg-ember/10 transition-colors disabled:opacity-40"
            aria-label="Send announcement"
          >
            <PaperPlaneRight size={22} weight="fill" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div ref={scrollBodyRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div
          className="max-w-2xl mx-auto px-4 py-4 space-y-4"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >

          {/* Send to — only shown when church has multiple groups */}
          {groupsInChurch.length > 1 && (
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-4 py-4 space-y-3">
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Send to</p>
              <LayoutGroup id="broadcast-target">
                <div className="bg-stone-100 rounded-xl p-1 flex">
                  <button
                    type="button"
                    onClick={() => setTargetMode('all')}
                    className={`flex-1 relative flex items-center justify-center py-2 text-sm font-medium rounded-lg transition-colors ${targetMode === 'all' ? 'text-white' : 'text-stone-500'}`}
                  >
                    {targetMode === 'all' && (
                      <motion.span
                        layoutId="broadcast-target-pill"
                        className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10">All groups</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetMode('select')}
                    className={`flex-1 relative flex items-center justify-center py-2 text-sm font-medium rounded-lg transition-colors ${targetMode === 'select' ? 'text-white' : 'text-stone-500'}`}
                  >
                    {targetMode === 'select' && (
                      <motion.span
                        layoutId="broadcast-target-pill"
                        className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                    <span className="relative z-10">Select groups</span>
                  </button>
                </div>
              </LayoutGroup>
              {targetMode === 'select' && (
                <div className="space-y-0.5 -mx-1">
                  {groupsInChurch.map(g => {
                    const selected = selectedGroupIds.has(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroup(g.id)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 transition-colors"
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-ember border-ember' : 'border-stone-300'}`}>
                          {selected && <Check size={11} weight="bold" className="text-white" />}
                        </div>
                        <span className="text-sm text-stone-700">{g.name}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Audience */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-4 py-4 space-y-3">
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Audience</p>
            <LayoutGroup id="broadcast-audience">
              <div className="bg-stone-100 rounded-xl p-1 flex">
                <button
                  type="button"
                  onClick={() => setAudience('all_members')}
                  className={`flex-1 relative flex items-center justify-center py-2 text-sm font-medium rounded-lg transition-colors ${audience === 'all_members' ? 'text-white' : 'text-stone-500'}`}
                >
                  {audience === 'all_members' && (
                    <motion.span
                      layoutId="broadcast-audience-pill"
                      className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">All members</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAudience('admins_only')}
                  className={`flex-1 relative flex items-center justify-center py-2 text-sm font-medium rounded-lg transition-colors ${audience === 'admins_only' ? 'text-white' : 'text-stone-500'}`}
                >
                  {audience === 'admins_only' && (
                    <motion.span
                      layoutId="broadcast-audience-pill"
                      className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative z-10">Group Admins only</span>
                </button>
              </div>
            </LayoutGroup>
          </div>

          {/* Edit / Preview toggle */}
          <LayoutGroup id="broadcast-preview">
            <div className="flex bg-stone-100 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setPreviewMode(false)}
                aria-pressed={!previewMode}
                className={`flex-1 relative flex items-center justify-center py-2 text-sm font-semibold rounded-lg transition-colors ${!previewMode ? 'text-white' : 'text-stone-500 hover:text-stone-700'}`}
              >
                {!previewMode && (
                  <motion.span
                    layoutId="broadcast-preview-pill"
                    className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode(true)}
                aria-pressed={previewMode}
                className={`flex-1 relative flex items-center justify-center py-2 text-sm font-semibold rounded-lg transition-colors ${previewMode ? 'text-white' : 'text-stone-500 hover:text-stone-700'}`}
              >
                {previewMode && (
                  <motion.span
                    layoutId="broadcast-preview-pill"
                    className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Preview</span>
              </button>
            </div>
          </LayoutGroup>

          {previewMode ? (
            <>
              {editorEmpty ? (
                <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-5 py-8 text-center">
                  <p className="text-sm text-stone-500">Nothing to preview yet — write something first.</p>
                </div>
              ) : (
                <BroadcastCard
                  msg={{
                    display_name: displayName,
                    body: editor?.getHTML() ?? '',
                    created_at: new Date().toISOString(),
                    audience,
                    target_group_ids: targetMode === 'select' ? [...selectedGroupIds] : null,
                  }}
                  isChurchAdmin={true}
                  groupsInChurch={groupsInChurch}
                  isAdminOnly={audience === 'admins_only'}
                />
              )}
            </>
          ) : (
            /* Editor card — toolbar on top, content below */
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-ember focus-within:border-transparent transition-all">
              <div className="border-b border-stone-100 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-0.5 px-3 py-1.5 min-w-max">
                  <select
                    value={headingLevel}
                    onChange={e => {
                      const v = e.target.value
                      if (!v) editor?.chain().focus().setParagraph().run()
                      else editor?.chain().focus().setHeading({ level: parseInt(v) }).run()
                    }}
                    className="h-8 pl-2 pr-6 text-xs font-medium border border-stone-200 rounded-lg bg-white text-stone-700 focus:outline-none focus:ring-1 focus:ring-ember shrink-0"
                    style={{
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23a8a29e'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 6px center',
                    }}
                  >
                    <option value="">Normal</option>
                    <option value="2">Large</option>
                    <option value="1">XL</option>
                  </select>
                  <TSep />
                  <TBtn active={editor?.isActive('bold')} onActivate={() => editor?.chain().focus().toggleBold().run()} title="Bold">
                    <TextB size={15} weight="bold" />
                  </TBtn>
                  <TBtn active={editor?.isActive('italic')} onActivate={() => editor?.chain().focus().toggleItalic().run()} title="Italic">
                    <TextItalic size={15} />
                  </TBtn>
                  <TBtn active={editor?.isActive('underline')} onActivate={() => editor?.chain().focus().toggleUnderline().run()} title="Underline">
                    <TextUnderline size={15} />
                  </TBtn>
                  <TBtn active={editor?.isActive('strike')} onActivate={() => editor?.chain().focus().toggleStrike().run()} title="Strikethrough">
                    <TextStrikethrough size={15} />
                  </TBtn>
                  <TSep />
                  <TBtn active={editor?.isActive('bulletList')} onActivate={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list">
                    <ListBullets size={15} />
                  </TBtn>
                  <TBtn active={editor?.isActive('orderedList')} onActivate={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered list">
                    <ListNumbers size={15} />
                  </TBtn>
                  <TBtn
                    onActivate={() => editor?.chain().focus().sinkListItem('listItem').run()}
                    disabled={!editor?.can().sinkListItem('listItem')}
                    title="Indent"
                  >
                    <TextIndent size={15} />
                  </TBtn>
                  <TBtn
                    onActivate={() => editor?.chain().focus().liftListItem('listItem').run()}
                    disabled={!editor?.can().liftListItem('listItem')}
                    title="Outdent"
                  >
                    <TextOutdent size={15} />
                  </TBtn>
                  <TSep />
                  <TBtn active={editor?.isActive({ textAlign: 'left' })} onActivate={() => editor?.chain().focus().setTextAlign('left').run()} title="Align left">
                    <TextAlignLeft size={15} />
                  </TBtn>
                  <TBtn active={editor?.isActive({ textAlign: 'center' })} onActivate={() => editor?.chain().focus().setTextAlign('center').run()} title="Align center">
                    <TextAlignCenter size={15} />
                  </TBtn>
                  <TBtn active={editor?.isActive({ textAlign: 'right' })} onActivate={() => editor?.chain().focus().setTextAlign('right').run()} title="Align right">
                    <TextAlignRight size={15} />
                  </TBtn>
                  <TSep />
                  <TBtn active={editor?.isActive('link') || linkDialogOpen} onActivate={openLinkDialog} title="Link">
                    <LinkSimple size={15} />
                  </TBtn>
                </div>
              </div>

              <div className="px-4 pt-3 pb-4">
                <EditorContent editor={editor} />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Link dialog */}
      {(linkDialogOpen || linkDialogClosing) && (
        <>
          <div className={`fixed inset-0 z-[80] bg-black/40 ${linkDialogClosing ? 'animate-backdrop-out' : 'animate-backdrop-in'}`} onClick={closeLinkDialog} />
          <div
            className={`fixed inset-x-4 z-[81] bg-white rounded-2xl shadow-xl p-5 space-y-4 ${linkDialogClosing ? 'animate-popup-out' : 'animate-popup-in'}`}
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-stone-800">Insert Link</h3>
              <button
                type="button"
                onClick={closeLinkDialog}
                className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">Text</label>
                <input
                  ref={linkTextInputRef}
                  type="text"
                  value={linkText}
                  onChange={e => setLinkText(e.target.value)}
                  placeholder="Display text"
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5">URL</label>
                <input
                  ref={linkUrlInputRef}
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); applyLinkDialog() }
                    if (e.key === 'Escape') closeLinkDialog()
                  }}
                  placeholder="https://example.com"
                  className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              {editor?.isActive('link') && (
                <button
                  type="button"
                  onClick={removeLinkDialog}
                  className="px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-medium hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              )}
              <button
                type="button"
                onClick={applyLinkDialog}
                disabled={!linkUrl.trim() && !linkText.trim()}
                className="flex-1 py-2.5 rounded-xl bg-ember text-white text-sm font-semibold hover:bg-ember-700 transition-colors disabled:opacity-40"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}

      {(confirmOpen || confirmClosing) && (
        <ConfirmSendModal
          sending={sending}
          summary={confirmSummary}
          closing={confirmClosing}
          onCancel={closeConfirm}
          onConfirm={doSend}
        />
      )}
    </div>
    </>,
    document.body
  )
}

// ── PCO member row (shared by group list and search results) ──────────────────

function PcoMemberRow({ member, isMember, inviteRecord, sending, onCopyLink, onInvite, daysAgo }) {
  // Priority: 1) already a group member, 2) joined via invite, 3) pending invite, 4) never invited
  const joined = isMember || !!inviteRecord?.joined_at
  const hasPendingInvite = inviteRecord && !inviteRecord.joined_at && !isMember

  // Resend is available 3+ days after the last send
  const canResend = hasPendingInvite &&
    (Date.now() - new Date(inviteRecord.last_sent_at).getTime()) >= 3 * 86_400_000

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-800 truncate">{member.name}</p>
        <p className="text-xs text-stone-400 truncate">{member.email ?? 'No email in PCO'}</p>
      </div>

      {!member.email ? (
        <span className="text-xs text-stone-300 shrink-0">Can't invite</span>
      ) : joined ? (
        <div className="flex items-center gap-1 text-sage-700 shrink-0">
          <CheckCircle size={14} weight="fill" />
          <span className="text-xs font-medium">Member</span>
        </div>
      ) : hasPendingInvite ? (
        <div className="flex items-center gap-2 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1 text-stone-400">
              <ClockCounterClockwise size={12} />
              <span className="text-xs">Invited {daysAgo(inviteRecord.last_sent_at)}</span>
            </div>
            {inviteRecord.send_count > 1 && (
              <p className="text-xs text-stone-300">{inviteRecord.send_count}× sent</p>
            )}
          </div>
          {canResend && (
            <button
              onClick={onInvite}
              disabled={sending}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold border border-stone-200 text-stone-500 hover:border-ember hover:text-ember hover:bg-ember/5 transition-colors disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Resend'}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={onCopyLink}
            aria-label="Copy invite link"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300 transition-colors"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={onInvite}
            disabled={sending}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-ember text-white hover:bg-ember-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? 'Sending…' : <><Envelope size={12} weight="bold" />Invite</>}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ChurchSettingsPage() {
  const { userId, displayName, groupId, groupName, churchId, churchName, churchConversations, isChurchAdmin } = useAppContext()
  const navigate  = useNavigate()
  const location  = useLocation()
  const toast     = useToast()

  // Conversations split by type
  const allMembersConv  = churchConversations.find(c => c.type === 'all_members')
  const adminsOnlyConv  = churchConversations.find(c => c.type === 'admins_only')
  const convIds = {
    allMembers:  allMembersConv?.id  ?? null,
    adminsOnly:  adminsOnlyConv?.id  ?? null,
  }

  // Broadcast state
  const [broadcastMessages, setBroadcastMessages] = useState([])
  const [broadcastLoading, setBroadcastLoading]   = useState(true)
  const [composerOpen, setComposerOpen]           = useState(false)
  const [groupsInChurch, setGroupsInChurch]       = useState([])

  // PCO state
  const [pcoConnection, setPcoConnection]         = useState(undefined)
  const [pcoConnecting, setPcoConnecting]         = useState(false)
  const [pcoDisconnecting, setPcoDisconnecting]   = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [pcoGroups, setPcoGroups]                 = useState([])
  const [pcoGroupsLoading, setPcoGroupsLoading]   = useState(false)
  const [pcoGroupsError, setPcoGroupsError]       = useState(null)
  const [selectedPcoGroup, setSelectedPcoGroup]   = useState(null)
  const [pcoMembers, setPcoMembers]               = useState([])
  const [pcoMembersLoading, setPcoMembersLoading] = useState(false)
  const [memberStatuses, setMemberStatuses]       = useState({})
  const [inviteSending, setInviteSending]         = useState({})
  const [inviteCode, setInviteCode]               = useState(null)
  const [churchJoinCode, setChurchJoinCode]       = useState(null)
  const [confirmRotateChurchCode, setConfirmRotateChurchCode] = useState(false)
  const [churchCodeRotating, setChurchCodeRotating]           = useState(false)
  const [activeTab, setActiveTab]                 = useState('broadcasts')
  const [tabAnimKey, setTabAnimKey]               = useState(0)
  const [tabAnimClass, setTabAnimClass]           = useState('')
  const TAB_ORDER = { broadcasts: 0, planning_center: 1 }
  function switchTab(id) {
    if (id === activeTab) return
    const goingRight = TAB_ORDER[id] > TAB_ORDER[activeTab]
    setTabAnimClass(goingRight ? 'animate-slide-out-left' : 'animate-slide-out-right')
    setTimeout(() => {
      setTabAnimClass(goingRight ? 'animate-slide-in-right' : 'animate-slide-in-left')
      setTabAnimKey(k => k + 1)
      setActiveTab(id)
    }, 200)
  }
  // Which Coveyspace group to invite PCO members into
  const [selectedCoveyGroupId, setSelectedCoveyGroupId] = useState(null)
  const [coveyGroupInviteCode, setCoveyGroupInviteCode] = useState(null)
  const [coveyGroupInviteLoading, setCoveyGroupInviteLoading] = useState(false)

  // Invite history: { [email]: { sent_at, last_sent_at, send_count, joined_at } }
  const [inviteHistory, setInviteHistory] = useState({})

  // PCO people search
  const [pcoSearchQuery, setPcoSearchQuery] = useState('')
  const [pcoSearchResults, setPcoSearchResults] = useState([])
  const [pcoSearchLoading, setPcoSearchLoading] = useState(false)
  const [pcoSearchStatuses, setPcoSearchStatuses] = useState({})
  const [pcoSearchInviteHistory, setPcoSearchInviteHistory] = useState({})
  const [pcoSearchSending, setPcoSearchSending] = useState({})
  const pcoSearchDebounceRef = useRef(null)

  // Load broadcasts from both conversations merged by date
  useEffect(() => {
    if (!churchId) { setBroadcastLoading(false); return }
    setBroadcastLoading(true)
    const convIdList = [allMembersConv?.id, adminsOnlyConv?.id].filter(Boolean)
    if (!convIdList.length) { setBroadcastLoading(false); return }

    Promise.all(convIdList.map(id => db.churches.fetchMessages(id))).then(results => {
      const merged = results
        .flatMap(r => r.data ?? [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      setBroadcastMessages(merged)
      setBroadcastLoading(false)
    })
  }, [churchId, allMembersConv?.id, adminsOnlyConv?.id])

  // Load groups in church (for targeting)
  useEffect(() => {
    if (!churchId) return
    supabase
      .from('community_groups')
      .select('id, name')
      .eq('church_id', churchId)
      .order('name')
      .then(({ data }) => setGroupsInChurch(data ?? []))
  }, [churchId])

  // Load PCO connection + default invite target to admin's own group
  useEffect(() => {
    if (!isChurchAdmin) return
    supabase.rpc('get_pco_connection').then(({ data }) => setPcoConnection(data?.[0] ?? null))
    supabase.rpc('get_invite_code').then(({ data }) => setInviteCode(data ?? null))
    db.churches.getJoinCode().then(({ data }) => setChurchJoinCode(data ?? null))
    if (groupId) setSelectedCoveyGroupId(groupId)
  }, [groupId, isChurchAdmin])

  // Fetch invite code for the selected Coveyspace target group
  useEffect(() => {
    if (!selectedCoveyGroupId) { setCoveyGroupInviteCode(null); return }
    // If it's the admin's own group, reuse the already-fetched code
    if (selectedCoveyGroupId === groupId) { setCoveyGroupInviteCode(inviteCode); return }
    setCoveyGroupInviteLoading(true)
    db.churches.getGroupInviteCode(selectedCoveyGroupId).then(({ data, error }) => {
      setCoveyGroupInviteCode(error ? null : (data ?? null))
      setCoveyGroupInviteLoading(false)
    })
  }, [selectedCoveyGroupId, groupId, inviteCode])

  // Auto-load PCO groups when connected
  useEffect(() => {
    if (pcoConnection) loadPcoGroups()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pcoConnection])

  // Re-check member statuses + invite history when target Coveyspace group changes
  useEffect(() => {
    if (pcoMembers.length > 0 && selectedCoveyGroupId) {
      setMemberStatuses({})
      refreshMemberStatuses(pcoMembers, selectedCoveyGroupId)
    }
    if (selectedCoveyGroupId) loadInviteHistory(selectedCoveyGroupId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCoveyGroupId])

  // Handle OAuth callback ?pco= param
  useEffect(() => {
    const params   = new URLSearchParams(location.search)
    const pcoStatus = params.get('pco')
    if (!pcoStatus) return
    navigate(location.pathname, { replace: true })
    if (pcoStatus === 'connected') {
      supabase.rpc('get_pco_connection').then(({ data }) => setPcoConnection(data?.[0] ?? null))
      toast('Planning Center connected!', 'success')
    } else if (pcoStatus === 'error') {
      toast('Planning Center connection failed. Please try again.', 'error')
    }
  }, [location.search])

  // Prepend new broadcasts as they arrive via realtime
  const handleSent = useCallback((msg) => {
    setBroadcastMessages(prev => [msg, ...prev])
  }, [])

  // ── PCO helpers ──────────────────────────────────────────────────────────────

  async function loadPcoGroups() {
    setPcoGroupsLoading(true)
    setPcoGroupsError(null)
    try {
      const { data, error } = await supabase.functions.invoke('pco-api', {
        body: { path: '/groups/v2/groups?per_page=100&order=name' },
      })
      if (error) {
        console.error('[PCO] groups load error:', error)
        setPcoGroupsError(error?.message ?? 'Failed to load groups')
        return
      }
      if (data?.data) {
        const groups = data.data.map(g => ({ id: g.id, name: g.attributes.name }))
        setPcoGroups(groups)
        const syncId = pcoConnection?.pco_sync_group_id
        if (syncId && groups.some(g => g.id === syncId)) {
          setSelectedPcoGroup(syncId)
          loadPcoMembers(syncId)
        }
      } else if (data?.errors) {
        const msg = data.errors?.[0]?.title ?? 'PCO API error'
        console.error('[PCO] API error:', data.errors)
        setPcoGroupsError(msg)
      }
    } finally {
      setPcoGroupsLoading(false)
    }
  }

  async function loadPcoMembers(pcoGroupId, explicitTargetGroupId) {
    setPcoMembersLoading(true)
    setPcoMembers([])
    setMemberStatuses({})

    const { data } = await supabase.functions.invoke('pco-api', {
      body: { path: `/groups/v2/groups/${pcoGroupId}/memberships?include=person&per_page=100` },
    })

    const persons = data?.included?.filter(i => i.type === 'Person') ?? []

    if (persons.length === 0) {
      if (data?.data?.length > 0) {
        setPcoMembers([{ id: '__debug__', name: `${data.data.length} memberships found but no person details returned`, email: null }])
      }
      setPcoMembersLoading(false)
      return
    }

    const ids = persons.map(p => p.id).join(',')
    const { data: peopleData } = await supabase.functions.invoke('pco-api', {
      body: { path: `/people/v2/people?where[id]=${ids}&include=emails&per_page=${persons.length}` },
    })

    const personMap = {}
    peopleData?.data?.forEach(p => {
      personMap[p.id] = {
        name:      p.attributes.name ?? [p.attributes.first_name, p.attributes.last_name].filter(Boolean).join(' ') ?? null,
        email:     p.attributes.email_address ?? null,
        birthdate: p.attributes.birthdate ?? null,
      }
    })
    peopleData?.included
      ?.filter(i => i.type === 'Email')
      ?.forEach(e => {
        const pid = e.relationships?.person?.data?.id
        if (pid && personMap[pid] && !personMap[pid].email && e.attributes?.address) {
          personMap[pid].email = e.attributes.address
        }
      })

    const people = persons.map(p => ({
      id:       p.id,
      name:     personMap[p.id]?.name     ?? p.attributes.name ?? null,
      email:    personMap[p.id]?.email    ?? null,
      birthdate: personMap[p.id]?.birthdate ?? null,
      avatar:   p.attributes.avatar,
    }))

    setPcoMembers(people)
    // explicitTargetGroupId is passed when a saved mapping was just resolved (avoids
    // using stale selectedCoveyGroupId before React re-renders with the new value)
    const gId = explicitTargetGroupId ?? selectedCoveyGroupId
    await Promise.all([
      refreshMemberStatuses(people, gId),
      gId ? loadInviteHistory(gId) : Promise.resolve(),
    ])
    setPcoMembersLoading(false)
  }

  async function refreshMemberStatuses(people, targetGroupId) {
    const withEmail = (people ?? pcoMembers).filter(p => p.email)
    if (!withEmail.length) return
    const emails = withEmail.map(p => p.email)
    const { data: statuses } = await supabase.rpc('check_pco_members', {
      emails,
      target_group_id: targetGroupId ?? selectedCoveyGroupId ?? null,
    })
    const map = {}
    statuses?.forEach(s => { map[s.email.toLowerCase()] = s.in_group })
    setMemberStatuses(map)
  }

  async function loadInviteHistory(targetGroupId) {
    const gId = targetGroupId ?? selectedCoveyGroupId
    if (!gId) return
    const { data } = await db.pco.getInvites(gId)
    const map = {}
    data?.forEach(inv => { map[inv.email.toLowerCase()] = inv })
    setInviteHistory(map)
  }

  async function loadGroupMapping(pcoGroupId) {
    if (!churchId || !pcoGroupId) return null
    const { data } = await db.pco.getMapping(churchId, pcoGroupId)
    const resolvedId = data?.coveyspace_group_id ?? null
    if (resolvedId) setSelectedCoveyGroupId(resolvedId)
    return resolvedId
  }

  async function saveGroupMapping(pcoGroupId, coveyGroupId) {
    if (!churchId || !pcoGroupId || !coveyGroupId) return
    await db.pco.upsertMapping({ churchId, pcoGroupId, coveyspaceGroupId: coveyGroupId })
  }

  // Days-ago helper for invite status labels
  function daysAgo(dateStr) {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
    if (days === 0) return 'today'
    if (days === 1) return '1 day ago'
    return `${days} days ago`
  }

  // Search PCO people by name or email (debounced via pcoSearchDebounceRef)
  async function executePcoSearch(query) {
    if (!query.trim()) {
      setPcoSearchResults([])
      setPcoSearchStatuses({})
      setPcoSearchInviteHistory({})
      return
    }
    setPcoSearchLoading(true)
    try {
      const { data } = await supabase.functions.invoke('pco-api', {
        body: {
          path: `/people/v2/people?where[search_name_or_email]=${encodeURIComponent(query.trim())}&include=emails&per_page=25`,
        },
      })

      const personMap = {}
      data?.data?.forEach(p => {
        personMap[p.id] = {
          id:        p.id,
          name:      p.attributes.name ?? [p.attributes.first_name, p.attributes.last_name].filter(Boolean).join(' ') ?? null,
          email:     p.attributes.email_address ?? null,
          birthdate: p.attributes.birthdate ?? null,
          avatar:    p.attributes.avatar ?? null,
        }
      })
      data?.included
        ?.filter(i => i.type === 'Email')
        ?.forEach(e => {
          const pid = e.relationships?.person?.data?.id
          if (pid && personMap[pid] && !personMap[pid].email && e.attributes?.address) {
            personMap[pid].email = e.attributes.address
          }
        })

      const results = Object.values(personMap)
      setPcoSearchResults(results)

      // Check membership + invite history for search results
      const gId = selectedCoveyGroupId
      const withEmail = results.filter(p => p.email)
      if (withEmail.length && gId) {
        const emails = withEmail.map(p => p.email)
        const [{ data: statuses }, { data: invites }] = await Promise.all([
          supabase.rpc('check_pco_members', { emails, target_group_id: gId }),
          db.pco.getInvites(gId),
        ])
        const sMap = {}
        statuses?.forEach(s => { sMap[s.email.toLowerCase()] = s.in_group })
        setPcoSearchStatuses(sMap)
        const iMap = {}
        invites?.forEach(inv => { iMap[inv.email.toLowerCase()] = inv })
        setPcoSearchInviteHistory(iMap)
      } else {
        setPcoSearchStatuses({})
        setPcoSearchInviteHistory({})
      }
    } catch (err) {
      console.error('[PCO search]', err)
    } finally {
      setPcoSearchLoading(false)
    }
  }

  function handlePcoSearchChange(val) {
    setPcoSearchQuery(val)
    clearTimeout(pcoSearchDebounceRef.current)
    if (!val.trim()) {
      setPcoSearchResults([])
      setPcoSearchStatuses({})
      setPcoSearchInviteHistory({})
      return
    }
    pcoSearchDebounceRef.current = setTimeout(() => executePcoSearch(val), 400)
  }

  async function handleSendSearchInvite(member) {
    const targetCode = coveyGroupInviteCode ?? inviteCode
    if (!targetCode) { toast('No invite code available', 'error'); return }
    const targetGroupName = groupsInChurch.find(g => g.id === selectedCoveyGroupId)?.name ?? groupName
    const inviteUrl = `${window.location.origin}/login?code=${targetCode}`
    setPcoSearchSending(prev => ({ ...prev, [member.email]: true }))
    const { error } = await supabase.functions.invoke('pco-send-invite', {
      body: {
        email: member.email,
        name:  member.name,
        invite_url: inviteUrl,
        group_name: targetGroupName,
        coveyspace_group_id: selectedCoveyGroupId ?? null,
        birthdate: member.birthdate ?? null,
      },
    })
    setPcoSearchSending(prev => ({ ...prev, [member.email]: false }))
    if (error) {
      toast('Failed to send invite', 'error')
    } else {
      toast(`Invite sent to ${member.name}`, 'success')
      setPcoSearchInviteHistory(prev => ({
        ...prev,
        [member.email.toLowerCase()]: {
          ...prev[member.email.toLowerCase()],
          last_sent_at: new Date().toISOString(),
          send_count: (prev[member.email.toLowerCase()]?.send_count ?? 0) + 1,
        },
      }))
    }
  }

  async function handleConnectPco() {
    setPcoConnecting(true)
    const returnUrl = `${window.location.origin}/church-settings?pco=connected`
    const { data, error } = await supabase.functions.invoke('pco-oauth-start', {
      body: { return_url: returnUrl },
    })
    if (error || !data?.auth_url) {
      toast('Failed to start Planning Center connection', 'error')
      setPcoConnecting(false)
      return
    }
    window.location.href = data.auth_url
  }

  async function handleDisconnectPco() {
    setConfirmDisconnect(false)
    setPcoDisconnecting(true)
    const { error } = await supabase.functions.invoke('pco-disconnect', { body: {} })
    if (error) {
      toast('Failed to disconnect', 'error')
    } else {
      setPcoConnection(null)
      setPcoGroups([])
      setPcoMembers([])
      setSelectedPcoGroup(null)
      setMemberStatuses({})
      setInviteHistory({})
      setPcoSearchQuery('')
      setPcoSearchResults([])
      setPcoSearchStatuses({})
      setPcoSearchInviteHistory({})
      setPcoSearchSending({})
      toast('Planning Center disconnected', 'success')
    }
    setPcoDisconnecting(false)
  }

  async function handleSendInvite(member) {
    const targetCode = coveyGroupInviteCode ?? inviteCode
    if (!targetCode) { toast('No invite code available', 'error'); return }
    const targetGroupName = groupsInChurch.find(g => g.id === selectedCoveyGroupId)?.name ?? groupName
    const inviteUrl = `${window.location.origin}/login?code=${targetCode}`
    setInviteSending(prev => ({ ...prev, [member.email]: true }))
    const { error } = await supabase.functions.invoke('pco-send-invite', {
      body: {
        email:       member.email,
        name:        member.name,
        invite_url:  inviteUrl,
        group_name:  targetGroupName,
        coveyspace_group_id: selectedCoveyGroupId ?? null,
        birthdate:   member.birthdate ?? null,
      },
    })
    if (error) {
      toast('Failed to send invite', 'error')
    } else {
      toast(`Invite sent to ${member.name}`, 'success')
      // Update local invite history so status shows immediately without a reload
      const emailKey = member.email.toLowerCase()
      setInviteHistory(prev => ({
        ...prev,
        [emailKey]: {
          ...prev[emailKey],
          last_sent_at: new Date().toISOString(),
          send_count: (prev[emailKey]?.send_count ?? 0) + 1,
          joined_at: prev[emailKey]?.joined_at ?? null,
        },
      }))
    }
    setInviteSending(prev => ({ ...prev, [member.email]: false }))
  }

  async function handleTogglePcoSync() {
    const currentSync = pcoConnection?.pco_sync_group_id ?? null
    const newId = currentSync === selectedPcoGroup ? null : selectedPcoGroup
    const { error } = await supabase.rpc('set_pco_sync_group', { target_group_id: newId })
    if (error) {
      toast('Failed to update sync setting', 'error')
    } else {
      setPcoConnection(prev => ({ ...prev, pco_sync_group_id: newId }))
      toast(newId ? 'Sync enabled — new members will be added to this PCO Group' : 'Sync disabled', 'success')
    }
  }

  async function handleRotateChurchCode() {
    setConfirmRotateChurchCode(false)
    setChurchCodeRotating(true)
    const { data, error } = await db.churches.rotateJoinCode()
    if (!error) setChurchJoinCode(data)
    setChurchCodeRotating(false)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-12">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="lg:hidden w-11 h-11 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className="flex items-center gap-2">
          <Church size={20} weight="fill" className="text-ember" />
          <h1 className="text-2xl font-bold text-stone-800">Church Settings</h1>
        </div>
      </div>

      {churchName && (
        <p className="text-sm text-stone-500 -mt-6 mb-6 pl-[52px] lg:pl-7">{churchName}</p>
      )}

      {/* Church join code — visible to church admins for sharing with group admins */}
      {isChurchAdmin && churchJoinCode && (
        <div className="mb-6 bg-white border border-stone-200 rounded-2xl px-5 py-4">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-2">Church Code</p>
          <div className="flex items-center gap-4 mb-2">
            <span className="font-mono font-bold text-3xl tracking-widest text-stone-800 flex-1">
              {churchCodeRotating ? '……' : churchJoinCode}
            </span>
            {confirmRotateChurchCode ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setConfirmRotateChurchCode(false)}
                  className="px-3 py-2 rounded-xl text-sm font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRotateChurchCode}
                  disabled={churchCodeRotating}
                  className="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40"
                >
                  Reset
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => { navigator.clipboard.writeText(churchJoinCode); toast('Church code copied!', 'success') }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 border border-stone-200 hover:bg-stone-50 transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => setConfirmRotateChurchCode(true)}
                  disabled={churchCodeRotating}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 border border-stone-200 hover:bg-stone-50 transition-colors disabled:opacity-40"
                >
                  Reset
                </button>
              </div>
            )}
          </div>
          {confirmRotateChurchCode && (
            <p className="text-xs text-red-500 mb-1 animate-fade-in">The old code will stop working immediately.</p>
          )}
          {!confirmRotateChurchCode && (
            <p className="text-xs text-stone-400">Share this code with group admins so they can link their group to your church.</p>
          )}
        </div>
      )}

      {/* Tab nav */}
      <div className="flex bg-stone-100 rounded-xl p-1 mb-6">
        {[
          { id: 'broadcasts',      label: 'Announcements'   },
          { id: 'planning_center', label: 'Planning Center' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-ember text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div key={tabAnimKey} className={tabAnimClass}>
      {activeTab === 'broadcasts' && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">Announcements</p>
            {convIds.allMembers && (
              <button
                onClick={() => setComposerOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-ember text-white text-xs font-semibold hover:bg-ember-700 transition-colors"
              >
                <PaperPlaneRight size={13} weight="fill" />
                New Announcement
              </button>
            )}
          </div>

          {broadcastLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-stone-100 px-5 py-4 animate-pulse">
                  <div className="flex justify-between mb-2">
                    <div className="h-3.5 bg-stone-200 rounded w-24" />
                    <div className="h-3 bg-stone-100 rounded w-14" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 bg-stone-100 rounded w-full" />
                    <div className="h-3 bg-stone-100 rounded w-4/5" />
                  </div>
                </div>
              ))}
            </div>
          ) : broadcastMessages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-5 py-8 text-center">
              <Megaphone size={36} weight="thin" className="text-stone-300 mx-auto mb-2" />
              <p className="text-sm text-stone-500">No announcements sent yet</p>
              <p className="text-xs text-stone-400 mt-1">Tap "New Announcement" to send your first message</p>
            </div>
          ) : (
            <div className="space-y-3">
              {broadcastMessages.map((msg, i) => (
                <BroadcastCard
                  key={msg.id}
                  msg={msg}
                  isChurchAdmin
                  groupsInChurch={groupsInChurch}
                  idx={i}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'planning_center' && (
        <section>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Planning Center</p>

          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            {/* Header row */}
            <div className="px-4 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                <LinkSimple size={20} weight="bold" className="text-stone-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-stone-800">Planning Center</p>
                <p className="text-xs text-stone-400">
                  {pcoConnection === undefined ? 'Loading…' :
                   pcoConnection
                     ? `Connected to ${pcoConnection.pco_organization_name ?? 'your church'}`
                     : 'Sync members from People & Groups'}
                </p>
              </div>
              {pcoConnection === null && (
                <button
                  onClick={handleConnectPco}
                  disabled={pcoConnecting}
                  className="shrink-0 px-3 py-1.5 bg-ember text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-ember-700 transition-colors"
                >
                  {pcoConnecting ? 'Redirecting…' : 'Connect'}
                </button>
              )}
              {pcoConnection && (
                <button
                  onClick={() => setConfirmDisconnect(true)}
                  className="shrink-0 text-xs text-stone-400 hover:text-red-500 transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>

            {/* Connected body */}
            {pcoConnection && (
              <div className="border-t border-stone-100">
                {/* PCO people search */}
                <div className="px-4 pt-4 pb-3 border-b border-stone-100">
                  <div className="relative">
                    <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    <input
                      type="text"
                      value={pcoSearchQuery}
                      onChange={e => handlePcoSearchChange(e.target.value)}
                      placeholder="Search people by name or email…"
                      className="w-full border border-stone-200 rounded-xl pl-8 pr-8 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
                    />
                    {pcoSearchQuery && (
                      <button
                        onClick={() => { setPcoSearchQuery(''); setPcoSearchResults([]); setPcoSearchStatuses({}); setPcoSearchInviteHistory({}) }}
                        aria-label="Clear search"
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                      >
                        <X size={12} weight="bold" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Search results */}
                {pcoSearchQuery ? (
                  <div className="px-4 py-3">
                    {pcoSearchLoading ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map(i => <div key={i} className="h-11 bg-stone-100 rounded-xl animate-pulse" />)}
                      </div>
                    ) : pcoSearchResults.length === 0 ? (
                      <p className="text-xs text-stone-500 py-2 text-center">No people found for "{pcoSearchQuery}"</p>
                    ) : (
                      <div className="space-y-1">
                        {pcoSearchResults.map(member => (
                          <PcoMemberRow
                            key={member.id}
                            member={member}
                            isMember={pcoSearchStatuses[member.email?.toLowerCase()] === true}
                            inviteRecord={pcoSearchInviteHistory[member.email?.toLowerCase()]}
                            sending={!!pcoSearchSending[member.email]}

                            onCopyLink={() => {
                              const code = coveyGroupInviteCode ?? inviteCode
                              if (!code) { toast('No invite code available', 'error'); return }
                              navigator.clipboard.writeText(`${window.location.origin}/login?code=${code}`)
                              toast('Invite link copied', 'success')
                            }}
                            onInvite={() => handleSendSearchInvite(member)}
                            daysAgo={daysAgo}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <>

                {/* Group picker */}
                <div className="px-4 pt-4 pb-3">
                  <p className="text-xs font-semibold text-stone-500 mb-2">Import members from a PCO Group</p>
                  {pcoGroupsLoading ? (
                    <div className="h-10 bg-stone-100 rounded-xl animate-pulse" />
                  ) : pcoGroupsError ? (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-red-500 flex-1">{pcoGroupsError}</p>
                      <button
                        onClick={loadPcoGroups}
                        className="shrink-0 text-xs text-ember font-semibold hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : pcoGroups.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-stone-400 flex-1">No PCO Groups found. Make sure the Groups product is enabled in Planning Center.</p>
                      <button
                        onClick={loadPcoGroups}
                        className="shrink-0 text-xs text-ember font-semibold hover:underline"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          value={selectedPcoGroup ?? ''}
                          onChange={async e => {
                            const val = e.target.value || null
                            setSelectedPcoGroup(val)
                            setPcoSearchQuery('')
                            setPcoSearchResults([])
                            if (val) {
                              // Resolve saved mapping first so loadPcoMembers gets the
                              // correct target group, not the stale selectedCoveyGroupId
                              const resolvedGroupId = await loadGroupMapping(val)
                              loadPcoMembers(val, resolvedGroupId ?? selectedCoveyGroupId)
                            } else {
                              setPcoMembers([])
                              setMemberStatuses({})
                              setInviteHistory({})
                            }
                          }}
                          className="w-full appearance-none border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 bg-white pr-9 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
                        >
                          <option value="">Pick a PCO Group…</option>
                          {pcoGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                      </div>
                      {selectedPcoGroup && (
                        <button
                          onClick={() => loadPcoMembers(selectedPcoGroup)}
                          disabled={pcoMembersLoading}
                          aria-label="Refresh member list"
                          className="shrink-0 w-10 h-10 flex items-center justify-center border border-stone-200 rounded-xl text-stone-400 hover:text-ember hover:border-ember hover:bg-ember/5 transition-colors disabled:opacity-40"
                        >
                          <ArrowsClockwise size={16} className={pcoMembersLoading ? 'animate-spin' : ''} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sync toggle */}
                {selectedPcoGroup && (
                  <div className="px-4 pb-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-stone-700">Auto-sync new members</p>
                      <p className="text-xs text-stone-400 mt-0.5">New Coveyspace members are added to this PCO Group automatically</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={pcoConnection?.pco_sync_group_id === selectedPcoGroup}
                      aria-label="Auto-sync new members to this PCO Group"
                      onClick={handleTogglePcoSync}
                      className={`relative shrink-0 w-11 h-6 rounded-full border-2 border-transparent transition-colors ${
                        pcoConnection?.pco_sync_group_id === selectedPcoGroup ? 'bg-ember' : 'bg-stone-200'
                      }`}
                    >
                      <span className={`absolute top-0 left-0 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        pcoConnection?.pco_sync_group_id === selectedPcoGroup ? 'translate-x-5' : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                )}

                {/* Coveyspace target group picker — shown when there are multiple groups */}
                {selectedPcoGroup && groupsInChurch.length > 1 && (
                  <div className="px-4 pb-3 border-t border-stone-100 pt-3">
                    <p className="text-xs font-semibold text-stone-500 mb-2">Invite to Coveyspace Group</p>
                    <div className="relative">
                      <select
                        value={selectedCoveyGroupId ?? ''}
                        onChange={e => {
                          const val = e.target.value || null
                          setSelectedCoveyGroupId(val)
                          setMemberStatuses({})
                          setInviteHistory({})
                          if (val && selectedPcoGroup) saveGroupMapping(selectedPcoGroup, val)
                        }}
                        disabled={coveyGroupInviteLoading}
                        className="w-full appearance-none border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 bg-white pr-9 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent disabled:opacity-50"
                      >
                        <option value="">Pick a Coveyspace group…</option>
                        {groupsInChurch.map(g => (
                          <option key={g.id} value={g.id}>{g.name}{g.id === groupId ? ' (your group)' : ''}</option>
                        ))}
                      </select>
                      <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                    </div>
                    {coveyGroupInviteLoading && (
                      <p className="text-xs text-stone-400 mt-1">Loading invite code…</p>
                    )}
                  </div>
                )}

                {/* Member list */}
                {selectedPcoGroup && (
                  <div className="px-4 pb-4">
                    {pcoMembersLoading ? (
                      <div className="space-y-2 pt-1">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-11 bg-stone-100 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : pcoMembers.length === 0 ? (
                      <p className="text-xs text-stone-500 py-3 text-center">No members found in this PCO Group.</p>
                    ) : (
                      <>
                        <p className="text-xs text-stone-400 mb-3">
                          {pcoMembers.length} {pcoMembers.length === 1 ? 'person' : 'people'} in this PCO Group
                        </p>
                        <div className="space-y-1">
                          {pcoMembers.map(member => (
                            <PcoMemberRow
                              key={member.id}
                              member={member}
                              isMember={memberStatuses[member.email?.toLowerCase()] === true}
                              inviteRecord={inviteHistory[member.email?.toLowerCase()]}
                              sending={!!inviteSending[member.email]}
  
                              onCopyLink={() => {
                                const code = coveyGroupInviteCode ?? inviteCode
                                if (!code) { toast('No invite code available', 'error'); return }
                                navigator.clipboard.writeText(`${window.location.origin}/login?code=${code}`)
                                toast('Invite link copied', 'success')
                              }}
                              onInvite={() => handleSendInvite(member)}
                              daysAgo={daysAgo}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                </>
                )}
              </div>
            )}

            {/* Disconnect confirmation */}
            {confirmDisconnect && (
              <div className="border-t border-stone-100 px-4 py-4 bg-red-50/60 animate-fade-in">
                <p className="text-sm font-semibold text-stone-800 mb-1">Disconnect Planning Center?</p>
                <p className="text-xs text-stone-500 mb-3">Your Coveyspace group data won't be affected.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDisconnect(false)}
                    className="flex-1 py-2 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisconnectPco}
                    disabled={pcoDisconnecting}
                    className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {pcoDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>
      )}
      </div>{/* end tab content */}

      {/* Broadcast composer overlay */}
      {composerOpen && convIds.allMembers && (
        <BroadcastComposer
          churchId={churchId}
          convIds={convIds}
          groupsInChurch={groupsInChurch}
          displayName={displayName}
          userId={userId}
          onSent={handleSent}
          onClose={() => setComposerOpen(false)}
        />
      )}
    </div>
  )
}
