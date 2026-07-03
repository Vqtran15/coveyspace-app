export default function SplashScreen({ exiting }) {
  return (
    <div className={`fixed inset-0 z-[200] bg-sunrise-50 flex flex-col items-center justify-center gap-5 ${exiting ? 'animate-splash-out' : ''}`}>
      <img
        src="/icons/icon-192.png"
        alt=""
        className="w-24 h-24 rounded-[22px] shadow-md animate-welcome-pop"
      />
      <p
        className="text-2xl font-bold text-stone-800 tracking-tight animate-fade-up"
        style={{ animationDelay: '180ms' }}
      >
        Covey Space
      </p>
    </div>
  )
}
