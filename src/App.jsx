import { useState, useEffect, useRef } from 'react'
import { ForkKnife, HandHeart, Confetti } from '@phosphor-icons/react'
import { formatDate } from './utils/dates.js'
import { getUpcomingBirthdays } from './utils/birthdays.js'
import { supabase } from './lib/supabase.js'
import RotationTab from './RotationTab.jsx'
import BirthdayTab from './components/BirthdayTab.jsx'
import BirthdayBanner from './components/BirthdayBanner.jsx'

const TABS = [
  {
    id: 'meal',
    label: 'Meal Rotation',
    shortLabel: 'Meals',
    Icon: ForkKnife,
    config: {
      label: 'Meal Rotation',
      Icon: ForkKnife,
      editLabel: 'Edit Meal',
      noun: 'Ingredient',
      itemNoun: 'Ingredient',
      tables: { pages: 'meal_pages', signups: 'signups', settings: 'app_settings' },
      defaultTitle: dateStr => `Meal — ${formatDate(dateStr)}`,
    },
  },
  {
    id: 'serving',
    label: 'Service Night',
    shortLabel: 'Service',
    Icon: HandHeart,
    config: {
      label: 'Service Night',
      Icon: HandHeart,
      editLabel: 'Edit Items',
      noun: 'Item',
      itemNoun: 'Item',
      tables: { pages: 'serving_pages', signups: 'serving_signups', settings: 'serving_settings' },
      defaultTitle: dateStr => `Service Night — ${formatDate(dateStr)}`,
      rotation: false,
    },
  },
  {
    id: 'birthdays',
    label: 'Birthdays',
    shortLabel: 'Birthdays',
    Icon: Confetti,
  },
]

const TAB_ORDER = TABS.map(t => t.id)

export default function App() {
  const [activeTab, setActiveTab] = useState('meal')
  const [enterFrom, setEnterFrom] = useState('right')
  const prevIndexRef = useRef(TAB_ORDER.indexOf('meal'))
  const [birthdays, setBirthdays] = useState([])

  useEffect(() => {
    supabase.from('birthdays').select('*').then(({ data }) => setBirthdays(data ?? []))

    const channel = supabase
      .channel('birthdays-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'birthdays' },
        ({ eventType, new: next, old: prev }) => {
          if (eventType === 'INSERT') {
            setBirthdays(b => b.some(r => r.id === next.id) ? b : [...b, next])
          } else if (eventType === 'UPDATE') {
            setBirthdays(b => b.map(r => r.id === next.id ? next : r))
          } else if (eventType === 'DELETE') {
            setBirthdays(b => b.filter(r => r.id !== prev.id))
          }
        },
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [])

  const upcoming = getUpcomingBirthdays(birthdays)
  const tab = TABS.find(t => t.id === activeTab)

  function handleTabChange(id) {
    const newIndex = TAB_ORDER.indexOf(id)
    setEnterFrom(newIndex > prevIndexRef.current ? 'right' : 'left')
    prevIndexRef.current = newIndex
    setActiveTab(id)
  }

  return (
    <div className="min-h-screen bg-sunrise-50" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <BirthdayBanner upcoming={upcoming} />

      <div
        key={activeTab}
        className={`pb-24 ${enterFrom === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
      >
        {activeTab === 'birthdays' ? (
          <BirthdayTab birthdays={birthdays} onBirthdaysChange={setBirthdays} />
        ) : (
          <RotationTab config={tab.config} />
        )}
      </div>

      <nav
        className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 z-40 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTabChange(t.id)}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 transition-colors ${
              activeTab === t.id ? '' : 'text-stone-400 hover:text-stone-600'
            }`}
          >
            <span className={`relative px-3 py-1 rounded-2xl transition-colors ${activeTab === t.id ? 'bg-jade text-white' : ''}`}>
              <t.Icon
                size={26}
                weight={activeTab === t.id ? 'fill' : 'regular'}
              />
              {t.id === 'birthdays' && upcoming.length > 0 && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-lagoon rounded-full border-2 border-white" />
              )}
            </span>
            <span className={`text-[10px] font-medium tracking-wide ${activeTab === t.id ? 'text-jade' : ''}`}>{t.shortLabel}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
