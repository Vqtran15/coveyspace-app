import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ForkKnife, HandHeart, Cake, BookOpen, CaretRight, Megaphone, PencilSimple, HandWaving, Lightbulb, GearSix } from '@phosphor-icons/react'
import { supabase } from '../lib/supabase.js'
import { toDateString } from '../utils/dates.js'
import { daysUntilNext } from '../utils/birthdays.js'
import { useModalClose } from '../hooks/useModalClose.js'

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const CONFETTI = [
  { left: '8%',  top: '20%', color: '#B85A3A', delay: 0,    size: 10 },
  { left: '22%', top: '65%', color: '#E8A838', delay: 0.5,  size: 8  },
  { left: '38%', top: '28%', color: '#C4622D', delay: 1.0,  size: 12 },
  { left: '53%', top: '70%', color: '#A1CCA6', delay: 0.25, size: 8  },
  { left: '67%', top: '32%', color: '#E8A838', delay: 0.75, size: 10 },
  { left: '80%', top: '62%', color: '#B85A3A', delay: 0.4,  size: 8  },
  { left: '91%', top: '22%', color: '#A1CCA6', delay: 1.2,  size: 10 },
  { left: '15%', top: '72%', color: '#E8A838', delay: 1.5,  size: 7  },
]

function ConfettiDots() {
  return CONFETTI.map((dot, i) => (
    <span
      key={i}
      className="absolute pointer-events-none animate-confetti-float leading-none select-none"
      style={{
        left: dot.left,
        top: dot.top,
        fontSize: dot.size,
        color: dot.color,
        animationDelay: `${dot.delay}s`,
      }}
    >
      ✦
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

function timeGreeting() {
  const now = new Date()
  const h = now.getHours()
  const day = DAYS[now.getDay()]
  if (h < 12) return `Happy ${day} morning`
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
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

export default function OverviewTab({ displayName, groupName, groupId, isAdmin, birthdays, onOpenBirthdays, onOpenGuide, onOpenSettings }) {
  const navigate = useNavigate()
  const [nextMeal, setNextMeal]             = useState(undefined)
  const [nextService, setNextService]       = useState(undefined)
  const [announcement, setAnnouncement]     = useState(undefined)
  const [editingAnnouncement, setEditingAnnouncement] = useState(false)
  const [funFact, setFunFact]               = useState(null)

  useEffect(() => {
    const today = toDateString(new Date())

    supabase
      .from('meal_pages')
      .select('id, title, week_date, is_paused')
      .gte('week_date', mealCutoffDate())
      .order('week_date')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setNextMeal(data ?? null))

    supabase
      .from('serving_pages')
      .select('title, week_date, is_paused')
      .gte('week_date', today)
      .order('week_date')
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setNextService(data ?? null))

    if (groupId) {
      supabase
        .from('community_groups')
        .select('announcement')
        .eq('id', groupId)
        .single()
        .then(({ data }) => setAnnouncement(data?.announcement ?? null))
    }

    const cached = JSON.parse(localStorage.getItem('fun_fact_v2') ?? 'null')
    if (cached?.date === today) {
      setFunFact(cached.text)
    } else {
      const useDog = new Date().getDate() % 2 === 0
      const url = useDog
        ? 'https://dogapi.dog/api/v2/facts'
        : 'https://catfact.ninja/fact'
      fetch(url)
        .then(r => r.json())
        .then(d => {
          const text = useDog ? d.data[0].attributes.body : d.fact
          localStorage.setItem('fun_fact_v2', JSON.stringify({ date: today, text }))
          setFunFact(text)
        })
        .catch(() => setFunFact(null))
    }
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
    ? sortedBirthdays.filter(b => b.days === nextBirthday.days).map(b => b.name)
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
    <main className="max-w-3xl mx-auto px-4 pt-8 pb-12">
      <div className="mb-7 animate-fade-up flex items-start justify-between" style={{ animationDelay: '0ms' }}>
        <div>
          <h1 className="text-3xl font-bold text-stone-800">
            {timeGreeting()}{displayName ? `, ${displayName.split(' ')[0]}` : ''}
          </h1>
          {groupName && (
            <p className="text-stone-500 mt-1 text-sm flex items-center gap-1.5">
              {groupName}
              <HandWaving size={16} weight="fill" className="inline-block text-amber-400 animate-wave origin-bottom shrink-0" />
            </p>
          )}
        </div>
        <button
          onClick={onOpenSettings}
          className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0 mt-1"
        >
          <GearSix size={22} weight="regular" />
        </button>
      </div>

      <div className="space-y-3">
        {/* Announcement — always first */}
        {showAnnouncement && (
          announcement ? (
            <div
              className="w-full bg-jade rounded-2xl p-4 animate-stack-in shadow-md shadow-jade/25"
              style={{ animationDelay: '70ms' }}
            >
              <div className="flex items-start gap-3">
                <Megaphone size={26} weight="fill" className="text-white/70 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wide mb-1">Announcement</p>
                  <p className="text-sm text-white leading-relaxed font-medium whitespace-pre-wrap">{announcement}</p>
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
          ) : (
            <button
              onClick={() => setEditingAnnouncement(true)}
              className="w-full bg-jade/8 border border-dashed border-jade/30 rounded-2xl p-4 animate-stack-in text-left"
              style={{ animationDelay: '70ms' }}
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

        <Card
          onClick={() => navigate('/meals')}
          icon={<ForkKnife size={24} weight="fill" className="text-jade" />}
          iconBg="bg-jade/10"
          label="Next Meal"
          primary={nextMeal === undefined ? 'Loading…' : nextMeal?.is_paused ? 'No meal signup this week' : nextMeal?.title ?? 'No upcoming meals'}
          secondary={nextMeal?.week_date && !nextMeal?.is_paused ? shortDate(nextMeal.week_date) : null}
          delay={showAnnouncement ? 140 : 70}
        />
        <Card
          onClick={() => navigate('/services')}
          icon={<HandHeart size={24} weight="fill" className="text-coral" />}
          iconBg="bg-coral/10"
          label="Next Service"
          primary={nextService === undefined ? 'Loading…' : nextService?.is_paused ? 'No service signup this week' : nextService?.title ?? 'No upcoming services'}
          secondary={nextService?.week_date && !nextService?.is_paused ? shortDate(nextService.week_date) : null}
          delay={showAnnouncement ? 210 : 140}
        />
        <Card
          onClick={onOpenBirthdays}
          icon={<Cake size={24} weight="fill" className="text-lagoon-700" />}
          iconBg="bg-lagoon-50"
          label="Upcoming Birthdays"
          primary={birthdayPrimary()}
          delay={showAnnouncement ? 280 : 210}
          confetti={!!nextBirthday && nextBirthday.days <= 30}
        />
        <Card
          onClick={onOpenGuide}
          icon={<BookOpen size={24} weight="fill" className="text-stone-500" />}
          iconBg="bg-stone-100"
          label="Guide"
          primary="Community Guide"
          secondary="Tap to open"
          delay={showAnnouncement ? 350 : 280}
        />

        {/* Fun Fact */}
        {funFact !== null && (
          <div
            className="w-full bg-amber-50 border border-amber-100 rounded-2xl p-4 animate-stack-in"
            style={{ animationDelay: `${showAnnouncement ? 420 : 350}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                <Lightbulb size={22} weight="fill" className="text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-amber-500 uppercase tracking-wide mb-1">Fun Fact</p>
                <p className="text-sm text-stone-700 leading-relaxed">{funFact}</p>
              </div>
            </div>
          </div>
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
