import { createContext, useContext, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, XCircle, Info } from '@phosphor-icons/react'

const ToastContext = createContext(null)

const ICONS = {
  success: <CheckCircle size={16} weight="fill" className="shrink-0" />,
  error:   <XCircle    size={16} weight="fill" className="shrink-0" />,
  info:    <Info       size={16} weight="fill" className="shrink-0" />,
}

const STYLES = {
  success: 'bg-jade text-white',
  error:   'bg-red-500 text-white',
  info:    'bg-stone-800 text-white',
}

function ToastItem({ toast, onRemove }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.94 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium max-w-sm w-full ${STYLES[toast.type]}`}
    >
      {ICONS[toast.type]}
      <span className="flex-1 leading-snug">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        <X size={14} weight="bold" />
      </button>
    </motion.div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={addToast}>
      {children}
      <div
        className="fixed inset-x-0 flex flex-col items-center gap-2 z-[200] px-4 pointer-events-none"
        style={{ top: 'calc(env(safe-area-inset-top) + 12px)' }}
      >
        <AnimatePresence>
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto w-full max-w-sm">
              <ToastItem toast={t} onRemove={removeToast} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
