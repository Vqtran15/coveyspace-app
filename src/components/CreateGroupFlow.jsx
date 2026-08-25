import { useState } from 'react'
import { ArrowLeft, UsersThree, ChatCircleDots, ForkKnife, HandsPraying, Cake, CalendarCheck, Link, CalendarHeart, BookOpen, Coins } from '@phosphor-icons/react'
import { createPortal } from 'react-dom'
import { db } from '../lib/db.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { useToast } from '../lib/toast.jsx'

const FEATURE_TOGGLES = [
  { key: 'chat_enabled',      label: 'Group Chat',        desc: 'Group and direct messages',       Icon: ChatCircleDots, color: 'text-sage-700',    bg: 'bg-sage/20'    },
  { key: 'prayer_enabled',    label: 'Prayer Requests',   desc: 'Member prayer profiles',          Icon: HandsPraying,   color: 'text-sunrise',     bg: 'bg-sunrise/10' },
  { key: 'birthdays_enabled', label: 'Birthdays',         desc: 'Home screen birthday reminders',  Icon: Cake,           color: 'text-coral',       bg: 'bg-coral/10'   },
  { key: 'meals_enabled',     label: 'Meal Sign-ups',     desc: 'Weekly rotating meal signups',    Icon: ForkKnife,      color: 'text-ember',       bg: 'bg-ember/10'   },
  { key: 'services_enabled',  label: 'Service Schedules', desc: 'Monthly service signups',         Icon: CalendarCheck,  color: 'text-lagoon-600',  bg: 'bg-lagoon/10'  },
  { key: 'events_enabled',    label: 'Events',            desc: 'One-off events with RSVP',        Icon: CalendarHeart,  color: 'text-amber-500',   bg: 'bg-amber-50'   },
  { key: 'guide_enabled',     label: 'Community Guide',   desc: 'PDF, link, or written notes',     Icon: Link,           color: 'text-ember',       bg: 'bg-ember/10'   },
  { key: 'bible_enabled',     label: 'Bible',             desc: 'Bible reader with verse search',  Icon: BookOpen,       color: 'text-ember',       bg: 'bg-ember/10'   },
  { key: 'giving_enabled',    label: 'Giving',            desc: 'Monthly tithing/giving link',     Icon: Coins,          color: 'text-amber-600',   bg: 'bg-amber-50'   },
]

const DEFAULT_FEATURES = {
  chat_enabled:      true,
  prayer_enabled:    true,
  birthdays_enabled: true,
  meals_enabled:     true,
  services_enabled:  true,
  events_enabled:    true,
  guide_enabled:     true,
  bible_enabled:     true,
  giving_enabled:    true,
}

