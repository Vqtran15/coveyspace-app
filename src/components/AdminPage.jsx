import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, PencilSimple, X, CaretDown, ShareNetwork } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { AvatarCircle } from '../lib/avatarIcons.jsx'
import { weekOccToMode } from '../utils/schedule.js'

export default function AdminPage({ groupId, isAdmin, groupName, userId, groupSettings, onGroupSettingsChange, onGroupNameChange }) {
  const navigate = useNavigate()
  const toast = useToast()

  const [inviteCode, setInviteCode] = useState(null)
  const [codeRotating, setCodeRotating] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const [members, setMembers] = useState([])
  const [settingRoleId, setSettingRoleId] = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [confirmRoleAction, setConfirmRoleAction] = useState(null) // { id, newRole }
  const [confirmRemoveId, setConfirmRemoveId] = useState(null)
  const [groupNameOpen, setGroupNameOpen] = useState(false)
  const [groupNameValue, setGroupNameValue] = useState('')
  const [groupNameConfirm, setGroupNameConfirm] = useState(false)
  const [groupNameSaving, setGroupNameSaving] = useState(false)
  const [membersOpen, setMembersOpen] = useState(false)
  const [mealFreqMode, setMealFreqMode]       = useState(() => weekOccToMode(groupSettings?.meal_week_occurrences))
  const [serviceFreqMode, setServiceFreqMode] = useState(() => weekOccToMode(groupSettings?.service_week_occurrences))

  useEffect(() => {
    if (!isAdmin) { navigate('/home', { replace: true }); return }
    supabase.rpc('get_invite_code').then(({ data }) => setInviteCode(data ?? null))
    supabase
      .from('profiles')
      .select('user_id, display_name, role, avatar_icon, avatar_color, avatar_image_url')
      .eq('community_group_id', groupId)
      .order('display_name')
      .then(({ data }) => {
        const sorted = (data ?? []).slice().sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1
          if (b.role === 'admin' && a.role !== 'admin') return 1
          return (a.display_name ?? '').localeCompare(b.display_name ?? '')
        })
        setMembers(sorted)
      })

    const channel = supabase
      .channel(`admin-members-${groupId}`)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'profiles' },
        ({ old: deleted }) => {
          if (deleted.user_id) setMembers(prev => prev.filter(m => m.user_id !== deleted.user_id))
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles', filter: `community_group_id=eq.${groupId}` },
        ({ new: added }) => {
          setMembers(prev => {
            if (prev.some(m => m.user_id === added.user_id)) return prev
            const next = [...prev, added]
            return next.sort((a, b) => {
              if (a.role === 'admin' && b.role !== 'admin') return -1
              if (b.role === 'admin' && a.role !== 'admin') return 1
              return (a.display_name ?? '').localeCompare(b.display_name ?? '')
            })
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [groupId, isAdmin])

  async function handleRotate() {
    setConfirmRotate(false)
    setCodeRotating(true)
    const { data, error } = await supabase.rpc('rotate_invite_code')
    if (!error) setInviteCode(data)
    setCodeRotating(false)
  }

  async function handleSetRole(targetId, newRole) {
    setConfirmRoleAction(null)
    setSettingRoleId(targetId)
    const member = members.find(m => m.user_id === targetId)
    const { error } = await supabase.rpc('set_member_role', { target_user_id: targetId, new_role: newRole })
    if (error) {
      toast(error.message, 'error')
    } else {
      setMembers(prev => {
        const updated = prev.map(m => m.user_id === targetId ? { ...m, role: newRole } : m)
        return updated.slice().sort((a, b) => {
          if (a.role === 'admin' && b.role !== 'admin') return -1
          if (b.role === 'admin' && a.role !== 'admin') return 1
          return (a.display_name ?? '').localeCompare(b.display_name ?? '')
        })
      })
      const name = member?.display_name ?? 'Member'
      toast(newRole === 'admin' ? `${name} is now an admin` : `${name}'s admin access was removed`, 'success')
    }
    setSettingRoleId(null)
  }

  async function handleRemoveMember(targetId) {
    const member = members.find(m => m.user_id === targetId)
    setConfirmRemoveId(null)
    setRemovingId(targetId)
    const { error } = await supabase.rpc('remove_member', { target_user_id: targetId })
    if (error) {
      toast(error.message, 'error')
    } else {
      setMembers(prev => prev.filter(m => m.user_id !== targetId))
      toast(`${member?.display_name ?? 'Member'} was removed from the group`, 'success')
    }
    setRemovingId(null)
  }

  async function handleShareLink() {
    const url = `${window.location.origin}/login?code=${inviteCode}`
    if (navigator.share) {
      try { await navigator.share({ title: 'Join my group on Covey Space', url }) } catch (_) {}
    } else {
      await navigator.clipboard.writeText(url)
      toast('Invite link copied!', 'success')
    }
  }

  async function handleSaveRotation(patch) {
    onGroupSettingsChange?.(prev => ({ ...prev, ...patch }))
    const { error } = await supabase
      .from('group_settings')
      .upsert({ group_id: groupId, ...patch }, { onConflict: 'group_id' })
    if (error) {
      toast('Failed to save', 'error')
      onGroupSettingsChange?.(groupSettings)
    }
  }

  async function handleChangeGroupName() {
    const trimmed = groupNameValue.trim()
    if (!trimmed || trimmed === groupName) return
    setGroupNameSaving(true)
    const { error } = await supabase
      .from('community_groups')
      .update({ name: trimmed })
      .eq('id', groupId)
    if (error) {
      toast('Failed to rename group', 'error')
    } else {
      onGroupNameChange?.(trimmed)
      toast('Group renamed', 'success')
      setGroupNameOpen(false)
      setGroupNameConfirm(false)
    }
    setGroupNameSaving(false)
  }

  return (
    <div className="max-w-3xl lg:max-w-2xl mx-auto px-4 pt-8 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} weight="fill" className="text-jade" />
          <h1 className="text-2xl font-bold text-stone-800">Admin</h1>
        </div>
      </div>

      <div className="space-y-8">
        {/* Onboarding nudge — solo admin, nobody has joined yet */}
        {members.length === 1 && inviteCode && (
          <div className="bg-jade/5 border border-jade/25 rounded-2xl p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-jade">Your group is just you</p>
              <p className="text-xs text-stone-500 mt-1">Share the invite link so people can join with one tap — no code to type.</p>
            </div>
            <button
              onClick={handleShareLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-jade text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
            >
              <ShareNetwork size={16} weight="bold" />
              Share Invite Link
            </button>
          </div>
        )}

        {/* Group Name */}
        <section>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Group Name</p>
          {groupNameOpen ? (
            groupNameConfirm ? (
              <div className="p-4 bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
                <p className="text-sm text-stone-700">
                  Rename group to <span className="font-semibold">"{groupNameValue.trim()}"</span>?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setGroupNameConfirm(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleChangeGroupName}
                    disabled={groupNameSaving}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-jade rounded-xl hover:bg-jade-700 transition-colors disabled:opacity-40"
                  >
                    {groupNameSaving ? 'Saving…' : 'Confirm'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  autoFocus
                  type="text"
                  value={groupNameValue}
                  onChange={e => setGroupNameValue(e.target.value)}
                  maxLength={60}
                  placeholder="Group name"
                  className="w-full text-sm bg-white border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-jade placeholder:text-stone-300"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setGroupNameOpen(false)}
                    className="flex-1 py-2.5 text-sm font-medium text-stone-600 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setGroupNameConfirm(true)}
                    disabled={!groupNameValue.trim() || groupNameValue.trim() === groupName}
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-jade rounded-xl hover:bg-jade-700 transition-colors disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
              </div>
            )
          ) : (
            <button
              onClick={() => { setGroupNameValue(groupName ?? ''); setGroupNameOpen(true); setGroupNameConfirm(false) }}
              className="w-full flex items-center gap-3 px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <PencilSimple size={16} weight="bold" className="text-stone-400 shrink-0" />
              <span className="flex-1 text-left truncate">{groupName}</span>
            </button>
          )}
        </section>

        {/* Invite Code */}
        {inviteCode && (
          <section>
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Invite Code</p>
            <div className="bg-white border border-stone-200 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-4 mb-3">
                <span className="font-mono font-bold text-3xl tracking-widest text-stone-800 flex-1">
                  {codeRotating ? '……' : inviteCode}
                </span>
                {confirmRotate ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setConfirmRotate(false)}
                      className="px-3 py-2 rounded-xl text-sm font-medium text-stone-600 bg-white border border-stone-200 hover:bg-stone-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRotate}
                      disabled={codeRotating}
                      className="px-3 py-2 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-40"
                    >
                      Reset
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRotate(true)}
                    disabled={codeRotating}
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-jade hover:bg-jade-700 transition-colors shrink-0 disabled:opacity-40"
                  >
                    {codeRotating ? 'Resetting…' : 'Reset invite code'}
                  </button>
                )}
              </div>
              {confirmRotate && (
                <p className="text-xs text-red-500 mb-1">The old code will stop working immediately.</p>
              )}
              {!confirmRotate && (
                <button
                  onClick={handleShareLink}
                  disabled={!inviteCode}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-jade/10 text-jade text-sm font-semibold rounded-xl transition-colors active:bg-jade/20 disabled:opacity-40"
                >
                  <ShareNetwork size={15} weight="bold" />
                  Share Invite Link
                </button>
              )}
            </div>
          </section>
        )}

        {/* Members */}
        {members.length > 0 && (
          <section>
            <button
              onClick={() => setMembersOpen(o => !o)}
              className="w-full flex items-center justify-between mb-3"
            >
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide">
                Members ({members.length})
              </p>
              <CaretDown
                size={14}
                weight="bold"
                className={`text-stone-400 transition-transform ${membersOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {membersOpen && (
              <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
                {members.map(m => (
                  <div key={m.user_id} className="px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <AvatarCircle icon={m.avatar_icon} name={m.display_name} userId={m.user_id} colorKey={m.avatar_color} imageUrl={m.avatar_image_url} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-stone-700 truncate">{m.display_name}</span>
                          {m.user_id === userId && <span className="text-stone-400 text-xs shrink-0">(You)</span>}
                        </div>
                        {m.role === 'admin' && (
                          <span className="text-xs text-jade font-semibold flex items-center gap-1">
                            <ShieldCheck size={10} weight="fill" /> Admin
                          </span>
                        )}
                      </div>
                      {m.user_id !== userId && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => setConfirmRoleAction({ id: m.user_id, newRole: m.role === 'admin' ? 'member' : 'admin' })}
                            disabled={!!settingRoleId}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-40 ${
                              m.role === 'admin'
                                ? 'bg-jade/10 text-jade hover:bg-jade/20'
                                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                            }`}
                          >
                            {settingRoleId === m.user_id ? '…' : m.role === 'admin' ? 'Admin ✓' : 'Make Admin'}
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(m.user_id)}
                            disabled={removingId === m.user_id}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
                          >
                            {removingId === m.user_id ? <span className="text-[10px]">…</span> : <X size={15} weight="bold" />}
                          </button>
                        </div>
                      )}
                    </div>
                    {/* Inline role confirmation */}
                    {confirmRoleAction?.id === m.user_id && (
                      <div className="mt-3 flex items-center gap-2">
                        <p className="flex-1 text-xs text-stone-500">
                          {confirmRoleAction.newRole === 'admin'
                            ? `Make ${m.display_name} an admin?`
                            : `Remove admin rights from ${m.display_name}?`}
                        </p>
                        <button
                          onClick={() => setConfirmRoleAction(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSetRole(confirmRoleAction.id, confirmRoleAction.newRole)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-jade hover:bg-jade-700 transition-colors"
                        >
                          Confirm
                        </button>
                      </div>
                    )}
                    {/* Inline remove confirmation */}
                    {confirmRemoveId === m.user_id && (
                      <div className="mt-3 flex items-center gap-2">
                        <p className="flex-1 text-xs text-stone-500">Remove {m.display_name} from the group?</p>
                        <button
                          onClick={() => setConfirmRemoveId(null)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleRemoveMember(confirmRemoveId)}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Features */}
        <section>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Features</p>
          <p className="text-xs text-stone-400 mb-3">Toggling a feature off hides it from members — no data is deleted.</p>
          <div className="bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
            {[
              { key: 'meals_enabled',     label: 'Meal Sign-ups',     desc: 'Home screen card' },
              { key: 'services_enabled',  label: 'Service Sign-ups',  desc: 'Home screen card' },
              { key: 'chat_enabled',      label: 'Group Chat',        desc: 'Chat tab' },
              { key: 'prayer_enabled',    label: 'Prayer Requests',   desc: 'Prayer tab' },
              { key: 'birthdays_enabled', label: 'Birthdays',         desc: 'Home screen card and birthday banner' },
              { key: 'guide_enabled',     label: 'Community Guide',   desc: 'Home screen card' },
              { key: 'events_enabled',    label: 'Events',            desc: 'Events tab with RSVP' },
              { key: 'giving_enabled',    label: 'Giving / Tithing',  desc: 'Home screen card' },
            ].map(({ key, label, desc }) => {
              const enabled = key === 'events_enabled' || key === 'giving_enabled'
                ? groupSettings?.[key] === true
                : groupSettings?.[key] !== false
              return (
                <div key={key} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-700">{label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{desc}</p>
                  </div>
                  <button
                    onClick={() => handleSaveRotation({ [key]: !enabled })}
                    className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${enabled ? 'bg-jade' : 'bg-stone-200'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-stone-400 mt-2 px-1">The Sign Up tab is removed from the nav when both Meal and Service sign-ups are disabled.</p>
        </section>

        {/* Meal Schedule */}
        <section>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Meal Schedule</p>
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-4">
            <div>
              <p className="text-xs text-stone-400 font-semibold mb-2">Day of week</p>
              <div className="flex gap-1.5">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => {
                  const mealDows = groupSettings?.meal_day_of_week ?? []
                  const selected = mealDows.includes(i)
                  return (
                    <button
                      key={i}
                      onClick={() => {
                        const next = selected
                          ? mealDows.length > 1 ? mealDows.filter(x => x !== i) : mealDows
                          : [...mealDows, i].sort((a, b) => a - b)
                        handleSaveRotation({ meal_day_of_week: next })
                      }}
                      className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                        selected ? 'bg-jade text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="text-xs text-stone-400 font-semibold mb-2">Frequency</p>
              <div className="flex gap-1.5">
                {[{ label: 'Weekly', value: 'weekly' }, { label: 'Biweekly', value: 'biweekly' }, { label: 'Custom', value: 'custom' }].map(({ label, value }) => (
                  <button
                    key={value}
                    onClick={() => {
                      setMealFreqMode(value)
                      if (value === 'weekly')   handleSaveRotation({ meal_week_occurrences: [1,2,3,4,5] })
                      if (value === 'biweekly') handleSaveRotation({ meal_week_occurrences: [2,4] })
                    }}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                      mealFreqMode === value ? 'bg-jade text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mealFreqMode === 'biweekly' && (() => {
                const occ = groupSettings?.meal_week_occurrences ?? [2,4]
                return (
                  <div className="mt-3">
                    <p className="text-xs text-stone-400 font-semibold mb-2">Which pattern?</p>
                    <div className="flex gap-1.5">
                      {[{ label: '1st & 3rd', pat: [1,3] }, { label: '2nd & 4th', pat: [2,4] }].map(({ label, pat }) => (
                        <button
                          key={label}
                          onClick={() => handleSaveRotation({ meal_week_occurrences: pat })}
                          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                            JSON.stringify(occ) === JSON.stringify(pat) ? 'bg-jade text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
              {mealFreqMode === 'custom' && (() => {
                const occ = groupSettings?.meal_week_occurrences ?? [1,2,3,4,5]
                return (
                  <div className="mt-3">
                    <p className="text-xs text-stone-400 font-semibold mb-2">Which weeks of the month?</p>
                    <div className="flex gap-1">
                      {['1st','2nd','3rd','4th','5th'].map((label, idx) => {
                        const n = idx + 1
                        const selected = occ.includes(n)
                        return (
                          <button
                            key={n}
                            onClick={() => {
                              const next = selected
                                ? occ.length > 1 ? occ.filter(x => x !== n) : occ
                                : [...occ, n].sort((a,b) => a-b)
                              handleSaveRotation({ meal_week_occurrences: next })
                            }}
                            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                              selected ? 'bg-jade text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                            }`}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-2 px-1">New meals are automatically created on these days using your existing meals as a rotating template.</p>
        </section>

        {/* Service Schedule */}
        <section>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Service Schedule</p>
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-4">
            <div className="flex gap-2">
              {[{ label: 'Off', val: false }, { label: 'Auto-schedule', val: true }].map(({ label, val }) => (
                <button
                  key={String(val)}
                  onClick={() => handleSaveRotation({ service_autofill: val })}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                    (groupSettings?.service_autofill ?? false) === val
                      ? 'bg-jade text-white'
                      : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {groupSettings?.service_autofill && (
              <>
                <div>
                  <p className="text-xs text-stone-400 font-semibold mb-2">Day of week</p>
                  <div className="flex gap-1.5">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => {
                      const svcDows = groupSettings?.service_day_of_week ?? []
                      const selected = svcDows.includes(i)
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const next = selected
                              ? svcDows.length > 1 ? svcDows.filter(x => x !== i) : svcDows
                              : [...svcDows, i].sort((a, b) => a - b)
                            handleSaveRotation({ service_day_of_week: next })
                          }}
                          className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                            selected ? 'bg-jade text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                          }`}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-stone-400 font-semibold mb-2">Frequency</p>
                  <div className="flex gap-1.5">
                    {[{ label: 'Weekly', value: 'weekly' }, { label: 'Biweekly', value: 'biweekly' }, { label: 'Custom', value: 'custom' }].map(({ label, value }) => (
                      <button
                        key={value}
                        onClick={() => {
                          setServiceFreqMode(value)
                          if (value === 'weekly')   handleSaveRotation({ service_week_occurrences: [1,2,3,4,5] })
                          if (value === 'biweekly') handleSaveRotation({ service_week_occurrences: [2,4] })
                        }}
                        className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                          serviceFreqMode === value ? 'bg-jade text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {serviceFreqMode === 'biweekly' && (() => {
                    const occ = groupSettings?.service_week_occurrences ?? [2,4]
                    return (
                      <div className="mt-3">
                        <p className="text-xs text-stone-400 font-semibold mb-2">Which pattern?</p>
                        <div className="flex gap-1.5">
                          {[{ label: '1st & 3rd', pat: [1,3] }, { label: '2nd & 4th', pat: [2,4] }].map(({ label, pat }) => (
                            <button
                              key={label}
                              onClick={() => handleSaveRotation({ service_week_occurrences: pat })}
                              className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                                JSON.stringify(occ) === JSON.stringify(pat) ? 'bg-jade text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })()}
                  {serviceFreqMode === 'custom' && (() => {
                    const occ = groupSettings?.service_week_occurrences ?? [1,2,3,4,5]
                    return (
                      <div className="mt-3">
                        <p className="text-xs text-stone-400 font-semibold mb-2">Which weeks of the month?</p>
                        <div className="flex gap-1">
                          {['1st','2nd','3rd','4th','5th'].map((label, idx) => {
                            const n = idx + 1
                            const selected = occ.includes(n)
                            return (
                              <button
                                key={n}
                                onClick={() => {
                                  const next = selected
                                    ? occ.length > 1 ? occ.filter(x => x !== n) : occ
                                    : [...occ, n].sort((a,b) => a-b)
                                  handleSaveRotation({ service_week_occurrences: next })
                                }}
                                className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                                  selected ? 'bg-jade text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                                }`}
                              >
                                {label}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </>
            )}
          </div>
          <p className="text-xs text-stone-400 mt-2 px-1">Service sign-ups auto-fill on the configured schedule using existing slot templates.</p>
        </section>

      </div>
    </div>
  )
}
