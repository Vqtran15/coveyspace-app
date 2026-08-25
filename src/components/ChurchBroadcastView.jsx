import { useState, useEffect, useCallback, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import UnderlineExt from '@tiptap/extension-underline'
import LinkExt from '@tiptap/extension-link'
import TextAlignExt from '@tiptap/extension-text-align'
import {
  ArrowLeft, PaperPlaneRight, Megaphone, Check, X,
  ListBullets, ListNumbers, LinkSimple,
  TextAlignLeft, TextAlignCenter, TextAlignRight,
  TextB, TextItalic, TextUnderline, TextStrikethrough,
  TextIndent, TextOutdent,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { db } from '../lib/db.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { formatListTime } from '../utils/format.js'

function sanitizeHtml(html) {
  try {
    const doc = new DOMParser().parseFromString(html, 'text/html')
    doc.querySelectorAll('script, style, iframe').forEach(el => el.remove())
    doc.querySelectorAll('*').forEach(el => {
      for (const attr of [...el.attributes]) {
        if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
      }
      if (el.tagName === 'A') {
        const href = el.getAttribute('href') ?? ''
        if (href.toLowerCase().startsWith('javascript:')) el.removeAttribute('href')
        else { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer') }
      }
    })
    return doc.body.innerHTML
  } catch { return '' }
}

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

function ConfirmSendModal({ sending, summary, onCancel, onConfirm }) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[45]" onClick={onCancel} />
      <div
        className="fixed inset-x-4 bottom-4 z-[46] bg-white rounded-2xl shadow-xl px-5 pt-5 animate-modal-in"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-bold text-stone-800 mb-1">Send Broadcast?</h3>
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

function BroadcastComposer({ churchId, convId, groupsInChurch, displayName, userId, onSent, onClose }) {
  const [targetMode, setTargetMode]             = useState('all')
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set())
  const [audience, setAudience]                 = useState('all_members')
  const [sending, setSending]                   = useState(false)
  const [exiting, setExiting]                   = useState(false)
  const [confirmOpen, setConfirmOpen]           = useState(false)
  const [linkBarOpen, setLinkBarOpen]           = useState(false)
  const [linkUrl, setLinkUrl]                   = useState('')
  const linkInputRef  = useRef(null)
  const composerRef   = useRef(null)
  const scrollBodyRef = useRef(null)

  useEffect(() => {
    const vp = window.visualViewport
    if (!vp) return
    let prevH = vp.height
    const sync = () => {
      if (composerRef.current) composerRef.current.style.height = `${vp.height}px`
      if (vp.height < prevH) {
        scrollBodyRef.current?.scrollTo({ top: scrollBodyRef.current.scrollHeight })
      }
      prevH = vp.height
    }
    vp.addEventListener('resize', sync)
    return () => vp.removeEventListener('resize', sync)
  }, [])

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
    const { data, error } = await db.churches.sendMessage({
      churchId, convId, userId, displayName, body, audience, targetGroupIds,
    })
    setSending(false)
    if (!error && data) { onSent(data); handleClose() }
  }

  function openLinkBar() {
    setLinkUrl(editor?.getAttributes('link').href ?? '')
    setLinkBarOpen(true)
    setTimeout(() => linkInputRef.current?.focus(), 40)
  }

  function applyLink() {
    if (!editor) return
    const url = linkUrl.trim()
    if (url) editor.chain().focus().setLink({ href: url }).run()
    else editor.chain().focus().unsetLink().run()
    setLinkBarOpen(false)
    setLinkUrl('')
  }

  function toggleGroup(id) {
    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const isEmpty = !editor || editor.isEmpty
  const sendDisabled = isEmpty || sending || (targetMode === 'select' && selectedGroupIds.size === 0)

  const headingLevel = editor?.isActive('heading', { level: 1 }) ? '1'
    : editor?.isActive('heading', { level: 2 }) ? '2'
    : ''

  const groupNames = targetMode === 'select' && selectedGroupIds.size > 0
    ? [...selectedGroupIds].map(id => groupsInChurch.find(g => g.id === id)?.name).filter(Boolean)
    : null
  const confirmSummary = `To: ${groupNames ? groupNames.join(', ') : 'All groups'} · ${
    audience === 'admins_only' ? 'Admins only' : 'All members'
  }`

  return (
    <div
      ref={composerRef}
      className={`fixed top-0 inset-x-0 lg:left-56 z-[35] bg-sunrise-50 flex flex-col ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)', height: `${window.visualViewport?.height ?? window.innerHeight}px` }}
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
          <h2 className="flex-1 text-lg font-bold text-stone-800">New Broadcast</h2>
          <button
            onClick={() => !sendDisabled && setConfirmOpen(true)}
            disabled={sendDisabled}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ember text-white text-sm font-semibold hover:bg-ember-700 transition-colors disabled:opacity-40"
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
                Admins only
              </button>
            </div>
          </div>

          {/* Editor card — toolbar on top, content below */}
          <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-ember focus-within:border-transparent transition-all">

            {/* Link bar — replaces toolbar when open */}
            {linkBarOpen ? (
              <div className="border-b border-stone-100 px-3 py-2.5 flex items-center gap-2">
                <LinkSimple size={15} className="text-stone-400 shrink-0" />
                <input
                  ref={linkInputRef}
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { e.preventDefault(); applyLink() }
                    if (e.key === 'Escape') setLinkBarOpen(false)
                  }}
                  placeholder="https://example.com"
                  className="flex-1 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none min-w-0"
                />
                {editor?.isActive('link') && (
                  <button
                    type="button"
                    onClick={() => { editor.chain().focus().unsetLink().run(); setLinkBarOpen(false) }}
                    className="text-xs font-medium text-red-500 hover:text-red-700 px-2 py-1 shrink-0 transition-colors"
                  >
                    Remove
                  </button>
                )}
                <button type="button" onClick={applyLink} className="text-xs font-semibold text-ember px-2 py-1 shrink-0">
                  Apply
                </button>
                <button
                  type="button"
                  onClick={() => setLinkBarOpen(false)}
                  className="w-7 h-7 flex items-center justify-center text-stone-400 hover:text-stone-600 shrink-0 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              /* Formatting toolbar */
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
                  <TBtn active={editor?.isActive('link') || linkBarOpen} onActivate={openLinkBar} title="Link">
                    <LinkSimple size={15} />
                  </TBtn>
                </div>
              </div>
            )}

            <div className="px-4 pt-3 pb-4">
              <EditorContent editor={editor} />
            </div>
          </div>

        </div>
      </div>

      {/* Confirmation modal */}
      {confirmOpen && (
        <ConfirmSendModal
          sending={sending}
          summary={confirmSummary}
          onCancel={() => setConfirmOpen(false)}
          onConfirm={doSend}
        />
      )}
    </div>
  )
}

function BroadcastCard({ msg, isChurchAdmin, groupsInChurch }) {
  const targetedGroups = isChurchAdmin && msg.target_group_ids?.length
    ? msg.target_group_ids.map(id => groupsInChurch.find(g => g.id === id)?.name).filter(Boolean)
    : null

  const isHtml = msg.body?.trimStart().startsWith('<')

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-5 py-4 animate-fade-up">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-stone-800">{msg.display_name}</p>
        <span className="text-xs text-stone-400 whitespace-nowrap shrink-0">{formatListTime(msg.created_at)}</span>
      </div>
      {isHtml ? (
        <div
          className="broadcast-html text-sm text-stone-700 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.body) }}
        />
      ) : (
        <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
      )}
      {isChurchAdmin && (
        <p className="text-xs text-stone-400 mt-2">
          {targetedGroups?.length > 0 ? `${targetedGroups.join(', ')} · ` : ''}
          {msg.audience === 'admins_only' ? 'Admins only' : 'All members'}
        </p>
      )}
    </div>
  )
}

export default function ChurchBroadcastView({ conversation, onBack }) {
  const { userId, displayName, churchId, isChurchAdmin } = useAppContext()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [composerOpen, setComposerOpen] = useState(false)
  const [groupsInChurch, setGroupsInChurch] = useState([])

  const convId = conversation.id

  useEffect(() => {
    if (!convId) return
    setLoading(true)
    db.churches.fetchMessages(convId).then(({ data }) => {
      setMessages(data ?? [])
      setLoading(false)
    })
    db.churches.updateLastRead(convId, userId).then()

    if (isChurchAdmin && churchId) {
      supabase
        .from('community_groups')
        .select('id, name')
        .eq('church_id', churchId)
        .order('name')
        .then(({ data }) => setGroupsInChurch(data ?? []))
    }
  }, [convId, churchId, isChurchAdmin, userId])

  useEffect(() => {
    if (!convId) return
    const ch = supabase
      .channel(`church-broadcast:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'church_messages',
        filter: `church_conversation_id=eq.${convId}`,
      }, ({ new: msg }) => {
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [msg, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [convId])

  const handleSent = useCallback((msg) => {
    setMessages(prev => [msg, ...prev])
  }, [])

  return (
    <div className="flex flex-col bg-sunrise-50" style={{ height: '100dvh' }}>
      {/* Header */}
      <div
        className="shrink-0 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: '12px' }}
      >
        <button
          onClick={onBack}
          className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={22} weight="bold" />
        </button>
        <div className="w-10 h-10 rounded-full bg-ember/10 flex items-center justify-center shrink-0">
          <Megaphone size={20} weight="fill" className="text-ember" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-stone-800 truncate">Church Updates</p>
          <p className="text-xs text-stone-400 truncate">{conversation.name?.replace(' · All Members', '')}</p>
        </div>
        {isChurchAdmin && (
          <button
            onClick={() => setComposerOpen(true)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-ember text-white text-sm font-semibold hover:bg-ember-700 transition-colors"
          >
            <PaperPlaneRight size={16} weight="fill" />
            Broadcast
          </button>
        )}
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="max-w-2xl mx-auto px-4 pt-6 space-y-3">
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
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 px-8 text-center">
            <Megaphone size={48} weight="thin" className="text-stone-300 mb-3" />
            <p className="text-sm font-medium text-stone-500">No broadcasts yet</p>
            {isChurchAdmin && (
              <p className="text-xs text-stone-400 mt-1">Tap "Broadcast" to send your first message</p>
            )}
          </div>
        ) : (
          <div
            className="max-w-2xl mx-auto px-4 py-6 space-y-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
            {messages.map(msg => (
              <BroadcastCard
                key={msg.id}
                msg={msg}
                isChurchAdmin={isChurchAdmin}
                groupsInChurch={groupsInChurch}
              />
            ))}
          </div>
        )}
      </div>

      {composerOpen && (
        <BroadcastComposer
          churchId={churchId}
          convId={convId}
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
