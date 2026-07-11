import { HandsPraying, X } from '@phosphor-icons/react'

export default function PrayerReactionBanner({ reactorName, closing = false, onDismiss, onTap }) {
  return (
    <div className={`max-w-3xl mx-auto px-4 pt-4 ${closing ? 'animate-overlay-out' : 'animate-stack-in'}`}>
      <div
        className="relative overflow-hidden rounded-2xl bg-sunrise/10 border border-sunrise/30 shadow-sm px-5 py-4 cursor-pointer active:opacity-80 transition-opacity"
        onClick={onTap}
      >
        <span className="absolute left-0 top-0 h-full w-1.5 bg-sunrise rounded-l-2xl" />
        <div className="pl-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <HandsPraying size={16} weight="fill" className="text-sunrise shrink-0" />
            <p className="text-sm font-semibold text-stone-800 truncate">
              {reactorName} prayed for you
            </p>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onDismiss() }}
            className="shrink-0 text-stone-400 hover:text-stone-600 transition-colors p-0.5"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
