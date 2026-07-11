import { X, MegaphoneSimple } from '@phosphor-icons/react'

export default function AnnouncementBanner({ announcement, closing = false, onDismiss }) {
  if (!announcement) return null
  return (
    <div className={`max-w-3xl mx-auto px-4 pt-4 ${closing ? 'animate-overlay-out' : 'animate-stack-in'}`}>
      <div className="relative overflow-hidden rounded-2xl bg-jade-50 border border-jade/30 shadow-sm px-5 py-4">
        <span className="absolute left-0 top-0 h-full w-1.5 bg-jade rounded-l-2xl" />
        <p className="text-xs font-bold text-jade uppercase tracking-wider mb-2 pl-3 flex items-center gap-1.5">
          <MegaphoneSimple size={12} weight="fill" />
          From the team
        </p>
        <div className="pl-3 flex items-start justify-between gap-3">
          <p className="text-sm text-stone-700 leading-snug flex-1 min-w-0">{announcement.message}</p>
          <button
            onClick={onDismiss}
            className="shrink-0 text-stone-400 hover:text-stone-600 transition-colors p-0.5 mt-0.5"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
