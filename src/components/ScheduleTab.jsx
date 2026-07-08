import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { ForkKnife, HandHeart, ListBullets } from '@phosphor-icons/react'
import RotationTab from '../RotationTab.jsx'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { mealCutoffDate } from '../utils/dates.js'

export default function ScheduleTab({ mealsConfig, servicesConfig, groupName, displayName, onOpenSettings, isAdmin, groupSettings, refreshKey = 0 }) {
  const location = useLocation()
  const mealsEnabled    = groupSettings?.meals_enabled !== false
  const servicesEnabled = groupSettings?.services_enabled !== false
  const defaultSegment  = location.state?.segment ?? (mealsEnabled ? 'meals' : 'services')
  const [segment, setSegment] = useState(defaultSegment)
  const [animClass, setAnimClass] = useState('animate-slide-in-right')
  const [localRefreshKey, setLocalRefreshKey] = useState(0)
  const switchingRef = useRef(false)
  const rotationRef = useRef(null)

  const { pullDistance, refreshing, threshold } = usePullToRefresh(
    () => setLocalRefreshKey(k => k + 1)
  )

  function switchTo(newSeg) {
    if (newSeg === segment || switchingRef.current) return
    switchingRef.current = true
    const goRight = newSeg === 'services'
    setAnimClass(goRight ? 'animate-slide-out-left' : 'animate-slide-out-right')
    setTimeout(() => {
      setSegment(newSeg)
      setAnimClass(goRight ? 'animate-slide-in-right' : 'animate-slide-in-left')
      switchingRef.current = false
    }, 180)
  }

  return (
    <div>
      {pullDistance > 0 && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center transition-transform"
          style={{ top: 'calc(env(safe-area-inset-top) + 8px)', transform: `translateY(${Math.min(pullDistance, threshold) * 0.6}px)` }}
        >
          <div className={`w-8 h-8 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            <div className="w-3 h-3 rounded-full border-2 border-jade border-t-transparent" style={{ opacity: pullDistance / threshold }} />
          </div>
        </div>
      )}

      <div className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-stone-800">Sign Up</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => rotationRef.current?.jumpToToday()}
              className="px-3 py-1.5 rounded-xl text-sm font-medium bg-stone-100 text-stone-600 hover:bg-stone-200 active:bg-stone-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={() => rotationRef.current?.openPages()}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 active:bg-stone-200 transition-colors"
            >
              <ListBullets size={20} weight="regular" />
            </button>
          </div>
        </div>
        {mealsEnabled && servicesEnabled && (
          <div className="flex gap-2">
            <button
              onClick={() => switchTo('meals')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all ${
                segment === 'meals'
                  ? 'bg-jade text-white shadow-sm'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              <ForkKnife size={17} weight="fill" />
              Meals
            </button>
            <button
              onClick={() => switchTo('services')}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl font-semibold text-sm transition-all ${
                segment === 'services'
                  ? 'bg-jade text-white shadow-sm'
                  : 'bg-stone-100 text-stone-500'
              }`}
            >
              <HandHeart size={17} weight="fill" />
              Service
            </button>
          </div>
        )}
      </div>

      <div className={animClass}>
        <RotationTab
          key={`${segment}-${refreshKey}-${localRefreshKey}`}
          ref={rotationRef}
          config={segment === 'meals'
            ? { ...mealsConfig, intervalDays: groupSettings?.meal_interval_days ?? 7, targetDow: groupSettings?.meal_day_of_week ?? null, weekOccurrences: groupSettings?.meal_week_occurrences ?? null }
            : { ...servicesConfig, autoFill: groupSettings?.service_autofill ?? false, intervalDays: groupSettings?.service_interval_days ?? 28, targetDow: groupSettings?.service_day_of_week ?? null, weekOccurrences: groupSettings?.service_week_occurrences ?? null }
          }
          cutoffDate={segment === 'meals' ? mealCutoffDate() : undefined}
          revealKey={segment}
          groupName={groupName}
          displayName={displayName}
          onOpenSettings={onOpenSettings}
          isAdmin={isAdmin}
          compact
        />
      </div>
    </div>
  )
}
