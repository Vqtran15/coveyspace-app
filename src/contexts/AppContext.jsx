import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { db } from '../lib/db.js'
import { usePushNotifications } from '../hooks/usePushNotifications.js'
import { dedupBirthdays } from '../utils/birthdays.js'

const PATHS = ['/home', '/schedule', '/events', '/chat', '/prayer', '/bible']

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const navigate = useNavigate()

  const [session, setSession]         = useState(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [isRecovery, setIsRecovery]   = useState(false)
  const [profile, setProfile]         = useState(null)
  const [groupSettings, setGroupSettings] = useState(null)
  const [birthdays, setBirthdays]         = useState([])
  const [unreadChatCount, setUnreadChatCount] = useState(0)

  // Derived early so effects below can reference them in dependency arrays
  const userId        = session?.user?.id ?? null
  const groupId       = profile?.community_group_id ?? null
  const displayName   = profile?.display_name ?? ''
  const groupName     = profile?.community_groups?.name ?? session?.user?.user_metadata?.community_group_name ?? ''
  const isAdmin       = profile?.role === 'admin'
  const avatarIcon     = profile?.avatar_icon ?? null
  const avatarColorKey = profile?.avatar_color ?? null
  const avatarImageUrl = profile?.avatar_image_url ?? null

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      setSession(sess)
      if (event === 'INITIAL_SESSION') setAuthLoading(false)
      if (event === 'SIGNED_IN' && !PATHS.includes(window.location.pathname)) navigate('/home')
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      if (!sess) { setProfile(null); setIsRecovery(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  // ── Profile load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    db.profiles.fetch(session.user.id).then(({ data }) => {
      if (data) setProfile(data)
    })
  }, [session])

  // ── Group settings ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return
    db.groupSettings.fetch(groupId).then(({ data }) => setGroupSettings(data ?? {}))
  }, [groupId])

  // ── Birthdays ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    supabase.from('birthdays').select('*').then(({ data }) => setBirthdays(dedupBirthdays(data ?? [])))

    const channel = supabase
      .channel(`birthdays:${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'birthdays', filter: `community_group_id=eq.${groupId}` },
        ({ eventType, new: next, old: prev }) => {
          if (eventType === 'INSERT') setBirthdays(b => dedupBirthdays(b.some(r => r.id === next.id) ? b : [...b, next]))
          else if (eventType === 'UPDATE') setBirthdays(b => dedupBirthdays(b.map(r => r.id === next.id ? next : r)))
          else if (eventType === 'DELETE') setBirthdays(b => b.filter(r => r.id !== prev.id))
        },
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [session])

  // ── last_seen_at ping ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const ping = () =>
      supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('user_id', userId).then()
    ping()
    const onVisible = () => { if (document.visibilityState === 'visible') ping() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [userId])

  // ── is_pwa flag ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator && window.navigator.standalone === true)
    if (!isStandalone) return
    supabase.from('profiles').update({ is_pwa: true }).eq('user_id', userId).then()
  }, [userId])

  // ── App badge sync ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    if (unreadChatCount > 0) {
      navigator.setAppBadge(unreadChatCount).catch(() => {})
    } else {
      navigator.clearAppBadge().catch(() => {})
    }
  }, [unreadChatCount])

  // ── Push notifications ────────────────────────────────────────────────────
  const push = usePushNotifications(userId, groupId)

  // ── Feature flags ─────────────────────────────────────────────────────────
  const mealsEnabled     = groupSettings?.meals_enabled !== false
  const servicesEnabled  = groupSettings?.services_enabled !== false
  const chatEnabled      = groupSettings?.chat_enabled !== false
  const prayerEnabled    = groupSettings?.prayer_enabled !== false
  const birthdaysEnabled = groupSettings?.birthdays_enabled !== false
  const guideEnabled     = groupSettings?.guide_enabled !== false
  const givingEnabled    = groupSettings?.giving_enabled === true
  const eventsEnabled    = groupSettings?.events_enabled === true
  const bibleEnabled     = groupSettings?.bible_enabled === true
  const showScheduleTab  = mealsEnabled || servicesEnabled

  // ── Profile update callbacks ──────────────────────────────────────────────
  const onDisplayNameChange = useCallback((name) => {
    setProfile(p => p ? { ...p, display_name: name } : p)
  }, [])

  const onAvatarChange = useCallback(({ icon, color, imageUrl }) => {
    setProfile(p => p ? { ...p, avatar_icon: icon, avatar_color: color, avatar_image_url: imageUrl } : p)
  }, [])

  const onGroupSettingsChange = useCallback((settings) => {
    setGroupSettings(settings)
  }, [])

  const onGroupNameChange = useCallback((name) => {
    setProfile(p => p ? { ...p, community_groups: { ...p.community_groups, name } } : p)
  }, [])

  const clearRecovery = useCallback(() => setIsRecovery(false), [])

  const refreshProfile = useCallback(() => {
    if (!userId) return
    db.profiles.fetch(userId).then(({ data }) => { if (data) setProfile(data) })
  }, [userId])

  const refreshBirthdays = useCallback(() => {
    supabase.from('birthdays').select('*').then(({ data }) => { if (data) setBirthdays(dedupBirthdays(data ?? [])) })
  }, [])

  const existingBirthday = profile?.birthday ?? null

  const value = {
    session, userId, authLoading, isRecovery, clearRecovery,
    displayName, groupId, groupName, isAdmin,
    avatarIcon, avatarColorKey, avatarImageUrl,
    existingBirthday,
    groupSettings, setGroupSettings,
    mealsEnabled, servicesEnabled, chatEnabled, prayerEnabled,
    birthdaysEnabled, guideEnabled, givingEnabled, eventsEnabled, bibleEnabled,
    showScheduleTab,
    birthdays,
    unreadChatCount, setUnreadChatCount,
    push,
    onDisplayNameChange, onAvatarChange, onGroupSettingsChange, onGroupNameChange,
    setProfile,
    refreshProfile, refreshBirthdays,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used inside AppProvider')
  return ctx
}
