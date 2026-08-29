import { useState, useRef, useEffect } from 'react'
import { motion, LayoutGroup } from 'framer-motion'
import { useLocation } from 'react-router-dom'
import { ListBullets, ArrowsClockwise } from '@phosphor-icons/react'
import RotationTab from './RotationTab.jsx'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'
import { mealCutoffDate, toDateString } from '../utils/dates.js'
import { useAppContext } from '../contexts/AppContext.jsx'
import { supabase } from '../lib/supabase.js'

export default function ScheduleTab({ mealsConfig, servicesConfig }) {
  const { groupName, displayName, isAdmin, groupSettings } = useAppContext()
  const location = useLocation()
  const mealsEnabled    = groupSettings?.meals_enabled !== false
  const servicesEnabled = groupSettings?.services_enabled !== false
  const bothEnabled     = mealsEnabled && servicesEnabled

  // Resolve configs once to avoid duplication
  const mealConfigResolved = {
    ...mealsConfig,
    intervalDays:    groupSettings?.meal_interval_days ?? 7,
    targetDow:       groupSettings?.meal_day_of_week ?? null,
    weekOccurrences: groupSettings?.meal_week_occurrences ?? null,
  }
  const serviceConfigResolved = {
    ...servicesConfig,
    autoFill:        groupSettings?.service_autofill ?? false,
    intervalDays:    groupSettings?.service_interval_days ?? 28,
    targetDow:       groupSettings?.service_day_of_week ?? null,
    weekOccurrences: groupSettings?.service_week_occurrences ?? null,
  }

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

      if (!nextMeal && !nextService) { setSegment(p => p ?? 'meals'); return }
      if (!nextMeal)    { setSegment(p => p ?? 'services'); return }
      if (!nextService) { setSegment(p => p ?? 'meals'); return }

      if (nextMeal.week_date < nextService.week_date) { setSegment(p => p ?? 'meals'); return }
      if (nextService.week_date < nextMeal.week_date) { setSegment(p => p ?? 'services'); return }

      // Tie — same date. Pick whichever has fewer sign-ups filled.
      const [{ count: mealCount }, { count: serviceCount }] = await Promise.all([
        supabase.from('signups').select('id', { count: 'exact', head: true }).eq('meal_page_id', nextMeal.id),
        supabase.from('serving_signups').select('id', { count: 'exact', head: true }).eq('meal_page_id', nextService.id),
      ])
      setSegment(p => p ?? ((serviceCount ?? 0) < (mealCount ?? 0) ? 'services' : 'meals'))
    }).catch(() => setSegment(p => p ?? 'meals'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia('(min-width: 1024px)').matches
  )
  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)')
    const handler = (e) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const [animClass, setAnimClass] = useState('animate-slide-in-right')
  const [localRefreshKey, setLocalRefreshKey] = useState(0)
  const switchingRef     = useRef(false)
  const rotationRef      = useRef(null)
  const mealDesktopRef   = useRef(null)
  const serviceDesktopRef = useRef(null)

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
          className="fixed inset-x-0 lg:left-56 z-30 flex justify-center transition-transform"
          style={{ top: 'calc(env(safe-area-inset-top) + 8px)', transform: `translateY(${Math.min(pullDistance, threshold) * 0.6}px)` }}
        >
          <div className="w-8 h-8 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center">
            <ArrowsClockwise
              size={16}
              weight="bold"
              className={`text-ember ${refreshing ? 'animate-spin' : ''}`}
              style={{
                opacity: Math.min(pullDistance / threshold, 1),
                transform: refreshing ? undefined : `rotate(${(pullDistance / threshold) * 270}deg)`,
              }}
            />
          </div>
        </div>
      )}

      {/* Header — manage button hidden on desktop when both panels are shown (each has its own) */}
      <div className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-3">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold text-stone-800">Sign Up</h1>
          <button
            onClick={() => rotationRef.current?.openManagePages()}
            aria-label="Manage pages"
            className={`w-11 h-11 flex items-center justify-center rounded-xl bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-ember transition-colors ${bothEnabled ? 'lg:hidden' : ''}`}
          >
            <ListBullets size={20} weight="regular" />
          </button>
        </div>
        {/* Segment switcher — mobile only when both enabled */}
        {bothEnabled && segment && (
          <div className={bothEnabled ? 'lg:hidden' : ''}>
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
          </div>
        )}
      </div>

      {/* Single panel: mobile always, desktop only when not showing both side-by-side */}
      {segment && (!bothEnabled || !isDesktop) && (
        <div className={animClass}>
          <RotationTab
            key={`${segment}-${localRefreshKey}`}
            ref={rotationRef}
            config={segment === 'meals' ? mealConfigResolved : serviceConfigResolved}
            cutoffDate={segment === 'meals' ? mealCutoffDate() : undefined}
            revealKey={segment}
            groupName={groupName}
            displayName={displayName}
            isAdmin={isAdmin}
            compact
          />
        </div>
      )}

      {/* Desktop: side-by-side panels when both are enabled */}
      {bothEnabled && isDesktop && (
        <div className="lg:grid lg:grid-cols-2 lg:gap-6 max-w-5xl mx-auto px-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-3 px-1">Meals</p>
            <RotationTab
              key={`meals-desktop-${localRefreshKey}`}
              ref={mealDesktopRef}
              config={mealConfigResolved}
              cutoffDate={mealCutoffDate()}
              revealKey="meals"
              groupName={groupName}
              displayName={displayName}
              isAdmin={isAdmin}
              compact
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-stone-400 mb-3 px-1">Service</p>
            <RotationTab
              key={`services-desktop-${localRefreshKey}`}
              ref={serviceDesktopRef}
              config={serviceConfigResolved}
              revealKey="services"
              groupName={groupName}
              displayName={displayName}
              isAdmin={isAdmin}
              compact
            />
          </div>
        </div>
      )}
    </div>
  )
}
