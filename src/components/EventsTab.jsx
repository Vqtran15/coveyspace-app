import { useState, useEffect, useRef } from 'react'
import { CalendarStar, Plus, CaretDown, CaretUp, MapPin, CheckCircle, Minus, X as XIcon, DotsThreeVertical, ArrowLeft, PencilSimple, Trash, GearSix } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase.js'
import { useToast } from '../lib/toast.jsx'
import { haptic } from '../lib/haptic.js'
import { AvatarCircle, AvatarIcon, avatarColor } from '../lib/avatarIcons.jsx'
import { usePullToRefresh } from '../hooks/usePullToRefresh.js'

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAYS_FULL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function today() {
  return new Date().toISOString().split('T')[0]
}

function formatDateBadge(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return { month: MONTHS[d.getMonth()], day: d.getDate() }
}

function formatDateFull(dateStr, timeStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const dow = DAYS_FULL[d.getDay()]
  const mon = MONTHS[d.getMonth()]
  const day = d.getDate()
  const year = d.getFullYear()
  if (!timeStr) return `${dow}, ${mon} ${day}, ${year}`
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  const mins = m === 0 ? '' : `:${String(m).padStart(2, '0')}`
  return `${dow}, ${mon} ${day}, ${year} at ${hour12}${mins} ${suffix}`
}

function formatDateShort(dateStr, timeStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const mon = MONTHS[d.getMonth()]
  const day = d.getDate()
  if (!timeStr) return `${mon} ${day}`
  const [h, m] = timeStr.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour12 = h % 12 || 12
  const mins = m === 0 ? '' : `:${String(m).padStart(2, '0')}`
  return `${mon} ${day} · ${hour12}${mins} ${suffix}`
}

function GoingAvatars({ rsvps }) {
  const going = (rsvps ?? []).filter(r => r.status === 'going')
  if (!going.length) return null
  const MAX = 6
  const shown = going.slice(0, MAX)
  const extra = going.length - MAX
  return (
    <div className="flex items-center">
      {shown.map((r, i) => (
        <div
          key={r.user_id}
          className={`w-7 h-7 rounded-full border-2 border-white shrink-0 overflow-hidden ${r.profile?.avatar_image_url ? 'bg-stone-200' : `${avatarColor(r.user_id, r.profile?.avatar_color)} flex items-center justify-center`}`}
          style={{ marginLeft: i === 0 ? 0 : -8, zIndex: shown.length - i }}
          title={r.profile?.display_name}
        >
          {r.profile?.avatar_image_url
            ? <img src={r.profile.avatar_image_url} alt="" className="w-full h-full object-cover" />
            : r.profile?.avatar_icon
              ? <AvatarIcon name={r.profile.avatar_icon} size={12} />
              : <span className="text-white text-[9px] font-bold">{(r.profile?.display_name ?? '?').charAt(0).toUpperCase()}</span>
          }
        </div>
      ))}
      {extra > 0 && <span className="text-xs text-stone-400 ml-1.5">+{extra}</span>}
    </div>
  )
}

function RsvpCounts({ rsvps }) {
  const going    = (rsvps ?? []).filter(r => r.status === 'going').length
  const maybe    = (rsvps ?? []).filter(r => r.status === 'maybe').length
  if (!going && !maybe) return <span className="text-xs text-stone-400">No RSVPs yet</span>
  const parts = []
  if (going) parts.push(`${going} going`)
  if (maybe) parts.push(`${maybe} maybe`)
  return <span className="text-xs text-stone-400">{parts.join(' · ')}</span>
}

// ── Create / Edit form ────────────────────────────────────────────────────────

