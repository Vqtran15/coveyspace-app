import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, useAnimation } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { ForkKnife, HandHeart, Cake, BookOpen, CaretRight, Megaphone, PencilSimple, HandsPraying, ShareNetwork, Coins, GearSix, CalendarHeart, ChatCircleDots, X } from '@phosphor-icons/react'
import { AvatarCircle } from '../lib/avatarDisplay.jsx'
import { supabase } from '../lib/supabase.js'
import { toDateString, mealCutoffDate } from '../utils/dates.js'
import { daysUntilNext } from '../utils/birthdays.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { useToast } from '../lib/toast.jsx'
import ConfettiDots from './ConfettiDots.jsx'
import InstallBanner from './InstallBanner.jsx'
import { useAppContext } from '../contexts/AppContext.jsx'

let greetingDone = false

function relativeTime(dateStr) {
  const diffMin = Math.round((Date.now() - new Date(dateStr)) / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)}h ago`
  const days = Math.floor(diffMin / 1440)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function shortName(full) {
  const parts = (full ?? '').trim().split(' ').filter(Boolean)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? ''
}

function Card({ icon, iconBg, label, primary, secondary, onClick, delay = 0, confetti = false, className = '', dot = false }) {
  return (
    <motion.button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`relative overflow-hidden w-full flex items-center gap-4 bg-white rounded-2xl p-4 border border-stone-100 shadow-sm active:bg-stone-50 transition-colors text-left animate-stack-in ${className}`}
      whileTap={{ scale: 0.975 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {confetti && <ConfettiDots />}
      <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
        {dot && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-ember rounded-full border-2 border-white" />}
      </div>
      <div className="relative flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-base font-semibold text-stone-800 leading-snug line-clamp-2">{primary}</p>
        {secondary && <p className="text-xs text-stone-400 mt-0.5 truncate">{secondary}</p>}
      </div>
      <CaretRight size={16} className="text-stone-300 shrink-0 relative" />
    </motion.button>
  )
}

function CardSkeleton({ delay = 0 }) {
  return (
    <div
      className="w-full flex items-center gap-4 bg-white rounded-2xl p-4 border border-stone-100 shadow-sm animate-pulse"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-12 h-12 rounded-xl bg-stone-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-2.5 bg-stone-100 rounded w-1/4" />
        <div className="h-4 bg-stone-200 rounded w-3/5" />
      </div>
      <div className="w-4 h-4 rounded bg-stone-100 shrink-0" />
    </div>
  )
}

function AnnouncementEditModal({ value, onClose, onSave }) {
  const [closing, close] = useModalClose(onClose)
  const [text, setText] = useState(value ?? '')
  const [saving, setSaving] = useState(false)
  const [keyboardHeight, setKeyboardHeight] = useState(0)

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    function onResize() {
      setKeyboardHeight(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    await onSave(text)
    setSaving(false)
    close()
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 ${closing ? 'animate-backdrop-out' : 'animate-overlay-in'}`}
      style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight + 16 } : undefined}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm ${closing ? 'animate-sheet-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-4">
          <div className="flex items-center gap-2">
            <Megaphone size={20} weight="fill" className="text-ember" />
            <h2 className="text-lg font-bold text-stone-800">Announcement</h2>
          </div>
          <button
            onClick={close}
            aria-label="Close announcement"
            className="text-stone-400 hover:text-stone-600 w-11 h-11 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 pb-6 space-y-4">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write an announcement for your group…"
            rows={4}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent resize-none"
          />
          <div className="flex gap-2">
            {value && (
              <button
                type="button"
                onClick={async () => { setSaving(true); await onSave(''); setSaving(false); close() }}
                disabled={saving}
                className="flex-1 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-40"
              >
                Remove
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-ember hover:bg-ember-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function OverviewTab({ onOpenBirthdays, onOpenGuide, onOpenSettings, onOpenGiving, refreshKey = 0, greetingReady = false }) {
  const {
    displayName, groupName, groupId, isAdmin, userId,
    avatarIcon, avatarColorKey, avatarImageUrl,
    birthdays,
    mealsEnabled, servicesEnabled, guideEnabled, birthdaysEnabled,
    prayerEnabled, givingEnabled, eventsEnabled, chatEnabled,
    groupSettings,
    unreadChatCount: chatUnreadCount,
  } = useAppContext()
  const givingUrl = groupSettings?.giving_url ?? null
  const guideUrl  = groupSettings?.guide_url  ?? null
  const guideType = groupSettings?.guide_type ?? null
  const navigate = useNavigate()
  const toast = useToast()
  const [nextMeal, setNextMeal]             = useState(undefined)
  const [nextService, setNextService]       = useState(undefined)
  const [nextEvent, setNextEvent]           = useState(undefined)
  const [lastGroupMessage, setLastGroupMessage] = useState(undefined)
  const [announcement, setAnnouncement]     = useState(undefined)
  const [prayerCard, setPrayerCard]         = useState(undefined)
  const [editingAnnouncement, setEditingAnnouncement] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [soloAdmin, setSoloAdmin] = useState(false)
  const realtimeDebounceRef = useRef(null)
  const [shouldAnimate]  = useState(() => !greetingDone)
  const greetingControls = useAnimation()
  const [announceShake, setAnnounceShake] = useState(false)

  useEffect(() => {
    if (!shouldAnimate || !greetingReady) return
    greetingDone = true
    greetingControls.start({ clipPath: 'inset(0 0% 0 0)', transition: { duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] } })
    const fadeId   = setTimeout(() => greetingControls.start({ opacity: 0, transition: { duration: 0.3, ease: 'easeIn' } }), 1150)
    const shakeId  = setTimeout(() => setAnnounceShake(true),  1600)
    const clearId  = setTimeout(() => setAnnounceShake(false), 2200)
    return () => { clearTimeout(fadeId); clearTimeout(shakeId); clearTimeout(clearId) }
  }, [greetingReady])

  async function load() {
    const today = toDateString(new Date())
    const cutoff = new Date(Date.now() - 60 * 86400000).toISOString()

    // Round 1: all queries that only need groupId — run fully in parallel
    const [mealRes, serviceRes, eventRes, mainChatConvRes, groupRes, memberRes, countRes] = await Promise.all([
      supabase.from('meal_pages').select('id, title, week_date, is_paused').gte('week_date', mealCutoffDate()).order('week_date').limit(1).maybeSingle(),
      supabase.from('serving_pages').select('title, week_date, is_paused').gte('week_date', today).order('week_date').limit(1).maybeSingle(),
      eventsEnabled && groupId
        ? supabase.from('events').select('id, title, event_date, event_time').eq('community_group_id', groupId).gte('event_date', today).order('event_date').limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
      chatEnabled
        ? supabase.from('conversations').select('id').eq('name', 'Main Group Chat').maybeSingle()
        : Promise.resolve({ data: null }),
      groupId
        ? supabase.from('community_groups').select('announcement').eq('id', groupId).single()
        : Promise.resolve({ data: null }),
      prayerEnabled && groupId
        ? supabase.from('profiles').select('user_id, display_name, avatar_icon, avatar_color, avatar_image_url').eq('community_group_id', groupId)
        : Promise.resolve({ data: [] }),
      isAdmin && groupId
        ? supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('community_group_id', groupId)
        : Promise.resolve({ count: null }),
    ])

    setNextMeal(mealRes.data ?? null)
    setNextService(serviceRes.data ?? null)
    setNextEvent(eventRes.data ?? null)
    setAnnouncement(groupRes.data?.announcement ?? null)
    if (isAdmin) setSoloAdmin(countRes.count === 1)
    const mainChatId = mainChatConvRes.data?.id ?? null
    const memberData = memberRes.data ?? []

    // Round 2: queries that depend on round-1 results
    const memberIds = prayerEnabled ? memberData.map(m => m.user_id) : []
    const [{ data: requestData }, { data: latestMsg }] = await Promise.all([
      prayerEnabled && memberIds.length > 0
        ? supabase.from('prayer_requests').select('id, member_user_id, request, created_at').in('member_user_id', memberIds).gte('created_at', cutoff).eq('answered', false).order('created_at', { ascending: false })
        : Promise.resolve({ data: null }),
      chatEnabled && mainChatId
        ? supabase.from('messages').select('body, display_name, created_at, image_url').eq('conversation_id', mainChatId).order('created_at', { ascending: false }).limit(1).maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    if (prayerEnabled) {
      if (requestData?.length > 0) {
        const profileMap = Object.fromEntries(memberData.map(p => [p.user_id, p]))
        const seen = new Set()
        const uniqueUsers = []
        for (const r of requestData) {
          if (!seen.has(r.member_user_id)) {
            seen.add(r.member_user_id)
            uniqueUsers.push({ ...r, profile: profileMap[r.member_user_id] })
          }
        }
        if (uniqueUsers.length > 0) {
          const d = new Date()
          const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
          setPrayerCard(uniqueUsers[seed % uniqueUsers.length])
        } else {
          setPrayerCard(null)
        }
      } else {
        setPrayerCard(null)
      }
    }
    setLastGroupMessage(chatEnabled && mainChatId ? (latestMsg ?? null) : null)
    setLoaded(true)
  }

  const { pullDistance, refreshing, threshold } = usePullToRefresh(load, !editingAnnouncement)

  useEffect(() => { load() }, [groupId, refreshKey, prayerEnabled, isAdmin, eventsEnabled, chatEnabled])

  useEffect(() => {
    if (!groupId) return
    function debouncedLoad() {
      clearTimeout(realtimeDebounceRef.current)
      realtimeDebounceRef.current = setTimeout(load, 300)
    }
    const channel = supabase
      .channel(`overview-pages:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_pages' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'serving_pages' }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `community_group_id=eq.${groupId}` }, debouncedLoad)
      .subscribe()
    return () => { clearTimeout(realtimeDebounceRef.current); supabase.removeChannel(channel) }
  }, [groupId])

  async function handleSaveAnnouncement(text) {
    await supabase.rpc('update_announcement', { p_text: text })
    setAnnouncement(text.trim() || null)
  }

  const { nextBirthday, birthdayPrimary } = useMemo(() => {
    function joinNames(names) {
      if (names.length === 1) return names[0]
      if (names.length === 2) return `${names[0]} & ${names[1]}`
      return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
    }
    const sorted = [...birthdays]
      .map(b => ({ ...b, days: daysUntilNext(b.birthday) }))
      .sort((a, b) => a.days - b.days)
    const next = sorted[0]
    const sameDay = next
      ? sorted.filter(b => b.days === next.days).map(b => { const p = (b.name ?? '').trim().split(' ').filter(Boolean); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] ?? '' })
      : []
    let primary = 'No upcoming birthdays'
    if (next) {
      // 14 days is intentional — wider than the banner (3 days) so the home card
      // previews upcoming birthdays well in advance without triggering the banner.
      const upcomingSoon = sorted.filter(b => b.days <= 14)
      if (upcomingSoon.length > 1) {
        primary = `${upcomingSoon.length} birthdays coming up!`
      } else {
        const who = joinNames(sameDay)
        if (next.days === 0) primary = `🎂 Today is ${who}'s birthday!`
        else if (next.days === 1) primary = `${who}'s birthday is tomorrow`
        else primary = `${who}'s birthday in ${next.days} days`
      }
    }
    return { nextBirthday: next, birthdayPrimary: primary }
  }, [birthdays])

  const showAnnouncement = isAdmin || !!announcement

  return (
    <main className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12">
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center transition-transform"
          style={{ top: 'calc(env(safe-area-inset-top) + 8px)', transform: `translateY(${Math.min(pullDistance, threshold) * 0.6}px)` }}
        >
          <div className={`w-8 h-8 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            <div className="w-3 h-3 rounded-full border-2 border-ember border-t-transparent" style={{ opacity: pullDistance / threshold }} />
          </div>
        </div>
      )}

      <div className="mb-7 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-stone-800">
          <span className="relative inline-block">
            Hi, {(displayName ?? '').split(' ')[0] || 'there'}!
            {shouldAnimate && (
              <motion.svg
                aria-hidden="true"
                width="100%"
                height="13"
                viewBox="0 0 200 16"
                preserveAspectRatio="none"
                className="absolute top-full left-0"
                style={{ overflow: 'visible' }}
                initial={{ clipPath: 'inset(0 100% 0 0)', opacity: 1 }}
                animate={greetingControls}
              >
                <defs>
                  <linearGradient id="greeting-taper" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#C4622D" stopOpacity="0" />
                    <stop offset="10%" stopColor="#C4622D" stopOpacity="1" />
                    <stop offset="100%" stopColor="#C4622D" stopOpacity="1" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 14 C 14 3 30 4 200 4"
                  fill="none"
                  stroke="#C4622D"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                  strokeOpacity="0.65"
                />
                <path
                  d="M 0 14 C 14 3 30 4 200 4"
                  fill="none"
                  stroke="url(#greeting-taper)"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              </motion.svg>
            )}
          </span>
        </h1>
        <button
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="relative active:opacity-70 transition-opacity shrink-0"
        >
          <AvatarCircle size="11" icon={avatarIcon} colorKey={avatarColorKey} userId={userId} name={displayName} imageUrl={avatarImageUrl} />
          <div className="absolute -bottom-0.5 -right-0.5">
            <GearSix size={14} weight="fill" className="text-stone-500 [filter:drop-shadow(0_0_3px_rgba(255,255,255,1))]" />
          </div>
        </button>
      </div>

      <InstallBanner />

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
        {!loaded ? (
          <>
            {isAdmin && <div className="lg:col-span-2"><CardSkeleton delay={0} /></div>}
            {mealsEnabled     && <CardSkeleton delay={isAdmin ? 40  : 0}   />}
            {servicesEnabled  && <CardSkeleton delay={isAdmin ? 80  : 40}  />}
            {eventsEnabled    && <CardSkeleton delay={isAdmin ? 120 : 80}  />}
            {chatEnabled      && <CardSkeleton delay={isAdmin ? 160 : 120} />}
            {prayerEnabled    && <CardSkeleton delay={isAdmin ? 200 : 160} />}
            {birthdaysEnabled && <CardSkeleton delay={isAdmin ? 240 : 200} />}
            {guideEnabled     && <CardSkeleton delay={isAdmin ? 280 : 240} />}
            {givingEnabled    && <CardSkeleton delay={isAdmin ? 320 : 280} />}
          </>
        ) : (
          <>
            {/* Solo-admin nudge — shown until someone joins */}
            {soloAdmin && (
              <div className="w-full animate-stack-in lg:col-span-2">
                <div className="bg-ember/5 border border-ember/25 rounded-2xl p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ember mb-0.5">Your group is just you</p>
                    <p className="text-xs text-stone-500">Share an invite link so your members can join with one tap.</p>
                  </div>
                  <button
                    onClick={async () => {
                      const { data: code } = await supabase.rpc('get_invite_code')
                      if (!code) return
                      const url = `${window.location.origin}/login?code=${code}`
                      if (navigator.share) {
                        await navigator.share({ title: 'Join my group on Coveyspace', url }).catch(() => {})
                      } else {
                        await navigator.clipboard.writeText(url)
                        toast('Invite link copied!', 'success')
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-ember text-white text-sm font-semibold rounded-xl shrink-0 transition-all active:scale-[0.98]"
                  >
                    <ShareNetwork size={15} weight="bold" />
                    Invite
                  </button>
                </div>
              </div>
            )}

            {/* Announcement — always first */}
            {showAnnouncement && (
              announcement ? (
                <div className="w-full animate-stack-in lg:col-span-2">
                  <div
                    className={`w-full bg-ember rounded-2xl p-5 shadow-md shadow-ember/25 ${announceShake ? 'animate-announcement-shake' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <Megaphone size={34} weight="fill" className="text-white/90 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-white/90 uppercase tracking-wide mb-1.5">Announcement</p>
                        <p className="text-base text-white leading-relaxed font-medium whitespace-pre-wrap">{announcement}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => setEditingAnnouncement(true)}
                          aria-label="Edit announcement"
                          className="text-white/50 hover:text-white transition-colors shrink-0 mt-0.5 p-1"
                        >
                          <PencilSimple size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditingAnnouncement(true)}
                  className="w-full bg-ember/8 border border-dashed border-ember/30 rounded-2xl p-4 animate-stack-in text-left lg:col-span-2"
                  style={{ animationDelay: '0ms' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-ember/10 flex items-center justify-center shrink-0">
                      <Megaphone size={20} weight="fill" className="text-ember/50" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-ember uppercase tracking-wide mb-0.5">Announcement</p>
                      <p className="text-sm text-stone-400 italic">Tap to add an announcement</p>
                    </div>
                  </div>
                </button>
              )
            )}

            {(() => {
              const baseDelay = showAnnouncement ? 80 : 0
              const cards = [
                eventsEnabled && nextEvent !== null && nextEvent !== undefined && {
                  key: 'events',
                  onClick: () => navigate('/events'),
                  icon: <CalendarHeart size={24} weight="fill" className="text-amber-500" />,
                  iconBg: 'bg-amber-50',
                  label: 'Next Event',
                  primary: nextEvent?.title ?? 'No upcoming events',
                  secondary: nextEvent?.event_date ? shortDate(nextEvent.event_date) : null,
                },
                mealsEnabled && nextMeal?.is_paused !== true && {
                  key: 'meals',
                  onClick: () => navigate('/schedule'),
                  icon: <ForkKnife size={24} weight="fill" className="text-ember" />,
                  iconBg: 'bg-ember/10',
                  label: 'Next Meal',
                  primary: nextMeal?.title ?? (isAdmin ? 'Add meals in the Sign Up tab' : 'No meals scheduled yet'),
                  secondary: nextMeal?.week_date ? shortDate(nextMeal.week_date) : null,
                },
                servicesEnabled && nextService !== null && {
                  key: 'services',
                  onClick: () => navigate('/schedule', { state: { segment: 'services' } }),
                  icon: <HandHeart size={24} weight="fill" className="text-lagoon-700" />,
                  iconBg: 'bg-lagoon-50',
                  label: 'Next Service',
                  primary: nextService?.is_paused ? 'No service signup this week' : nextService?.title ?? (isAdmin ? 'Add service dates in the Sign Up tab' : 'No service scheduled yet'),
                  secondary: nextService?.week_date && !nextService?.is_paused ? shortDate(nextService.week_date) : null,
                },
                chatEnabled && lastGroupMessage !== null && lastGroupMessage !== undefined && {
                  key: 'chat',
                  onClick: () => navigate('/chat', { state: { openMainChat: true } }),
                  icon: <ChatCircleDots size={24} weight="fill" className="text-ember" />,
                  iconBg: 'bg-ember/10',
                  label: 'Main Chat',
                  primary: lastGroupMessage.image_url && !lastGroupMessage.body ? '📷 Photo' : `“${lastGroupMessage.body}”`,
                  secondary: `${shortName(lastGroupMessage.display_name)} · ${relativeTime(lastGroupMessage.created_at)}`,
                  dot: chatUnreadCount > 0,
                },
                prayerEnabled && prayerCard && {
                  key: 'prayer',
                  onClick: () => navigate('/prayer', { state: { featuredUserId: prayerCard.member_user_id } }),
                  icon: <HandsPraying size={24} weight="fill" className="text-lagoon" />,
                  iconBg: 'bg-lagoon-50',
                  label: 'Pray for Today',
                  primary: shortName(prayerCard.profile?.display_name) || 'Someone',
                  secondary: prayerCard.request,
                },
                birthdaysEnabled && {
                  key: 'birthdays',
                  onClick: onOpenBirthdays,
                  icon: <Cake size={24} weight="fill" className="text-coral" />,
                  iconBg: 'bg-coral/10',
                  label: 'Upcoming Birthdays',
                  primary: birthdayPrimary,
                  confetti: !!nextBirthday && nextBirthday.days <= 30,
                },
                guideEnabled && {
                  key: 'guide',
                  onClick: onOpenGuide,
                  icon: <BookOpen size={24} weight="fill" className="text-sunrise" />,
                  iconBg: 'bg-sunrise/10',
                  label: 'Guide',
                  primary: 'Community Guide',
                  secondary: isAdmin && !guideType && !guideUrl ? 'Tap to set up' : 'Tap to open',
                },
                givingEnabled && {
                  key: 'giving',
                  onClick: onOpenGiving,
                  icon: <Coins size={24} weight="fill" className="text-sage-700" />,
                  iconBg: 'bg-sage-50',
                  label: 'Giving',
                  primary: 'Monthly Giving',
                  secondary: isAdmin && !givingUrl ? 'Tap to set up' : 'Tap to open',
                },
              ].filter(Boolean)

              return cards.map(({ key, ...rest }, i) => (
                <Card
                  key={key}
                  {...rest}
                  delay={baseDelay + i * 40}
                  className={i === cards.length - 1 && cards.length % 2 !== 0 ? 'lg:col-span-2' : ''}
                />
              ))
            })()}
          </>
        )}
      </div>

      {editingAnnouncement && (
        <AnnouncementEditModal
          value={announcement}
          onClose={() => setEditingAnnouncement(false)}
          onSave={handleSaveAnnouncement}
        />
      )}
    </main>
  )
}
