import { useState, useEffect, useRef } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ForkKnife, HandHeart, ChatCircleDots, HandsPraying, House } from '@phosphor-icons/react'
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
      tables: { pages: 'meal_pages', signups: 'signups' },
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
      tables: { pages: 'serving_pages', signups: 'serving_signups' },
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
  const [hasUnreadChat, setHasUnreadChat] = useState(false)
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setAuthLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
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
  const push = usePushNotifications(session?.user?.id, groupId)
  const groupName   = profile?.community_groups?.name ?? session?.user?.user_metadata?.community_group_name ?? ''
  const groupId     = profile?.community_group_id ?? null
  const isAdmin     = profile?.role === 'admin'

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
        if (locationRef.current !== '/chat') setHasUnreadChat(true)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [groupId])

  // Clear unread dot when visiting chat
  useEffect(() => {
    if (location.pathname === '/chat') setHasUnreadChat(false)
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
    const newIndex = PATHS.indexOf(path)
    setEnterFrom(newIndex > prevIndexRef.current ? 'right' : 'left')
    prevIndexRef.current = newIndex
    if (path === '/chat') setHasUnreadChat(false)
    navigate(path)
  }

  return (
    <div className="min-h-screen bg-sunrise-50 overflow-x-hidden" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {!isFullHeight && location.pathname !== '/home' && <BirthdayBanner upcoming={upcoming} />}

      <div
        key={location.pathname}
        className={`${isFullHeight ? '' : 'pb-24'} ${enterFrom === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'}`}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home"      element={<OverviewTab displayName={displayName} groupName={groupName} groupId={groupId} isAdmin={isAdmin} birthdays={birthdays} onOpenBirthdays={() => setBirthdayOpen(true)} onOpenGuide={() => setGuideOpen(true)} />} />
          <Route path="/meals"     element={<RotationTab config={TABS[1].config} revealKey="/meals"     groupName={groupName} displayName={displayName} onOpenSettings={() => setSettingsOpen(true)} />} />
          <Route path="/services"  element={<RotationTab config={TABS[2].config} revealKey="/services"  groupName={groupName} displayName={displayName} onOpenSettings={() => setSettingsOpen(true)} />} />
          <Route path="/chat"      element={<ChatTab session={session} displayName={displayName} groupId={groupId} isAdmin={isAdmin} onRead={() => setHasUnreadChat(false)} onOpenSettings={() => setSettingsOpen(true)} />} />
          <Route path="/prayer"    element={<PrayerTab displayName={displayName} onOpenSettings={() => setSettingsOpen(true)} />} />
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
                {t.path === '/chat' && hasUnreadChat && (
                  <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-coral rounded-full border-2 border-white" />
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
          onOpenGuide={() => setGuideOpen(true)}
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
