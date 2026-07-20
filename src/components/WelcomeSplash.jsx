import {
  Confetti, DeviceMobile, BoxArrowUp, DotsThreeVertical,
  ShieldCheck, Users, ArrowLeft, ChatCircleDots, ForkKnife,
  HandsPraying, Cake, CalendarCheck, Link, ShareNetwork, Bell,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useModalClose } from '../hooks/useModalClose.js'
import { nextScheduledDate, weekOccToMode } from '../utils/schedule.js'
import { AvatarCircle } from '../lib/avatarIcons.jsx'
import AvatarPicker from './AvatarPicker.jsx'

const MONTHS    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS      = Array.from({ length: 31 }, (_, i) => i + 1)
const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

function ProgressDots({ steps, currentStep }) {
  const idx = steps.indexOf(currentStep)
  return (
    <div
      className="fixed left-0 right-0 flex justify-center z-[60] gap-1.5 pointer-events-none"
      style={{ top: 'calc(env(safe-area-inset-top) + 14px)' }}
    >
      {steps.map((s, i) => (
        <div
          key={s}
          className={`rounded-full transition-all duration-300 ${
            i === idx ? 'w-5 h-2 bg-jade' : i < idx ? 'w-2 h-2 bg-jade/40' : 'w-2 h-2 bg-stone-200'
          }`}
        />
      ))}
    </div>
  )
}

const TOUR_CARDS = [
  { key: 'chat_enabled',      Icon: ChatCircleDots, color: 'bg-sage/20 text-sage-700',     title: 'Group Chat',        desc: 'A main group chat, plus direct messages and smaller group threads.' },
  { key: 'meals_enabled',     Icon: ForkKnife,      color: 'bg-jade/10 text-jade',         title: 'Meal Sign-ups',     desc: 'Auto-rotating weekly meals. Members claim their ingredient in seconds.' },
  { key: 'prayer_enabled',    Icon: HandsPraying,   color: 'bg-sunrise/10 text-sunrise',   title: 'Prayer Requests',   desc: 'Every member has a profile. Look back later and see what God has done.' },
  { key: 'birthdays_enabled', Icon: Cake,           color: 'bg-coral/10 text-coral',       title: 'Birthdays',         desc: 'Upcoming birthdays show on the home screen so no one gets forgotten.' },
  { key: 'services_enabled',  Icon: CalendarCheck,  color: 'bg-lagoon/10 text-lagoon-600', title: 'Service Schedules', desc: 'Monthly service sign-ups that rotate automatically.' },
]

const FEATURE_TOGGLES = [
  { key: 'meals_enabled',     label: 'Meal Sign-ups',     desc: 'Weekly rotating meal signups',    Icon: ForkKnife,      color: 'text-jade' },
  { key: 'services_enabled',  label: 'Service Schedules', desc: 'Monthly service signups',          Icon: CalendarCheck,  color: 'text-lagoon-600' },
  { key: 'chat_enabled',      label: 'Group Chat',        desc: 'Group and direct messages',        Icon: ChatCircleDots, color: 'text-sage-700' },
  { key: 'prayer_enabled',    label: 'Prayer Requests',   desc: 'Member prayer profiles',           Icon: HandsPraying,   color: 'text-sunrise' },
  { key: 'birthdays_enabled', label: 'Birthdays',         desc: 'Home screen birthday reminders',  Icon: Cake,           color: 'text-coral' },
  { key: 'guide_enabled',     label: 'Community Guide',   desc: 'PDF, link, or written notes',     Icon: Link,           color: 'text-jade' },
]

function weekOccToPat(occ) {
  return (occ?.[0]===1 && occ?.[1]===3) ? 'odd' : 'even'
}
function modeToWeekOcc(mode, pat, customWeeks) {
  if (mode === 'weekly')   return [1, 2, 3, 4, 5]
  if (mode === 'biweekly') return pat === 'odd' ? [1, 3] : [2, 4]
  return customWeeks
}

