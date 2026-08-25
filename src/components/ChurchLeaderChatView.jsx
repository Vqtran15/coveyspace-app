import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, UsersThree, PaperPlaneTilt } from '@phosphor-icons/react'
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
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const bottomRef = useRef(null)
  const textareaRef = useRef(null)

  const convId = conversation.id

  // Prevent iOS from scrolling the page when keyboard opens (same mechanism as ChatView)
  useEffect(() => {
    function measure() {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);width:0;pointer-events:none;visibility:hidden'
      document.documentElement.appendChild(el)
      const px = el.offsetHeight
      el.remove()
      return px
    }
    window.scrollTo(0, 1)
    const initial = measure()
    if (initial > 0) document.documentElement.style.setProperty('--sab', `${initial}px`)
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  // Track keyboard via visualViewport — sets --vvh and chat-keyboard-open class
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const satEl = document.createElement('div')
    satEl.style.cssText = 'position:fixed;top:0;height:env(safe-area-inset-top,0px);width:0;pointer-events:none;visibility:hidden'
    document.documentElement.appendChild(satEl)
    const sat = satEl.offsetHeight
    satEl.remove()
    const baseline = Math.round(vv.height)
    let kbOpen = false
    function update() {
      const nowVVH = Math.round(vv.height)
      const kbH = baseline - nowVVH
      const nowOpen = kbH > 120
      document.documentElement.style.setProperty('--vvh', `${Math.round(sat + vv.offsetTop + vv.height)}px`)
      if (nowOpen && !kbOpen) {
        kbOpen = true
        document.body.classList.add('chat-keyboard-open')
        setKeyboardOpen(true)
      } else if (!nowOpen && kbOpen) {
        kbOpen = false
        document.body.classList.remove('chat-keyboard-open')
        setKeyboardOpen(false)
        window.scrollTo(0, 0)
      }
    }
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
      document.body.classList.remove('chat-keyboard-open')
      document.documentElement.style.removeProperty('--vvh')
      setKeyboardOpen(false)
    }
  }, [])

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
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
        if (msg.user_id !== userId) {
          db.churches.updateLastRead(convId, userId).then()
        }
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [convId, userId])

  async function handleSend() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
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

  function handleTextInput(e) {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  return (
    <div className="chat-container relative flex flex-col bg-sunrise-50">
      {/* Header */}
      <div
        className="shrink-0 bg-white border-b border-stone-100 flex items-center gap-3 px-4"
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

      {/* Input — pill style matching the main group chat */}
      <div
        className="shrink-0 px-4 py-2"
        style={{ paddingBottom: keyboardOpen ? '8px' : 'max(8px, var(--sab, env(safe-area-inset-bottom)))' }}
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-[30px] shadow-lg border border-stone-100 px-3 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={text}
              onChange={handleTextInput}
              onKeyDown={handleKeyDown}
              placeholder="Message leaders…"
              rows={1}
              className="flex-1 resize-none bg-stone-100 border-0 rounded-xl px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
            />
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-ember text-white hover:bg-ember-700 transition-colors shrink-0 disabled:opacity-40"
              aria-label="Send"
            >
              <PaperPlaneTilt size={18} weight="fill" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
