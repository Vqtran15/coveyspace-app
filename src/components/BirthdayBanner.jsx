import { Cake } from '@phosphor-icons/react'

export default function BirthdayBanner({ upcoming }) {
  if (!upcoming.length) return null

  return (
    <div className="max-w-3xl mx-auto px-4 pt-4">
      <div className="relative overflow-hidden rounded-2xl bg-jade-50 border border-jade/30 shadow-sm px-5 py-4">
        <span className="absolute left-0 top-0 h-full w-1.5 bg-jade rounded-l-2xl" />
        <div className="pl-3 flex items-start gap-3">
          <Cake size={24} weight="fill" className="text-jade shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-jade uppercase tracking-wider mb-2.5">
              Upcoming {upcoming.length === 1 ? 'Birthday' : 'Birthdays'}
            </p>
            <div className="space-y-2">
              {upcoming.map(b => (
                <div key={b.id} className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-stone-800 truncate">{b.name}</span>
                  <span className={`text-sm font-medium shrink-0 ${
                    b.daysUntil === 0 ? 'text-jade' : 'text-stone-500'
                  }`}>
                    {b.daysUntil === 0
                      ? 'Today! 🎉'
                      : b.daysUntil === 1
                      ? 'Tomorrow'
                      : `in ${b.daysUntil} days`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
