import { useState, useEffect } from 'react'
import { NotePencil, X } from '@phosphor-icons/react'
import { useModalClose } from '../hooks/useModalClose.js'
import { supabase } from '../lib/supabase.js'

export default function NotesModal({ groupId, onClose }) {
  const [closing, close] = useModalClose(onClose)
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase
      .from('community_groups')
      .select('notes')
      .eq('id', groupId)
      .single()
      .then(({ data }) => {
        setContent(data?.notes ?? '')
        setLoading(false)
      })
  }, [])

  async function handleSave() {
    setSaving(true)
    await supabase.rpc('update_group_notes', { p_notes: content })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div
      className={`fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4 ${closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
      onClick={close}
    >
      <div
        className={`bg-white rounded-2xl shadow-xl w-full max-w-sm ${closing ? 'animate-modal-out' : 'animate-modal-in'}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <NotePencil size={20} weight="fill" className="text-jade" />
              <h2 className="text-lg font-bold text-stone-800">Public Notes</h2>
            </div>
            <p className="text-xs text-stone-400 mt-0.5 ml-7">Shared with all group members</p>
          </div>
          <button
            onClick={close}
            className="text-stone-400 hover:text-stone-600 w-8 h-8 flex items-center justify-center rounded-full hover:bg-stone-100 transition-colors"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="px-5 pb-6">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={loading ? 'Loading…' : 'Write notes for your group…'}
            disabled={loading}
            rows={8}
            className="w-full border border-stone-200 rounded-xl px-4 py-3 text-sm text-stone-800 placeholder:text-stone-400 resize-none focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent disabled:opacity-40"
          />
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="mt-3 w-full py-2.5 bg-jade hover:bg-jade-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-40 text-sm"
          >
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Notes'}
          </button>
        </div>
      </div>
    </div>
  )
}
