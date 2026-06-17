import { useState, useEffect, useRef } from 'react'
import { ChatCircleDots, PaperPlaneTilt, Image as ImageIcon, X, MagnifyingGlass, NotePencil } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'
import NotesModal from './NotesModal.jsx'

const AVATAR_COLORS = ['bg-jade', 'bg-coral', 'bg-lagoon-700']
function avatarColor(userId) {
  const n = (userId.charCodeAt(0) ?? 0) + (userId.charCodeAt(userId.length - 1) ?? 0)
  return AVATAR_COLORS[n % AVATAR_COLORS.length]
}

function Initials({ name, userId }) {
  const initials = name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <div className={`w-8 h-8 rounded-full ${avatarColor(userId)} flex items-center justify-center shrink-0 text-white text-xs font-bold`}>
      {initials}
    </div>
  )
}

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function dateSeparator(iso) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

function highlightText(text, query) {
  if (!query.trim() || !text) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <mark key={i} className="bg-yellow-200 text-stone-900 rounded-sm">{part}</mark>
          : part
      )}
    </>
  )
}

export default function ChatTab({ session, displayName, groupId, onRead }) {
  const [messages, setMessages]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [text, setText]                   = useState('')
  const [sending, setSending]             = useState(false)
  const [imagePreview, setImagePreview]   = useState(null)
  const [searchOpen, setSearchOpen]       = useState(false)
  const [searchQuery, setSearchQuery]     = useState('')
  const [notesOpen, setNotesOpen]         = useState(false)
  const scrollRef      = useRef(null)
  const fileInputRef   = useRef(null)
  const textareaRef    = useRef(null)
  const searchInputRef = useRef(null)
  const { className: headerClass } = useEntranceAnimation('/chat', 0, { direction: 'left' })

  useEffect(() => {
    if (!groupId) return
    onRead?.()

    supabase
      .from('messages')
      .select('*')
      .eq('community_group_id', groupId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data ?? [])
        setLoading(false)
      })

    const channel = supabase
      .channel(`messages:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `community_group_id=eq.${groupId}`,
      }, ({ new: msg }) => {
        // Skip if already added optimistically by handleSend
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, { ...msg, _isNew: true }])
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [groupId])

  useEffect(() => {
    if (!scrollRef.current) return
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  // Close search on Escape
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [searchOpen])

  function toggleSearch() {
    if (searchOpen) {
      setSearchOpen(false)
      setSearchQuery('')
    } else {
      setSearchOpen(true)
      setTimeout(() => searchInputRef.current?.focus(), 50)
    }
  }

  async function handleSend(e) {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed && !imagePreview) return
    setSending(true)

    try {
      let imageUrl = null
      if (imagePreview) {
        const ext = imagePreview.file.name.split('.').pop()
        const path = `${groupId}/${session.user.id}_${Date.now()}.${ext}`
        const { data: uploaded, error: upErr } = await supabase.storage
          .from('chat-images')
          .upload(path, imagePreview.file, { contentType: imagePreview.file.type })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(uploaded.path)
        imageUrl = publicUrl
      }

      const { data: newMsg } = await supabase.from('messages').insert({
        community_group_id: groupId,
        user_id: session.user.id,
        display_name: displayName || 'Member',
        body: trimmed || null,
        image_url: imageUrl,
      }).select().single()

      if (newMsg) setMessages(prev => [...prev, { ...newMsg, _isNew: true }])

      setText('')
      setImagePreview(null)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } catch (err) {
      console.error('Send failed:', err)
    }

    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTextInput(e) {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB'); return }
    setImagePreview({ file, previewUrl: URL.createObjectURL(file) })
    e.target.value = ''
  }

  const myId = session.user.id

  // Filter messages by search query, then build display list with date separators
  const filteredMsgs = searchQuery.trim()
    ? messages.filter(m =>
        m.body?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.display_name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages

  const items = []
  let lastDate = null
  for (const msg of filteredMsgs) {
    const d = new Date(msg.created_at).toDateString()
    if (d !== lastDate) { items.push({ type: 'date', label: dateSeparator(msg.created_at), key: `date-${msg.created_at}` }); lastDate = d }
    items.push({ type: 'msg', msg })
  }

  return (
    <div
      className="flex flex-col bg-sunrise-50"
      style={{ height: 'calc(100svh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 62px)' }}
    >
      {/* Header */}
      <div className={`max-w-3xl mx-auto w-full px-4 pt-6 pb-3 shrink-0 flex items-center justify-between ${headerClass}`}>
        <div className="flex items-center gap-3">
          <ChatCircleDots size={32} weight="fill" className="text-jade shrink-0" />
          <h1 className="text-3xl font-bold text-stone-800">Chat</h1>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSearch}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors ${searchOpen ? 'bg-jade text-white' : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'}`}
          >
            <MagnifyingGlass size={20} weight={searchOpen ? 'fill' : 'regular'} />
          </button>
          <button
            onClick={() => setNotesOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <NotePencil size={20} />
          </button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="max-w-3xl mx-auto w-full px-4 pb-2 shrink-0 animate-overlay-in">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-9 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="text-xs text-stone-400 mt-1.5 px-1">
              {filteredMsgs.length} {filteredMsgs.length === 1 ? 'message' : 'messages'} found
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="flex justify-center py-16">
            <p className="text-stone-400 text-sm animate-pulse">Loading messages…</p>
          </div>
        ) : filteredMsgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-stone-400">
            {searchQuery ? (
              <>
                <MagnifyingGlass size={48} className="text-stone-300 mb-3" />
                <p className="text-sm">No messages match &ldquo;{searchQuery}&rdquo;</p>
              </>
            ) : (
              <>
                <ChatCircleDots size={48} weight="fill" className="text-stone-300 mb-3" />
                <p className="text-sm">No messages yet. Say hello!</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-0.5 py-2 pb-4">
            {items.map((item, i) => {
              if (item.type === 'date') {
                return (
                  <div key={item.key} className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-stone-200" />
                    <span className="text-xs text-stone-400 font-medium">{item.label}</span>
                    <div className="flex-1 h-px bg-stone-200" />
                  </div>
                )
              }
              const { msg } = item
              const isOwn = msg.user_id === myId
              const nextMsg = items[i + 1]
              const nextIsMsg = nextMsg?.type === 'msg'
              const isLastInGroup = !nextIsMsg || nextMsg.msg.user_id !== msg.user_id
              const prevMsg = items[i - 1]
              const prevIsMsg = prevMsg?.type === 'msg'
              const isFirstInGroup = !prevIsMsg || prevMsg.msg.user_id !== msg.user_id

              return (
                <div key={msg.id} className={`flex gap-2 ${isOwn ? 'justify-end' : 'justify-start'} ${isLastInGroup ? 'mb-2' : 'mb-0'}`}>
                  {!isOwn && (
                    <div className="w-8 shrink-0 self-start mt-1">
                      {isFirstInGroup && <Initials name={msg.display_name} userId={msg.user_id} />}
                    </div>
                  )}
                  <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} ${msg._isNew ? 'animate-message-in' : ''}`}>
                    {!isOwn && isFirstInGroup && (
                      <p className="text-xs font-semibold text-stone-500 mb-1 ml-1">{msg.display_name}</p>
                    )}
                    <div className={`overflow-hidden ${
                      isOwn
                        ? `bg-jade text-white ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? 'rounded-bl-2xl rounded-br-sm' : 'rounded-b-md'}`
                        : `bg-white border border-stone-200 text-stone-800 ${isFirstInGroup ? 'rounded-t-2xl' : 'rounded-t-md'} ${isLastInGroup ? 'rounded-br-2xl rounded-bl-sm' : 'rounded-b-md'}`
                    }`}>
                      {msg.image_url && (
                        <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                          <img
                            src={msg.image_url}
                            alt="shared"
                            className="block max-w-full"
                            style={{ maxHeight: 280 }}
                          />
                        </a>
                      )}
                      {msg.body && (
                        <p className="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words">
                          {searchQuery.trim() ? highlightText(msg.body, searchQuery) : msg.body}
                        </p>
                      )}
                    </div>
                    {isLastInGroup && (
                      <p className={`text-[10px] text-stone-400 mt-1 ${isOwn ? 'mr-1' : 'ml-1'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-stone-200 bg-white px-4 pt-3 pb-3 max-w-3xl mx-auto w-full">
        {imagePreview && (
          <div className="relative inline-block mb-2">
            <img
              src={imagePreview.previewUrl}
              alt="preview"
              className="h-20 w-20 object-cover rounded-xl border border-stone-200"
            />
            <button
              onClick={() => setImagePreview(null)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-600 text-white rounded-full flex items-center justify-center"
            >
              <X size={10} weight="bold" />
            </button>
          </div>
        )}
        <form onSubmit={handleSend} className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-jade hover:bg-stone-100 transition-colors shrink-0"
          >
            <ImageIcon size={22} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextInput}
            onKeyDown={handleKeyDown}
            placeholder="Message…"
            rows={1}
            className="flex-1 resize-none border border-stone-200 rounded-2xl px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent bg-stone-50"
            style={{ maxHeight: 120, overflowY: 'auto' }}
          />
          <button
            type="submit"
            disabled={sending || (!text.trim() && !imagePreview)}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-jade text-white hover:bg-jade-700 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PaperPlaneTilt size={18} weight="fill" />
          </button>
        </form>
      </div>

      {notesOpen && (
        <NotesModal session={session} onClose={() => setNotesOpen(false)} />
      )}
    </div>
  )
}
