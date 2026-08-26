import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Confetti } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'

export default function GroupWelcomeBack({ name, onDone }) {
  const [exiting, setExiting] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const hold = setTimeout(() => setExiting(true), 1800)
    return () => clearTimeout(hold)
  }, [])

  useEffect(() => {
    if (!exiting) return
    navigate('/home')
    const exit = setTimeout(() => onDone?.(), 400)
    return () => clearTimeout(exit)
  }, [exiting, navigate, onDone])

  return createPortal(
    <div
      className={`fixed inset-0 z-[90] bg-sunrise-50 flex flex-col items-center justify-center p-6 text-center ${
        exiting ? 'animate-splash-out' : 'animate-slide-in-up'
      }`}
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mb-6 text-ember animate-welcome-pop" style={{ animationDelay: '0.1s' }}>
        <Confetti size={80} weight="fill" />
      </div>
      <p className="text-stone-500 text-base mb-2 animate-fade-up" style={{ animationDelay: '0.3s' }}>
        Welcome back to
      </p>
      <h1 className="text-3xl font-bold text-ember animate-fade-up" style={{ animationDelay: '0.4s' }}>
        {name}
      </h1>
    </div>,
    document.body
  )
}
