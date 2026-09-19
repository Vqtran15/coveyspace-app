import { lazy, Suspense, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, UsersThree, PaperPlaneTilt,
  Image as ImageIcon, Smiley, Plus as PlusIcon, X,
} from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { db } from '../lib/db.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { formatListTime } from '../utils/format.js'

const EmojiPicker = lazy(() => import('emoji-picker-react'))

// ── Image compression (same algorithm as ChatView) ────────────────────────────
function compressImage(file) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file)
      const img = new Image()
      img.onload  = () => { URL.revokeObjectURL(url); resolve({ file, width: img.naturalWidth, height: img.naturalHeight }) }
      img.onerror = () => { URL.revokeObjectURL(url); resolve({ file, width: null, height: null }) }
      img.src = url
    })
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      function tryEncode(maxDim, quality) {
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.round(img.naturalWidth * scale)
        const h = Math.round(img.naturalHeight * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        canvas.toBlob(blob => {
          if (blob) {
            resolve({ file: new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }), width: w, height: h })
          } else if (maxDim > 600) {
            tryEncode(Math.round(maxDim / 2), quality)
          } else {
            reject(new Error('Image compression failed'))
          }
        }, 'image/jpeg', quality)
      }
      tryEncode(1200, 0.82)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')) }
    img.src = url
  })
}

