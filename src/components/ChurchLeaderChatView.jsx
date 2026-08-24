import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, PaperPlaneRight, UsersThree } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { db } from '../lib/db.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { formatListTime } from '../utils/format.js'

function Message({ msg, myId }) {
  const isOwn = msg.user_id === myId
  return (
    <div className={`flex items-end gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-ember/15 flex items-center justify-center shrink-0 mb-0.5 text-xs font-bold text-ember">
          {msg.display_name?.[0]?.toUpperCase() ?? '?'}
        </div>
      )}
      <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
        {!isOwn && (
          <span className="text-xs text-stone-400 px-1">{msg.display_name}</span>
        )}
        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isOwn ? 'bg-ember text-white rounded-br-md' : 'bg-white border border-stone-100 text-stone-800 rounded-bl-md shadow-sm'}`}>
          {msg.body}
        </div>
        <span className="text-[11px] text-stone-400 px-1">{formatListTime(msg.created_at)}</span>
      </div>
    </div>
  )
}

export default function ChurchLeaderChatView({ conversation, onBack }) {
  const { userId, displayName, churchId } = useAppContext()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const convId = conversation.id

  useEffect(() => {
    if (!convId) return
    setLoading(true)
    db.churches.fetchMessages(convId).then(({ data }) => {
      setMessages(data ?? [])
      setLoading(false)
    })
    db.churches.updateLastRead(convId, userId).then()
  }, [convId, userId])

  // Scroll to bottom when messages load or new message arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loading ? 'instant' : 'smooth' })
  }, [messages, loading])

  // Realtime subscription
  useEffect(() => {
    if (!convId) return
    const ch = supabase
      .channel(`church-leaders:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'church_messages',
        filter: `church_conversation_id=eq.${convId}`,
      }, ({ new: msg }) => {
        setMessages(prev => [...prev, msg])
        if (msg.user_id !== userId) {
          db.churches.updateLastRead(convId, userId).then()
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [convId, userId])

  async function handleSend() {
    const body = text.trim()
    if (!body) return
    setSending(true)
    setText('')
    const { data, error } = await db.churches.sendMessage({
      churchId,
      convId,
      userId,
      displayName,
      body,
      audience: 'admins_only',
      targetGroupIds: null,
    })
    setSending(false)
    if (!error && data) setMessages(prev => [...prev, data])
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      className="flex flex-col bg-sunrise-50"
      style={{ height: '100dvh' }}
    >
      {/* Header */}
      <div
        className="shrink-0 bg-white border-b border-stone-100 flex items-center gap-3 px-4"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: '12px' }}
      >
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={22} weight="bold" />
        </button>
        <div className="w-10 h-10 rounded-full bg-ember/10 flex items-center justify-center shrink-0">
          <UsersThree size={20} weight="fill" className="text-ember" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-stone-800">Leaders Chat</p>
          <p className="text-xs text-stone-400 truncate">{conversation.name?.replace(' · Leaders', '')}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full text-stone-400">
            <p className="text-sm">Loading…</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-stone-400 text-center px-8">
            <UsersThree size={48} weight="thin" className="text-stone-300 mb-3" />
            <p className="text-sm font-medium text-stone-500">Leaders Chat</p>
            <p className="text-xs text-stone-400 mt-1">Church admin and group leaders can chat here</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {messages.map(msg => (
              <Message key={msg.id} msg={msg} myId={userId} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className="shrink-0 bg-white border-t border-stone-100 px-4 py-3 flex items-end gap-2"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message leaders…"
          rows={1}
          style={{ resize: 'none', maxHeight: '120px', overflowY: 'auto' }}
          className="flex-1 border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
          onInput={e => {
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
          }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-xl bg-ember text-white flex items-center justify-center hover:bg-ember-700 transition-colors disabled:opacity-40 shrink-0"
          aria-label="Send"
        >
          <PaperPlaneRight size={18} weight="fill" />
        </button>
      </div>
    </div>
  )
}
