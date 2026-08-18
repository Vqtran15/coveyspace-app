import { lazy, Suspense, useState, useRef, useEffect } from 'react'
import { flushSync } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PaperPlaneTilt, Image as ImageIcon, X, ChartBar, Plus as PlusIcon, Smiley,
} from '@phosphor-icons/react'
import { useChatContext } from './ChatContext.jsx'

const EmojiPicker = lazy(() => import('emoji-picker-react'))

export default function MessageInput() {
  const {
    text, setText, imagePreviews, setImagePreviews,
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
  } = useChatContext()

  const [showAttachMenu, setShowAttachMenu] = useState(false)
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
    const keyboardWasUp = ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)
    if (keyboardWasUp) {
      flushSync(() => setPollCreating(true))
      pollQuestionRef.current?.focus()
    } else {
      setPollCreating(true)
    }
  }

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
      {pollCreating && !pollSubmitting && (
        <div
          className="fixed inset-0 z-[7] pointer-events-auto"
          onPointerDown={() => { setPollCreating(false); setPollQuestion(''); setPollOptions(['', '']) }}
        />
      )}
      <AnimatePresence>
        {pollCreating && (
          <motion.div
            key="poll-create"
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="absolute bottom-full left-0 right-0 pb-2 px-4 z-[8]"
          >
          <div className="border border-stone-200 rounded-2xl bg-white flex flex-col overflow-hidden"
               style={{ maxHeight: 'calc(100dvh - 80px)' }}>
          {/* Header — always visible */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0">
            <p className="text-sm font-bold text-stone-800">Create Poll</p>
            <button onClick={() => { setPollCreating(false); setPollQuestion(''); setPollOptions(['', '']) }} className="text-stone-400 hover:text-stone-600">
              <X size={16} weight="bold" />
            </button>
          </div>
          {/* Scrollable: question + options */}
          <div className="overflow-y-auto flex-1 min-h-0 px-3">
          <input
            ref={pollQuestionRef}
            type="text"
            value={pollQuestion}
            onChange={e => setPollQuestion(e.target.value)}
            placeholder="Ask a question…"
            className="w-full text-sm border border-stone-200 rounded-xl px-3 py-2 mb-2 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
          />
          <div className="flex flex-col gap-1.5 mb-2.5">
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
                  className="flex-1 text-sm border border-stone-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
                />
                {pollOptions.length > 2 && (
                  <button
                    onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))}
                    className="text-stone-300 hover:text-red-400 shrink-0"
                  >
                    <X size={14} weight="bold" />
                  </button>
                )}
              </div>
            ))}
          </div>
          </div>
          {/* Footer — always visible */}
          <div className="flex items-center justify-between px-3 pt-2 pb-3 shrink-0">
            {pollOptions.length < 10 ? (
              <button
                onClick={() => { justAddedOptionRef.current = true; setPollOptions(prev => [...prev, '']) }}
                className="flex items-center gap-1 text-xs text-ember font-semibold hover:text-ember-700 transition-colors"
              >
                <PlusIcon size={12} weight="bold" /> Add option
              </button>
            ) : <span />}
            <button
              onClick={createPoll}
              disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2 || pollSubmitting}
              className="text-sm font-semibold bg-ember text-white px-4 py-1.5 rounded-xl disabled:opacity-40 hover:bg-ember-700 transition-colors"
            >
              {pollSubmitting ? 'Creating…' : 'Create Poll'}
            </button>
          </div>
          </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            ref={emojiPickerRef}
            key="emoji-picker"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="fixed inset-x-0 lg:left-56 bottom-0 z-[11] bg-white"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="flex justify-end px-3 pt-2 pb-0">
              <button
                type="button"
                onPointerDown={closeEmojiPicker}
                className="w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
              >
                <X size={16} weight="bold" />
              </button>
            </div>
            <Suspense fallback={null}>
              <EmojiPicker
                onEmojiClick={emojiData => insertEmoji(emojiData.emoji)}
                width="100%"
                height={310}
                searchPlaceholder="Search emojis…"
                previewConfig={{ showPreview: false }}
                autoFocusSearch={false}
                defaultSkinTone={localStorage.getItem('emoji-skin-tone') || 'neutral'}
                onSkinToneChange={tone => localStorage.setItem('emoji-skin-tone', tone)}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
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
                <span className="text-sm font-medium text-stone-700">Photo</span>
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
                  openEmoji()
                }}
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
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextInput}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          className="flex-1 resize-none bg-stone-100 border-0 rounded-xl px-4 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none"
          style={{ maxHeight: 120, overflowY: 'auto' }}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || (!text.trim() && imagePreviews.length === 0)}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-ember text-white hover:bg-ember-700 transition-colors shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <PaperPlaneTilt size={18} weight="fill" />
        </button>
      </div>
    </div>
    </div>
  )
}
