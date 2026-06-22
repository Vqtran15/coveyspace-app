import { BookOpen, ArrowSquareOut, ArrowLeft } from '@phosphor-icons/react'

export default function GuideTab({ onClose }) {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-8 pb-12">
      <div className="flex items-center justify-end mb-8">
        {onClose && (
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
        )}
      </div>
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-jade flex items-center justify-center mb-5">
          <BookOpen size={44} weight="fill" className="text-white" />
        </div>
        <h1 className="text-3xl font-bold text-stone-800 mb-2">Guide</h1>
        <p className="text-stone-500 text-sm mb-8 max-w-xs">
          Read the latest guide posts from Bridgetown Church.
        </p>
        <button
          onClick={() => window.open('https://bridgetown.church/guideblog', '_blank', 'noopener,noreferrer')}
          className="flex items-center gap-2 px-6 py-3 bg-jade hover:bg-jade-700 active:bg-jade-800 text-white font-medium rounded-xl transition-colors"
        >
          Open Guide
          <ArrowSquareOut size={18} weight="bold" />
        </button>
      </div>
    </div>
  )
}
