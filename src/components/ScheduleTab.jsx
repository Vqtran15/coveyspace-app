import { useState, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { ForkKnife, HandHeart, ListBullets } from '@phosphor-icons/react'
import RotationTab from '../RotationTab.jsx'

export default function ScheduleTab({ mealsConfig, servicesConfig, groupName, displayName, onOpenSettings, isAdmin }) {
  const location = useLocation()
  const [segment, setSegment] = useState(location.state?.segment ?? 'meals')
  const [animClass, setAnimClass] = useState('animate-slide-in-right')
  const switchingRef = useRef(false)
  const rotationRef = useRef(null)

  function switchTo(newSeg) {
    if (newSeg === segment || switchingRef.current) return
    switchingRef.current = true
    const goRight = newSeg === 'services'
    // Apply exit animation, then swap segment so RotationTab remounts with entry animation
    setAnimClass(goRight ? 'animate-slide-out-left' : 'animate-slide-out-right')
    setTimeout(() => {
      setSegment(newSeg)
      setAnimClass(goRight ? 'animate-slide-in-right' : 'animate-slide-in-left')
      switchingRef.current = false
    }, 180)
  }

  return (
    <div>
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-3">
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
      </div>

      <div className={animClass}>
        <RotationTab
          key={segment}
          ref={rotationRef}
          config={segment === 'meals' ? mealsConfig : servicesConfig}
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
