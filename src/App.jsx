import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ForkKnife, HandHeart, ChatCircleDots, HandsPraying, House, WifiSlash } from '@phosphor-icons/react'
import { haptic } from './lib/haptic.js'
import { usePushNotifications } from './hooks/usePushNotifications.js'
import { formatDate } from './utils/dates.js'
import { getUpcomingBirthdays } from './utils/birthdays.js'
import { supabase } from './lib/supabase.js'
import RotationTab from './RotationTab.jsx'
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

const TABS = [
  { path: '/home',     shortLabel: 'Home',      Icon: House },
  {
    path: '/meals',
    shortLabel: 'Meals',
    Icon: ForkKnife,
    config: {
      label: 'Meal Signup',
      Icon: ForkKnife,
      editLabel: 'Edit Meal',
      noun: 'Ingredient',
      itemNoun: 'Ingredient',
      pageNoun: 'Meal',
      pageNounPlural: 'Meals',
      tables: { pages: 'meal_pages', signups: 'signups', pauseRpc: 'toggle_meal_pause' },
      autoFill: true,
      defaultTitle: dateStr => `Meal — ${formatDate(dateStr)}`,
    },
  },
  {
    path: '/services',
    shortLabel: 'Service',
    Icon: HandHeart,
    config: {
      label: 'Service Night',
      Icon: HandHeart,
      editLabel: 'Edit Items',
      noun: 'Item',
      itemNoun: 'Item',
      pageNoun: 'Service',
      pageNounPlural: 'Services',
      tables: { pages: 'serving_pages', signups: 'serving_signups', pauseRpc: 'toggle_service_pause' },
      defaultTitle: dateStr => `Service Night — ${formatDate(dateStr)}`,
    },
  },
  { path: '/chat',      shortLabel: 'Chat',      Icon: ChatCircleDots },
  { path: '/prayer',    shortLabel: 'Prayer',    Icon: HandsPraying },
]

const PATHS = TABS.map(t => t.path)

export default function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const prevIndexRef  = useRef(PATHS.indexOf(location.pathname))
  const locationRef   = useRef(location.pathname)
  const [enterFrom, setEnterFrom]       = useState('right')
  const [birthdays, setBirthdays]       = useState([])
  const [session, setSession]           = useState(null)
  const [authLoading, setAuthLoading]   = useState(true)
  const [profile, setProfile]           = useState(null)
  const [unreadChatCount, setUnreadChatCount] = useState(0)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [isRecovery, setIsRecovery] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
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
      if (event === 'SIGNED_IN') navigate('/home')
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true)
      if (!session) { setProfile(null); setIsRecovery(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase
      .from('profiles')
      .select('display_name, community_group_id, role, community_groups(name)')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data }) => {
        if (!data) return
        setProfile(data)
        const key = `cg_welcomed_${session.user.id}`
        if (!localStorage.getItem(key)) {
          localStorage.setItem(key, '1')
          setShowWelcome(true)
        }
      })
  }, [session])

  const displayName = profile?.display_name ?? ''
  const groupName   = profile?.community_groups?.name ?? session?.user?.user_metadata?.community_group_name ?? ''
  const groupId     = profile?.community_group_id ?? null
  const isAdmin     = profile?.role === 'admin'
  const push = usePushNotifications(session?.user?.id, groupId)

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

  // Unread chat tracking — fires for any new message while not on /chat
  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`chat-unread:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `community_group_id=eq.${groupId}`,
      }, () => {
        if (locationRef.current !== '/chat') setUnreadChatCount(c => c + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [groupId])

  useEffect(() => {
    if (location.pathname === '/chat') setUnreadChatCount(0)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [location.pathname])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-sunrise-50 flex items-center justify-center">
        <div className="text-stone-400 animate-pulse text-sm">Loading…</div>
      </div>
    )
  }

  if (!session) return <AuthPage />
  if (isRecovery) return <ResetPasswordPage onDone={() => setIsRecovery(false)} />

  const upcoming = getUpcomingBirthdays(birthdays)
  const isChat = location.pathname === '/chat'
  const isFullHeight = isChat

  function handleTabChange(path) {
    haptic()
    const newIndex = PATHS.indexOf(path)
    setEnterFrom(newIndex > prevIndexRef.current ? 'right' : 'left')
    prevIndexRef.current = newIndex
    if (path === '/chat') setUnreadChatCount(0)
    navigate(path)
  }

  return (
    <div className="min-h-screen bg-sunrise-50 overflow-x-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {!isOnline && (
        <div className="fixed inset-x-0 z-[150] flex items-center justify-center gap-2 bg-stone-800 text-white text-xs font-medium py-2 px-4 animate-toast-in" style={{ top: 'env(safe-area-inset-top)' }}>
          <WifiSlash size={14} weight="bold" />
          You're offline
        </div>
      )}
      {!isFullHeight && location.pathname !== '/home' && <BirthdayBanner upcoming={upcoming} />}

      <div
        key={location.pathname}
        className={`${isFullHeight ? '' : 'pb-24'} ${enterFrom === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home"      element={<OverviewTab displayName={displayName} groupName={groupName} groupId={groupId} isAdmin={isAdmin} birthdays={birthdays} onOpenBirthdays={() => setBirthdayOpen(true)} onOpenGuide={() => setGuideOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />} />
          <Route path="/meals"     element={<RotationTab config={TABS[1].config} revealKey="/meals"     groupName={groupName} displayName={displayName} onOpenSettings={() => setSettingsOpen(true)} isAdmin={isAdmin} />} />
          <Route path="/services"  element={<RotationTab config={TABS[2].config} revealKey="/services"  groupName={groupName} displayName={displayName} onOpenSettings={() => setSettingsOpen(true)} isAdmin={isAdmin} />} />
          <Route path="/chat"      element={<ChatTab session={session} displayName={displayName} groupId={groupId} isAdmin={isAdmin} onRead={() => setUnreadChatCount(0)} onOpenSettings={() => setSettingsOpen(true)} />} />
          <Route path="/prayer"    element={<PrayerTab displayName={displayName} groupId={groupId} isAdmin={isAdmin} onOpenSettings={() => setSettingsOpen(true)} />} />
        </Routes>
      </div>

      {showWelcome && (
        <WelcomeSplash groupName={groupName} onDone={() => setShowWelcome(false)} />
      )}

      <nav
        className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 z-40 flex"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(t => {
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
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-coral rounded-full border-2 border-white flex items-center justify-center">
                    <span className="text-[9px] font-bold text-white leading-none px-0.5">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-medium tracking-wide ${active ? 'text-jade' : ''}`}>{t.shortLabel}</span>
            </button>
          )
        })}
      </nav>

      {settingsOpen && (
        <SettingsModal
          groupName={groupName}
          displayName={displayName}
          groupId={groupId}
          isAdmin={isAdmin}
          userId={session.user.id}
          onClose={() => setSettingsOpen(false)}
          pushSupported={push.supported}
          pushSubscribed={push.subscribed}
          pushPermission={push.permission}
          pushToggling={push.toggling}
          onPushToggle={push.toggle}
        />
      )}

      {guideOpen && (
        <div
          className={`fixed inset-0 z-50 bg-sunrise-50 overflow-y-auto ${guideClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
          style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <GuideTab onClose={closeGuide} />
        </div>
      )}

      {birthdayOpen && (
        <div
          className={`fixed inset-0 z-50 bg-sunrise-50 overflow-y-auto ${birthdayClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
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
    </div>
  )
}
