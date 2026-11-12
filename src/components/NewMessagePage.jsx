import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, MagnifyingGlass, X, Check } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { AvatarCircle } from '../lib/avatarIcons.jsx'

export default function NewMessagePage() {
  const navigate = useNavigate()
  const { session, groupId } = useAppContext()
  const myId = session.user.id

  const [members, setMembers]   = useState([])
  const [mode, setMode]         = useState('dm')
  const [search, setSearch]     = useState('')
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState(null)
  const searchRef = useRef(null)

  useEffect(() => {
    if (!groupId) return
    supabase
      .from('profiles')
      .select('user_id, display_name, role, avatar_icon, avatar_color, avatar_image_url')
      .eq('community_group_id', groupId)
      .then(({ data }) => setMembers((data ?? []).filter(m => m.user_id !== myId)))
  }, [groupId])

  const filtered = members.filter(m =>
    !search || m.display_name?.toLowerCase().includes(search.toLowerCase())
  )

  function switchMode(next) {
    setMode(next)
    setSearch('')
    setSelected(new Set())
    searchRef.current?.focus()
  }

  function toggleMember(userId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  async function startDm(otherId) {
    setLoading(true)
    setError(null)
    const { data: convId, error: rpcError } = await supabase.rpc('find_or_create_dm', { other_user_id: otherId })
    if (rpcError || !convId) { setError('Could not start conversation.'); setLoading(false); return }
    const { data: conv } = await supabase
      .from('conversations')
      .select('*, conversation_members(user_id)')
      .eq('id', convId)
      .single()
    if (conv) navigate('/chat', { state: { openConv: conv } })
    else setLoading(false)
  }

  async function createGroupChat() {
    if (selected.size === 0) return
    setLoading(true)
    setError(null)
    const memberIds = Array.from(selected)
    const chatName = memberIds
      .map(id => members.find(m => m.user_id === id)?.display_name?.split(' ')[0])
      .filter(Boolean)
      .join(', ') || 'Group Chat'
    const { data: convId, error: rpcError } = await supabase.rpc('create_group_chat', {
      chat_name: chatName,
      member_ids: memberIds,
    })
    if (rpcError || !convId) { setError('Could not create group chat.'); setLoading(false); return }
    const { data: conv } = await supabase
      .from('conversations')
      .select('*, conversation_members(user_id)')
      .eq('id', convId)
      .single()
    if (conv) navigate('/chat', { state: { openConv: conv } })
    else setLoading(false)
  }

  return (
    <div className="bg-sunrise-50">
      <div className="max-w-md mx-auto px-4 pt-8 pb-8">

        {/* Header */}
        <div className="flex items-center gap-1 min-w-0 -ml-2 mb-4">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-3xl font-bold text-stone-800">New Message</h1>
        </div>

        {/* Mode switcher */}
        <div className="mb-3 flex bg-stone-100 rounded-xl p-1">
          <button
            onClick={() => switchMode('dm')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'dm' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Direct message
          </button>
          <button
            onClick={() => switchMode('group')}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${mode === 'group' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500 hover:text-stone-700'}`}
          >
            Group chat
          </button>
        </div>

        {/* Search */}
        <div className="mb-3 flex items-center gap-2">
          <div className="relative flex-1">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search members…"
              className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-9 py-2.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
          {search && (
            <button className="text-sm text-ember font-medium shrink-0" onClick={() => setSearch('')}>Cancel</button>
          )}
        </div>

        {error && (
          <p className="mb-3 text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2 text-center">{error}</p>
        )}

        {/* Member list */}
        {mode === 'dm' ? (
          members.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-8">No other members in this group yet.</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-stone-500 text-center py-8">No members match "{search}"</p>
          ) : (
            <div className="bg-white rounded-2xl border border-stone-100 shadow overflow-hidden">
              {filtered.map(m => (
                <button
                  key={m.user_id}
                  onClick={() => startDm(m.user_id)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors border-b border-stone-100 last:border-0 disabled:opacity-40"
                >
                  <AvatarCircle icon={m.avatar_icon} name={m.display_name} userId={m.user_id} colorKey={m.avatar_color} imageUrl={m.avatar_image_url} />
                  <span className="text-sm font-medium text-stone-800">{m.display_name}</span>
                </button>
              ))}
            </div>
          )
        ) : (
          <>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
              Add members
              {selected.size > 0 && (
                <span className="ml-2 text-ember normal-case font-semibold">{selected.size} selected</span>
              )}
            </p>
            {filtered.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-8">
                {members.length === 0 ? 'No other members in this group yet.' : `No members match "${search}"`}
              </p>
            ) : (
              <div className="bg-white rounded-2xl border border-stone-100 shadow overflow-hidden mb-4">
                {filtered.map(m => {
                  const isSelected = selected.has(m.user_id)
                  return (
                    <button
                      key={m.user_id}
                      onClick={() => toggleMember(m.user_id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-stone-50 active:bg-stone-100 transition-colors border-b border-stone-100 last:border-0"
                    >
                      <AvatarCircle icon={m.avatar_icon} name={m.display_name} userId={m.user_id} colorKey={m.avatar_color} imageUrl={m.avatar_image_url} />
                      <span className="flex-1 text-sm font-medium text-stone-800 text-left">{m.display_name}</span>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'bg-ember border-ember' : 'border-stone-300'}`}>
                        {isSelected && <Check size={11} weight="bold" className="text-white" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
            <button
              onClick={createGroupChat}
              disabled={loading || selected.size === 0}
              className="w-full py-3 rounded-xl bg-ember text-white font-semibold text-sm hover:bg-ember-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : selected.size === 0 ? 'Select at least one member' : 'Create group chat'}
            </button>
          </>
        )}

      </div>
    </div>
  )
}