export default function WelcomeSplash({
  groupName, onDone, isAdmin,
  userId, displayName, groupId,
  groupSettings, onGroupSettingsChange,
  existingBirthday,
  onAvatarChange,
}) {
  const [closing, close] = useModalClose(onDone)
  const navigate = useNavigate()

  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && window.navigator.standalone === true)

  const visibleTourCards = TOUR_CARDS.filter(c => groupSettings == null || groupSettings[c.key] !== false)

  const steps = useRef(
    isAdmin
      ? ['welcome', 'personalize', 'features', 'setup', 'invite', ...(isStandalone ? [] : ['install'])]
      : ['welcome', 'personalize', 'tour', ...(isStandalone ? [] : ['install'])]
  ).current

  const [step, setStep] = useState(() => {
    if (isAdmin && groupId) {
      try {
        const s = localStorage.getItem(`cg_onb_step_${groupId}`)
        if (s === 'features' || s === 'setup') return s
      } catch {}
    }
    return 'welcome'
  })

  // ── Personalize ────────────────────────────────────────────────────────────
  const [avatarIcon,    setAvatarIcon]    = useState(null)
  const [colorKey,      setColorKey]      = useState(null)
  const [avatarImageUrl,setAvatarImageUrl]= useState(null)
  const [bdMonth, setBdMonth] = useState(() => existingBirthday ? existingBirthday.slice(5, 7) : '')
  const [bdDay,   setBdDay]   = useState(() => existingBirthday ? existingBirthday.slice(8, 10) : '')

  // ── Features (admin) ───────────────────────────────────────────────────────
  const [features, setFeatures] = useState(() => {
    if (isAdmin && groupId) {
      try {
        const s = localStorage.getItem(`cg_onb_features_${groupId}`)
        if (s) return JSON.parse(s)
      } catch {}
    }
    return {
      meals_enabled:     groupSettings?.meals_enabled     !== false,
      services_enabled:  groupSettings?.services_enabled  !== false,
      chat_enabled:      groupSettings?.chat_enabled      !== false,
      prayer_enabled:    groupSettings?.prayer_enabled    !== false,
      birthdays_enabled: groupSettings?.birthdays_enabled !== false,
      guide_enabled:     groupSettings?.guide_enabled     !== false,
    }
  })
  const [savingFeatures, setSavingFeatures] = useState(false)

  // ── Setup (admin) ──────────────────────────────────────────────────────────
  const _setupDraft = (() => {
    if (isAdmin && groupId) {
      try {
        const s = localStorage.getItem(`cg_onb_setup_${groupId}`)
        return s ? JSON.parse(s) : null
      } catch {}
    }
    return null
  })()
  const [mealDow,           setMealDow]           = useState(_setupDraft?.mealDow           ?? groupSettings?.meal_day_of_week ?? null)
  const [mealFreqMode,      setMealFreqMode]      = useState(_setupDraft?.mealFreqMode      ?? weekOccToMode(groupSettings?.meal_week_occurrences))
  const [mealBiweeklyPat,   setMealBiweeklyPat]   = useState(_setupDraft?.mealBiweeklyPat   ?? weekOccToPat(groupSettings?.meal_week_occurrences))
  const [mealCustomWeeks,   setMealCustomWeeks]   = useState(_setupDraft?.mealCustomWeeks   ?? groupSettings?.meal_week_occurrences ?? [1, 2, 3, 4, 5])
  const [mealNames,         setMealNames]         = useState(_setupDraft?.mealNames         ?? ['', ''])
  const [serviceDow,        setServiceDow]        = useState(_setupDraft?.serviceDow        ?? groupSettings?.service_day_of_week ?? null)
  const [serviceFreqMode,   setServiceFreqMode]   = useState(_setupDraft?.serviceFreqMode   ?? weekOccToMode(groupSettings?.service_week_occurrences ?? [1]))
  const [serviceBiweeklyPat,setServiceBiweeklyPat]= useState(_setupDraft?.serviceBiweeklyPat ?? weekOccToPat(groupSettings?.service_week_occurrences ?? [1]))
  const [serviceCustomWeeks,setServiceCustomWeeks]= useState(_setupDraft?.serviceCustomWeeks ?? groupSettings?.service_week_occurrences ?? [1])
  const [serviceAutofill,   setServiceAutofill]   = useState(_setupDraft?.serviceAutofill   ?? groupSettings?.service_autofill ?? false)
  const [savingSetup,    setSavingSetup]    = useState(false)

  // ── Invite (admin) ─────────────────────────────────────────────────────────
  const [inviteCode, setInviteCode] = useState(null)
  const [loadingCode, setLoadingCode] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)

  // ── Tour (member) ──────────────────────────────────────────────────────────
  const [tourSlide, setTourSlide] = useState(0)
  const touchStartX = useRef(null)

  // ── Notifications (install step) ───────────────────────────────────────────
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [notifRequesting, setNotifRequesting] = useState(false)

  async function requestNotifPermission() {
    if (typeof Notification === 'undefined') return
    setNotifRequesting(true)
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
    setNotifRequesting(false)
  }

  useEffect(() => {
    if (!userId) return
    supabase.from('profiles')
      .select('avatar_icon, avatar_color, avatar_image_url')
      .eq('user_id', userId)
      .single()
      .then(({ data }) => {
        setAvatarIcon(data?.avatar_icon ?? null)
        setColorKey(data?.avatar_color ?? null)
        setAvatarImageUrl(data?.avatar_image_url ?? null)
      })
  }, [userId])

  // If groupId wasn't available on mount (async profile load), restore step once it arrives
  useEffect(() => {
    if (!isAdmin || !groupId || step !== 'welcome') return
    try {
      const s = localStorage.getItem(`cg_onb_step_${groupId}`)
      if (s === 'features' || s === 'setup') setStep(s)
    } catch {}
  }, [groupId])

  // Persist admin onboarding drafts to localStorage so closing mid-flow doesn't lose work
  useEffect(() => {
    if (!isAdmin || !groupId) return
    if (step === 'features' || step === 'setup') {
      localStorage.setItem(`cg_onb_step_${groupId}`, step)
    }
  }, [isAdmin, groupId, step])

  useEffect(() => {
    if (!isAdmin || !groupId || step !== 'features') return
    localStorage.setItem(`cg_onb_features_${groupId}`, JSON.stringify(features))
  }, [isAdmin, groupId, step, features])

  useEffect(() => {
    if (!isAdmin || !groupId || step !== 'setup') return
    const draft = { mealDow, mealFreqMode, mealBiweeklyPat, mealCustomWeeks, mealNames, serviceDow, serviceFreqMode, serviceBiweeklyPat, serviceCustomWeeks, serviceAutofill }
    localStorage.setItem(`cg_onb_setup_${groupId}`, JSON.stringify(draft))
  }, [isAdmin, groupId, step, mealDow, mealFreqMode, mealBiweeklyPat, mealCustomWeeks, mealNames, serviceDow, serviceFreqMode, serviceBiweeklyPat, serviceCustomWeeks, serviceAutofill])

  // Context-aware CTA for members at the end of onboarding
  const memberCta = !isAdmin
    ? groupSettings?.chat_enabled !== false      ? { label: 'Let the group know you\'re here →', path: '/chat',     state: { openGroupChat: true } }
    : groupSettings?.meals_enabled !== false     ? { label: 'See this week\'s meals →',           path: '/schedule', state: null }
    : groupSettings?.prayer_enabled !== false    ? { label: 'View prayer requests →',             path: '/prayer',   state: null }
    : null
    : null

  function closeAndNavigate(path, state) {
    if (path) navigate(path, state ? { state } : undefined)
    close()
  }

  useEffect(() => {
    if (isAdmin && step === 'invite') {
      setLoadingCode(true)
      supabase.rpc('get_invite_code').then(({ data }) => {
        setInviteCode(data ?? null)
        setLoadingCode(false)
      })
    }
  }, [isAdmin, step])


  async function handlePersonalizeNext() {
    if (bdMonth && bdDay) {
      const mm = String(bdMonth).padStart(2, '0')
      const dd = String(bdDay).padStart(2, '0')
      await supabase.from('profiles')
        .update({ birthday: `2000-${mm}-${dd}` })
        .eq('user_id', userId)
    }
    setStep(isAdmin ? 'features' : 'tour')
  }

  async function handleFeaturesNext() {
    setSavingFeatures(true)
    const updates = {
      group_id: groupId,
      ...features,
    }
    const { data, error } = await supabase.from('group_settings')
      .upsert(updates, { onConflict: 'group_id' })
      .select().single()
    setSavingFeatures(false)
    if (error) { console.error('Failed to save features:', error.message); return }
    if (data) onGroupSettingsChange?.(data)
    localStorage.removeItem(`cg_onb_features_${groupId}`)
    setStep('setup')
  }

  function dateStr(d) {
    const y  = d.getFullYear()
    const m  = String(d.getMonth() + 1).padStart(2, '0')
    const dy = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${dy}`
  }

  async function handleSetupNext() {
    setSavingSetup(true)
    const patch = {}
    if (features.meals_enabled) {
      patch.meal_day_of_week      = mealDow
      patch.meal_week_occurrences = modeToWeekOcc(mealFreqMode, mealBiweeklyPat, mealCustomWeeks)
    }
    if (features.services_enabled) {
      patch.service_day_of_week      = serviceDow
      patch.service_week_occurrences = modeToWeekOcc(serviceFreqMode, serviceBiweeklyPat, serviceCustomWeeks)
      patch.service_autofill         = serviceAutofill
    }
    if (Object.keys(patch).length > 0) {
      const { data, error } = await supabase.from('group_settings')
        .upsert({ group_id: groupId, ...patch }, { onConflict: 'group_id' })
        .select().single()
      if (error) { console.error('Failed to save schedule:', error.message); setSavingSetup(false); return }
      if (data) onGroupSettingsChange?.(data)
    }

    const names = mealNames.map(n => n.trim()).filter(Boolean)
    if (features.meals_enabled && names.length > 0 && mealDow && mealDow.length > 0) {
      const dates = []
      let from = new Date(); from.setHours(0, 0, 0, 0); from.setDate(from.getDate() - 1)
      for (let i = 0; i < names.length; i++) {
        const d = nextScheduledDate(from, mealDow, modeToWeekOcc(mealFreqMode, mealBiweeklyPat, mealCustomWeeks))
        if (!d) break
        dates.push(d)
        from = new Date(d)
      }
      const rows = names.map((title, i) => ({
        title,
        week_date: dates[i] ? dateStr(dates[i]) : dateStr(new Date()),
        slot_count: 10,
        slot_dishes: [],
        position: i,
      }))
      const { error } = await supabase.from('meal_pages').insert(rows)
      if (!error) setMealNames(['', ''])
    }

    setSavingSetup(false)
    localStorage.removeItem(`cg_onb_setup_${groupId}`)
    localStorage.removeItem(`cg_onb_step_${groupId}`)
    setStep('invite')
  }

  function copyCode() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode).catch(() => {})
  }

  function copyLink() {
    if (!inviteCode) return
    const url = `${window.location.origin}/login?code=${inviteCode}`
    navigator.clipboard.writeText(url)
      .then(() => { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000) })
      .catch(() => {})
  }

  async function shareCode() {
    if (!inviteCode) return
    const url = `${window.location.origin}/login?code=${inviteCode}`
    if (navigator.share) await navigator.share({ title: 'Join my group on Covey Space', url }).catch(() => {})
    else copyLink()
  }

  function handleTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const delta = touchStartX.current - e.changedTouches[0].clientX
    if (Math.abs(delta) > 40) {
      if (delta > 0) setTourSlide(s => Math.min(s + 1, visibleTourCards.length - 1))
      else           setTourSlide(s => Math.max(s - 1, 0))
    }
    touchStartX.current = null
  }

  const stepIdx = steps.indexOf(step)

  const onBack = (() => {
    if (step === 'personalize') return () => setStep('welcome')
    if (step === 'features')   return () => setStep('personalize')
    if (step === 'setup')      return () => setStep('features')
    if (step === 'invite')     return () => setStep('setup')
    if (step === 'tour')       return () => setStep('personalize')
    if (step === 'install')    return () => setStep(isAdmin ? 'invite' : 'tour')
    return null
  })()

  function renderStep() {
    // ── STEP: welcome ──────────────────────────────────────────────────────────
    if (step === 'welcome') return (
      <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
        <div className="mb-6 text-jade animate-welcome-pop" style={{ animationDelay: '0.1s' }}>
          <Confetti size={80} weight="fill" />
        </div>
        {isAdmin ? (
          <>
            <p className="text-stone-500 text-base mb-2 animate-fade-up" style={{ animationDelay: '0.3s' }}>
              You created
            </p>
            <h1 className="text-3xl font-bold text-jade text-center mb-3 animate-fade-up" style={{ animationDelay: '0.4s' }}>
              {groupName || 'your group'}
            </h1>
            <div className="flex items-center gap-1.5 mb-8 animate-fade-up" style={{ animationDelay: '0.48s' }}>
              <ShieldCheck size={14} weight="fill" className="text-amber-500" />
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wide">You're the admin</p>
            </div>
            <p className="text-stone-400 text-sm max-w-xs mb-10 animate-fade-up" style={{ animationDelay: '0.52s' }}>
              Let's get your group set up. It only takes a minute.
            </p>
          </>
        ) : (
          <>
            <p className="text-stone-500 text-base mb-2 animate-fade-up" style={{ animationDelay: '0.3s' }}>
              You joined
            </p>
            <h1 className="text-3xl font-bold text-jade text-center mb-8 animate-fade-up" style={{ animationDelay: '0.4s' }}>
              {groupName || 'your group'}
            </h1>
            <p className="text-stone-400 text-sm max-w-xs mb-10 animate-fade-up" style={{ animationDelay: '0.52s' }}>
              Let's get you set up so your group knows who you are.
            </p>
          </>
        )}
        <button
          onClick={() => setStep('personalize')}
          className="px-8 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm animate-fade-up"
          style={{ animationDelay: '0.65s' }}
        >
          Let's go
        </button>
      </div>
    )

    // ── STEP: personalize ──────────────────────────────────────────────────────
    if (step === 'personalize') {
      return (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="w-full max-w-xs mx-auto px-6 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
            <h1 className="text-2xl font-bold text-stone-800 mb-1 animate-fade-up">Make it yours</h1>
            <p className="text-stone-400 text-sm mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
              Pick an avatar and add your birthday.
            </p>

            <div className="flex justify-center mb-5 animate-fade-up" style={{ animationDelay: '0.15s' }}>
              <AvatarCircle
                icon={avatarIcon}
                name={displayName}
                userId={userId}
                colorKey={colorKey}
                size="lg"
                imageUrl={avatarImageUrl}
              />
            </div>

            <div className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm mb-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <AvatarPicker
                userId={userId}
                currentIcon={avatarIcon}
                currentColor={colorKey}
                currentImageUrl={avatarImageUrl}
                onSave={({ icon, color, imageUrl }) => {
                  setAvatarIcon(icon)
                  setColorKey(color)
                  setAvatarImageUrl(imageUrl)
                  onAvatarChange?.({ icon, color, imageUrl })
                }}
                inline
              />
            </div>

            <div className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm mb-6 animate-fade-up" style={{ animationDelay: '0.28s' }}>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-1">Birthday</p>
              <p className="text-xs text-stone-400 mb-3">Your group will be reminded so they can celebrate you.</p>
              <div className="flex gap-2">
                <select
                  value={bdMonth}
                  onChange={e => setBdMonth(e.target.value)}
                  className="flex-1 text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-jade text-stone-700"
                >
                  <option value="">Month</option>
                  {MONTHS.map((m, i) => (
                    <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                  ))}
                </select>
                <select
                  value={bdDay}
                  onChange={e => setBdDay(e.target.value)}
                  className="w-24 text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-jade text-stone-700"
                >
                  <option value="">Day</option>
                  {DAYS.map(d => (
                    <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handlePersonalizeNext}
              className="w-full py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm"
            >
              Next
            </button>
          </div>
        </div>
      )
    }

    // ── STEP: features (admin only) ────────────────────────────────────────────
    if (step === 'features') return (
      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="w-full max-w-xs mx-auto px-6 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
          <h1 className="text-2xl font-bold text-stone-800 mb-1 animate-fade-up">Set up features</h1>
          <p className="text-stone-400 text-sm mb-6 animate-fade-up" style={{ animationDelay: '0.1s' }}>
            Turn on what your group needs. You can change these anytime in Admin settings.
          </p>

          <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden shadow-sm mb-6 animate-fade-up" style={{ animationDelay: '0.2s' }}>
            {FEATURE_TOGGLES.map(({ key, label, desc, Icon, color }, i) => (
              <div key={key}>
                <div className={`flex items-center gap-3 px-4 py-3.5 ${i < FEATURE_TOGGLES.length - 1 ? 'border-b border-stone-100' : ''}`}>
                  <Icon size={18} weight="fill" className={`${color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-stone-700">{label}</p>
                    <p className="text-xs text-stone-400">{desc}</p>
                  </div>
                  <button
                    onClick={() => setFeatures(f => ({ ...f, [key]: !f[key] }))}
                    className={`w-11 h-6 rounded-full transition-colors shrink-0 relative ${features[key] ? 'bg-jade' : 'bg-stone-200'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${features[key] ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </div>
                {key === 'guide_enabled' && features.guide_enabled && (
                  <p className="px-4 pb-3 text-xs text-stone-400">Set up your guide content from the Guide tab after setup.</p>
                )}
              </div>
            ))}
          </div>

          <button
            onClick={handleFeaturesNext}
            disabled={savingFeatures}
            className="w-full py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-40"
          >
            {savingFeatures ? 'Saving…' : 'Next'}
          </button>
        </div>
      </div>
    )

    // ── STEP: setup (admin only) ───────────────────────────────────────────────
    if (step === 'setup') {
      const showMeals    = features.meals_enabled
      const showServices = features.services_enabled
      return (
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="w-full max-w-xs mx-auto px-6 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
            <h1 className="text-2xl font-bold text-stone-800 mb-1 animate-fade-up">Set up your schedule</h1>
            <p className="text-stone-400 text-sm mb-6 animate-fade-up" style={{ animationDelay: '0.08s' }}>
              Tell us when your group meets so the rotation is ready from day one.
            </p>

            {showMeals && (
              <div className="mb-5 animate-fade-up" style={{ animationDelay: '0.15s' }}>
                <div className="flex items-center gap-2 mb-3">
                  <ForkKnife size={14} weight="fill" className="text-jade" />
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Meals</p>
                </div>
                <div className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm space-y-4">
                  <div>
                    <p className="text-xs text-stone-400 font-medium mb-2">Which day do you meet?</p>
                    <div className="flex bg-stone-100 rounded-xl p-1">
                      {DOW_LABELS.map((d, i) => {
                        const current = mealDow ?? []
                        const selected = current.includes(i)
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              const next = selected
                                ? current.length > 1 ? current.filter(x => x !== i) : current
                                : [...current, i].sort((a, b) => a - b)
                              setMealDow(next.length > 0 ? next : null)
                            }}
                            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                              selected ? 'bg-jade text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                            }`}
                          >
                            {d}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 font-medium mb-2">How often?</p>
                    <div className="flex bg-stone-100 rounded-xl p-1">
                      {[{ label: 'Weekly', value: 'weekly' }, { label: 'Biweekly', value: 'biweekly' }, { label: 'Custom', value: 'custom' }].map(({ label, value }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setMealFreqMode(value)}
                          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            mealFreqMode === value ? 'bg-jade text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {mealFreqMode === 'biweekly' && (
                    <div>
                      <p className="text-xs text-stone-400 font-medium mb-2">Which pattern?</p>
                      <div className="flex bg-stone-100 rounded-xl p-1">
                        {[{ label: '1st & 3rd', value: 'odd' }, { label: '2nd & 4th', value: 'even' }].map(({ label, value }) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setMealBiweeklyPat(value)}
                            className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                              mealBiweeklyPat === value ? 'bg-jade text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {mealFreqMode === 'custom' && (
                    <div>
                      <p className="text-xs text-stone-400 font-medium mb-2">Which weeks of the month?</p>
                      <div className="flex bg-stone-100 rounded-xl p-1">
                        {['1st', '2nd', '3rd', '4th', '5th'].map((label, idx) => {
                          const n = idx + 1
                          const selected = mealCustomWeeks.includes(n)
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setMealCustomWeeks(prev =>
                                prev.includes(n)
                                  ? prev.length > 1 ? prev.filter(x => x !== n) : prev
                                  : [...prev, n].sort((a, b) => a - b)
                              )}
                              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                selected ? 'bg-jade text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-stone-400 font-medium mb-2">Name your meals <span className="font-normal">(optional)</span></p>
                    <div className="space-y-2">
                      {mealNames.map((name, i) => (
                        <input
                          key={i}
                          type="text"
                          placeholder={`e.g. ${['Taco Night', 'Pasta Night', 'BBQ Night', 'Soup Night'][i] ?? 'Meal name'}`}
                          value={name}
                          onChange={e => setMealNames(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                          className="w-full text-sm bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-jade placeholder:text-stone-300"
                        />
                      ))}
                    </div>
                    {mealNames.length < 4 && (
                      <button
                        onClick={() => setMealNames(prev => [...prev, ''])}
                        className="mt-2 text-xs text-jade font-semibold"
                      >
                        + Add another meal
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showServices && (
              <div className="mb-6 animate-fade-up" style={{ animationDelay: showMeals ? '0.22s' : '0.15s' }}>
                <div className="flex items-center gap-2 mb-3">
                  <CalendarCheck size={14} weight="fill" className="text-lagoon-600" />
                  <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Service</p>
                </div>
                <div className="bg-white border border-stone-100 rounded-2xl p-4 shadow-sm space-y-4">
                  <div>
                    <p className="text-xs text-stone-400 font-medium mb-2">Auto-schedule monthly rotations?</p>
                    <div className="flex bg-stone-100 rounded-xl p-1">
                      {[{ label: 'Yes', val: true }, { label: 'No', val: false }].map(({ label, val }) => (
                        <button
                          key={String(val)}
                          onClick={() => setServiceAutofill(val)}
                          className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                            serviceAutofill === val ? 'bg-jade text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {serviceAutofill && (
                    <>
                      <div>
                        <p className="text-xs text-stone-400 font-medium mb-2">Which day does service meet?</p>
                        <div className="flex bg-stone-100 rounded-xl p-1">
                          {DOW_LABELS.map((d, i) => {
                            const current = serviceDow ?? []
                            const selected = current.includes(i)
                            return (
                              <button
                                key={i}
                                onClick={() => {
                                  const next = selected
                                    ? current.length > 1 ? current.filter(x => x !== i) : current
                                    : [...current, i].sort((a, b) => a - b)
                                  setServiceDow(next.length > 0 ? next : null)
                                }}
                                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                  selected ? 'bg-jade text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                                }`}
                              >
                                {d}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-stone-400 font-medium mb-2">How often?</p>
                        <div className="flex bg-stone-100 rounded-xl p-1">
                          {[{ label: 'Weekly', value: 'weekly' }, { label: 'Biweekly', value: 'biweekly' }, { label: 'Custom', value: 'custom' }].map(({ label, value }) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setServiceFreqMode(value)}
                              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                                serviceFreqMode === value ? 'bg-jade text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                              }`}
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                      </div>
                      {serviceFreqMode === 'biweekly' && (
                        <div>
                          <p className="text-xs text-stone-400 font-medium mb-2">Which pattern?</p>
                          <div className="flex bg-stone-100 rounded-xl p-1">
                            {[{ label: '1st & 3rd', value: 'odd' }, { label: '2nd & 4th', value: 'even' }].map(({ label, value }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setServiceBiweeklyPat(value)}
                                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                                  serviceBiweeklyPat === value ? 'bg-jade text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                                }`}
                              >
                                {label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {serviceFreqMode === 'custom' && (
                        <div>
                          <p className="text-xs text-stone-400 font-medium mb-2">Which weeks of the month?</p>
                          <div className="flex bg-stone-100 rounded-xl p-1">
                            {['1st', '2nd', '3rd', '4th', '5th'].map((label, idx) => {
                              const n = idx + 1
                              const selected = serviceCustomWeeks.includes(n)
                              return (
                                <button
                                  key={n}
                                  type="button"
                                  onClick={() => setServiceCustomWeeks(prev =>
                                    prev.includes(n)
                                      ? prev.length > 1 ? prev.filter(x => x !== n) : prev
                                      : [...prev, n].sort((a, b) => a - b)
                                  )}
                                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
                                    selected ? 'bg-jade text-white shadow-sm' : 'text-stone-500 hover:text-stone-700'
                                  }`}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}

            {!showMeals && !showServices && (
              <div className="bg-white border border-stone-100 rounded-2xl p-6 shadow-sm text-center mb-6 animate-fade-up" style={{ animationDelay: '0.15s' }}>
                <p className="text-stone-400 text-sm">No schedule to configure — you can always enable features later in Admin settings.</p>
              </div>
            )}

            <button
              onClick={handleSetupNext}
              disabled={savingSetup}
              className="w-full py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-40"
            >
              {savingSetup ? 'Saving…' : 'Next'}
            </button>
            <button
              onClick={() => setStep('invite')}
              className="w-full py-2.5 text-stone-400 text-sm mt-1"
            >
              Set up later
            </button>
          </div>
        </div>
      )
    }

    // ── STEP: invite (admin only) ──────────────────────────────────────────────
    if (step === 'invite') return (
      <div className="flex flex-col items-center justify-center flex-1 p-6 text-center">
        <div className="mb-5 text-jade animate-welcome-pop" style={{ animationDelay: '0.05s' }}>
          <Users size={64} weight="fill" />
        </div>
        <h1 className="text-2xl font-bold text-stone-800 mb-2 animate-fade-up" style={{ animationDelay: '0.15s' }}>
          Invite your members
        </h1>
        <p className="text-stone-400 text-sm max-w-xs mb-8 animate-fade-up" style={{ animationDelay: '0.25s' }}>
          Send your group an invite link — they can sign up with one tap, no code needed.
        </p>

        <div className="w-full max-w-xs animate-fade-up" style={{ animationDelay: '0.35s' }}>
          {!loadingCode && (
            <button
              onClick={shareCode}
              className="w-full py-3.5 bg-jade text-white text-sm font-semibold rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 mb-4"
            >
              <ShareNetwork size={16} weight="bold" />
              {codeCopied ? '✓ Copied!' : 'Share Invite Link'}
            </button>
          )}
          {loadingCode && (
            <div className="flex items-center justify-center mb-4 h-12">
              <span className="w-6 h-6 rounded-full border-2 border-jade border-t-transparent animate-spin" />
            </div>
          )}

          {!loadingCode && inviteCode && (
            <button
              onClick={copyCode}
              className="w-full py-2.5 text-xs text-stone-400 mb-4 active:text-stone-600 transition-colors"
            >
              Or copy the code manually: <span className="font-mono font-bold tracking-widest text-stone-500">{inviteCode}</span>
            </button>
          )}

          <button
            onClick={() => isStandalone ? close() : setStep('install')}
            className="w-full py-3.5 bg-stone-100 hover:bg-stone-200 active:scale-[0.98] text-stone-600 font-semibold rounded-xl transition-all text-sm"
          >
            {isStandalone ? 'Go to my group' : 'Continue →'}
          </button>
        </div>
      </div>
    )

    // ── STEP: tour (member only) ───────────────────────────────────────────────
    if (step === 'tour') {
      const isLastSlide = tourSlide === Math.max(0, visibleTourCards.length - 1)
      return (
        <div className="flex flex-col flex-1" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
          <div className="px-6 mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-stone-800 mb-1">What's in here</h1>
              <p className="text-stone-400 text-sm">Swipe to explore what your group can do.</p>
            </div>
            <button
              onClick={() => isStandalone ? close() : setStep('install')}
              className="text-stone-400 text-sm font-medium pt-1 shrink-0"
            >
              Skip
            </button>
          </div>

          <div
            className="flex-1 overflow-hidden px-6"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'pan-y' }}
          >
            <div
              className="flex h-full transition-transform duration-300 ease-in-out"
              style={{ transform: `translateX(calc(-${tourSlide * 100}% - ${tourSlide * 24}px))` }}
            >
              {visibleTourCards.map(({ Icon, color, title, desc }) => (
                <div key={title} className="w-full shrink-0 mr-6">
                  <div className="bg-white border border-stone-100 rounded-2xl p-8 shadow-sm h-full flex flex-col items-center justify-center text-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${color}`}>
                      <Icon size={32} weight="fill" />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-800 text-lg mb-2">{title}</h3>
                      <p className="text-stone-400 text-sm leading-relaxed max-w-[220px] mx-auto">{desc}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-6 flex flex-col items-center gap-4">
            <div className="flex gap-1.5">
              {visibleTourCards.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setTourSlide(i)}
                  className={`rounded-full transition-all duration-300 ${i === tourSlide ? 'w-5 h-2 bg-jade' : 'w-2 h-2 bg-stone-300'}`}
                />
              ))}
            </div>
            <button
              onClick={() => {
                if (!isLastSlide) { setTourSlide(s => s + 1); return }
                if (isStandalone) memberCta ? closeAndNavigate(memberCta.path, memberCta.state) : close()
                else setStep('install')
              }}
              className="w-full max-w-xs py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm"
            >
              {isLastSlide ? (isStandalone && memberCta ? memberCta.label : 'Got it') : 'Next'}
            </button>
          </div>
        </div>
      )
    }

    // ── STEP: install ──────────────────────────────────────────────────────────
    return (
      <div className="flex flex-col items-center justify-center flex-1 p-6 overflow-y-auto overscroll-contain">
        <div className="mb-6 text-jade animate-welcome-pop" style={{ animationDelay: '0.05s' }}>
          <DeviceMobile size={72} weight="fill" />
        </div>
        <h1 className="text-2xl font-bold text-stone-800 text-center mb-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          Save to your home screen
        </h1>
        <p className="text-stone-500 text-sm text-center max-w-xs mb-8 animate-fade-up" style={{ animationDelay: '0.32s' }}>
          Add this app to your home screen for quick access — no app store needed.
        </p>
        <div className="w-full max-w-xs animate-fade-up" style={{ animationDelay: '0.42s' }}>
          <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden divide-y divide-stone-100 shadow-sm mb-6">
            <div className="flex items-center gap-3 px-4 py-4">
              <BoxArrowUp size={22} className="shrink-0 text-jade" />
              <div>
                <p className="text-sm font-semibold text-stone-700">iPhone / iPad</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Open in <span className="font-medium">Safari</span>, tap <span className="font-medium">Share</span>, then <span className="font-medium">"Add to Home Screen"</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-4">
              <DotsThreeVertical size={22} className="shrink-0 text-jade" weight="bold" />
              <div>
                <p className="text-sm font-semibold text-stone-700">Android</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Tap the <span className="font-medium">browser menu</span>, then <span className="font-medium">"Add to Home Screen"</span>
                </p>
              </div>
            </div>
          </div>
          {'Notification' in window && 'PushManager' in window && (
            <div className="bg-white border border-stone-100 rounded-2xl shadow-sm mb-6 animate-fade-up" style={{ animationDelay: '0.52s' }}>
              <div className="flex items-center gap-3 px-4 py-4">
                <Bell size={22} className="shrink-0 text-jade" weight="fill" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-700">Chat Notifications</p>
                  <p className="text-xs text-stone-400 mt-0.5">Get notified when new messages arrive</p>
                </div>
                {notifPermission === 'granted' ? (
                  <span className="text-xs font-semibold text-jade shrink-0">On ✓</span>
                ) : notifPermission === 'denied' ? (
                  <span className="text-xs text-stone-400 shrink-0">Blocked</span>
                ) : (
                  <button
                    onClick={requestNotifPermission}
                    disabled={notifRequesting}
                    className="text-xs font-semibold text-white bg-jade px-3 py-1.5 rounded-lg shrink-0 hover:bg-jade-700 transition-colors disabled:opacity-40"
                  >
                    {notifRequesting ? '…' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          )}
          {!isAdmin && memberCta ? (
            <>
              <button
                onClick={() => closeAndNavigate(memberCta.path, memberCta.state)}
                className="w-full px-8 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm"
              >
                {memberCta.label}
              </button>
              <button
                onClick={close}
                className="w-full py-2.5 text-stone-400 text-sm mt-1"
              >
                Go to home
              </button>
            </>
          ) : (
            <button
              onClick={close}
              className="w-full px-8 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm"
            >
              {isAdmin ? 'Go to my group' : "I'm ready"}
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={`fixed inset-0 z-50 bg-sunrise-50 flex flex-col ${closing ? 'animate-overlay-out' : ''}`}>
      <ProgressDots steps={steps} currentStep={step} />
      {stepIdx > 0 && (
        <button
          onClick={onBack}
          className="absolute left-6 flex items-center gap-1.5 text-stone-400 hover:text-stone-600 transition-colors text-sm font-medium"
          style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
        >
          <ArrowLeft size={16} weight="bold" /> Back
        </button>
      )}
      <div key={step} className="animate-overlay-in flex flex-col flex-1 min-h-0">
        {renderStep()}
      </div>
    </div>
  )
}
