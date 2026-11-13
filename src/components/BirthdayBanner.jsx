import { Cake, X } from '@phosphor-icons/react'
import { trackEvent } from '../lib/analytics.js'

export default function BirthdayBanner({ upcoming, closing = false, onDismiss, onTap }) {
  if (!upcoming.length) return null

  const multi      = upcoming.length > 1
  const todayOnes  = upcoming.filter(b => b.daysUntil === 0)
  const hasToday   = todayOnes.length > 0
  const single     = upcoming[0]

  function singleName(b) {
    const p = (b.name ?? '').trim().split(' ').filter(Boolean)
    return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] ?? ''
  }

  const label = hasToday
    ? (todayOnes.length > 1 ? 'Birthdays Today' : 'Birthday Today')
    : (multi ? 'Upcoming Birthdays' : 'Upcoming Birthday')

  return (
    <div className={`w-full max-w-3xl mx-auto px-4 pt-3 ${closing ? 'animate-overlay-out' : 'animate-stack-in'}`}>
      <div
        className="rounded-2xl bg-ember-50 border border-ember/30 shadow px-4 py-2.5 cursor-pointer active:opacity-80 transition-opacity"
        onClick={() => { trackEvent('birthday_banner_tapped'); onTap?.() }}
      >
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-xs font-bold text-ember uppercase tracking-wider">
            {label}
          </p>
          <button
            onClick={e => { e.stopPropagation(); trackEvent('birthday_banner_dismissed'); onDismiss?.() }}
            aria-label="Dismiss birthday banner"
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-600 transition-colors -mr-1 -mt-0.5"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
        {multi ? (
          <p className="text-sm font-semibold text-stone-800 flex items-center gap-1.5 min-w-0 truncate">
            <Cake size={15} weight="fill" className="text-ember shrink-0" />
            {hasToday
              ? todayOnes.length > 1
                ? `${todayOnes.length} birthdays today!`
                : `${singleName(todayOnes[0])}'s birthday is today!`
              : `${upcoming.length} birthdays coming up soon!`}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-4 min-w-0">
            <span className="text-sm font-semibold text-stone-800 truncate flex items-center gap-1.5">
              <Cake size={15} weight="fill" className="text-ember shrink-0" />
              {singleName(single)}
            </span>
            <span className={`text-sm font-medium shrink-0 ${single.daysUntil === 0 ? 'text-ember' : 'text-stone-500'}`}>
              {single.daysUntil === 0 ? 'Today!' : single.daysUntil === 1 ? 'Tomorrow' : `in ${single.daysUntil} days`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
