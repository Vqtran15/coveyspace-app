import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ShieldCheck, ArrowLeft, PencilSimple, X, CaretDown, ShareNetwork, LinkSimple, CheckCircle, Copy, Envelope, ArrowsClockwise } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { AvatarCircle } from '../lib/avatarIcons.jsx'
import { weekOccToMode } from '../utils/schedule.js'

export default function AdminPage({ groupId, isAdmin, groupName, userId, groupSettings, onGroupSettingsChange, onGroupNameChange }) {
  const navigate = useNavigate()
  const location = useLocation()
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
  const [membersOpen, setMembersOpen] = useState(true)
  const [mealFreqMode, setMealFreqMode]       = useState(() => weekOccToMode(groupSettings?.meal_week_occurrences))
  const [serviceFreqMode, setServiceFreqMode] = useState(() => weekOccToMode(groupSettings?.service_week_occurrences))

  const [activeTab, setActiveTab] = useState(() =>
    new URLSearchParams(location.search).get('pco') ? 'integrations' : 'settings'
  )
  const [tabAnimKey, setTabAnimKey]     = useState(0)
  const [tabAnimClass, setTabAnimClass] = useState('')

  const TAB_ORDER = { settings: 0, features: 1, integrations: 2 }
  function switchTab(id) {
    if (id === activeTab) return
    setTabAnimClass(TAB_ORDER[id] > TAB_ORDER[activeTab] ? 'animate-slide-in-right' : 'animate-slide-in-left')
    setTabAnimKey(k => k + 1)
    setActiveTab(id)
  }

  // PCO integration state
  const [pcoConnection, setPcoConnection]   = useState(undefined) // undefined=loading, null=not connected, {...}=connected
  const [pcoConnecting, setPcoConnecting]   = useState(false)
  const [pcoDisconnecting, setPcoDisconnecting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [pcoGroups, setPcoGroups]           = useState([])
  const [pcoGroupsLoading, setPcoGroupsLoading] = useState(false)
  const [selectedPcoGroup, setSelectedPcoGroup] = useState(null)
  const [pcoMembers, setPcoMembers]         = useState([])
  const [pcoMembersLoading, setPcoMembersLoading] = useState(false)
  const [memberStatuses, setMemberStatuses] = useState({}) // { [email]: true | 'invited' | false }
  const [inviteSending, setInviteSending]   = useState({}) // { [email]: boolean }
  const [pcoFetchingGiving, setPcoFetchingGiving] = useState(false)

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

  // ─── Planning Center integration ────────────────────────────────────────────

  async function loadPcoConnection() {
    const { data } = await supabase.rpc('get_pco_connection')
    setPcoConnection(data?.[0] ?? null)
  }

  async function loadPcoGroups() {
    setPcoGroupsLoading(true)
    const { data } = await supabase.functions.invoke('pco-api', {
      body: { path: '/groups/v2/groups?per_page=100&order=name' },
    })
    if (data?.data) {
      const groups = data.data.map(g => ({ id: g.id, name: g.attributes.name }))
      setPcoGroups(groups)
      // Auto-select whichever group is currently configured for sync
      const syncId = pcoConnection?.pco_sync_group_id
      if (syncId && groups.some(g => g.id === syncId)) {
        setSelectedPcoGroup(syncId)
        loadPcoMembers(syncId)
      }
    }
    setPcoGroupsLoading(false)
  }

  async function loadPcoMembers(pcoGroupId) {
    setPcoMembersLoading(true)
    setPcoMembers([])
    setMemberStatuses({})

    // Step 1: memberships + embedded person (name/avatar only — no email in Groups v2)
    const { data } = await supabase.functions.invoke('pco-api', {
      body: { path: `/groups/v2/groups/${pcoGroupId}/memberships?include=person&per_page=100` },
    })

    const persons = data?.included?.filter(i => i.type === 'Person') ?? []

    if (persons.length === 0) {
      if (data?.data?.length > 0) {
        setPcoMembers([{ id: '__debug__', name: `${data.data.length} memberships found but no person details returned`, email: null }])
      }
      setPcoMembersLoading(false)
      return
    }

    // Step 2: fetch emails from People v2 — Groups v2 person records don't include email_address
    const ids = persons.map(p => p.id).join(',')
    const { data: peopleData } = await supabase.functions.invoke('pco-api', {
      body: { path: `/people/v2/people?where[id]=${ids}&include=emails&per_page=${persons.length}` },
    })

    // Build person_id → { name, email } from People v2 (authoritative source for both)
    const personMap = {}
    peopleData?.data?.forEach(p => {
      personMap[p.id] = {
        name:  p.attributes.name ?? [p.attributes.first_name, p.attributes.last_name].filter(Boolean).join(' ') ?? null,
        email: p.attributes.email_address ?? null,
      }
    })
    // Fill in emails from included Email resources (fallback if email_address is absent)
    peopleData?.included
      ?.filter(i => i.type === 'Email')
      ?.forEach(e => {
        const pid = e.relationships?.person?.data?.id
        if (pid && personMap[pid] && !personMap[pid].email && e.attributes?.address) {
          personMap[pid].email = e.attributes.address
        }
      })

    const people = persons.map(p => ({
      id:     p.id,
      name:   personMap[p.id]?.name  ?? p.attributes.name ?? null,
      email:  personMap[p.id]?.email ?? null,
      avatar: p.attributes.avatar,
    }))

    const withEmail = people.filter(p => p.email)
    if (withEmail.length) {
      const emails = withEmail.map(p => p.email)
      const { data: statuses } = await supabase.rpc('check_pco_members', { emails })
      const map = {}
      statuses?.forEach(s => { map[s.email] = s.in_group })
      setMemberStatuses(map)
    }
    setPcoMembers(people)
    setPcoMembersLoading(false)
  }

  async function handleConnectPco() {
    setPcoConnecting(true)
    const returnUrl = `${window.location.origin}/admin?pco=connected`
    const { data, error } = await supabase.functions.invoke('pco-oauth-start', {
      body: { return_url: returnUrl },
    })
    if (error || !data?.auth_url) {
      toast('Failed to start Planning Center connection', 'error')
      setPcoConnecting(false)
      return
    }
    window.location.href = data.auth_url
  }

  async function handleDisconnectPco() {
    setConfirmDisconnect(false)
    setPcoDisconnecting(true)
    const { error } = await supabase.functions.invoke('pco-disconnect', { body: {} })
    if (error) {
      toast('Failed to disconnect', 'error')
    } else {
      setPcoConnection(null)
      setPcoGroups([])
      setPcoMembers([])
      setSelectedPcoGroup(null)
      setMemberStatuses({})
      toast('Planning Center disconnected', 'success')
    }
    setPcoDisconnecting(false)
  }

  async function handleSendInvite(member) {
    const inviteUrl = `${window.location.origin}/login?code=${inviteCode}`
    setInviteSending(prev => ({ ...prev, [member.email]: true }))
    const { error } = await supabase.functions.invoke('pco-send-invite', {
      body: { email: member.email, name: member.name, invite_url: inviteUrl, group_name: groupName },
    })
    if (error) {
      toast('Failed to send invite', 'error')
    } else {
      toast(`Invite sent to ${member.name}`, 'success')
      setMemberStatuses(prev => ({ ...prev, [member.email]: 'invited' }))
    }
    setInviteSending(prev => ({ ...prev, [member.email]: false }))
  }

  async function handleFetchPcoGiving() {
    setPcoFetchingGiving(true)
    const { data } = await supabase.functions.invoke('pco-api', { body: { path: '/giving/v2' } })
    // PCO Giving v2 links.html_url is the church's giving page, or derive from API base URL
    const givingUrl =
      data?.links?.html_url ||
      data?.data?.[0]?.links?.html_url ||
      null
    if (givingUrl) {
      await handleSaveRotation({ giving_url: givingUrl, giving_enabled: true })
      toast('Giving URL updated from Planning Center', 'success')
    } else {
      toast('Could not detect PCO giving URL — set it manually in the Giving tab', 'error')
    }
    setPcoFetchingGiving(false)
  }

  async function handleTogglePcoSync() {
    const currentSync = pcoConnection?.pco_sync_group_id ?? null
    const newId = currentSync === selectedPcoGroup ? null : selectedPcoGroup
    const { error } = await supabase.rpc('set_pco_sync_group', { target_group_id: newId })
    if (error) {
      toast('Failed to update sync setting', 'error')
    } else {
      setPcoConnection(prev => ({ ...prev, pco_sync_group_id: newId }))
      toast(newId ? 'Sync enabled — new members will be added to this PCO Group' : 'Sync disabled', 'success')
    }
  }

  // Load PCO connection on mount
  useEffect(() => {
    if (isAdmin) loadPcoConnection()
  }, [groupId])

  // Handle OAuth callback query params
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const pcoStatus = params.get('pco')
    if (!pcoStatus) return
    navigate(location.pathname, { replace: true })
    if (pcoStatus === 'connected') {
      loadPcoConnection()
      toast('Planning Center connected!', 'success')
    } else if (pcoStatus === 'error') {
      toast('Planning Center connection failed. Please try again.', 'error')
    }
  }, [location.search])

  // Load PCO groups when connection is first established
  useEffect(() => {
    if (pcoConnection) loadPcoGroups()
  }, [!!pcoConnection])

  // ────────────────────────────────────────────────────────────────────────────

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
    <div className="max-w-3xl lg:max-w-2xl mx-auto px-4 pt-8 pb-12 animate-slide-in-right">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        >
          <ArrowLeft size={20} weight="bold" />
        </button>
        <div className="flex items-center gap-2">
          <ShieldCheck size={20} weight="fill" className="text-ember" />
          <h1 className="text-2xl font-bold text-stone-800">Admin</h1>
        </div>
      </div>

      {/* Tab nav */}
      <div className="flex bg-stone-100 rounded-xl p-1 mb-6">
        {[
          { id: 'settings',     label: 'Settings'     },
          { id: 'features',     label: 'Features'     },
          { id: 'integrations', label: 'Integrations' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            aria-pressed={activeTab === tab.id}
            className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === tab.id
                ? 'bg-ember text-white shadow-sm'
                : 'text-stone-500 hover:text-stone-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div key={tabAnimKey} className={`space-y-8 ${tabAnimClass}`}>

        {/* ── Settings tab ─────────────────────────────────────── */}
        {activeTab === 'settings' && <>

        {/* Onboarding nudge — solo admin, nobody has joined yet */}
        {members.length === 1 && inviteCode && (
          <div className="bg-ember/5 border border-ember/25 rounded-2xl p-5 space-y-3">
            <div>
              <p className="text-sm font-semibold text-ember">Your group is just you</p>
              <p className="text-xs text-stone-500 mt-1">Share the invite link so people can join with one tap — no code to type.</p>
            </div>
            <button
              onClick={handleShareLink}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-ember text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
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
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-ember rounded-xl hover:bg-ember-700 transition-colors disabled:opacity-40"
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
                  className="w-full text-sm bg-white border border-stone-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-ember placeholder:text-stone-300"
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
                    className="flex-1 py-2.5 text-sm font-medium text-white bg-ember rounded-xl hover:bg-ember-700 transition-colors disabled:opacity-40"
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
                    className="px-4 py-2 rounded-xl text-sm font-semibold text-white bg-ember hover:bg-ember-700 transition-colors shrink-0 disabled:opacity-40"
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
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-ember/10 text-ember text-sm font-semibold rounded-xl transition-colors active:bg-ember/20 disabled:opacity-40"
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
                          <span className="text-xs text-ember font-semibold flex items-center gap-1">
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
                                ? 'bg-ember/10 text-ember hover:bg-ember/20'
                                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                            }`}
                          >
                            {settingRoleId === m.user_id ? '…' : m.role === 'admin' ? 'Admin ✓' : 'Make Admin'}
                          </button>
                          <button
                            onClick={() => setConfirmRemoveId(m.user_id)}
                            disabled={removingId === m.user_id}
                            aria-label={`Remove ${m.display_name} from group`}
                            className="w-11 h-11 flex items-center justify-center rounded-lg text-stone-300 hover:text-red-400 hover:bg-red-50 transition-colors disabled:opacity-40"
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
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-ember hover:bg-ember-700 transition-colors"
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

        </>}

        {/* ── Features tab ─────────────────────────────────────── */}
        {activeTab === 'features' && <>

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
              { key: 'bible_enabled',     label: 'Bible',             desc: 'Bible reader tab with verse search' },
            ].map(({ key, label, desc }) => {
              const enabled = key === 'events_enabled' || key === 'giving_enabled' || key === 'bible_enabled'
                ? groupSettings?.[key] === true
                : groupSettings?.[key] !== false
              return (
                <div key={key} className="flex items-center gap-4 px-4 py-3.5">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-stone-700">{label}</p>
                    <p className="text-xs text-stone-400 mt-0.5">{desc}</p>
                  </div>
                  <button
                    role="switch"
                    aria-checked={enabled}
                    aria-label={label}
                    onClick={() => handleSaveRotation({ [key]: !enabled })}
                    className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${enabled ? 'bg-ember' : 'bg-stone-200'}`}
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
        {groupSettings?.meals_enabled && <section>
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
                        selected ? 'bg-ember text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
                      mealFreqMode === value ? 'bg-ember text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
                            JSON.stringify(occ) === JSON.stringify(pat) ? 'bg-ember text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
                              selected ? 'bg-ember text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
        </section>}

        {/* Service Schedule */}
        {groupSettings?.services_enabled && <section>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Service Schedule</p>
          <div className="bg-white border border-stone-200 rounded-2xl p-4 space-y-4">
            <div className="flex gap-2">
              {[{ label: 'Off', val: false }, { label: 'Auto-schedule', val: true }].map(({ label, val }) => (
                <button
                  key={String(val)}
                  onClick={() => handleSaveRotation({ service_autofill: val })}
                  className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-colors ${
                    (groupSettings?.service_autofill ?? false) === val
                      ? 'bg-ember text-white'
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
                            selected ? 'bg-ember text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
                          serviceFreqMode === value ? 'bg-ember text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
                                JSON.stringify(occ) === JSON.stringify(pat) ? 'bg-ember text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
                                  selected ? 'bg-ember text-white' : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
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
        </section>}

        </>}

        {/* ── Integrations tab ─────────────────────────────────── */}
        {activeTab === 'integrations' && <>

        {/* Integrations */}
        <section>
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Integrations</p>
          <p className="text-xs text-stone-400 mb-3">Connect third-party tools to streamline your group management.</p>

          <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
            {/* Header row */}
            <div className="px-4 py-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                <LinkSimple size={20} weight="bold" className="text-stone-500" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-stone-800">Planning Center</p>
                <p className="text-xs text-stone-400">
                  {pcoConnection === undefined ? 'Loading…' :
                   pcoConnection
                     ? `Connected to ${pcoConnection.pco_organization_name ?? 'your church'}`
                     : 'Sync members from People & Groups'}
                </p>
              </div>
              {pcoConnection === null && (
                <button
                  onClick={handleConnectPco}
                  disabled={pcoConnecting}
                  className="shrink-0 px-3 py-1.5 bg-ember text-white rounded-xl text-xs font-semibold disabled:opacity-50 hover:bg-ember-700 transition-colors"
                >
                  {pcoConnecting ? 'Redirecting…' : 'Connect'}
                </button>
              )}
              {pcoConnection && (
                <button
                  onClick={() => setConfirmDisconnect(true)}
                  className="shrink-0 text-xs text-stone-400 hover:text-red-500 transition-colors"
                >
                  Disconnect
                </button>
              )}
            </div>

            {/* Connected body */}
            {pcoConnection && (
              <div className="border-t border-stone-100">
                {/* Group picker */}
                <div className="px-4 pt-4 pb-3">
                  <p className="text-xs font-semibold text-stone-500 mb-2">Import members from a PCO Group</p>
                  {pcoGroupsLoading ? (
                    <div className="h-10 bg-stone-100 rounded-xl animate-pulse" />
                  ) : pcoGroups.length === 0 ? (
                    <p className="text-xs text-stone-400">No PCO Groups found. Make sure the Groups product is enabled in Planning Center.</p>
                  ) : (
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select
                          value={selectedPcoGroup ?? ''}
                          onChange={e => {
                            const val = e.target.value || null
                            setSelectedPcoGroup(val)
                            if (val) loadPcoMembers(val)
                            else { setPcoMembers([]); setMemberStatuses({}) }
                          }}
                          className="w-full appearance-none border border-stone-200 rounded-xl px-4 py-2.5 text-sm text-stone-800 bg-white pr-9 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
                        >
                          <option value="">Pick a PCO Group…</option>
                          {pcoGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </select>
                        <CaretDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                      </div>
                      {selectedPcoGroup && (
                        <button
                          onClick={() => loadPcoMembers(selectedPcoGroup)}
                          disabled={pcoMembersLoading}
                          aria-label="Refresh member list"
                          className="shrink-0 w-10 h-10 flex items-center justify-center border border-stone-200 rounded-xl text-stone-400 hover:text-ember hover:border-ember hover:bg-ember/5 transition-colors disabled:opacity-40"
                        >
                          <ArrowsClockwise size={16} className={pcoMembersLoading ? 'animate-spin' : ''} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Sync toggle */}
                {selectedPcoGroup && (
                  <div className="px-4 pb-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-stone-700">Auto-sync new members here</p>
                      <p className="text-xs text-stone-400 mt-0.5">New Covey Space members are added to this PCO Group automatically</p>
                    </div>
                    <button
                      role="switch"
                      aria-checked={pcoConnection?.pco_sync_group_id === selectedPcoGroup}
                      aria-label="Auto-sync new members to this PCO Group"
                      onClick={handleTogglePcoSync}
                      className={`relative shrink-0 w-11 h-6 rounded-full border-2 border-transparent transition-colors ${
                        pcoConnection?.pco_sync_group_id === selectedPcoGroup
                          ? 'bg-ember'
                          : 'bg-stone-200'
                      }`}
                    >
                      <span className={`absolute top-0 left-0 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        pcoConnection?.pco_sync_group_id === selectedPcoGroup
                          ? 'translate-x-5'
                          : 'translate-x-0'
                      }`} />
                    </button>
                  </div>
                )}

                {/* Member list */}
                {selectedPcoGroup && (
                  <div className="px-4 pb-4">
                    {pcoMembersLoading ? (
                      <div className="space-y-2 pt-1">
                        {[1, 2, 3].map(i => (
                          <div key={i} className="h-11 bg-stone-100 rounded-xl animate-pulse" />
                        ))}
                      </div>
                    ) : pcoMembers.length === 0 ? (
                      <p className="text-xs text-stone-500 py-3 text-center">No members found in this PCO Group.</p>
                    ) : (
                      <>
                        <p className="text-xs text-stone-400 mb-3">{pcoMembers.length} {pcoMembers.length === 1 ? 'person' : 'people'} in this PCO Group</p>
                        <div className="space-y-1">
                          {pcoMembers.map(member => {
                            const status = memberStatuses[member.email]
                            const alreadyMember = status === true
                            const invited = status === 'invited'
                            return (
                              <div key={member.id} className="flex items-center gap-3 py-1.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-stone-800 truncate">{member.name}</p>
                                  <p className="text-xs text-stone-400 truncate">{member.email ?? 'No email in PCO'}</p>
                                </div>
                                {!member.email ? (
                                  <span className="text-xs text-stone-300 shrink-0">Can't invite</span>
                                ) : alreadyMember ? (
                                  <div className="flex items-center gap-1 text-sage-700 shrink-0">
                                    <CheckCircle size={14} weight="fill" />
                                    <span className="text-xs font-medium">Member</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/login?code=${inviteCode}`)
                                        toast('Invite link copied', 'success')
                                      }}
                                      aria-label="Copy invite link"
                                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-stone-200 text-stone-400 hover:text-stone-600 hover:border-stone-300 transition-colors"
                                    >
                                      <Copy size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleSendInvite(member)}
                                      disabled={!!inviteSending[member.email] || invited}
                                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                                        invited
                                          ? 'bg-stone-100 text-stone-400 cursor-default'
                                          : 'bg-ember text-white hover:bg-ember-700 disabled:opacity-50'
                                      }`}
                                    >
                                      {inviteSending[member.email]
                                        ? 'Sending…'
                                        : invited
                                          ? 'Sent ✓'
                                          : <><Envelope size={12} weight="bold" />Invite</>}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Giving */}
                <div className="border-t border-stone-100 px-4 py-3">
                  <p className="text-xs font-semibold text-stone-500 mb-2">PCO Giving</p>
                  <button
                    onClick={handleFetchPcoGiving}
                    disabled={pcoFetchingGiving}
                    className="w-full py-2.5 border border-stone-200 text-stone-600 rounded-xl text-sm font-medium hover:border-ember hover:text-ember hover:bg-ember/5 transition-colors disabled:opacity-50"
                  >
                    {pcoFetchingGiving ? 'Fetching…' : 'Auto-fill giving URL from PCO'}
                  </button>
                </div>
              </div>
            )}

            {/* Disconnect confirmation */}
            {confirmDisconnect && (
              <div className="border-t border-stone-100 px-4 py-4 bg-red-50/60">
                <p className="text-sm font-semibold text-stone-800 mb-1">Disconnect Planning Center?</p>
                <p className="text-xs text-stone-500 mb-3">Your Covey Space group data won't be affected.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDisconnect(false)}
                    className="flex-1 py-2 border border-stone-200 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDisconnectPco}
                    disabled={pcoDisconnecting}
                    className="flex-1 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {pcoDisconnecting ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        </>}

      </div>
    </div>
  )
}
