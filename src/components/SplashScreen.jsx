import { useRef } from 'react'

export default function SplashScreen({ exiting }) {
  // Freeze the vertical center at the initial viewport height so the content
  // doesn't drift as iOS expands window.innerHeight during the launch animation.
  const centerY = useRef(Math.round(window.innerHeight / 2))

  return (
    <div className={`fixed inset-0 z-[200] bg-sunrise-50 ${exiting ? 'animate-splash-out' : ''}`}>
      <div
        className="absolute left-0 right-0 flex flex-col items-center gap-5"
        style={{ top: centerY.current, transform: 'translateY(-50%)' }}
      >
        <img
          src="/icons/icon-192.png"
          alt=""
          className="w-24 h-24 rounded-[22px] shadow-md animate-welcome-pop"
        />
        <p
          className="text-2xl font-bold text-stone-800 tracking-tight animate-fade-up"
          style={{ animationDelay: '180ms' }}
        >
          Coveyspace
        </p>
      </div>
    </div>
  )
}
