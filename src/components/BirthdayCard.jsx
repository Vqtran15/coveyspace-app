import { useEffect, useState } from 'react'
import { formatBirthdayDate } from '../utils/birthdays.js'

export default function BirthdayCard({ index, birthday, days, revealKey, onClick }) {
  const fromLeft = index % 2 === 0
  const [entering, setEntering] = useState(true)

  useEffect(() => {
    setEntering(true)
    const t = setTimeout(() => setEntering(false), 2600)
    return () => clearTimeout(t)
  }, [revealKey])

  return (
    <button
      onClick={onClick}
      style={entering ? { animationDelay: `${Math.min(index, 10) * 170}ms` } : undefined}
      className={`w-full text-left p-4 rounded-xl border-2 shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-jade ${
        days <= 14
          ? 'bg-coral-light border-coral-100 hover:border-coral'
          : days <= 30
          ? 'bg-lagoon-50 border-lagoon-200 hover:border-lagoon'
          : 'bg-white border-stone-200 hover:border-stone-300'
      } ${entering ? (fromLeft ? 'animate-card-slide-left' : 'animate-card-slide-right') : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-stone-800">{birthday.name}</div>
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
