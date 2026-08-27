import { useState, useEffect } from 'react'
import { ArrowLeft, Megaphone, ShieldCheck } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { db } from '../lib/db.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { formatListTime } from '../utils/format.js'

export function sanitizeHtml(html) {
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

export function BroadcastCard({ msg, isChurchAdmin, groupsInChurch = [], isAdminOnly = false, idx = 0 }) {
  const targetedGroups = isChurchAdmin && msg.target_group_ids?.length
    ? msg.target_group_ids.map(id => groupsInChurch.find(g => g.id === id)?.name).filter(Boolean)
    : null

  return (
    <div
      className="bg-white rounded-2xl border border-stone-100 shadow-sm px-5 py-4 animate-stack-in"
      style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-stone-800">{msg.display_name}</p>
        <div className="flex items-center gap-2 shrink-0">
          {isAdminOnly && (
            <span className="flex items-center gap-1 bg-ember/10 text-ember rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
              <ShieldCheck size={12} weight="fill" />
              Group Admins
            </span>
          )}
          <span className="text-xs text-stone-400 whitespace-nowrap">{formatListTime(msg.created_at)}</span>
        </div>
      </div>
      <div
        className="broadcast-html text-sm text-stone-700 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.body ?? '') }}
      />
      {isChurchAdmin && (
        <p className="text-xs text-stone-400 mt-2">
          {targetedGroups?.length > 0 ? `${targetedGroups.join(', ')} · ` : ''}
          {msg.audience === 'admins_only' ? 'Group Admins only' : 'All members'}
        </p>
      )}
    </div>
  )
}

export default function ChurchBroadcastView({ conversation, onBack }) {
  const { userId, isChurchAdmin } = useAppContext()
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)

  const convId      = conversation.id
  const isAdminOnly = conversation.type === 'admins_only'

  useEffect(() => {
    if (!convId) return
    setLoading(true)
    db.churches.fetchMessages(convId)
      .then(r => {
        setMessages((r.data ?? []).map(m => ({ ...m, _isAdminOnly: isAdminOnly })))
        setLoading(false)
      })
    db.churches.updateLastRead(convId, userId).then()
  }, [convId, userId, isAdminOnly])

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
        const tagged = { ...msg, _isAdminOnly: isAdminOnly }
        setMessages(prev => prev.some(m => m.id === tagged.id) ? prev : [tagged, ...prev])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [convId, isAdminOnly])

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
          {isAdminOnly
            ? <ShieldCheck size={20} weight="fill" className="text-ember" />
            : <Megaphone size={20} weight="fill" className="text-ember" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xl font-bold text-stone-800 truncate">
            {isAdminOnly ? 'Leadership Bulletin' : 'Church Bulletin'}
          </p>
        </div>
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
              <p className="text-xs text-stone-400 mt-1">Compose broadcasts in Settings → Church Settings</p>
            )}
          </div>
        ) : (
          <div
            className="max-w-2xl mx-auto px-4 py-6 space-y-3"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
          >
            {messages.map((msg, i) => (
              <BroadcastCard key={msg.id} msg={msg} isChurchAdmin={isChurchAdmin} isAdminOnly={msg._isAdminOnly} idx={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
