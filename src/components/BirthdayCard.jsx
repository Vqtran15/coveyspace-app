import { Cake } from '@phosphor-icons/react'
import { formatBirthdayDate } from '../utils/birthdays.js'
import { useEntranceAnimation } from '../hooks/useEntranceAnimation.js'

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

export default function BirthdayCard({ index, birthday, days, revealKey, onClick }) {
  const { className: entranceClass, style: entranceStyle } = useEntranceAnimation(revealKey, index)

  return (
    <button
      onClick={onClick}
      style={entranceStyle}
      className={`relative overflow-hidden w-full text-left p-4 rounded-xl border-2 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-jade ${
        days <= 14
          ? 'bg-coral-light border-coral-100 hover:border-coral'
          : days <= 30
          ? 'bg-lagoon-50 border-lagoon-200 hover:border-lagoon'
          : 'bg-white border-stone-200 hover:border-stone-300'
      } ${entranceClass}`}
    >
      {days <= 30 && <ConfettiDots />}
      <div className="relative flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 font-semibold text-stone-800">
            {birthday.name}
            {days <= 7 && <Cake size={15} weight="fill" className={days === 0 ? 'text-jade' : 'text-coral'} />}
          </div>
          <div className="text-sm text-stone-500 mt-0.5">{formatBirthdayDate(birthday.birthday)}</div>
        </div>
        {days === 0 ? (
          <span className="text-xs font-medium bg-jade text-white px-2.5 py-1 rounded-full shrink-0">
            Today! 🎉
          </span>
        ) : days <= 14 ? (
          <span className="text-xs font-medium bg-coral-100 text-coral-700 px-2.5 py-1 rounded-full shrink-0">
            in {days} day{days !== 1 ? 's' : ''}
          </span>
        ) : days <= 30 ? (
          <span className="text-xs font-medium bg-lagoon-100 text-jade px-2.5 py-1 rounded-full shrink-0">
            in {days} days
          </span>
        ) : (
          <span className="text-xs text-stone-400 shrink-0">
            in {days} days
          </span>
        )}
      </div>
    </button>
  )
}
