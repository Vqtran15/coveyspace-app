import { useState, useRef, useEffect } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { ListBullets } from '@phosphor-icons/react'
import RotationTab from './RotationTab.jsx'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { mealCutoffDate, toDateString } from '../utils/dates.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function ScheduleTab({ mealsConfig, servicesConfig, refreshKey = 0 }) {
  const { groupName, displayName, isAdmin, groupSettings } = useAppContext()
  const location = useLocation()
  const mealsEnabled    = groupSettings?.meals_enabled !== false
  const servicesEnabled = groupSettings?.services_enabled !== false

  // If navigation state specifies a segment (e.g. tapping a home card), use it immediately.
  // If only one tab is enabled, use it immediately.
  // If both are enabled, start null and determine from DB which has the earliest non-paused page.
  const navSegment = location.state?.segment
  const initialSegment = navSegment
    ?? (!mealsEnabled ? 'services' : !servicesEnabled ? 'meals' : null)
  const [segment, setSegment] = useState(initialSegment)
  useEffect(() => {
    // Only needed when both tabs are enabled and no navigation hint was given
    if (segment !== null) return
    const mealsCutoff   = mealCutoffDate()
    const servicesToday = toDateString(new Date())
    Promise.all([
      supabase.from('meal_pages').select('id, week_date, is_paused, slot_count').gte('week_date', mealsCutoff).order('week_date').limit(10),
      supabase.from('serving_pages').select('id, week_date, is_paused, slot_count').gte('week_date', servicesToday).order('week_date').limit(10),
    ]).then(async ([{ data: mealPages }, { data: servicePages }]) => {
      const nextMeal    = (mealPages ?? []).find(p => !p.is_paused)
      const nextService = (servicePages ?? []).find(p => !p.is_paused)

      if (!nextMeal && !nextService) { setSegment('meals'); return }
      if (!nextMeal)    { setSegment('services'); return }
      if (!nextService) { setSegment('meals'); return }

      if (nextMeal.week_date < nextService.week_date) { setSegment('meals'); return }
      if (nextService.week_date < nextMeal.week_date) { setSegment('services'); return }

      // Tie — same date. Pick whichever has fewer sign-ups filled.
      const [{ count: mealCount }, { count: serviceCount }] = await Promise.all([
        supabase.from('signups').select('id', { count: 'exact', head: true }).eq('meal_page_id', nextMeal.id),
        supabase.from('serving_signups').select('id', { count: 'exact', head: true }).eq('meal_page_id', nextService.id),
      ])
      setSegment((serviceCount ?? 0) < (mealCount ?? 0) ? 'services' : 'meals')
    }).catch(() => setSegment('meals'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
            <div className="w-3 h-3 rounded-full border-2 border-ember border-t-transparent" style={{ opacity: pullDistance / threshold }} />
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 pt-8 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-stone-800">Sign Up</h1>
          <button
            onClick={() => rotationRef.current?.openManagePages()}
            aria-label="Manage pages"
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-ember transition-colors"
          >
            <ListBullets size={20} weight="regular" />
          </button>
        </div>
        {mealsEnabled && servicesEnabled && (
          <LayoutGroup id="schedule-tabs">
            <div className="flex bg-stone-100 rounded-xl p-1">
              <button
                onClick={() => switchTo('meals')}
                className={`flex-1 relative flex items-center justify-center py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  segment === 'meals' ? 'text-white' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {segment === 'meals' && (
                  <motion.span
                    layoutId="schedule-pill"
                    className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Meals</span>
              </button>
              <button
                onClick={() => switchTo('services')}
                className={`flex-1 relative flex items-center justify-center py-2.5 rounded-lg font-semibold text-sm transition-colors ${
                  segment === 'services' ? 'text-white' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                {segment === 'services' && (
                  <motion.span
                    layoutId="schedule-pill"
                    className="absolute inset-0 bg-ember rounded-lg shadow-sm"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span className="relative z-10">Service</span>
              </button>
            </div>
          </LayoutGroup>
        )}
      </div>

      {segment && <div className={animClass}>
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
          isAdmin={isAdmin}
          compact
        />
      </div>}
    </div>
  )
}
