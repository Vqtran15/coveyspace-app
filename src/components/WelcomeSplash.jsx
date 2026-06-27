import {
  Confetti, Lightbulb, BoxArrowUp, DotsThreeVertical,
  DeviceMobile, GearSix, UserCircle, Bell, Key, Users, Crown, ArrowLeft, Link, Database,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useModalClose } from '../hooks/useModalClose.js'

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

function FeatureRow({ icon, label, desc }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium text-stone-700">{label}</p>
        {desc && <p className="text-xs text-stone-400 mt-0.5">{desc}</p>}
      </div>
    </div>
  )
}

export default function WelcomeSplash({ groupName, onDone, isAdmin, groupSettings, onSeedGroup }) {
  const [closing, close] = useModalClose(onDone)
  const [iconClass, setIconClass] = useState('animate-welcome-pop')
  const [step, setStep] = useState('welcome')
  const [seeding, setSeeding] = useState(false)
  const [inviteCode, setInviteCode] = useState(null)
  const [codeCopied, setCodeCopied] = useState(false)

  const steps = useRef(
    isAdmin && !groupSettings?.sample_seeded
      ? ['welcome', 'sample', 'guide', 'install']
      : ['welcome', 'guide', 'install']
  ).current

  const showSeedStep = isAdmin && !groupSettings?.sample_seeded

  useEffect(() => {
    const t = setTimeout(() => setIconClass('animate-icon-wiggle'), 750)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (!isAdmin || step !== 'guide') return
    supabase.rpc('get_invite_code').then(({ data }) => setInviteCode(data ?? null))
  }, [isAdmin, step])

  async function handleSeed() {
    setSeeding(true)
    try {
      await onSeedGroup()
      window.dispatchEvent(new CustomEvent('cg-sample-data-changed'))
      setStep('guide')
    } finally {
      setSeeding(false)
    }
  }

  function copyCode() {
    if (!inviteCode) return
    navigator.clipboard.writeText(inviteCode)
      .then(() => { setCodeCopied(true); setTimeout(() => setCodeCopied(false), 2000) })
      .catch(() => {})
  }

  if (step === 'sample') {
    return (
      <div className="fixed inset-0 bg-sunrise-50 flex flex-col items-center justify-center z-50 p-6 animate-overlay-in">
        <ProgressDots steps={steps} currentStep="sample" />
        <button
          onClick={() => setStep('welcome')}
          className="absolute left-6 flex items-center gap-1.5 text-stone-400 hover:text-stone-600 transition-colors text-sm font-medium"
          style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
        >
          <ArrowLeft size={16} weight="bold" />
          Back
        </button>
        <div className="mb-6 text-jade animate-welcome-pop" style={{ animationDelay: '0.05s' }}>
          <Lightbulb size={72} weight="fill" />
        </div>
        <h1 className="text-2xl font-bold text-stone-800 text-center mb-3 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          Want to see it in action?
        </h1>
        <p className="text-stone-500 text-sm text-center max-w-xs mb-8 animate-fade-up" style={{ animationDelay: '0.32s' }}>
          Load sample data to explore meals, service signups, and birthdays. You can clear it anytime from Settings.
        </p>
        <div className="w-full max-w-xs flex flex-col gap-3 animate-fade-up" style={{ animationDelay: '0.42s' }}>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="w-full px-8 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm disabled:opacity-60"
          >
            {seeding ? 'Loading...' : 'Load sample data'}
          </button>
          <button
            onClick={() => setStep('guide')}
            className="w-full px-8 py-3 text-stone-500 hover:text-stone-700 font-medium text-sm transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    )
  }

  if (step === 'guide') {
    return (
      <div className="fixed inset-0 bg-sunrise-50 z-50 animate-overlay-in overflow-y-auto">
        <ProgressDots steps={steps} currentStep="guide" />
        <div className="w-full max-w-xs mx-auto px-6 pb-10" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 48px)' }}>
          <button
            onClick={() => setStep(isAdmin && showSeedStep ? 'sample' : 'welcome')}
            className="flex items-center gap-1.5 text-stone-400 hover:text-stone-600 transition-colors text-sm font-medium mb-6"
          >
            <ArrowLeft size={16} weight="bold" />
            Back
          </button>

          <div className="mb-5 text-jade animate-welcome-pop" style={{ animationDelay: '0.05s' }}>
            <GearSix size={64} weight="fill" />
          </div>
          <h1 className="text-2xl font-bold text-stone-800 mb-2 animate-fade-up" style={{ animationDelay: '0.15s' }}>
            Your Settings
          </h1>
          <p className="text-stone-500 text-sm mb-6 animate-fade-up" style={{ animationDelay: '0.25s' }}>
            Tap your avatar in the top right of the home screen to open Settings.
          </p>

          <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden shadow-sm mb-4 animate-fade-up" style={{ animationDelay: '0.35s' }}>
            <div className="px-4 py-2.5 border-b border-stone-100">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide">Everyone</p>
            </div>
            <div className="divide-y divide-stone-100">
              <FeatureRow icon={<UserCircle size={18} weight="fill" className="text-jade" />} label="Edit your name and avatar" />
              <FeatureRow icon={<Bell size={18} weight="fill" className="text-jade" />} label="Toggle chat notifications" desc="Available after saving to home screen" />
              <FeatureRow icon={<Key size={18} weight="fill" className="text-jade" />} label="Change your password" />
            </div>
          </div>

          {isAdmin && (
            <div className="bg-white border border-stone-100 rounded-2xl overflow-hidden shadow-sm mb-6 animate-fade-up" style={{ animationDelay: '0.45s' }}>
              <div className="px-4 py-2.5 border-b border-stone-100 flex items-center gap-1.5">
                <Crown size={12} weight="fill" className="text-amber-500" />
                <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wide">Admin only</p>
              </div>
              <div className="divide-y divide-stone-100">
                <FeatureRow
                  icon={<Users size={18} weight="fill" className="text-coral" />}
                  label="Invite code"
                  desc="Share with new members to join your group"
                />
                <FeatureRow
                  icon={<Users size={18} weight="fill" className="text-coral" />}
                  label="Member management"
                  desc="Promote to admin or remove members"
                />
                <FeatureRow
                  icon={<GearSix size={18} weight="fill" className="text-coral" />}
                  label="Meal & service schedules"
                  desc="Set day of week and frequency"
                />
                <FeatureRow
                  icon={<Link size={18} weight="fill" className="text-coral" />}
                  label="Guide link"
                  desc="Customize the community guide URL"
                />
                <FeatureRow
                  icon={<Database size={18} weight="fill" className="text-coral" />}
                  label="Sample data"
                  desc="Load or clear sample meals, service, and birthdays"
                />
              </div>
              {inviteCode && (
                <div className="px-4 py-3 border-t border-stone-100 bg-stone-50">
                  <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">Your invite code</p>
                  <div className="flex items-center gap-3 bg-white border border-stone-200 rounded-xl px-3 py-2.5">
                    <span className="font-mono font-bold text-lg tracking-widest text-stone-800 flex-1">{inviteCode}</span>
                    <button
                      onClick={copyCode}
                      className="text-xs font-semibold text-jade shrink-0 px-2 py-1 rounded-lg hover:bg-jade/10 transition-colors"
                    >
                      {codeCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs text-stone-400 mt-1.5">Share this with people you want to invite.</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => setStep('install')}
            className="w-full px-8 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm animate-fade-up"
            style={{ animationDelay: '0.55s' }}
          >
            Next
          </button>
        </div>
      </div>
    )
  }

  if (step === 'install') {
    return (
      <div className={`fixed inset-0 bg-sunrise-50 flex flex-col items-center justify-center z-50 p-6 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}>
        <ProgressDots steps={steps} currentStep="install" />
        <button
          onClick={() => setStep('guide')}
          className="absolute left-6 flex items-center gap-1.5 text-stone-400 hover:text-stone-600 transition-colors text-sm font-medium"
          style={{ top: 'calc(env(safe-area-inset-top) + 16px)' }}
        >
          <ArrowLeft size={16} weight="bold" />
          Back
        </button>
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
                  Tap the <span className="font-medium">Share</span> button, then{' '}
                  <span className="font-medium">"Add to Home Screen"</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-4">
              <DotsThreeVertical size={22} className="shrink-0 text-jade" weight="bold" />
              <div>
                <p className="text-sm font-semibold text-stone-700">Android</p>
                <p className="text-xs text-stone-400 mt-0.5">
                  Tap the <span className="font-medium">browser menu</span>, then{' '}
                  <span className="font-medium">"Add to Home Screen"</span>
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={close}
            className="w-full px-8 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm"
          >
            Got it!
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`fixed inset-0 bg-sunrise-50 flex flex-col items-center justify-center z-50 p-6 ${
        closing ? 'animate-overlay-out' : 'animate-overlay-in'
      }`}
    >
      <ProgressDots steps={steps} currentStep="welcome" />
      <div
        className={`mb-6 text-jade ${iconClass}`}
        style={iconClass === 'animate-welcome-pop' ? { animationDelay: '0.1s' } : undefined}
      >
        <Confetti size={80} weight="fill" />
      </div>
      <p className="text-stone-500 text-base mb-2 animate-fade-up" style={{ animationDelay: '0.3s' }}>
        Welcome to your Covey Space!
      </p>
      <h1 className="text-3xl font-bold text-jade text-center mb-8 animate-fade-up" style={{ animationDelay: '0.4s' }}>
        {groupName || "Let's get started"}
      </h1>
      <p className="text-stone-400 text-sm text-center max-w-xs mb-10 animate-fade-up" style={{ animationDelay: '0.52s' }}>
        Chat with your group, sign up for meals and service, and celebrate each other's birthdays.
      </p>
      <button
        onClick={() => !isAdmin ? setStep('guide') : showSeedStep ? setStep('sample') : setStep('guide')}
        className="px-8 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm animate-fade-up"
        style={{ animationDelay: '0.65s' }}
      >
        Next
      </button>
    </div>
  )
}
