import { useState, useEffect, useCallback } from 'react'
import { ArrowLeft, PaperPlaneRight, Megaphone, Check } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { db } from '../lib/db.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { formatListTime } from '../utils/format.js'

// Full-screen slide-in composer — textarea is in the scrollable flow so iOS
// auto-scrolls to keep it above the keyboard (same pattern as PrayerProfile).
function BroadcastComposer({ churchId, convId, audience, groupsInChurch, displayName, userId, onSent, onClose }) {
  const [text, setText] = useState('')
  const [targetMode, setTargetMode] = useState('all') // 'all' | 'select'
  const [selectedGroupIds, setSelectedGroupIds] = useState(new Set())
  const [sending, setSending] = useState(false)
  const [exiting, setExiting] = useState(false)

  function handleClose() {
    setExiting(true)
    setTimeout(onClose, 200)
  }

  function toggleGroup(id) {
    setSelectedGroupIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  async function handleSend() {
    if (!text.trim()) return
    setSending(true)
    const targetGroupIds = targetMode === 'select' && selectedGroupIds.size > 0
      ? [...selectedGroupIds]
      : null
    const { data, error } = await db.churches.sendMessage({
      churchId,
      convId,
      userId,
      displayName,
      body: text.trim(),
      audience,
      targetGroupIds,
    })
    setSending(false)
    if (!error && data) { onSent(data); handleClose() }
  }

  const sendDisabled = !text.trim() || sending || (targetMode === 'select' && selectedGroupIds.size === 0)

  return (
    <div
      className={`fixed inset-0 lg:left-56 z-[35] bg-sunrise-50 flex flex-col ${exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
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
          <h2 className="flex-1 text-base font-bold text-stone-800">New Broadcast</h2>
          <button
            onClick={handleSend}
            disabled={sendDisabled}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-ember text-white text-sm font-semibold hover:bg-ember-700 transition-colors disabled:opacity-40"
          >
            <PaperPlaneRight size={15} weight="fill" />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>

      {/* Scrollable form — iOS auto-scrolls textarea above keyboard */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div
          className="max-w-2xl mx-auto px-4 py-6 space-y-6"
          style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
        >
        <div>
          <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5 block">Message</label>
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write your message…"
            rows={6}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent resize-none"
          />
        </div>

        {groupsInChurch.length > 1 && (
          <div>
            <label className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2 block">Send to</label>
            <div className="bg-stone-100 rounded-xl p-1 flex mb-3">
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
              <div className="space-y-1">
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
        </div>
      </div>
    </div>
  )
}

function BroadcastCard({ msg, isChurchAdmin, groupsInChurch }) {
  const targetedGroups = isChurchAdmin && msg.target_group_ids?.length
    ? msg.target_group_ids.map(id => groupsInChurch.find(g => g.id === id)?.name).filter(Boolean)
    : null

  return (
    <div className="bg-white rounded-2xl border border-stone-100 shadow-sm px-5 py-4 animate-fade-up">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-stone-800">{msg.display_name}</p>
        <span className="text-xs text-stone-400 whitespace-nowrap shrink-0">{formatListTime(msg.created_at)}</span>
      </div>
      <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{msg.body}</p>
      {targetedGroups?.length > 0 && (
        <p className="text-xs text-stone-400 mt-2">Sent to: {targetedGroups.join(', ')}</p>
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
        setMessages(prev => [...prev, msg])
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [convId])

  const handleSent = useCallback((msg) => {
    setMessages(prev => [...prev, msg])
  }, [])

  return (
    <div className="flex flex-col bg-sunrise-50" style={{ height: '100dvh' }}>
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
          audience="all_members"
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
