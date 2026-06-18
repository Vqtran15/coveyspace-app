import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase.js'

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

function PasswordGate({ onUnlock }) {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (value === ADMIN_PASSWORD) {
      sessionStorage.setItem('admin_unlocked', '1')
      onUnlock()
    } else {
      setError(true)
      setValue('')
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8">
        <h1 className="text-xl font-bold text-slate-800 mb-1">Community Admin</h1>
        <p className="text-sm text-slate-400 mb-6">Enter password to continue</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus
            type="password"
            value={value}
            onChange={e => { setValue(e.target.value); setError(false) }}
            placeholder="Password"
            className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 ${error ? 'border-red-400 bg-red-50' : 'border-slate-200'}`}
          />
          {error && <p className="text-xs text-red-500">Incorrect password</p>}
          <button
            type="submit"
            className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-slate-700 transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}

function initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function AdminApp() {
  const [groups, setGroups]             = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [members, setMembers]           = useState([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [editingId, setEditingId]       = useState(null)
  const [editName, setEditName]         = useState('')
  const [saving, setSaving]             = useState(false)
  const [confirm, setConfirm]           = useState(null) // { type, id, label }
  const [busy, setBusy]                 = useState(false)
  const [error, setError]               = useState(null)

  useEffect(() => { loadGroups() }, [])

  // ── Groups ──────────────────────────────────────────────────────────────────
  async function loadGroups() {
    setLoadingGroups(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('community_groups')
      .select('id, name, created_at, profiles(count)')
      .order('created_at', { ascending: false })
    if (err) { setError(err.message); setLoadingGroups(false); return }
    setGroups(data ?? [])
    setLoadingGroups(false)
  }

  async function selectGroup(group) {
    setSelectedGroup(group)
    setEditingId(null)
    setLoadingMembers(true)
    setError(null)

    const [{ data: profiles, error: pErr }, { data: authData, error: aErr }] = await Promise.all([
      supabase.from('profiles').select('*').eq('community_group_id', group.id).order('created_at'),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
    ])

    if (pErr || aErr) { setError((pErr || aErr).message); setLoadingMembers(false); return }

    const emailMap = Object.fromEntries((authData.users ?? []).map(u => [u.id, u.email]))
    setMembers((profiles ?? []).map(p => ({ ...p, email: emailMap[p.user_id] ?? '' })))
    setLoadingMembers(false)
  }

  // ── Delete group ─────────────────────────────────────────────────────────────
  async function handleDeleteGroup(group) {
    setBusy(true)
    setError(null)
    try {
      const { data: profiles } = await supabase
        .from('profiles').select('user_id').eq('community_group_id', group.id)
      const userIds = (profiles ?? []).map(p => p.user_id)

      await supabase.from('reactions').delete().eq('community_group_id', group.id)
      await supabase.from('messages').delete().eq('community_group_id', group.id)
      await Promise.all(userIds.map(id => supabase.auth.admin.deleteUser(id)))
      await supabase.from('community_groups').delete().eq('id', group.id)

      setGroups(prev => prev.filter(g => g.id !== group.id))
      if (selectedGroup?.id === group.id) { setSelectedGroup(null); setMembers([]) }
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
    setConfirm(null)
  }

  // ── Delete user ──────────────────────────────────────────────────────────────
  async function handleDeleteUser(member) {
    setBusy(true)
    setError(null)
    try {
      await supabase.from('reactions').delete().eq('user_id', member.user_id)
      await supabase.from('messages').delete().eq('user_id', member.user_id)
      await supabase.auth.admin.deleteUser(member.user_id)

      setMembers(prev => prev.filter(m => m.user_id !== member.user_id))
      setGroups(prev => prev.map(g =>
        g.id === selectedGroup.id
          ? { ...g, profiles: [{ count: (g.profiles?.[0]?.count ?? 1) - 1 }] }
          : g
      ))
    } catch (e) {
      setError(e.message)
    }
    setBusy(false)
    setConfirm(null)
  }

  // ── Edit display name ────────────────────────────────────────────────────────
  async function saveDisplayName(userId) {
    if (!editName.trim()) return
    setSaving(true)
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: editName.trim() })
      .eq('user_id', userId)
    if (err) { setError(err.message) }
    else {
      setMembers(prev => prev.map(m =>
        m.user_id === userId ? { ...m, display_name: editName.trim() } : m
      ))
      setEditingId(null)
    }
    setSaving(false)
  }

  // ── Confirm dialog ───────────────────────────────────────────────────────────
  function ConfirmDialog() {
    if (!confirm) return null
    const isGroup = confirm.type === 'group'
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            {isGroup ? 'Delete community group?' : 'Delete user account?'}
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            <span className="font-semibold text-slate-700">{confirm.label}</span>
            {isGroup
              ? ' and all its members, messages, and data will be permanently deleted.'
              : "'s account, profile, and messages will be permanently deleted."}
            {' '}This cannot be undone.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setConfirm(null)}
              disabled={busy}
              className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={() => isGroup ? handleDeleteGroup(confirm.target) : handleDeleteUser(confirm.target)}
              disabled={busy}
              className="flex-1 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {busy ? 'Deleting…' : 'Delete forever'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const memberCount = (g) => g.profiles?.[0]?.count ?? 0

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight">Community Admin</h1>
          <p className="text-xs text-slate-400 mt-0.5">Master view — all groups and members</p>
        </div>
        <span className="text-xs bg-slate-700 text-slate-300 px-2.5 py-1 rounded-full font-mono">
          service role
        </span>
      </header>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none">×</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Groups sidebar */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Groups {!loadingGroups && `(${groups.length})`}
            </span>
            <button
              onClick={loadGroups}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loadingGroups ? (
              <div className="flex items-center justify-center py-16">
                <p className="text-sm text-slate-400 animate-pulse">Loading…</p>
              </div>
            ) : groups.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-16">No groups found</p>
            ) : (
              <ul className="divide-y divide-slate-50">
                {groups.map(group => (
                  <li key={group.id}>
                    <button
                      onClick={() => selectGroup(group)}
                      className={`w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors ${selectedGroup?.id === group.id ? 'bg-slate-50 border-l-2 border-slate-800' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{group.name}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {memberCount(group)} {memberCount(group) === 1 ? 'member' : 'members'} · {formatDate(group.created_at)}
                          </p>
                        </div>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setConfirm({ type: 'group', id: group.id, label: group.name, target: group })
                          }}
                          className="shrink-0 text-xs text-red-400 hover:text-red-600 transition-colors mt-0.5"
                        >
                          Delete
                        </button>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        {/* Members panel */}
        <main className="flex-1 overflow-y-auto">
          {!selectedGroup ? (
            <div className="flex items-center justify-center h-full text-slate-400">
              <div className="text-center">
                <p className="text-4xl mb-3">👈</p>
                <p className="text-sm">Select a group to view members</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">{selectedGroup.name}</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{members.length} {members.length === 1 ? 'member' : 'members'}</p>
                </div>
              </div>

              {loadingMembers ? (
                <div className="flex justify-center py-16">
                  <p className="text-sm text-slate-400 animate-pulse">Loading members…</p>
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-sm">No members in this group</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Joined</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {members.map(member => (
                        <tr key={member.user_id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 shrink-0">
                                {initials(member.display_name)}
                              </div>
                              {editingId === member.user_id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    autoFocus
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') saveDisplayName(member.user_id)
                                      if (e.key === 'Escape') setEditingId(null)
                                    }}
                                    className="border border-slate-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
                                  />
                                  <button
                                    onClick={() => saveDisplayName(member.user_id)}
                                    disabled={saving}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium disabled:opacity-50"
                                  >
                                    {saving ? 'Saving…' : 'Save'}
                                  </button>
                                  <button
                                    onClick={() => setEditingId(null)}
                                    className="text-xs text-slate-400 hover:text-slate-600"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-slate-800">{member.display_name}</span>
                                  <button
                                    onClick={() => { setEditingId(member.user_id); setEditName(member.display_name) }}
                                    className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                  >
                                    Edit
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-slate-500 font-mono text-xs">{member.email || '—'}</td>
                          <td className="px-5 py-4 text-slate-400 text-xs">{formatDate(member.created_at)}</td>
                          <td className="px-5 py-4 text-right">
                            <button
                              onClick={() => setConfirm({ type: 'user', id: member.user_id, label: member.display_name, target: member })}
                              className="text-xs text-red-400 hover:text-red-600 transition-colors font-medium"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <ConfirmDialog />
    </div>
  )
}

export default function App() {
  const [unlocked, setUnlocked] = useState(
    () => sessionStorage.getItem('admin_unlocked') === '1'
  )
  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />
  return <AdminApp />
}
