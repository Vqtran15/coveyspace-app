import { useRegisterSW } from 'virtual:pwa-register/react'

export default function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  if (!needRefresh) return null

  return (
    <div
      className="fixed inset-x-0 z-50 flex justify-center px-4 animate-toast-in"
      style={{ bottom: 'calc(env(safe-area-inset-bottom) + 62px)' }}
    >
      <div className="flex items-center gap-3 bg-stone-800 text-white text-sm font-medium pl-4 pr-2 py-2.5 rounded-xl shadow-lg">
        <span>New version available</span>
        <button
          onClick={() => updateServiceWorker(true)}
          className="bg-white text-stone-800 rounded-lg px-3 py-1.5 text-xs font-semibold shrink-0"
        >
          Reload
        </button>
      </div>
    </div>
  )
}
