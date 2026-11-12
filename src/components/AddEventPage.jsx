import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from '@phosphor-icons/react'
import { useAppContext } from '../contexts/AppContext.jsx'
import { useToast } from '../lib/toast.jsx'
import { db } from '../lib/db.js'
import { haptic } from '../lib/haptic.js'

function today() {
  return new Date().toISOString().split('T')[0]
}

const inputCls = 'w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent bg-white'
const labelCls = 'block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1.5'

export default function AddEventPage() {
  const navigate = useNavigate()
  const { groupId, userId } = useAppContext()
  const toast = useToast()

  const [title,       setTitle]       = useState('')
  const [date,        setDate]        = useState(today())
  const [time,        setTime]        = useState('')
  const [location,    setLocation]    = useState('')
  const [description, setDescription] = useState('')
  const [saving,      setSaving]      = useState(false)

  async function handleSave() {
    if (!title.trim() || !date) return
    setSaving(true)
    try {
      const { error } = await db.events.insert({
        community_group_id: groupId,
        created_by: userId,
        title:       title.trim(),
        event_date:  date,
        event_time:  time || null,
        location:    location.trim() || null,
        description: description.trim() || null,
      })
      if (error) { toast('Failed to create event', 'error'); return }
      haptic()
      navigate('/events', { replace: true })
    } catch {
      toast('Failed to create event', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-sunrise-50">
      <div className="max-w-md mx-auto px-4 pt-8 pb-12">

        {/* Header */}
        <div className="flex items-center gap-1 min-w-0 -ml-2 mb-6">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-3xl font-bold text-stone-800">New Event</h1>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-stone-100 shadow p-5 flex flex-col gap-5">

          <div>
            <label className={labelCls}>
              Title <span className="text-coral normal-case font-normal tracking-normal">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Event name"
              autoFocus
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              Date <span className="text-coral normal-case font-normal tracking-normal">*</span>
            </label>
            <div className="overflow-hidden rounded-xl border border-stone-200 focus-within:ring-2 focus-within:ring-ember">
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', display: 'block' }}
                className="px-4 py-3 text-sm text-stone-800 focus:outline-none bg-white"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Time <span className="text-stone-400 normal-case font-normal tracking-normal">optional</span>
            </label>
            <div className="overflow-hidden rounded-xl border border-stone-200 focus-within:ring-2 focus-within:ring-ember">
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={{ width: '100%', boxSizing: 'border-box', display: 'block' }}
                className="px-4 py-3 text-sm text-stone-800 focus:outline-none bg-white"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>
              Location <span className="text-stone-400 normal-case font-normal tracking-normal">optional</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Where is it?"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>
              Description <span className="text-stone-400 normal-case font-normal tracking-normal">optional</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Any details to share…"
              rows={4}
              className="w-full px-4 py-3 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-ember focus:border-transparent resize-none bg-white"
            />
          </div>

        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={!title.trim() || !date || saving}
          className="mt-4 w-full py-3.5 rounded-xl bg-ember text-white font-semibold text-sm hover:bg-ember-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saving ? 'Creating…' : 'Create Event'}
        </button>

      </div>
    </div>
  )
}
