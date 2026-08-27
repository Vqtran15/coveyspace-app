import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  Eye, PencilSimple,
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

function ConfirmSendModal({ sending, summary, onCancel, onConfirm }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[45]" onClick={onCancel} />
      <div
        className="fixed inset-x-4 bottom-4 z-[46] bg-white rounded-2xl shadow-xl px-5 pt-5 animate-modal-in"
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
  const [previewMode, setPreviewMode]           = useState(false)
  const [linkDialogOpen, setLinkDialogOpen]     = useState(false)
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

  function closeLinkDialog() {
    setLinkDialogOpen(false)
    setLinkUrl('')
    setLinkText('')
    setSavedRange(null)
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
            onClick={() => setPreviewMode(p => !p)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors shrink-0"
          >
            {previewMode ? <PencilSimple size={15} /> : <Eye size={15} />}
            {previewMode ? 'Edit' : 'Preview'}
          </button>
          <button
            onClick={() => !sendDisabled && setConfirmOpen(true)}
            disabled={sendDisabled}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ember text-white text-sm font-semibold hover:bg-ember-700 transition-colors disabled:opacity-40 shrink-0"
          >
            <PaperPlaneRight size={15} weight="fill" />
            Send
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
              <div className="bg-stone-100 rounded-xl p-1 flex">
                <button
                  type="button"
                  onClick={() => setTargetMode('all')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${targetMode === 'all' ? 'bg-ember text-white shadow-sm' : 'text-stone-500'}`}
                >
                  All groups
                </button>
                <button
                  type="button"
                  onClick={() => setTargetMode('select')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${targetMode === 'select' ? 'bg-ember text-white shadow-sm' : 'text-stone-500'}`}
                >
                  Select groups
                </button>
              </div>
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
            <div className="bg-stone-100 rounded-xl p-1 flex">
              <button
                type="button"
                onClick={() => setAudience('all_members')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${audience === 'all_members' ? 'bg-ember text-white shadow-sm' : 'text-stone-500'}`}
              >
                All members
              </button>
              <button
                type="button"
                onClick={() => setAudience('admins_only')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${audience === 'admins_only' ? 'bg-ember text-white shadow-sm' : 'text-stone-500'}`}
              >
                Group Admins only
              </button>
            </div>
          </div>

          {/* Editor / Preview toggle */}
          {previewMode ? (
            <div>
              <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-3">Preview</p>
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
            </div>
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
      {linkDialogOpen && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/40" onClick={closeLinkDialog} />
          <div
            className="fixed inset-x-4 z-[81] bg-white rounded-2xl shadow-xl p-5 space-y-4"
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

      {confirmOpen && (
        <ConfirmSendModal
          sending={sending}
          summary={confirmSummary}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={doSend}
        />
      )}
    </div>,
    document.body
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
  const [selectedPcoGroup, setSelectedPcoGroup]   = useState(null)
  const [pcoMembers, setPcoMembers]               = useState([])
  const [pcoMembersLoading, setPcoMembersLoading] = useState(false)
  const [memberStatuses, setMemberStatuses]       = useState({})
  const [inviteSending, setInviteSending]         = useState({})
  const [inviteCode, setInviteCode]               = useState(null)
  const [activeTab, setActiveTab]                 = useState('broadcasts')
  // Which Coveyspace group to invite PCO members into
  const [selectedCoveyGroupId, setSelectedCoveyGroupId] = useState(null)
  const [coveyGroupInviteCode, setCoveyGroupInviteCode] = useState(null)
  const [coveyGroupInviteLoading, setCoveyGroupInviteLoading] = useState(false)

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
  }, [!!pcoConnection])

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
    try {
      const { data } = await supabase.functions.invoke('pco-api', {
        body: { path: '/groups/v2/groups?per_page=100&order=name' },
      })
      if (data?.data) {
        const groups = data.data.map(g => ({ id: g.id, name: g.attributes.name }))
        setPcoGroups(groups)
        const syncId = pcoConnection?.pco_sync_group_id
        if (syncId && groups.some(g => g.id === syncId)) {
          setSelectedPcoGroup(syncId)
          loadPcoMembers(syncId)
        }
      }
    } finally {
      setPcoGroupsLoading(false)
    }
  }

  async function loadPcoMembers(pcoGroupId) {
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
        name:  p.attributes.name ?? [p.attributes.first_name, p.attributes.last_name].filter(Boolean).join(' ') ?? null,
        email: p.attributes.email_address ?? null,
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
      id:     p.id,
      name:   personMap[p.id]?.name  ?? p.attributes.name ?? null,
      email:  personMap[p.id]?.email ?? null,
      avatar: p.attributes.avatar,
    }))

    const withEmail = people.filter(p => p.email)
    if (withEmail.length) {
      const emails = withEmail.map(p => p.email)
      const { data: statuses } = await supabase.rpc('check_pco_members', { emails })
      const map = {}
      statuses?.forEach(s => { map[s.email] = s.in_group })
      setMemberStatuses(map)
    }
    setPcoMembers(people)
    setPcoMembersLoading(false)
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
      body: { email: member.email, name: member.name, invite_url: inviteUrl, group_name: targetGroupName },
    })
    if (error) {
      toast('Failed to send invite', 'error')
    } else {
      toast(`Invite sent to ${member.name}`, 'success')
      setMemberStatuses(prev => ({ ...prev, [member.email]: 'invited' }))
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

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl lg:max-w-2xl mx-auto px-4 pt-8 pb-12">

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className="flex items-center gap-2">
          <Church size={20} weight="fill" className="text-ember" />
          <h1 className="text-2xl font-bold text-stone-800">Church Settings</h1>
        </div>
      </div>

      {churchName && (
        <p className="text-sm text-stone-500 -mt-6 mb-6 pl-[52px]">{churchName}</p>
      )}

      {/* Tab nav */}
      <div className="flex bg-stone-100 rounded-xl p-1 mb-6">
        {[
          { id: 'broadcasts',      label: 'Announcements'   },
          { id: 'planning_center', label: 'Planning Center' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
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
                {/* Group picker */}
                <div className="px-4 pt-4 pb-3">
                  <p className="text-xs font-semibold text-stone-500 mb-2">Import members from a PCO Group</p>
                  {pcoGroupsLoading ? (
                    <div className="h-10 bg-stone-100 rounded-xl animate-pulse" />
                  ) : pcoGroups.length === 0 ? (
                    <p className="text-xs text-stone-400">No PCO Groups found. Make sure the Groups product is enabled in Planning Center.</p>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          value={selectedPcoGroup ?? ''}
                          onChange={e => {
                            const val = e.target.value || null
                            setSelectedPcoGroup(val)
                            if (val) loadPcoMembers(val)
                            else { setPcoMembers([]); setMemberStatuses({}) }
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
                          {pcoMembers.map(member => {
                            const status = memberStatuses[member.email]
                            const alreadyMember = status === true
                            const invited = status === 'invited'
                            return (
                              <div key={member.id} className="flex items-center gap-3 py-1.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-stone-800 truncate">{member.name}</p>
                                  <p className="text-xs text-stone-400 truncate">{member.email ?? 'No email in PCO'}</p>
                                </div>
                                {!member.email ? (
                                  <span className="text-xs text-stone-300 shrink-0">Can't invite</span>
                                ) : alreadyMember ? (
                                  <div className="flex items-center gap-1 text-sage-700 shrink-0">
                                    <CheckCircle size={14} weight="fill" />
                                    <span className="text-xs font-medium">Member</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => {
                                        const code = coveyGroupInviteCode ?? inviteCode
                                        if (!code) { toast('No invite code available', 'error'); return }
                                        navigator.clipboard.writeText(`${window.location.origin}/login?code=${code}`)
                                        toast('Invite link copied', 'success')
                                      }}
                                      aria-label="Copy invite link"
                                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300 transition-colors"
                                    >
                                      <Copy size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleSendInvite(member)}
                                      disabled={!!inviteSending[member.email] || invited}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                        invited
                                          ? 'bg-stone-100 text-stone-400 cursor-default'
                                          : 'bg-ember text-white hover:bg-ember-700 disabled:opacity-50'
                                      }`}
                                    >
                                      {inviteSending[member.email]
                                        ? 'Sending…'
                                        : invited
                                          ? 'Sent ✓'
                                          : <><Envelope size={12} weight="bold" />Invite</>}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Disconnect confirmation */}
            {confirmDisconnect && (
              <div className="border-t border-stone-100 px-4 py-4 bg-red-50/60">
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
