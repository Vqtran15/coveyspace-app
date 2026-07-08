import { Cake, X } from '@phosphor-icons/react'
import { trackEvent } from '../lib/analytics.js'

export default function BirthdayBanner({ upcoming, closing = false, onDismiss, onTap }) {
  if (!upcoming.length) return null

  const multi   = upcoming.length > 1
  const maxDays = multi ? Math.max(...upcoming.map(b => b.daysUntil)) : 0
  const single  = upcoming[0]

  function singleName(b) {
    const p = (b.name ?? '').trim().split(' ').filter(Boolean)
    return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] ?? ''
  }

  return (
    <div className={`max-w-3xl mx-auto px-4 pt-4 ${closing ? 'animate-overlay-out' : 'animate-stack-in'}`}>
      <div
        className="relative overflow-hidden rounded-2xl bg-jade-50 border border-jade/30 shadow-sm px-5 py-4 cursor-pointer active:opacity-80 transition-opacity"
        onClick={() => { trackEvent('birthday_banner_tapped'); onTap?.() }}
      >
        <span className="absolute left-0 top-0 h-full w-1.5 bg-jade rounded-l-2xl" />
        <p className="text-xs font-bold text-jade uppercase tracking-wider mb-2 pl-3">
          Upcoming {multi ? 'Birthdays' : 'Birthday'}
        </p>
        <div className="pl-3 flex items-center justify-between gap-3">
          {multi ? (
            <p className="font-semibold text-stone-800 flex items-center gap-1.5 min-w-0 truncate">
              <Cake size={16} weight="fill" className="text-jade shrink-0" />
              {maxDays === 0
                ? `${upcoming.length} birthdays today!`
                : `${upcoming.length} Birthdays to celebrate soon!`}
            </p>
          ) : (
            <div className="flex items-center justify-between gap-4 flex-1 min-w-0">
              <span className="font-semibold text-stone-800 truncate flex items-center gap-1.5">
                <Cake size={16} weight="fill" className="text-jade shrink-0" />
                {singleName(single)}
              </span>
              <span className={`text-sm font-medium shrink-0 ${single.daysUntil === 0 ? 'text-jade' : 'text-stone-500'}`}>
                {single.daysUntil === 0 ? 'Today!' : single.daysUntil === 1 ? 'Tomorrow' : `in ${single.daysUntil} days`}
              </span>
            </div>
          )}
          <button
            onClick={e => { e.stopPropagation(); trackEvent('birthday_banner_dismissed'); onDismiss?.() }}
            className="shrink-0 text-stone-400 hover:text-stone-600 transition-colors p-0.5"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
