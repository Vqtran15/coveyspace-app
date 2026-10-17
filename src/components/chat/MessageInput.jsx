import { lazy, Suspense, useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PaperPlaneTilt, Image as ImageIcon, X, ChartBar, Plus as PlusIcon, Smiley, VideoCamera,
} from '@phosphor-icons/react'
import { AvatarIcon, avatarColor } from '../../lib/avatarIcons.jsx'
import { useChatInputContext } from './ChatContext.jsx'

const EmojiPicker = lazy(() => import('emoji-picker-react'))

export default function MessageInput() {
  const {
    text, setText, imagePreviews, setImagePreviews, removePreview,
    replyingTo, setReplyingTo,
    sending,
    textareaRef, fileInputRef, savedSelectionRef,
    scrollRef,
    pollCreating, setPollCreating,
    pollQuestion, setPollQuestion,
    pollOptions, setPollOptions,
    pollSubmitting,
    pollOptionRefs, justAddedOptionRef, pollQuestionRef,
    showEmojiPicker, setShowEmojiPicker,
    handleTextInput, handleKeyDown, handleSend, handleFileChange,
    closeEmojiPicker, insertEmoji, createPoll,
    senderName,
    mentionSearch, setMentionSearch, insertMention, members, myId,
  } = useChatInputContext()

  const videoInputRef = useRef(null)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [justTapped, setJustTapped] = useState(false)
  const btnWrapRef = useRef(null)
  const justTappedTimerRef = useRef(null)

  useEffect(() => () => clearTimeout(justTappedTimerRef.current), [])

  useEffect(() => {
    if (pollCreating) {
      const t = setTimeout(() => pollQuestionRef.current?.focus(), 300)
      return () => clearTimeout(t)
    }
  }, [pollCreating])

  function onSendClick() {
    if (sending || (!text.trim() && imagePreviews.length === 0)) return
    const el = btnWrapRef.current
    if (el) {
      el.classList.remove('animate-send-pulse')
      void el.offsetWidth
      el.classList.add('animate-send-pulse')
    }
    clearTimeout(justTappedTimerRef.current)
    setJustTapped(true)
    justTappedTimerRef.current = setTimeout(() => setJustTapped(false), 380)
    handleSend()
  }
  const attachMenuRef = useRef(null)
  const attachBtnRef = useRef(null)
  const emojiPickerRef = useRef(null)
  // Capture-phase pointerdown listener: closes the attach menu when the user taps
  // anywhere outside the menu card or the + button. Fixed backdrop divs don't work
  // here because they inherit pointer-events: none from the overlay's outer wrapper.
  useEffect(() => {
    if (!showAttachMenu) return
    function onPointerDown(e) {
      if (
        !attachMenuRef.current?.contains(e.target) &&
        !attachBtnRef.current?.contains(e.target)
      ) {
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

  function stopListMomentum() {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollTop
  }

  function openPoll() {
    if (showEmojiPicker) closeEmojiPicker()
    setPollCreating(true)
  }

  // Focus the poll question input once the poll form has mounted
  useEffect(() => {
    if (pollCreating) pollQuestionRef.current?.focus()
  }, [pollCreating]) // eslint-disable-line react-hooks/exhaustive-deps

  function openEmoji() {
    const el = textareaRef.current
    if (el) {
      savedSelectionRef.current = { start: el.selectionStart ?? text.length, end: el.selectionEnd ?? text.length }
      el.blur()
    }
    setShowEmojiPicker(true)
    setPollCreating(false)
  }

  return (
    <div className="shrink-0 max-w-3xl mx-auto w-full px-4 py-2" onTouchStart={stopListMomentum}>
    <div className="bg-white/90 backdrop-blur-sm rounded-[30px] shadow-lg border border-stone-100 px-3 pt-3 pb-3 relative">
      {/* Reply preview */}
      {replyingTo && (
        <div className="flex items-center gap-2 bg-ember/5 border border-ember/20 rounded-xl px-3 py-2 mb-2">
          <div className="w-0.5 self-stretch bg-ember rounded-full shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-ember truncate">{senderName(replyingTo.user_id, replyingTo.display_name)}</p>
            <p className="text-xs text-stone-400 truncate">
              {replyingTo.image_url && !replyingTo.body ? '📷 Photo' : replyingTo.body}
            </p>
          </div>
          <button onClick={() => setReplyingTo(null)} className="text-stone-400 hover:text-stone-600 shrink-0">
            <X size={14} weight="bold" />
          </button>
        </div>
      )}
      {imagePreviews.length > 0 && (
        <div className="flex gap-2 mb-2 overflow-x-auto pt-2 pb-0.5">
          {imagePreviews.map((preview, i) => (
            <div key={preview.previewUrl} className="relative shrink-0">
              {preview.isVideo
                ? (
                  <div className="h-20 w-20 rounded-xl border border-stone-200 bg-stone-100 overflow-hidden flex items-center justify-center">
                    <video src={preview.previewUrl} className="h-full w-full object-cover" muted playsInline />
                    <VideoCamera size={20} className="absolute text-white drop-shadow" weight="fill" />
                  </div>
                )
                : <img src={preview.previewUrl} alt="preview" className="h-20 w-20 object-cover rounded-xl border border-stone-200" />
              }
              <button
                onClick={() => removePreview(i)}
                aria-label="Remove"
                className="absolute -top-2 -right-2 w-7 h-7 bg-stone-600 text-white rounded-full flex items-center justify-center"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* @mention picker */}
      {mentionSearch !== null && (() => {
        const q = mentionSearch.toLowerCase()
        const filtered = members
          .filter(m => m.user_id !== myId && m.display_name.toLowerCase().includes(q))
          .sort((a, b) => {
            const aStarts = a.display_name.toLowerCase().startsWith(q)
            const bStarts = b.display_name.toLowerCase().startsWith(q)
            return aStarts === bStarts ? 0 : aStarts ? -1 : 1
          })
        if (!filtered.length) return null
        return (
          <div className="absolute bottom-full left-0 right-0 pb-1 z-[8]">
            <div id="mention-listbox" role="listbox" aria-label="Mention suggestions" className="bg-white rounded-2xl shadow-lg border border-stone-100 overflow-hidden max-h-48 overflow-y-auto">
              {filtered.map(member => (
                <button
                  key={member.user_id}
                  role="option"
                  aria-selected="false"
                  type="button"
                  onPointerDown={e => { e.preventDefault(); insertMention(member) }}
                  className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-stone-50 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 ${member.avatar_image_url ? 'bg-stone-200' : avatarColor(member.user_id, member.avatar_color)}`}>
                    {member.avatar_image_url
                      ? <img src={member.avatar_image_url} alt="" className="w-full h-full object-cover" />
                      : member.avatar_icon
                        ? <AvatarIcon name={member.avatar_icon} size={16} />
                        : <span className="text-white text-xs font-bold">{member.display_name.charAt(0).toUpperCase()}</span>
                    }
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-stone-800">@{member.display_name.split(' ')[0]}</p>
                    {member.display_name.includes(' ') && (
                      <p className="text-xs text-stone-400 truncate">{member.display_name}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })()}

      {createPortal(
        <AnimatePresence>
          {pollCreating && (
            <motion.div
              key="poll-page"
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-0 lg:left-56 z-[20] bg-sunrise-50 flex flex-col"
              style={{ paddingTop: 'env(safe-area-inset-top)' }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-stone-100 shrink-0">
                <h1 className="text-xl font-bold text-stone-800">Create Poll</h1>
                <button
                  onClick={() => { setPollCreating(false); setPollQuestion(''); setPollOptions(['', '']) }}
                  aria-label="Close"
                  className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:bg-stone-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              {/* Scrollable content — submit button lives here so the keyboard never obscures it */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Question</p>
                    <input
                      ref={pollQuestionRef}
                      type="text"
                      value={pollQuestion}
                      onChange={e => setPollQuestion(e.target.value)}
                      placeholder="Ask a question…"
                      className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
                    />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-stone-500 mb-2">Options</p>
                    <div className="flex flex-col gap-2">
                      {pollOptions.map((opt, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            ref={el => pollOptionRefs.current[i] = el}
                            type="text"
                            value={opt}
                            onChange={e => {
                              const next = [...pollOptions]
                              next[i] = e.target.value
                              setPollOptions(next)
                            }}
                            placeholder={`Option ${i + 1}`}
                            className="flex-1 border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 bg-white placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
                          />
                          {pollOptions.length > 2 && (
                            <button
                              onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                              aria-label="Remove option"
                              className="w-10 h-10 flex items-center justify-center rounded-full text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                            >
                              <X size={16} weight="bold" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    {pollOptions.length < 10 && (
                      <button
                        onClick={() => { justAddedOptionRef.current = true; setPollOptions(prev => [...prev, '']) }}
                        className="mt-3 flex items-center gap-1.5 text-sm text-ember font-semibold hover:text-ember-700 transition-colors"
                      >
                        <PlusIcon size={14} weight="bold" /> Add option
                      </button>
                    )}
                  </div>
                </div>
                <div className="pt-6" style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
                  <button
                    onClick={createPoll}
                    disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2 || pollSubmitting}
                    className="w-full py-3.5 bg-ember text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:bg-ember-700 transition-colors"
                  >
                    {pollSubmitting ? 'Creating…' : 'Create Poll'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {createPortal(
        <AnimatePresence>
          {showEmojiPicker && (
            <motion.div
              ref={emojiPickerRef}
              key="emoji-picker"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="fixed inset-x-0 lg:left-56 bottom-0 z-[11]"
            >
              <div className="relative">
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
                  aria-label="Close emoji picker"
                  className="absolute top-5 right-2 z-10 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
              {/* White fill for home-indicator safe area */}
              <div className="bg-white" style={{ height: 'env(safe-area-inset-bottom)' }} />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
      {/* Attach menu popup */}
      <AnimatePresence>
        {showAttachMenu && (
          <motion.div
            key="attach-menu"
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
                <span className="text-sm font-medium text-stone-700">Photo / GIF</span>
              </button>
              <div className="mx-4 h-px bg-stone-100" />
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false)
                  openPoll()
                }}
                className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-stone-50 transition-colors"
              >
                <ChartBar size={18} className="text-stone-500 shrink-0" />
                <span className="text-sm font-medium text-stone-700">Poll</span>
              </button>
              <div className="mx-4 h-px bg-stone-100" />
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(false)
                  if (videoInputRef.current) {
                    videoInputRef.current.value = ''
                    videoInputRef.current.click()
                  }
                }}
                className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-stone-50 transition-colors"
              >
                <VideoCamera size={18} className="text-stone-500 shrink-0" />
                <span className="text-sm font-medium text-stone-700">Video</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="flex items-end gap-2 relative z-10">
        {/* + button — opens attach menu; rotates 45° to × when open */}
        <button
          ref={attachBtnRef}
          type="button"
          onClick={() => {
            const opening = !showAttachMenu
            setShowAttachMenu(v => !v)
            if (opening) {
              if (showEmojiPicker) closeEmojiPicker()
              if (pollCreating) { setPollCreating(false); setPollQuestion(''); setPollOptions(['', '']) }
            }
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
        <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={handleFileChange} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextInput}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          aria-label="Message"
          aria-autocomplete="list"
          aria-expanded={mentionSearch !== null}
          aria-controls={mentionSearch !== null ? 'mention-listbox' : undefined}
          className="flex-1 resize-none bg-stone-100 border-0 rounded-xl px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none"
          style={{ maxHeight: 120, overflowY: 'auto' }}
        />
        <button
          type="button"
          onClick={openEmoji}
          className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors shrink-0 ${showEmojiPicker ? 'text-ember bg-ember/10' : 'text-stone-400 hover:text-ember hover:bg-stone-100'}`}
          aria-label="Emoji"
        >
          <Smiley size={20} />
        </button>
        <span ref={btnWrapRef} className="shrink-0 inline-flex">
          <button
            type="button"
            onClick={onSendClick}
            disabled={sending || (!text.trim() && imagePreviews.length === 0)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-ember text-white hover:bg-ember-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
          >
            <motion.span
              animate={justTapped
                ? { rotate: [0, -15, 15, -8, 0] }
                : { rotate: 0 }
              }
              transition={justTapped
                ? { duration: 0.35, ease: 'easeInOut' }
                : { duration: 0 }
              }
            >
              <PaperPlaneTilt size={18} weight="fill" />
            </motion.span>
          </button>
        </span>
      </div>
      <p className="hidden lg:block text-xs text-stone-400 text-center pb-0.5 -mt-0.5">Shift+Enter for a new line</p>
    </div>
    </div>
  )
}
