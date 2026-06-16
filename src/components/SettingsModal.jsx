import { GearSix, Pause, Play, Plus } from '@phosphor-icons/react'

export default function SettingsModal({ rotation, isPaused, onTogglePause, onAddPage, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-4">
          <div className="flex items-center gap-2">
            <GearSix size={20} weight="fill" className="text-jade" />
            <h2 className="text-lg font-bold text-stone-800">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        <div className="px-5 pb-6 space-y-2">
          {rotation && (
            <>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide pb-1">
                Rotation
              </p>
              <button
                onClick={onTogglePause}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 transition-all ${
                  isPaused
                    ? 'border-sage bg-sage-50 hover:bg-sage-50'
                    : 'border-stone-200 bg-white hover:border-stone-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isPaused ? 'bg-jade' : 'bg-stone-100'}`}>
                    {isPaused
                      ? <Play size={14} weight="fill" className="text-white" />
                      : <Pause size={14} weight="fill" className="text-stone-500" />}
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-stone-800">
                      {isPaused ? 'Resume rotation' : 'Pause rotation'}
                    </div>
                    <div className="text-xs text-stone-400 mt-0.5">
                      {isPaused
                        ? 'Pages will auto-advance again'
                        : 'Stop auto-advancing each week'}
                    </div>
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${isPaused ? 'bg-jade' : 'bg-stone-200'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${isPaused ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>

              <div className="pt-2" />
            </>
          )}

          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide pb-1">
            Pages
          </p>
          <button
            onClick={onAddPage}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 border-stone-200 bg-white hover:border-coral hover:bg-coral-light transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-coral-100 flex items-center justify-center">
                <Plus size={16} weight="bold" className="text-coral-700" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-stone-800">Add page</div>
                <div className="text-xs text-stone-400 mt-0.5">Create a new week's page</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
