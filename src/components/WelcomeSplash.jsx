import { Confetti } from '@phosphor-icons/react'
import { useEffect, useState } from 'react'
import { useModalClose } from '../hooks/useModalClose.js'

export default function WelcomeSplash({ groupName, onDone }) {
  const [closing, close] = useModalClose(onDone)
  const [iconClass, setIconClass] = useState('animate-welcome-pop')

  useEffect(() => {
    // Switch to looping wiggle after the pop finishes (100ms delay + 600ms duration)
    const t = setTimeout(() => setIconClass('animate-icon-wiggle'), 750)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={`fixed inset-0 bg-sunrise-50 flex flex-col items-center justify-center z-50 p-6 ${
        closing ? 'animate-overlay-out' : 'animate-overlay-in'
      }`}
    >
      <div
        className={`mb-6 text-jade ${iconClass}`}
        style={iconClass === 'animate-welcome-pop' ? { animationDelay: '0.1s' } : undefined}
      >
        <Confetti size={80} weight="fill" />
      </div>

      <p
        className="text-stone-500 text-base mb-2 animate-fade-up"
        style={{ animationDelay: '0.3s' }}
      >
        Welcome to your community group!
      </p>
      <h1
        className="text-3xl font-bold text-jade text-center mb-8 animate-fade-up"
        style={{ animationDelay: '0.4s' }}
      >
        {groupName || 'Let’s get started'}
      </h1>
      <p
        className="text-stone-400 text-sm text-center max-w-xs mb-10 animate-fade-up"
        style={{ animationDelay: '0.52s' }}
      >
        Chat with your group, sign up for meals and service, and celebrate each other's birthdays.
      </p>

      <button
        onClick={close}
        className="px-8 py-3.5 bg-jade hover:bg-jade-700 active:scale-[0.98] text-white font-semibold rounded-xl transition-all text-sm animate-fade-up"
        style={{ animationDelay: '0.65s' }}
      >
        Join my group!
      </button>
    </div>
  )
}