// ── Message bubble ─────────────────────────────────────────────────────────────
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
        {msg.image_url ? (
          <img
            src={msg.image_url}
            alt="image"
            className={`rounded-2xl max-w-full ${isOwn ? 'rounded-br-md' : 'rounded-bl-md'}`}
            style={{ maxHeight: 300 }}
          />
        ) : (
          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isOwn ? 'bg-ember text-white rounded-br-md' : 'bg-white border border-stone-100 text-stone-800 rounded-bl-md shadow-sm'}`}>
            {msg.body}
          </div>
        )}
        <span className="text-[11px] text-stone-400 px-1">{formatListTime(msg.created_at)}</span>
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ChurchLeaderChatView({ conversation, onBack }) {
  const { userId, displayName, churchId } = useAppContext()
  const [messages, setMessages]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [text, setText]                 = useState('')
  const [sending, setSending]           = useState(false)
  const [keyboardOpen, setKeyboardOpen] = useState(false)
  const [imagePreviews, setImagePreviews] = useState([]) // [{ file, previewUrl }]
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  const bottomRef        = useRef(null)
  const textareaRef      = useRef(null)
  const fileInputRef     = useRef(null)
  const attachBtnRef     = useRef(null)
  const attachMenuRef    = useRef(null)
  const emojiPickerRef   = useRef(null)
  const savedSelectionRef = useRef(null)

  const convId = conversation.id

  // ── Keyboard tracking (same as ChatView) ─────────────────────────────────────
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

  // ── Outside-click handlers ────────────────────────────────────────────────────
  useEffect(() => {
    if (!showAttachMenu) return
    function onPointerDown(e) {
      if (!attachMenuRef.current?.contains(e.target) && !attachBtnRef.current?.contains(e.target)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [showAttachMenu])

  useEffect(() => {
    if (!showEmojiPicker) return
    function onPointerDown(e) {
      if (!emojiPickerRef.current?.contains(e.target)) closeEmojiPicker()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [showEmojiPicker])

  // ── Message fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!convId) return
    setLoading(true)
    db.churches.fetchMessages(convId).then(({ data }) => {
      setMessages(data ?? [])
      setLoading(false)
    })
    db.churches.updateLastRead(convId, userId).then()
  }, [convId, userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loading ? 'instant' : 'smooth' })
  }, [messages, loading])

  // ── Realtime ───────────────────────────────────────────────────────────────────
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

  // ── Input helpers ─────────────────────────────────────────────────────────────
  function handleTextInput(e) {
    setText(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  function closeEmojiPicker() {
    setShowEmojiPicker(false)
    const el = textareaRef.current
    if (!el) return
    const { start = el.value.length, end = el.value.length } = savedSelectionRef.current ?? {}
    el.focus()
    try { el.setSelectionRange(start, end) } catch (_) {}
  }

  function insertEmoji(emoji) {
    const el = textareaRef.current
    const { start = text.length, end = text.length } = savedSelectionRef.current ?? {}
    const next = text.slice(0, start) + emoji + text.slice(end)
    setText(next)
    savedSelectionRef.current = { start: start + emoji.length, end: start + emoji.length }
  }

  function openEmoji() {
    const el = textareaRef.current
    if (el) {
      savedSelectionRef.current = { start: el.selectionStart ?? text.length, end: el.selectionEnd ?? text.length }
      el.blur()
    }
    setShowEmojiPicker(true)
    setShowAttachMenu(false)
  }

  function handleFileChange(e) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      if (file.size > 10 * 1024 * 1024) continue
      const reader = new FileReader()
      reader.onload = ev => setImagePreviews(prev => [...prev, { file, previewUrl: ev.target.result }])
      reader.readAsDataURL(file)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function sendImage(file, previewUrl) {
    try {
      const { file: compressed } = await compressImage(file)
      const ext = compressed.name.split('.').pop()
      const path = `${userId}/${convId}_${Date.now()}.${ext}`
      const { data: uploaded, error: upErr } = await supabase.storage
        .from('chat-images')
        .upload(path, compressed, { contentType: compressed.type })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(uploaded.path)
      const { data } = await db.churches.sendMessage({
        churchId, convId, userId, displayName,
        body: null, audience: 'admins_only', targetGroupIds: null, imageUrl: publicUrl,
      })
      if (data) setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data])
    } catch (err) {
      console.error('Image send failed:', err)
    }
  }

  async function handleSend() {
    const body = text.trim()
    const hasImages = imagePreviews.length > 0
    if (!body && !hasImages) return
    if (sending) return
    setSending(true)
    setText('')
    const previews = imagePreviews
    setImagePreviews([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Send images
    for (const { file, previewUrl } of previews) {
      await sendImage(file, previewUrl)
    }

    // Send text
    if (body) {
      const { data } = await db.churches.sendMessage({
        churchId, convId, userId, displayName,
        body, audience: 'admins_only', targetGroupIds: null,
      })
      if (data) setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data])
    }

    setSending(false)
  }

  const canSend = (text.trim().length > 0 || imagePreviews.length > 0) && !sending

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

      {/* Emoji picker portal */}
      {createPortal(
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              ref={emojiPickerRef}
              key="leaders-emoji"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-x-0 lg:left-56 bottom-0 z-[11]"
            >
              <div className="relative">
                <style dangerouslySetInnerHTML={{ __html: '.covey-picker { border: none !important; --epr-picker-border-radius: 0 !important; } .covey-picker .epr-header { padding-right: 48px !important; } .covey-picker .epr-emoji-category-content { margin-left: 0 !important; margin-right: 0 !important; }' }} />
                <Suspense fallback={null}>
                  <EmojiPicker
                    className="covey-picker"
                    onEmojiClick={emojiData => insertEmoji(emojiData.emoji)}
                    width="100%"
                    height={350}
                    searchPlaceholder="Search emojis…"
                    previewConfig={{ showPreview: false }}
                    autoFocusSearch={false}
                    defaultSkinTone={localStorage.getItem('emoji-skin-tone') || 'neutral'}
                    onSkinToneChange={tone => localStorage.setItem('emoji-skin-tone', tone)}
                  />
                </Suspense>
                <button
                  type="button"
                  onPointerDown={closeEmojiPicker}
                  className="absolute w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                  style={{ top: 19, right: 8, zIndex: 10 }}
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
              <div className="bg-white" style={{ height: 'env(safe-area-inset-bottom)' }} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Input bar */}
      <div
        className="shrink-0 px-4 py-2"
        style={{ paddingBottom: keyboardOpen ? '8px' : 'max(8px, var(--sab, env(safe-area-inset-bottom)))' }}
      >
        <div className="bg-white/90 backdrop-blur-sm rounded-[30px] shadow-lg border border-stone-100 px-3 pt-3 pb-3 relative">

          {/* Image previews */}
          {imagePreviews.length > 0 && (
            <div className="flex gap-2 mb-2 overflow-x-auto pt-2 pb-0.5">
              {imagePreviews.map((preview, i) => (
                <div key={preview.previewUrl} className="relative shrink-0">
                  <img src={preview.previewUrl} alt="preview" className="h-20 w-20 object-cover rounded-xl border border-stone-200" />
                  <button
                    onClick={() => setImagePreviews(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-stone-600 text-white rounded-full flex items-center justify-center"
                  >
                    <X size={10} weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Attach menu popup */}
          <AnimatePresence>
            {showAttachMenu && (
              <motion.div
                key="leaders-attach"
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
                className="absolute bottom-full left-0 pb-2 z-[8]"
              >
                <div ref={attachMenuRef} className="bg-white rounded-2xl shadow-lg border border-stone-100 py-1 min-w-[148px] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAttachMenu(false)
                      if (fileInputRef.current) { fileInputRef.current.value = ''; fileInputRef.current.click() }
                    }}
                    className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-stone-50 transition-colors"
                  >
                    <ImageIcon size={18} className="text-stone-500 shrink-0" />
                    <span className="text-sm font-medium text-stone-700">Photo</span>
                  </button>
                  <div className="mx-4 h-px bg-stone-100" />
                  <button
                    type="button"
                    onClick={() => { setShowAttachMenu(false); openEmoji() }}
                    className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-stone-50 transition-colors"
                  >
                    <Smiley size={18} className="text-stone-500 shrink-0" />
                    <span className="text-sm font-medium text-stone-700">Emoji</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-end gap-2 relative z-10">
            {/* + button */}
            <button
              ref={attachBtnRef}
              type="button"
              onClick={() => {
                const opening = !showAttachMenu
                setShowAttachMenu(v => !v)
                if (opening && showEmojiPicker) closeEmojiPicker()
              }}
              className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 ${showAttachMenu ? 'text-ember bg-ember/10' : 'text-stone-400 hover:text-ember hover:bg-stone-100'}`}
            >
              <motion.div
                animate={{ rotate: showAttachMenu ? 45 : 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              >
                <PlusIcon size={22} weight="bold" />
              </motion.div>
            </button>

            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

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
              disabled={!canSend}
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
