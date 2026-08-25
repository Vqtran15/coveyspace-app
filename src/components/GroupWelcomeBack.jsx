import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { UsersThree } from '@phosphor-icons/react'

export default function GroupWelcomeBack({ name, onDone }) {
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    const hold = setTimeout(() => setExiting(true), 1600)
    return () => clearTimeout(hold)
  }, [])

  useEffect(() => {
    if (!exiting) return
    const exit = setTimeout(() => onDone?.(), 400)
    return () => clearTimeout(exit)
  }, [exiting, onDone])

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] bg-sunrise-50 flex flex-col items-center justify-center gap-3 ${
        exiting ? 'animate-splash-out' : 'animate-slide-in-up'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="animate-welcome-pop">
        <div className="w-24 h-24 rounded-2xl bg-ember/10 flex items-center justify-center">
          <UsersThree size={48} weight="duotone" className="text-ember" />
        </div>
      </div>
      <div className="text-center px-8 animate-fade-up" style={{ animationDelay: '0.12s' }}>
        <p className="text-stone-500 text-base">Welcome back to</p>
        <p className="text-2xl font-bold text-stone-800 mt-0.5">{name}</p>
      </div>
    </div>,
    document.body
  )
}
