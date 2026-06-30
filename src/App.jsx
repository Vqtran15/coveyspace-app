import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ForkKnife, HandHeart, ChatCircleDots, HandsPraying, House, WifiSlash, NotePencil, GearSix } from '@phosphor-icons/react'
import { haptic } from './lib/haptic.js'
import { usePushNotifications } from './hooks/usePushNotifications.js'
import { getUpcomingBirthdays } from './utils/birthdays.js'
import { supabase } from './lib/supabase.js'
import ScheduleTab from './components/ScheduleTab.jsx'
import BirthdayTab from './components/BirthdayTab.jsx'
import PrayerTab from './components/PrayerTab.jsx'
import BirthdayBanner from './components/BirthdayBanner.jsx'
import ChatTab from './components/ChatTab.jsx'
import GuideTab from './components/GuideTab.jsx'
import OverviewTab from './components/OverviewTab.jsx'
import AuthPage from './components/AuthPage.jsx'
import ResetPasswordPage from './components/ResetPasswordPage.jsx'
import WelcomeSplash from './components/WelcomeSplash.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import AdminPage from './components/AdminPage.jsx'
import UpdatePrompt from './components/UpdatePrompt.jsx'

const MEALS_CONFIG = {
  label: 'Meal Signup',
  Icon: ForkKnife,
  editLabel: 'Edit Meal',
  noun: 'Ingredient',
  itemNoun: 'Ingredient',
  pageNoun: 'Meal',
  pageNounPlural: 'Meals',
  tables: { pages: 'meal_pages', signups: 'signups', pauseRpc: 'toggle_meal_pause' },
  autoFill: true,
  defaultTitle: () => 'Meal',
}

const SERVICES_CONFIG = {
  label: 'Service',
  Icon: HandHeart,
  editLabel: 'Edit Items',
  noun: 'Item',
  itemNoun: 'Item',
  pageNoun: 'Service',
  pageNounPlural: 'Services',
  tables: { pages: 'serving_pages', signups: 'serving_signups', pauseRpc: 'toggle_service_pause' },
  defaultTitle: () => 'Service',
}

const TABS = [
  { path: '/home',     shortLabel: 'Home',     Icon: House },
  { path: '/schedule', shortLabel: 'Sign Up',  Icon: NotePencil },
  { path: '/chat',     shortLabel: 'Chat',     Icon: ChatCircleDots },
  { path: '/prayer',   shortLabel: 'Prayer',   Icon: HandsPraying },
]

