import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ForkKnife, HandHeart, Cake, BookOpen, CaretRight, Megaphone, PencilSimple, Confetti } from '@phosphor-icons/react'
import { AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'
import { supabase } from '../lib/supabase.js'
import { toDateString } from '../utils/dates.js'
import { daysUntilNext } from '../utils/birthdays.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'


const CONFETTI_DOTS = [
  { left: '8%',  top: '22%', color: '#B85A3A', delay: 0,    size: 11 },
  { left: '22%', top: '62%', color: '#E8A838', delay: 0.5,  size: 9  },
  { left: '38%', top: '26%', color: '#C4622D', delay: 1.0,  size: 13 },
  { left: '53%', top: '68%', color: '#A1CCA6', delay: 0.25, size: 9  },
  { left: '67%', top: '30%', color: '#E8A838', delay: 0.75, size: 11 },
  { left: '80%', top: '60%', color: '#B85A3A', delay: 0.4,  size: 9  },
  { left: '91%', top: '20%', color: '#A1CCA6', delay: 1.2,  size: 11 },
  { left: '15%', top: '70%', color: '#E8A838', delay: 1.5,  size: 8  },
]

function ConfettiDots() {
  return CONFETTI_DOTS.map((dot, i) => (
    <span
      key={i}
      className="absolute pointer-events-none animate-confetti-float select-none flex items-center justify-center"
      style={{ left: dot.left, top: dot.top, color: dot.color, animationDelay: `${dot.delay}s` }}
    >
      <Confetti size={dot.size} weight="fill" />
    </span>
  ))
}

// After 9 pm PT on Tuesdays, roll the meal cutoff forward to Wednesday
// so the current Tuesday's meal is no longer shown as "next".
function mealCutoffDate() {
  const pst = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }))
  if (pst.getDay() === 2 && pst.getHours() >= 21) {
    pst.setDate(pst.getDate() + 1)
  }
  return toDateString(pst)
}


function shortDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function Card({ icon, iconBg, label, primary, secondary, onClick, delay = 0, confetti = false }) {
  return (
    <button
      onClick={onClick}
      style={{ animationDelay: `${delay}ms` }}
      className="relative overflow-hidden w-full flex items-center gap-4 bg-white rounded-2xl p-4 border border-stone-100 shadow-sm active:bg-stone-50 transition-colors text-left animate-stack-in"
    >
      {confetti && <ConfettiDots />}
      <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="relative flex-1 min-w-0">
        <p className="text-[11px] font-semibold text-stone-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-base font-semibold text-stone-800 truncate leading-snug">{primary}</p>
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
                className="flex-1 py-2.5 border border-red-200 text-red-500 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Remove
              </button>
            )}
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2.5 bg-jade hover:bg-jade-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function OverviewTab({ displayName, groupName, groupId, isAdmin, userId, avatarIcon, avatarColorKey, birthdays, onOpenBirthdays, onOpenGuide, onOpenSettings, refreshKey = 0, mealsEnabled = true, servicesEnabled = true, guideEnabled = true, birthdaysEnabled = true }) {
  const navigate = useNavigate()
  const [nextMeal, setNextMeal]             = useState(undefined)
  const [nextService, setNextService]       = useState(undefined)
  const [announcement, setAnnouncement]     = useState(undefined)
  const [editingAnnouncement, setEditingAnnouncement] = useState(false)

  async function load() {
    const today = toDateString(new Date())

    const [mealRes, serviceRes] = await Promise.all([
      supabase.from('meal_pages').select('id, title, week_date, is_paused').gte('week_date', mealCutoffDate()).order('week_date').limit(1).maybeSingle(),
      supabase.from('serving_pages').select('title, week_date, is_paused').gte('week_date', today).order('week_date').limit(1).maybeSingle(),
    ])
    setNextMeal(mealRes.data ?? null)
    setNextService(serviceRes.data ?? null)

    if (groupId) {
      const { data } = await supabase.from('community_groups').select('announcement').eq('id', groupId).single()
      setAnnouncement(data?.announcement ?? null)
    }
  }

  const { pullDistance, refreshing, threshold } = usePullToRefresh(load, !editingAnnouncement)

  useEffect(() => { load() }, [groupId, refreshKey])

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

  const sortedBirthdays = [...birthdays]
    .map(b => ({ ...b, days: daysUntilNext(b.birthday) }))
    .sort((a, b) => a.days - b.days)

  const nextBirthday = sortedBirthdays[0]
  const sameDayGroup = nextBirthday
    ? sortedBirthdays.filter(b => b.days === nextBirthday.days).map(b => { const p = (b.name ?? '').trim().split(' ').filter(Boolean); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] ?? '' })
    : []

  function joinNames(names) {
    if (names.length === 1) return names[0]
    if (names.length === 2) return `${names[0]} & ${names[1]}`
    return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
  }

  function birthdayPrimary() {
    if (!nextBirthday) return 'No upcoming birthdays'
    const who = joinNames(sameDayGroup)
    if (nextBirthday.days === 0) return `🎂 Today is ${who}'s birthday!`
    if (nextBirthday.days === 1) return `${who}'s birthday is tomorrow`
    return `${who}'s birthday in ${nextBirthday.days} days`
  }

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
        <div>
          <h1 className="text-3xl font-bold text-stone-800">Covey Space</h1>
        </div>
        <button
          onClick={onOpenSettings}
          className={`w-11 h-11 rounded-full ${avatarColor(userId, avatarColorKey)} flex items-center justify-center shrink-0 active:opacity-70 transition-opacity`}
        >
          {avatarIcon
            ? <AvatarIcon name={avatarIcon} size={22} />
            : <span className="text-white text-sm font-bold">
                {(displayName ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
          }
        </button>
      </div>

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-5 lg:space-y-0">
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

        {mealsEnabled && (
          nextMeal === undefined
            ? <CardSkeleton delay={showAnnouncement ? 80 : 0} />
            : <Card
                onClick={() => navigate('/schedule')}
                icon={<ForkKnife size={24} weight="fill" className="text-jade" />}
                iconBg="bg-jade/10"
                label="Next Meal"
                primary={nextMeal?.is_paused ? 'No meal signup this week' : nextMeal?.title ?? (isAdmin ? 'Add meals in the Sign Up tab' : 'No meals scheduled yet')}
                secondary={nextMeal?.week_date && !nextMeal?.is_paused ? shortDate(nextMeal.week_date) : null}
                delay={showAnnouncement ? 80 : 0}
              />
        )}
        {servicesEnabled && (
          nextService === undefined
            ? <CardSkeleton delay={showAnnouncement ? 160 : 80} />
            : <Card
                onClick={() => navigate('/schedule', { state: { segment: 'services' } })}
                icon={<HandHeart size={24} weight="fill" className="text-coral" />}
                iconBg="bg-coral/10"
                label="Next Service"
                primary={nextService?.is_paused ? 'No service signup this week' : nextService?.title ?? (isAdmin ? 'Add service dates in the Sign Up tab' : 'No service scheduled yet')}
                secondary={nextService?.week_date && !nextService?.is_paused ? shortDate(nextService.week_date) : null}
                delay={showAnnouncement ? 160 : 80}
              />
        )}
        {birthdaysEnabled && (
          <Card
            onClick={onOpenBirthdays}
            icon={<Cake size={24} weight="fill" className="text-lagoon-700" />}
            iconBg="bg-lagoon-50"
            label="Upcoming Birthdays"
            primary={birthdayPrimary()}
            delay={showAnnouncement ? 240 : 160}
            confetti={!!nextBirthday && nextBirthday.days <= 30}
          />
        )}
        {guideEnabled && (
          <Card
            onClick={onOpenGuide}
            icon={<BookOpen size={24} weight="fill" className="text-stone-500" />}
            iconBg="bg-stone-100"
            label="Guide"
            primary="Community Guide"
            secondary="Tap to open"
            delay={showAnnouncement ? 320 : 240}
          />
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
