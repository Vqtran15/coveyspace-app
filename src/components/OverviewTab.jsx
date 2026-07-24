import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ForkKnife, HandHeart, Cake, BookOpen, CaretRight, Megaphone, PencilSimple, HandsPraying, ShareNetwork, Coins, GearSix } from '@phosphor-icons/react'
import { AvatarCircle } from '../lib/avatarDisplay.jsx'
import { supabase } from '../lib/supabase.js'
import { toDateString, mealCutoffDate } from '../utils/dates.js'
import { daysUntilNext } from '../utils/birthdays.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { useToast } from '../lib/toast.jsx'
import ConfettiDots from './ConfettiDots.jsx'
import InstallBanner from './InstallBanner.jsx'


function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function shortName(full) {
  const parts = (full ?? '').trim().split(' ').filter(Boolean)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? ''
}

function Card({ icon, iconBg, label, primary, secondary, onClick, delay = 0, confetti = false, className = '' }) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className={`relative overflow-hidden w-full flex items-center gap-4 bg-white rounded-2xl p-4 border border-stone-100 shadow-sm active:bg-stone-50 transition-colors text-left animate-stack-in ${className}`}
    >
      {confetti && <ConfettiDots />}
      <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="relative flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-stone-500 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-base font-semibold text-stone-800 leading-snug line-clamp-2">{primary}</p>
        {secondary && <p className="text-xs text-stone-400 mt-0.5 truncate">{secondary}</p>}
      </div>
      <CaretRight size={16} className="text-stone-300 shrink-0 relative" />
    </button>
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
      className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight + 16 } : undefined}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-4">
          <div className="flex items-center gap-2">
            <Megaphone size={20} weight="fill" className="text-jade" />
            <h2 className="text-lg font-bold text-stone-800">Announcement</h2>
          </div>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>
        <form onSubmit={handleSave} className="px-5 pb-6 space-y-4">
          <textarea
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write an announcement for your group…"
            rows={4}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent resize-none"
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
              className="flex-1 py-2.5 bg-jade hover:bg-jade-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function OverviewTab({ displayName, groupName, groupId, isAdmin, userId, avatarIcon, avatarColorKey, avatarImageUrl, birthdays, onOpenBirthdays, onOpenGuide, onOpenSettings, onOpenGiving, refreshKey = 0, mealsEnabled = true, servicesEnabled = true, guideEnabled = true, birthdaysEnabled = true, prayerEnabled = true, givingEnabled = false, givingUrl = null, guideUrl = null, guideType = null }) {
  const navigate = useNavigate()
  const toast = useToast()
  const [nextMeal, setNextMeal]             = useState(undefined)
  const [nextService, setNextService]       = useState(undefined)
  const [announcement, setAnnouncement]     = useState(undefined)
  const [prayerCard, setPrayerCard]         = useState(undefined)
  const [editingAnnouncement, setEditingAnnouncement] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [soloAdmin, setSoloAdmin] = useState(false)

  async function load() {
    setLoaded(false)
    const today = toDateString(new Date())

    const [mealRes, serviceRes] = await Promise.all([
      supabase.from('meal_pages').select('id, title, week_date, is_paused').gte('week_date', mealCutoffDate()).order('week_date').limit(1).maybeSingle(),
      supabase.from('serving_pages').select('title, week_date, is_paused').gte('week_date', today).order('week_date').limit(1).maybeSingle(),
    ])
    setNextMeal(mealRes.data ?? null)
    setNextService(serviceRes.data ?? null)

    if (groupId) {
      const cutoff = new Date(Date.now() - 60 * 86400000).toISOString()
      const [{ data: groupData }, { data: memberData }, { count: mCount }] = await Promise.all([
        supabase.from('community_groups').select('announcement').eq('id', groupId).single(),
        prayerEnabled
          ? supabase.from('profiles').select('user_id, display_name, avatar_icon, avatar_color, avatar_image_url').eq('community_group_id', groupId)
          : Promise.resolve({ data: [] }),
        isAdmin
          ? supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('community_group_id', groupId)
          : Promise.resolve({ count: null }),
      ])
      setAnnouncement(groupData?.announcement ?? null)
      if (isAdmin) setSoloAdmin(mCount === 1)

      if (prayerEnabled) {
        const memberIds = (memberData ?? []).map(m => m.user_id)
        if (memberIds.length > 0) {
          const { data: requestData } = await supabase
            .from('prayer_requests')
            .select('id, member_user_id, request, created_at')
            .in('member_user_id', memberIds)
            .gte('created_at', cutoff)
            .order('created_at', { ascending: false })
          const profileMap = Object.fromEntries((memberData ?? []).map(p => [p.user_id, p]))
          const seen = new Set()
          const uniqueUsers = []
          for (const r of requestData ?? []) {
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
    }
    setLoaded(true)
  }

  const { pullDistance, refreshing, threshold } = usePullToRefresh(load, !editingAnnouncement)

  useEffect(() => { load() }, [groupId, refreshKey, prayerEnabled, isAdmin])

  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`overview-pages:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'meal_pages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'serving_pages' }, load)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [groupId])

  async function handleSaveAnnouncement(text) {
    await supabase.rpc('update_announcement', { p_text: text })
    setAnnouncement(text.trim() || null)
  }

  const { sortedBirthdays, nextBirthday, sameDayGroup, birthdayPrimary } = useMemo(() => {
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
    return { sortedBirthdays: sorted, nextBirthday: next, sameDayGroup: sameDay, birthdayPrimary: primary }
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
            <div className="w-3 h-3 rounded-full border-2 border-jade border-t-transparent" style={{ opacity: pullDistance / threshold }} />
          </div>
        </div>
      )}

      <div className="mb-7 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold text-stone-800">
          Hi, {(displayName ?? '').split(' ')[0] || 'there'}!
        </h1>
        <button
          onClick={onOpenSettings}
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
            {mealsEnabled     && <CardSkeleton delay={isAdmin ? 80  : 0}   />}
            {servicesEnabled  && <CardSkeleton delay={isAdmin ? 160 : 80}  />}
            {prayerEnabled    && <CardSkeleton delay={isAdmin ? 240 : 160} />}
            {birthdaysEnabled && <CardSkeleton delay={isAdmin ? 320 : 240} />}
            {guideEnabled     && <CardSkeleton delay={isAdmin ? 400 : 320} />}
            {givingEnabled    && <CardSkeleton delay={isAdmin ? 480 : 400} />}
          </>
        ) : (
          <>
            {/* Solo-admin nudge — shown until someone joins */}
            {soloAdmin && (
              <div className="w-full animate-stack-in lg:col-span-2">
                <div className="bg-jade/5 border border-jade/25 rounded-2xl p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-jade mb-0.5">Your group is just you</p>
                    <p className="text-xs text-stone-500">Share an invite link so your members can join with one tap.</p>
                  </div>
                  <button
                    onClick={async () => {
                      const { data: code } = await supabase.rpc('get_invite_code')
                      if (!code) return
                      const url = `${window.location.origin}/login?code=${code}`
                      if (navigator.share) {
                        await navigator.share({ title: 'Join my group on Covey Space', url }).catch(() => {})
                      } else {
                        await navigator.clipboard.writeText(url)
                        toast('Invite link copied!', 'success')
                      }
                    }}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-jade text-white text-sm font-semibold rounded-xl shrink-0 transition-all active:scale-[0.98]"
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
                    className="w-full bg-jade rounded-2xl p-5 shadow-md shadow-jade/25 animate-announcement-shake"
                    style={{ animation: 'announcement-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) 320ms both, announcement-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) 2820ms both' }}
                  >
                    <div className="flex items-start gap-4">
                      <Megaphone size={34} weight="fill" className="text-white/70 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wide mb-1.5">Announcement</p>
                        <p className="text-base text-white leading-relaxed font-medium whitespace-pre-wrap">{announcement}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => setEditingAnnouncement(true)}
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
                  className="w-full bg-jade/8 border border-dashed border-jade/30 rounded-2xl p-4 animate-stack-in text-left lg:col-span-2"
                  style={{ animationDelay: '0ms' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-jade/10 flex items-center justify-center shrink-0">
                      <Megaphone size={20} weight="fill" className="text-jade/50" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-jade/60 uppercase tracking-wide mb-0.5">Announcement</p>
                      <p className="text-sm text-stone-400 italic">Tap to add an announcement</p>
                    </div>
                  </div>
                </button>
              )
            )}

            {(() => {
              const baseDelay = showAnnouncement ? 80 : 0
              const cards = [
                mealsEnabled && {
                  key: 'meals',
                  onClick: () => navigate('/schedule'),
                  icon: <ForkKnife size={24} weight="fill" className="text-jade" />,
                  iconBg: 'bg-jade/10',
                  label: 'Next Meal',
                  primary: nextMeal?.is_paused ? 'No meal signup this week' : nextMeal?.title ?? (isAdmin ? 'Add meals in the Sign Up tab' : 'No meals scheduled yet'),
                  secondary: nextMeal?.week_date && !nextMeal?.is_paused ? shortDate(nextMeal.week_date) : null,
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

              return cards.map((props, i) => (
                <Card
                  key={props.key}
                  {...props}
                  delay={baseDelay + i * 80}
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
