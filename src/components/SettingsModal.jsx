import { GearSix, ListBullets } from '@phosphor-icons/react'
import { useModalClose } from '../hooks/useModalClose.js'

export default function SettingsModal({ onManagePages, onClose }) {
  const [closing, close] = useModalClose(onClose)

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-4">
          <div className="flex items-center gap-2">
            <GearSix size={20} weight="fill" className="text-jade" />
            <h2 className="text-lg font-bold text-stone-800">Settings</h2>
          </div>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100"
          >
            &times;
          </button>
        </div>

        <div className="px-5 pb-6 space-y-2">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide pb-1">
            Pages
          </p>
          <button
            onClick={onManagePages}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border-2 border-stone-200 bg-white hover:border-jade hover:bg-lagoon-50 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-lagoon-50 flex items-center justify-center">
                <ListBullets size={16} weight="bold" className="text-lagoon-700" />
              </div>
              <div className="text-left">
                <div className="text-sm font-semibold text-stone-800">Manage pages</div>
                <div className="text-xs text-stone-400 mt-0.5">Add, view, and reorder pages</div>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
