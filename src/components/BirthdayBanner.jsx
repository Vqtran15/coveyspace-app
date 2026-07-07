import { Cake } from '@phosphor-icons/react'

export default function BirthdayBanner({ upcoming }) {
  if (!upcoming.length) return null

  const multi   = upcoming.length > 1
  const maxDays = multi ? Math.max(...upcoming.map(b => b.daysUntil)) : 0
  const single  = upcoming[0]

  function singleName(b) {
    const p = (b.name ?? '').trim().split(' ').filter(Boolean)
    return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0] ?? ''
  }

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4 animate-stack-in">
      <div className="relative overflow-hidden rounded-2xl bg-jade-50 border border-jade/30 shadow-sm px-5 py-4">
        <span className="absolute left-0 top-0 h-full w-1.5 bg-jade rounded-l-2xl" />
        <p className="text-xs font-bold text-jade uppercase tracking-wider mb-2 pl-3">
          Upcoming {multi ? 'Birthdays' : 'Birthday'}
        </p>
        <div className="pl-3">
          {multi ? (
            <p className="font-semibold text-stone-800 flex items-center gap-1.5">
              <Cake size={16} weight="fill" className="text-jade shrink-0" />
              {maxDays === 0
                ? 'Multiple birthdays today!'
                : `Multiple birthdays coming up in less than ${maxDays} days!`}
            </p>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <span className="font-semibold text-stone-800 truncate flex items-center gap-1.5">
                <Cake size={16} weight="fill" className="text-jade shrink-0" />
                {singleName(single)}
              </span>
              <span className={`text-sm font-medium shrink-0 ${single.daysUntil === 0 ? 'text-jade' : 'text-stone-500'}`}>
                {single.daysUntil === 0 ? 'Today!' : single.daysUntil === 1 ? 'Tomorrow' : `in ${single.daysUntil} days`}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
