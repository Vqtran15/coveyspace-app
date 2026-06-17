import { useModalClose } from '../hooks/useModalClose.js'

const FLOATIES = [
  { emoji: '🎉', style: { top: '10%',  left:  '8%'  }, delay: '0.25s' },
  { emoji: '✨', style: { top: '12%',  right: '10%' }, delay: '0.4s'  },
  { emoji: '🙏', style: { bottom: '28%', left: '6%' }, delay: '0.55s' },
  { emoji: '❤️', style: { bottom: '24%', right: '8%'}, delay: '0.5s'  },
  { emoji: '🎂', style: { top: '38%',  right: '5%'  }, delay: '0.65s' },
]

export default function WelcomeSplash({ groupName, onDone }) {
  const [closing, close] = useModalClose(onDone)

  return (
    <div
      className={`fixed inset-0 bg-sunrise-50 flex flex-col items-center justify-center z-50 p-6 ${
        closing ? 'animate-overlay-out' : 'animate-overlay-in'
      }`}
    >
      {FLOATIES.map(({ emoji, style, delay }) => (
        <span
          key={emoji}
          className="absolute text-3xl animate-fade-up select-none pointer-events-none"
          style={{ ...style, animationDelay: delay }}
        >
          {emoji}
        </span>
      ))}

      <div
        className="text-7xl mb-6 animate-welcome-pop"
        style={{ animationDelay: '0.1s' }}
      >
        👋
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
        Let's go! 🙌
      </button>
    </div>
  )
}
