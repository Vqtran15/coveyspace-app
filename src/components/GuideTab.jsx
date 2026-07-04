import { useState, useRef } from 'react'
import {
  BookOpen, ArrowSquareOut, ArrowLeft, Link,
  File, NotePencil, PencilSimple, UploadSimple, X,
  TextB, TextItalic, ListBullets,
} from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function TypePicker({ onPick }) {
  return (
    <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
      <p className="text-sm text-stone-500 text-center mb-1 animate-fade-up" style={{ animationDelay: '40ms' }}>
        How do you want to share the guide?
      </p>
      {[
        { type: 'url',   Icon: Link,       label: 'External Link', sub: 'Google Doc, Notion, website' },
        { type: 'file',  Icon: File,       label: 'Upload a File', sub: 'PDF or Word document' },
        { type: 'notes', Icon: NotePencil, label: 'Write Notes',   sub: 'Type directly in the app' },
      ].map(({ type, Icon, label, sub }, i) => (
        <button
          key={type}
          onClick={() => onPick(type)}
          style={{ animationDelay: `${80 + i * 70}ms` }}
          className="flex items-center gap-4 px-5 py-4 bg-white border border-stone-200 rounded-2xl text-left hover:border-jade hover:bg-jade/5 transition-colors animate-stack-in"
        >
          <div className="w-10 h-10 rounded-xl bg-sunrise-50 flex items-center justify-center shrink-0">
            <Icon size={20} className="text-jade" weight="fill" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-800">{label}</p>
            <p className="text-xs text-stone-400 mt-0.5">{sub}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

function UrlEditor({ initial, onSave, onCancel }) {
  const [url, setUrl] = useState(initial || '')
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  async function handle(e) {
    e.preventDefault()
    setSaving(true)
    const trimmed = url.trim()
    const normalized = trimmed && !/^https?:\/\//i.test(trimmed) ? `https://${trimmed}` : trimmed
    const { error } = await onSave({ type: 'url', url: normalized })
    if (error) toast('Failed to save', 'error')
    else toast('Guide saved', 'success')
    setSaving(false)
  }

  return (
    <form onSubmit={handle} className="w-full max-w-xs mx-auto flex flex-col gap-3">
      <input
        type="text"
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="https://docs.google.com/…"
        className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
        autoFocus
      />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Cancel</button>
        <button type="submit" disabled={saving || !url.trim()} className="flex-1 py-2.5 bg-jade rounded-xl text-sm font-medium text-white hover:bg-jade-700 transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}

function FileUploader({ groupId, onSave, onCancel }) {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef(null)
  const toast = useToast()

  async function handle() {
    if (!file || !groupId) return
    setUploading(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `${groupId}/guide.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('guide-files')
      .upload(path, file, { upsert: true, contentType: file.type })
    if (uploadError) {
      toast('Upload failed — check file size and try again', 'error')
      setUploading(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('guide-files').getPublicUrl(path)
    const { error } = await onSave({ type: 'file', url: publicUrl })
    if (error) toast('Failed to save', 'error')
    else toast('Guide uploaded', 'success')
    setUploading(false)
  }

  return (
    <div className="w-full max-w-xs mx-auto flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={e => setFile(e.target.files?.[0] || null)}
      />
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center gap-2 px-6 py-8 border-2 border-dashed border-stone-200 rounded-2xl hover:border-jade hover:bg-jade/5 transition-colors"
        >
          <UploadSimple size={28} className="text-stone-400" />
          <span className="text-sm text-stone-500">Tap to choose a file</span>
          <span className="text-xs text-stone-400">PDF or Word · max 10 MB</span>
        </button>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 bg-white border border-stone-200 rounded-xl">
          <File size={20} weight="fill" className="text-jade shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-stone-800 truncate">{file.name}</p>
            <p className="text-xs text-stone-400">{formatBytes(file.size)}</p>
          </div>
          <button type="button" onClick={() => setFile(null)} className="text-stone-400 hover:text-stone-600 p-1">
            <X size={16} />
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Cancel</button>
        <button type="button" onClick={handle} disabled={!file || uploading} className="flex-1 py-2.5 bg-jade rounded-xl text-sm font-medium text-white hover:bg-jade-700 transition-colors disabled:opacity-40">
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </div>
  )
}

const TOOLBAR_ACTIONS = [
  { format: 'bold',   Icon: TextB,        title: 'Bold' },
  { format: 'italic', Icon: TextItalic,   title: 'Italic' },
  { format: 'bullet', Icon: ListBullets,  title: 'Bullet list' },
]

function applyFormat(el, format, setContent) {
  const start = el.selectionStart
  const end   = el.selectionEnd
  const val   = el.value
  const sel   = val.substring(start, end)

  let newVal, nextStart, nextEnd

  if (format === 'bold' || format === 'italic') {
    const m = format === 'bold' ? '**' : '*'
    const placeholder = format === 'bold' ? 'bold text' : 'italic text'
    if (sel) {
      const inserted = `${m}${sel}${m}`
      newVal    = val.substring(0, start) + inserted + val.substring(end)
      nextStart = start
      nextEnd   = start + inserted.length
    } else {
      const inserted = `${m}${placeholder}${m}`
      newVal    = val.substring(0, start) + inserted + val.substring(end)
      nextStart = start + m.length
      nextEnd   = start + m.length + placeholder.length
    }
  } else if (format === 'bullet') {
    const lineStart = val.lastIndexOf('\n', start - 1) + 1
    newVal    = val.substring(0, lineStart) + '- ' + val.substring(lineStart)
    nextStart = nextEnd = start + 2
  }

  setContent(newVal)
  setTimeout(() => {
    el.focus()
    el.selectionStart = nextStart
    el.selectionEnd   = nextEnd
  }, 0)
}

function NotesEditor({ initial, onSave, onCancel }) {
  const [content, setContent] = useState(initial || '')
  const [saving, setSaving]   = useState(false)
  const textareaRef = useRef(null)
  const toast = useToast()

  async function handle() {
    setSaving(true)
    const { error } = await onSave({ type: 'notes', content: content.trim() })
    if (error) toast('Failed to save', 'error')
    else toast('Notes saved', 'success')
    setSaving(false)
  }

  return (
    <div className="w-full flex flex-col gap-3">
      <div className="border border-stone-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-jade focus-within:border-transparent">
        <div className="flex items-center gap-0.5 px-2 py-1.5 bg-stone-50 border-b border-stone-100">
          {TOOLBAR_ACTIONS.map(({ format, Icon, title }) => (
            <button
              key={format}
              type="button"
              title={title}
              onMouseDown={e => { e.preventDefault(); applyFormat(textareaRef.current, format, setContent) }}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-500 hover:text-stone-800 hover:bg-stone-200 transition-colors"
            >
              <Icon size={16} weight="bold" />
            </button>
          ))}
        </div>
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="Type your community guide here — values, FAQs, contact info, house rules…"
          className="w-full min-h-[260px] px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none resize-none leading-relaxed bg-white"
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-white border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors">Cancel</button>
        <button type="button" onClick={handle} disabled={saving || !content.trim()} className="flex-1 py-2.5 bg-jade rounded-xl text-sm font-medium text-white hover:bg-jade-700 transition-colors disabled:opacity-40">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function NavHeader({ onBack, onEdit, showEdit }) {
  return (
    <div className="flex items-center justify-between mb-8">
      <button
        onClick={onBack}
        className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors"
      >
        <ArrowLeft size={20} weight="bold" />
      </button>
      {showEdit && (
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-700 transition-colors"
        >
          <PencilSimple size={16} weight="bold" />
          Edit
        </button>
      )}
    </div>
  )
}

export default function GuideTab({ onClose, guideUrl, guideType, guideContent, isAdmin, groupId, onGuideSave }) {
  const [editMode, setEditMode]     = useState(null) // null | 'pick' | 'url' | 'file' | 'notes'
  const [slideDir, setSlideDir]     = useState('right')
  const [backTarget, setBackTarget] = useState(null) // where Cancel/back-arrow goes from an editor

  // Skip entry animation on first render; only animate on internal navigation
  const hasNavigated = useRef(false)

  const effectiveType = guideType || (guideUrl ? 'url' : null)
  const hasGuide = !!effectiveType

  function navigateTo(mode, dir, back = null) {
    hasNavigated.current = true
    setSlideDir(dir)
    setBackTarget(back)
    setEditMode(mode)
  }

  function screenClass() {
    if (!hasNavigated.current) return ''
    return slideDir === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
  }

  async function handleSave(data) {
    const result = await onGuideSave(data)
    if (!result?.error) navigateTo(null, 'left')
    return result
  }

  // ── Edit: type picker ──────────────────────────────────────────────────────
  if (editMode === 'pick') {
    return (
      <div key="pick" className={`max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12 ${screenClass()}`}>
        <NavHeader onBack={() => navigateTo(null, 'left')} />
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-jade flex items-center justify-center mb-5">
            <BookOpen size={44} weight="fill" className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Set Up Guide</h1>
          <p className="text-stone-500 text-sm max-w-xs">Choose how you'd like to share the guide with your community.</p>
        </div>
        <TypePicker onPick={type => navigateTo(type, 'right', 'pick')} />
      </div>
    )
  }

  // ── Edit: URL ──────────────────────────────────────────────────────────────
  if (editMode === 'url') {
    return (
      <div key="url" className={`max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12 ${screenClass()}`}>
        <NavHeader onBack={() => navigateTo(backTarget, 'left')} />
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-jade flex items-center justify-center mb-5">
            <Link size={44} weight="fill" className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800 mb-2">External Link</h1>
          <p className="text-stone-500 text-sm max-w-xs mb-8">Paste a link to a Google Doc, Notion page, or any website.</p>
          <UrlEditor
            initial={effectiveType === 'url' ? guideUrl : ''}
            onSave={handleSave}
            onCancel={() => navigateTo(backTarget, 'left')}
          />
          {hasGuide && (
            <button onClick={() => navigateTo('pick', 'left')} className="mt-5 text-xs text-stone-400 hover:text-stone-600 underline">
              Switch guide type
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Edit: file upload ──────────────────────────────────────────────────────
  if (editMode === 'file') {
    return (
      <div key="file" className={`max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12 ${screenClass()}`}>
        <NavHeader onBack={() => navigateTo(backTarget, 'left')} />
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-20 h-20 rounded-2xl bg-jade flex items-center justify-center mb-5">
            <File size={44} weight="fill" className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800 mb-2">Upload File</h1>
          <p className="text-stone-500 text-sm max-w-xs mb-8">Upload a PDF or Word document as your community guide.</p>
          <FileUploader
            groupId={groupId}
            onSave={handleSave}
            onCancel={() => navigateTo(backTarget, 'left')}
          />
          {hasGuide && (
            <button onClick={() => navigateTo('pick', 'left')} className="mt-5 text-xs text-stone-400 hover:text-stone-600 underline">
              Switch guide type
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Edit: notes ────────────────────────────────────────────────────────────
  if (editMode === 'notes') {
    return (
      <div key="notes" className={`max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12 ${screenClass()}`}>
        <NavHeader onBack={() => navigateTo(backTarget, 'left')} />
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-20 h-20 rounded-2xl bg-jade flex items-center justify-center mb-5">
            <NotePencil size={44} weight="fill" className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-stone-800 mb-1">Write Notes</h1>
          <p className="text-stone-500 text-sm max-w-xs mb-6">This content is visible to all group members.</p>
        </div>
        <NotesEditor
          initial={guideContent || ''}
          onSave={handleSave}
          onCancel={() => navigateTo(backTarget, 'left')}
        />
        {hasGuide && (
          <button onClick={() => navigateTo('pick', 'left')} className="mt-5 text-xs text-stone-400 hover:text-stone-600 underline block mx-auto">
            Switch guide type
          </button>
        )}
      </div>
    )
  }

  // ── Display mode ───────────────────────────────────────────────────────────
  return (
    <div key="display" className={`max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12 ${screenClass()}`}>
      <NavHeader
        onBack={onClose}
        showEdit={isAdmin && hasGuide}
        onEdit={() => navigateTo(effectiveType, 'right', null)}
      />

      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-jade flex items-center justify-center mb-5">
          <BookOpen size={44} weight="fill" className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-stone-800 mb-2">Guide</h1>

        {effectiveType === 'notes' && guideContent ? (
          <>
            <p className="text-stone-500 text-sm mb-6 max-w-xs">Community guide from your admin.</p>
            <div className="w-full text-left bg-white border border-stone-200 rounded-2xl px-5 py-4 text-sm text-stone-700 leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-base font-bold text-stone-800 mb-2 mt-4 first:mt-0">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-sm font-bold text-stone-800 mb-1.5 mt-3 first:mt-0">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-semibold text-stone-700 mb-1 mt-2 first:mt-0">{children}</h3>,
                  p:  ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                  strong: ({ children }) => <strong className="font-semibold text-stone-800">{children}</strong>,
                  em:     ({ children }) => <em className="italic">{children}</em>,
                  ul: ({ children }) => <ul className="list-disc ml-5 mb-3 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal ml-5 mb-3 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li>{children}</li>,
                  hr: () => <hr className="border-stone-100 my-4" />,
                }}
              >
                {guideContent}
              </ReactMarkdown>
            </div>
          </>
        ) : (effectiveType === 'url' || effectiveType === 'file') && guideUrl ? (
          <>
            <p className="text-stone-500 text-sm mb-8 max-w-xs">
              {effectiveType === 'file'
                ? 'Your community guide is available to view.'
                : 'Read the latest guide from your community.'}
            </p>
            <button
              onClick={() => window.open(guideUrl, '_blank', 'noopener,noreferrer')}
              className="flex items-center gap-2 px-6 py-3 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white font-medium rounded-xl transition-colors"
            >
              Open Guide
              <ArrowSquareOut size={18} weight="bold" />
            </button>
          </>
        ) : isAdmin ? (
          <>
            <p className="text-stone-500 text-sm mb-8 max-w-xs">Set up a guide for your community to reference anytime.</p>
            <button
              onClick={() => navigateTo('pick', 'right')}
              className="flex items-center gap-2 px-6 py-3 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white font-medium rounded-xl transition-colors"
            >
              Set up guide
            </button>
          </>
        ) : (
          <p className="text-sm text-stone-400 max-w-xs mt-2">
            No guide available yet. Ask your admin to set one up.
          </p>
        )}
      </div>
    </div>
  )
}