function EventForm({ event, groupId, userId, onSave, onClose }) {
  const toast = useToast()
  const [title,       setTitle]       = useState(event?.title ?? '')
  const [date,        setDate]        = useState(event?.event_date ?? today())
  const [time,        setTime]        = useState(event?.event_time?.slice(0, 5) ?? '')
  const [location,    setLocation]    = useState(event?.location ?? '')
  const [description, setDescription] = useState(event?.description ?? '')
  const [saving,      setSaving]      = useState(false)

  async function handleSave() {
    if (!title.trim() || !date) return
    setSaving(true)
    const payload = {
      community_group_id: groupId,
      created_by:         userId,
      title:              title.trim(),
      event_date:         date,
      event_time:         time || null,
      location:           location.trim() || null,
      description:        description.trim() || null,
    }
    let error
    if (event?.id) {
      ;({ error } = await supabase.from('events').update(payload).eq('id', event.id))
    } else {
      ;({ error } = await supabase.from('events').insert(payload))
    }
    setSaving(false)
    if (error) { toast('Failed to save event', 'error'); return }
    haptic()
    onSave()
  }

  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-xs font-semibold text-stone-500 mb-1">Title <span className="text-coral">*</span></label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Event name"
          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-stone-500 mb-1">Date <span className="text-coral">*</span></label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-stone-500 mb-1">Time <span className="text-stone-400 font-normal">(optional)</span></label>
          <input
            type="time"
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-semibold text-stone-500 mb-1">Location <span className="text-stone-400 font-normal">(optional)</span></label>
        <input
          type="text"
          value={location}
          onChange={e => setLocation(e.target.value)}
          placeholder="Where is it?"
          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent"
        />
      </div>
      <div>
        <label className="block text-xs font-semibold text-stone-500 mb-1">Description <span className="text-stone-400 font-normal">(optional)</span></label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Any details to share…"
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-sm text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-jade focus:border-transparent resize-none"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl border border-stone-200 text-sm font-semibold text-stone-600 hover:bg-stone-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!title.trim() || !date || saving}
          className="flex-1 py-2.5 rounded-xl bg-jade text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : event?.id ? 'Save Changes' : 'Create Event'}
        </button>
      </div>
    </div>
  )
}

// ── Event detail sheet ────────────────────────────────────────────────────────