const PATHS = TABS.map(t => t.path)

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const prevIndexRef  = useRef(PATHS.indexOf(location.pathname))
  const locationRef   = useRef(location.pathname)
  const enterFromRef = useRef('right')
  const [birthdays, setBirthdays]       = useState([])
  const [session, setSession]           = useState(null)
  const [authLoading, setAuthLoading]   = useState(true)
  const [profile, setProfile]           = useState(null)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isRecovery, setIsRecovery] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [groupSettings, setGroupSettings] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guideClosing, setGuideClosing] = useState(false)

  function closeGuide() {
    setGuideClosing(true)
    setTimeout(() => { setGuideOpen(false); setGuideClosing(false) }, 200)
  }

  const [birthdayOpen, setBirthdayOpen] = useState(false)
  const [birthdayClosing, setBirthdayClosing] = useState(false)

  function closeBirthdays() {
    setBirthdayClosing(true)
    setTimeout(() => { setBirthdayOpen(false); setBirthdayClosing(false) }, 200)
  }

  useEffect(() => { locationRef.current = location.pathname }, [location.pathname])

  useEffect(() => {
    const up   = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_IN' && !PATHS.includes(window.location.pathname)) navigate('/home')
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      if (!session) { setProfile(null); setIsRecovery(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase
      .from('profiles')
      .select('display_name, community_group_id, role, avatar_icon, avatar_color, community_groups(name)')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setProfile(data)
        const key = `cg_welcomed_${session.user.id}_${data.community_group_id}`
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1')
          setShowWelcome(true)
        }
      })
  }, [session])

  const displayName    = profile?.display_name ?? ''
  const groupName      = profile?.community_groups?.name ?? session?.user?.user_metadata?.community_group_name ?? ''
  const groupId        = profile?.community_group_id ?? null
  const isAdmin        = profile?.role === 'admin'
  const avatarIcon     = profile?.avatar_icon ?? null
  const avatarColorKey = profile?.avatar_color ?? null
  const push = usePushNotifications(session?.user?.id, groupId)

  const mealsEnabled     = groupSettings?.meals_enabled !== false
  const servicesEnabled  = groupSettings?.services_enabled !== false
  const chatEnabled      = groupSettings?.chat_enabled !== false
  const prayerEnabled    = groupSettings?.prayer_enabled !== false
  const birthdaysEnabled = groupSettings?.birthdays_enabled !== false
  const guideEnabled     = groupSettings?.guide_enabled !== false
  const showScheduleTab  = mealsEnabled || servicesEnabled
  const visibleTabs      = TABS.filter(t => {
    if (t.path === '/schedule') return showScheduleTab
    if (t.path === '/chat')     return chatEnabled
    if (t.path === '/prayer')   return prayerEnabled
    return true
  })

  useEffect(() => {
    if (!session) return
    supabase.from('birthdays').select('*').then(({ data }) => setBirthdays(data ?? []))

    const channel = supabase
      .channel('birthdays-global')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'birthdays' },
        ({ eventType, new: next, old: prev }) => {
          if (eventType === 'INSERT') setBirthdays(b => b.some(r => r.id === next.id) ? b : [...b, next])
          else if (eventType === 'UPDATE') setBirthdays(b => b.map(r => r.id === next.id ? next : r))
          else if (eventType === 'DELETE') setBirthdays(b => b.filter(r => r.id !== prev.id))
        },
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session])

  useEffect(() => {
    if (showWelcome) {
      setSettingsOpen(false)
      setGuideOpen(false)
      setBirthdayOpen(false)
    }
  }, [showWelcome])

  useEffect(() => {
    if (!groupId) return
    supabase
      .from('group_settings')
      .select('*')
      .eq('group_id', groupId)
      .maybeSingle()
      .then(({ data }) => setGroupSettings(data ?? {}))
  }, [groupId])

  // Navigate when a push notification is clicked (SW sends postMessage)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function onMessage(e) {
      if (e.data?.type === 'NAVIGATE') navigate(e.data.url)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  // Load initial unread state from DB on mount
  useEffect(() => {
    if (!groupId || !session?.user?.id || location.pathname === '/chat') return
    async function loadInitialUnread() {
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', session.user.id)

      const convIds = (memberships ?? []).map(m => m.conversation_id)
      if (!convIds.length) return

      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, created_at')
        .in('conversation_id', convIds)
        .neq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(200)

      const latestByConv = {}
      for (const msg of msgs ?? []) {
        if (!latestByConv[msg.conversation_id]) latestByConv[msg.conversation_id] = msg.created_at
      }
      const readMap = Object.fromEntries((memberships ?? []).map(m => [m.conversation_id, m.last_read_at]))
      const hasUnread = (memberships ?? []).some(m => {
        const latest = latestByConv[m.conversation_id]
        return latest && (!readMap[m.conversation_id] || latest > readMap[m.conversation_id])
      })
      if (hasUnread) setUnreadChatCount(c => Math.max(c, 1))
    }
    loadInitialUnread()
  }, [groupId, session?.user?.id])

  // Unread chat tracking — fires for any new message while not on /chat
  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`chat-unread:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `community_group_id=eq.${groupId}`,
      }, ({ new: msg }) => {
        if (locationRef.current !== '/chat' && msg.user_id !== session?.user?.id)
          setUnreadChatCount(c => c + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [groupId])

  useEffect(() => {
    if (location.pathname === '/chat') setUnreadChatCount(0)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-sunrise-50 flex items-center justify-center">
        <div className="text-stone-400 animate-pulse text-sm">Loading…</div>
      </div>
    )
  }

  if (!session) return (
    <Routes>
      <Route path="/login" element={<AuthPage />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
  if (isRecovery) return <ResetPasswordPage onDone={() => setIsRecovery(false)} />

  const upcoming = getUpcomingBirthdays(birthdays)
  const isChat = location.pathname === '/chat'
  const isFullHeight = isChat

  function handleTabChange(path) {
    haptic()
    const newIndex = PATHS.indexOf(path)
    enterFromRef.current = newIndex > prevIndexRef.current ? 'right' : 'left'
    prevIndexRef.current = newIndex
    if (path === '/chat') setUnreadChatCount(0)
    navigate(path)
  }

  return (
    <div className="min-h-screen bg-sunrise-50 overflow-x-hidden lg:pl-56" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {!isOnline && (
        <div className="fixed inset-x-0 lg:left-56 z-[150] flex items-center justify-center gap-2 bg-stone-800 text-white text-xs font-medium py-2 px-4 animate-toast-in" style={{ top: 'env(safe-area-inset-top)' }}>
          <WifiSlash size={14} weight="bold" />
          You're offline
        </div>
      )}
      {!isFullHeight && birthdaysEnabled && (location.pathname !== '/home' || upcoming.some(b => b.daysUntil === 0)) && <BirthdayBanner upcoming={upcoming} />}

      <div
        key={location.pathname}
        className={`${isFullHeight ? '' : 'pb-24 lg:pb-0'} ${enterFromRef.current === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home"      element={<OverviewTab displayName={displayName} groupName={groupName} groupId={groupId} isAdmin={isAdmin} userId={session.user.id} avatarIcon={avatarIcon} avatarColorKey={avatarColorKey} birthdays={birthdays} onOpenBirthdays={() => setBirthdayOpen(true)} onOpenGuide={() => setGuideOpen(true)} onOpenSettings={() => setSettingsOpen(true)} mealsEnabled={mealsEnabled} servicesEnabled={servicesEnabled} guideEnabled={guideEnabled} birthdaysEnabled={birthdaysEnabled} />} />
          <Route path="/schedule"  element={<ScheduleTab mealsConfig={MEALS_CONFIG} servicesConfig={SERVICES_CONFIG} groupName={groupName} displayName={displayName} onOpenSettings={() => setSettingsOpen(true)} isAdmin={isAdmin} groupSettings={groupSettings} />} />
          <Route path="/chat"      element={<ChatTab session={session} displayName={displayName} groupId={groupId} isAdmin={isAdmin} onRead={() => setUnreadChatCount(0)} onOpenSettings={() => setSettingsOpen(true)} upcoming={upcoming} />} />
          <Route path="/prayer"    element={<PrayerTab displayName={displayName} groupId={groupId} isAdmin={isAdmin} onOpenSettings={() => setSettingsOpen(true)} />} />
          <Route path="/admin"     element={<AdminPage groupId={groupId} isAdmin={isAdmin} groupName={groupName} userId={session.user.id} groupSettings={groupSettings} onGroupSettingsChange={setGroupSettings} onGroupNameChange={name => setProfile(p => ({ ...p, community_groups: { ...p.community_groups, name } }))} />} />
          <Route path="*"          element={<Navigate to="/home" replace />} />
        </Routes>
      </div>

      {showWelcome && (
        <WelcomeSplash
          groupName={groupName}
          onDone={() => setShowWelcome(false)}
          isAdmin={isAdmin}
          userId={session.user.id}
          displayName={displayName}
          groupId={groupId}
          groupSettings={groupSettings}
          onGroupSettingsChange={setGroupSettings}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-56 bg-white border-r border-stone-200 z-40">
        <div className="px-4 py-5 border-b border-stone-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-jade flex items-center justify-center shrink-0">
            <svg viewBox="0 0 256 256" className="w-4 h-4 fill-white">
              <path d="M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z" />
            </svg>
          </div>
          <span className="font-league-gothic text-2xl text-jade tracking-wide">Covey Space</span>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {visibleTabs.map(t => {
            const active = location.pathname === t.path
            return (
              <button
                key={t.path}
                onClick={() => handleTabChange(t.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-jade text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
                }`}
              >
                <t.Icon size={20} weight={active ? 'fill' : 'regular'} />
                {t.shortLabel}
                {t.path === '/chat' && unreadChatCount > 0 && (
                  <span className="ml-auto w-2 h-2 bg-coral rounded-full" />
                )}
              </button>
            )
          })}
        </nav>
        <div className="px-3 py-4 border-t border-stone-100">
          <button
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors"
          >
            <GearSix size={20} />
            Settings
          </button>
        </div>
      </aside>

      <nav
        className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 z-40 flex lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {visibleTabs.map(t => {
          const active = location.pathname === t.path
          return (
            <button
              key={t.path}
              onClick={() => handleTabChange(t.path)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 transition-colors touch-manipulation ${active ? '' : 'text-stone-400'}`}
            >
              <span className={`relative px-3 py-1 rounded-2xl transition-colors ${active ? 'bg-jade text-white' : ''}`}>
                <t.Icon size={26} weight={active ? 'fill' : 'regular'} />
                {t.path === '/chat' && unreadChatCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-coral rounded-full border-2 border-white" />
                )}
              </span>
              <span className={`text-[10px] font-medium tracking-wide ${active ? 'text-jade' : ''}`}>{t.shortLabel}</span>
            </button>
          )
        })}
      </nav>

      {settingsOpen && !showWelcome && (
        <SettingsModal
          displayName={displayName}
          isAdmin={isAdmin}
          userId={session.user.id}
          onClose={() => setSettingsOpen(false)}
          onDisplayNameChange={name => setProfile(p => ({ ...p, display_name: name }))}
          pushSupported={push.supported}
          pushSubscribed={push.subscribed}
          pushPermission={push.permission}
          pushToggling={push.toggling}
          onPushToggle={push.toggle}
          onRevisitGuide={() => {
            const key = `cg_welcomed_${session.user.id}_${groupId}`
            localStorage.removeItem(key)
            setSettingsOpen(false)
            setShowWelcome(true)
          }}
        />
      )}

      {guideOpen && (
        <div
          className={`fixed inset-0 lg:left-56 z-50 bg-sunrise-50 overflow-y-auto ${guideClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <GuideTab onClose={closeGuide} guideUrl={groupSettings?.guide_url} />
        </div>
      )}

      {birthdayOpen && (
        <div
          className={`fixed inset-0 lg:left-56 z-50 bg-sunrise-50 overflow-y-auto ${birthdayClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <BirthdayTab
            birthdays={birthdays}
            onBirthdaysChange={setBirthdays}
            revealKey="birthdays"
            onClose={closeBirthdays}
          />
        </div>
      )}

      <UpdatePrompt />
    </div>
  )
}
