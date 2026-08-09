import { Cake, ArrowLeft } from '@phosphor-icons/react'
import { daysUntilNext } from '../utils/birthdays.js'
import BirthdayCard from './BirthdayCard.jsx'

export default function BirthdayTab({ birthdays, revealKey, onClose }) {
  const sorted = [...birthdays].sort((a, b) => daysUntilNext(a.birthday) - daysUntilNext(b.birthday))

  return (
    // Bounded scroll container: height comes from the parent fixed overlay (inset-0
    // minus paddingTop: var(--sat)). overscroll-behavior: none prevents iOS elastic
    // bounce that can lock touch events and freeze the nav bar.
    <div className="h-full overflow-y-auto" style={{ overscrollBehaviorY: 'none', paddingTop: 'var(--sat)' }}>
      <main className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-32 lg:pb-12">
        <div className="mb-6">
          <div className="flex items-center gap-1 min-w-0">
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Back"
                className="w-11 h-11 flex items-center justify-center -ml-2 rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
              >
                <ArrowLeft size={20} weight="bold" />
              </button>
            )}
            <h1 className="text-3xl font-bold text-stone-800">Birthdays</h1>
          </div>
          <p className="text-stone-500 mt-1 text-sm">
            {birthdays.length === 0
              ? 'No birthdays yet'
              : `${birthdays.length} birthday${birthdays.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center py-16">
            <div className="flex justify-center mb-3"><Cake size={40} weight="fill" className="text-stone-300" /></div>
            <p className="text-sm text-stone-500">Birthdays appear here once members add them to their profile.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((b, i) => (
              <BirthdayCard
                key={b.id}
                index={i}
                birthday={b}
                days={daysUntilNext(b.birthday)}
                revealKey={revealKey}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