export default function CreateGroupFlow({ onDone, onClose }) {
  const { refreshMemberships, refreshProfile } = useAppContext()
  const toast = useToast()

  const [step, setStep]         = useState('name')   // 'name' | 'features'
  const [direction, setDirection] = useState(null)   // null | 'forward' | 'back'
  const [closing, setClosing]   = useState(false)
  const [groupName, setGroupName] = useState('')
  const [features, setFeatures] = useState({ ...DEFAULT_FEATURES })
  const [creating, setCreating] = useState(false)

  function toggleFeature(key) {
    setFeatures(prev => ({ ...prev, [key]: !prev[key] }))
  }

  async function handleCreate() {
    if (creating) return
    setCreating(true)
    const { data, error } = await db.groupMemberships.createGroup(groupName.trim(), features)
    if (error) {
      toast(
        error.message === 'group name cannot be empty'
          ? 'Please enter a group name.'
          : 'Failed to create group. Please try again.',
        'error'
      )
      setCreating(false)
      return
    }
    await Promise.all([refreshProfile(), refreshMemberships()])
    toast(`"${data.group_name}" created!`, 'success')
    sessionStorage.setItem('cg_created_from_settings', '1')
    sessionStorage.setItem('cg_settings_create_features', JSON.stringify(features))
    onDone?.()
  }

  function goBack() {
    if (step === 'features') {
      setDirection('back')
      setStep('name')
    } else {
      setClosing(true)
      setTimeout(() => onClose?.(), 250)
    }
  }

  const content = (
    <div
      className={`fixed inset-0 z-[70] bg-sunrise-50 flex flex-col ${closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Progress dots */}
      <div
        className="absolute left-0 right-0 flex justify-center gap-1.5 pointer-events-none z-10"
        style={{ top: 'calc(env(safe-area-inset-top) + 14px)' }}
      >
        {['name', 'features'].map((s, i) => {
          const idx = step === 'name' ? 0 : 1
          return (
            <div
              key={s}
              className={`rounded-full transition-all duration-300 ${
                i === idx ? 'w-5 h-2 bg-ember' : i < idx ? 'w-2 h-2 bg-ember/40' : 'w-2 h-2 bg-stone-200'
              }`}
            />
          )
        })}
      </div>

      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 mt-4">
        <button
          onClick={goBack}
          className="w-10 h-10 flex items-center justify-center rounded-xl text-stone-600 hover:bg-stone-100 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={22} weight="bold" />
        </button>
        <h2 className="text-xl font-bold text-stone-800">
          {step === 'name' ? 'Create a Group' : 'Choose Features'}
        </h2>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
        <div key={step} className={direction === 'back' ? 'animate-slide-in-left' : direction === 'forward' ? 'animate-slide-in-right' : ''}>

        {/* ── Step 1: Group name ─────────────────────────────────────────── */}
        {step === 'name' && (
          <div className="max-w-md mx-auto pt-6 space-y-6">
            <div className="flex justify-center">
              <div className="w-20 h-20 rounded-2xl bg-ember/10 flex items-center justify-center">
                <UsersThree size={40} weight="duotone" className="text-ember" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-stone-500 text-sm">Give your group a name. You'll be the admin and can invite members once it's created.</p>
            </div>
            <div>
              <input
                type="text"
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && groupName.trim().length >= 2) { setDirection('forward'); setStep('features') } }}
                placeholder="e.g. West Linn Community Group"
                maxLength={60}
                autoFocus
                className="w-full border border-stone-200 rounded-xl px-4 py-3.5 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent"
              />
              <p className="text-xs text-stone-400 mt-1.5 text-right">{groupName.length}/60</p>
            </div>
            <button
              onClick={() => { setDirection('forward'); setStep('features') }}
              disabled={groupName.trim().length < 2}
              className="w-full py-3.5 rounded-xl bg-ember text-white text-sm font-semibold hover:bg-ember-700 transition-colors disabled:opacity-40"
            >
              Continue
            </button>
          </div>
        )}

        {/* ── Step 2: Feature toggles ────────────────────────────────────── */}
        {step === 'features' && (
          <div className="max-w-md mx-auto pt-4 space-y-4">
            <p className="text-sm text-stone-500">Choose which features to enable for <span className="font-semibold text-stone-700">"{groupName}"</span>. You can change these any time in Admin settings.</p>

            <div className="bg-white border border-stone-100 rounded-2xl shadow-sm overflow-hidden">
              {FEATURE_TOGGLES.map(({ key, label, desc, Icon, color, bg }, i) => {
                const enabled = features[key]
                return (
                  <button
                    key={key}
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    aria-label={label}
                    onClick={() => toggleFeature(key)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                      i < FEATURE_TOGGLES.length - 1 ? 'border-b border-stone-100' : ''
                    } ${enabled ? 'bg-white' : 'bg-stone-50/50'}`}
                  >
                    <div className={`w-8 h-8 rounded-xl ${enabled ? bg : 'bg-stone-100'} flex items-center justify-center shrink-0 transition-colors`}>
                      <Icon size={16} weight="fill" className={enabled ? color : 'text-stone-300'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium transition-colors ${enabled ? 'text-stone-800' : 'text-stone-400'}`}>{label}</p>
                      <p className={`text-xs transition-colors ${enabled ? 'text-stone-400' : 'text-stone-300'}`}>{desc}</p>
                    </div>
                    {/* Toggle pill */}
                    <div className={`relative shrink-0 w-11 h-6 rounded-full border-2 border-transparent transition-colors ${enabled ? 'bg-ember' : 'bg-stone-200'}`}>
                      <span className={`absolute top-0 left-0 w-5 h-5 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </div>
                  </button>
                )
              })}
            </div>

            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-3.5 rounded-xl bg-ember text-white text-sm font-semibold hover:bg-ember-700 transition-colors disabled:opacity-50"
            >
              {creating ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  Creating…
                </span>
              ) : 'Create Group'}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  )

  return createPortal(content, document.body)
}