function EventDetail({ event, rsvps, userId, isAdmin, onRsvp, onEdit, onDelete, onClose }) {
  const [exiting, setExiting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)
  const myRsvp = (rsvps ?? []).find(r => r.user_id === userId)

  function close() {
    setExiting(true)
    setTimeout(onClose, 210)
  }

  useEffect(() => {
    if (!menuOpen) return
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const { month, day } = formatDateBadge(event.event_date)

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col bg-white transition-transform duration-200 ease-out ${exiting ? 'translate-y-full' : 'translate-y-0'}`}
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <button onClick={close} className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-semibold text-stone-800 text-base">Event Details</span>
        {isAdmin ? (
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-500 hover:bg-stone-100 transition-colors"
            >
              <DotsThreeVertical size={20} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-full mt-1 w-40 bg-white rounded-2xl shadow-xl border border-stone-100 overflow-hidden z-10"
                >
                  <button
                    onClick={() => { setMenuOpen(false); onEdit(event) }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-stone-700 hover:bg-stone-50 transition-colors"
                  >
                    <PencilSimple size={16} /> Edit
                  </button>
                  <button
                    onClick={() => { setMenuOpen(false); onDelete(event) }}
                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash size={16} /> Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 pt-6 pb-10">
          {/* Date badge + title */}
          <div className="flex items-start gap-4 mb-6">
            <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-100 rounded-2xl px-4 py-2 min-w-[60px] shrink-0">
              <span className="text-[11px] font-bold text-amber-500 uppercase tracking-wide">{month}</span>
              <span className="text-2xl font-bold text-amber-700 leading-none">{day}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-stone-800 leading-tight">{event.title}</h2>
              <p className="text-sm text-stone-500 mt-1">{formatDateFull(event.event_date, event.event_time)}</p>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-2 mb-5">
              <MapPin size={16} className="text-stone-400 mt-0.5 shrink-0" />
              <span className="text-sm text-stone-600">{event.location}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <p className="text-sm text-stone-600 leading-relaxed mb-6 whitespace-pre-wrap">{event.description}</p>
          )}

          {/* RSVP */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">RSVP</p>
            <div className="flex gap-2">
              {[
                { status: 'going',    label: 'Going',     Icon: CheckCircle, active: 'bg-jade text-white',  inactive: 'bg-stone-100 text-stone-600' },
                { status: 'maybe',    label: 'Maybe',     Icon: Minus,       active: 'bg-amber-400 text-white', inactive: 'bg-stone-100 text-stone-600' },
                { status: 'not_going',label: "Can't go",  Icon: XIcon,       active: 'bg-stone-500 text-white', inactive: 'bg-stone-100 text-stone-600' },
              ].map(({ status, label, Icon, active, inactive }) => (
                <button
                  key={status}
                  onClick={() => onRsvp(event.id, status, myRsvp?.status)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 rounded-2xl text-xs font-semibold transition-colors ${myRsvp?.status === status ? active : inactive}`}
                >
                  <Icon size={18} weight={myRsvp?.status === status ? 'fill' : 'regular'} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Who's going */}
          {(rsvps ?? []).some(r => r.status === 'going') && (
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Who's going</p>
              <div className="flex flex-wrap gap-2">
                {(rsvps ?? []).filter(r => r.status === 'going').map(r => (
                  <div key={r.user_id} className="flex items-center gap-2 bg-stone-50 rounded-xl px-3 py-2">
                    <AvatarCircle size="6" icon={r.profile?.avatar_icon} colorKey={r.profile?.avatar_color} userId={r.user_id} name={r.profile?.display_name} imageUrl={r.profile?.avatar_image_url} />
                    <span className="text-xs font-medium text-stone-700">{r.profile?.display_name ?? 'Member'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export default function EventsTab({ groupId, userId, isAdmin, onOpenSettings }) {
  const toast = useToast()
  const [events,       setEvents]       = useState([])
  const [rsvps,        setRsvps]        = useState({})
  const [loading,      setLoading]      = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [showForm,     setShowForm]     = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [pastExpanded, setPastExpanded] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting,     setDeleting]     = useState(false)

  async function load() {
    setLoading(true)
    const { data: evData } = await supabase
      .from('events')
      .select('*')
      .eq('community_group_id', groupId)
      .order('event_date', { ascending: true })

    const evList = evData ?? []
    setEvents(evList)

    if (evList.length > 0) {
      const ids = evList.map(e => e.id)
      const { data: rsvpData } = await supabase
        .from('event_rsvps')
        .select('event_id, user_id, status, profiles(display_name, avatar_icon, avatar_color, avatar_image_url)')
        .in('event_id', ids)

      const grouped = {}
      for (const r of (rsvpData ?? [])) {
        if (!grouped[r.event_id]) grouped[r.event_id] = []
        grouped[r.event_id].push({ user_id: r.user_id, status: r.status, profile: r.profiles })
      }
      setRsvps(grouped)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [groupId])

  const { pullDistance, refreshing, threshold } = usePullToRefresh(load, !selectedEvent && !showForm && !editingEvent)

  async function handleRsvp(eventId, status, currentStatus) {
    haptic()
    // Toggle off if clicking current status
    const newStatus = status === currentStatus ? null : status

    // Optimistic update
    setRsvps(prev => {
      const list = (prev[eventId] ?? []).filter(r => r.user_id !== userId)
      if (newStatus) list.push({ user_id: userId, status: newStatus, profile: null })
      return { ...prev, [eventId]: list }
    })

    if (newStatus) {
      const { error } = await supabase.from('event_rsvps')
        .upsert({ event_id: eventId, user_id: userId, status: newStatus }, { onConflict: 'event_id,user_id' })
      if (error) { toast('Failed to update RSVP', 'error'); load() }
    } else {
      const { error } = await supabase.from('event_rsvps')
        .delete().eq('event_id', eventId).eq('user_id', userId)
      if (error) { toast('Failed to update RSVP', 'error'); load() }
    }

    // Reload profiles for the updated RSVP so avatars are correct
    const { data } = await supabase
      .from('event_rsvps')
      .select('event_id, user_id, status, profiles(display_name, avatar_icon, avatar_color, avatar_image_url)')
      .eq('event_id', eventId)
    setRsvps(prev => ({ ...prev, [eventId]: (data ?? []).map(r => ({ user_id: r.user_id, status: r.status, profile: r.profiles })) }))
  }

  async function handleDelete(event) {
    setDeleting(true)
    const { error } = await supabase.from('events').delete().eq('id', event.id)
    setDeleting(false)
    if (error) { toast('Failed to delete event', 'error'); return }
    haptic()
    setDeleteTarget(null)
    if (selectedEvent?.id === event.id) setSelectedEvent(null)
    load()
  }

  const todayStr = today()
  const upcoming = events.filter(e => e.event_date >= todayStr)
  const past     = events.filter(e => e.event_date < todayStr).reverse()

  function openEdit(event) {
    setEditingEvent(event)
    setSelectedEvent(null)
  }

  function EventCard({ event }) {
    const { month, day } = formatDateBadge(event.event_date)
    const eventRsvps = rsvps[event.id] ?? []
    return (
      <button
        onClick={() => { haptic(); setSelectedEvent(event) }}
        className="w-full flex items-center gap-3 bg-white border border-stone-200 rounded-2xl p-4 text-left hover:border-amber-200 hover:bg-amber-50/30 transition-colors"
      >
        <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-100 rounded-xl px-3 py-1.5 min-w-[48px] shrink-0">
          <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wide">{month}</span>
          <span className="text-xl font-bold text-amber-700 leading-none">{day}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-stone-800 text-sm truncate">{event.title}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {event.location && (
              <>
                <MapPin size={11} className="text-stone-400 shrink-0" />
                <span className="text-xs text-stone-400 truncate">{event.location}</span>
                <span className="text-stone-300 text-xs">·</span>
              </>
            )}
            <RsvpCounts rsvps={eventRsvps} />
          </div>
        </div>
        <GoingAvatars rsvps={eventRsvps} />
      </button>
    )
  }

  return (
    <main className="max-w-3xl lg:max-w-5xl mx-auto px-4 pt-8 pb-12">
      {pullDistance > 0 && (
        <div
          className="fixed inset-x-0 z-30 flex justify-center transition-transform"
          style={{ top: 'calc(env(safe-area-inset-top) + 8px)', transform: `translateY(${Math.min(pullDistance, threshold) * 0.6}px)` }}
        >
          <div className={`w-8 h-8 rounded-full bg-white shadow-md border border-stone-200 flex items-center justify-center ${refreshing ? 'animate-spin' : ''}`}>
            <div className="w-3 h-3 rounded-full border-2 border-jade border-t-transparent" style={{ opacity: pullDistance / threshold }} />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-stone-800">Events</h1>
        <div className="flex items-center gap-1">
          {isAdmin && (
            <button
              onClick={() => { haptic(); setShowForm(true) }}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-jade text-white hover:bg-jade/90 transition-colors"
            >
              <Plus size={18} weight="bold" />
            </button>
          )}
          <button
            onClick={onOpenSettings}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
          >
            <GearSix size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="bg-white border border-stone-200 rounded-2xl p-4 animate-pulse flex gap-3" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="w-12 h-14 bg-stone-100 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3.5 bg-stone-100 rounded w-3/5" />
                <div className="h-3 bg-stone-100 rounded w-2/5" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Upcoming */}
          {upcoming.length > 0 ? (
            <div className="space-y-3 mb-6">
              {upcoming.map(event => <EventCard key={event.id} event={event} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center mb-4">
                <CalendarStar size={32} className="text-amber-400" weight="duotone" />
              </div>
              <p className="font-semibold text-stone-700 mb-1">No upcoming events</p>
              {isAdmin && (
                <button
                  onClick={() => { haptic(); setShowForm(true) }}
                  className="mt-3 px-4 py-2 rounded-xl bg-jade text-white text-sm font-semibold hover:bg-jade/90 transition-colors"
                >
                  Create an event
                </button>
              )}
            </div>
          )}

          {/* Past events */}
          {past.length > 0 && (
            <div>
              <button
                onClick={() => setPastExpanded(e => !e)}
                className="flex items-center gap-2 text-sm font-semibold text-stone-400 hover:text-stone-600 transition-colors mb-3"
              >
                {pastExpanded ? <CaretUp size={14} /> : <CaretDown size={14} />}
                Past events ({past.length})
              </button>
              <AnimatePresence>
                {pastExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 pb-2 opacity-60">
                      {past.map(event => <EventCard key={event.id} event={event} />)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}

      {/* Event detail sheet */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetail
            key={selectedEvent.id}
            event={selectedEvent}
            rsvps={rsvps[selectedEvent.id]}
            userId={userId}
            isAdmin={isAdmin}
            onRsvp={handleRsvp}
            onEdit={openEdit}
            onDelete={e => setDeleteTarget(e)}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>

      {/* Create / Edit form sheet */}
      <AnimatePresence>
        {(showForm || editingEvent) && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30"
            onClick={e => { if (e.target === e.currentTarget) { setShowForm(false); setEditingEvent(null) } }}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="bg-white rounded-t-3xl p-5 max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-stone-800 text-base">{editingEvent ? 'Edit Event' : 'New Event'}</h2>
                <button onClick={() => { setShowForm(false); setEditingEvent(null) }} className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100">
                  <XIcon size={18} />
                </button>
              </div>
              <EventForm
                event={editingEvent}
                groupId={groupId}
                userId={userId}
                onSave={() => { setShowForm(false); setEditingEvent(null); load() }}
                onClose={() => { setShowForm(false); setEditingEvent(null) }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation sheet */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="fixed inset-0 z-50 flex flex-col justify-end bg-black/30"
            onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="bg-white rounded-t-3xl p-5">
              <h2 className="font-bold text-stone-800 text-base mb-1">Delete Event</h2>
              <p className="text-sm text-stone-500 mb-5">"{deleteTarget.title}" will be permanently deleted.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 rounded-2xl border border-stone-200 text-sm font-semibold text-stone-600"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteTarget)}
                  disabled={deleting}
                  className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
