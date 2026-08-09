import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { motion, LayoutGroup } from 'framer-motion'
import { ForkKnife, HandHeart, ChatCircleDots, HandsPraying, House, WifiSlash, NotePencil, GearSix, CalendarHeart, BookOpen } from '@phosphor-icons/react'
import { haptic } from './lib/haptic.js'
import { trackEvent, trackPageView } from './lib/analytics.js'
import { useAnimatedOverlay } from './hooks/useAnimatedOverlay.js'
import { getUpcomingBirthdays } from './utils/birthdays.js'
import { supabase } from './lib/supabase.js'
import { getCookie, setCookie, removeCookie } from './lib/cookies.js'
import { AppProvider, useAppContext } from './contexts/AppContext.jsx'
import SplashScreen from './components/SplashScreen.jsx'

import BirthdayBanner       from './components/BirthdayBanner.jsx'
import PrayerReactionBanner from './components/PrayerReactionBanner.jsx'
import UpdatePrompt         from './components/UpdatePrompt.jsx'
import AnnouncementBanner   from './components/AnnouncementBanner.jsx'

const ScheduleTab       = lazy(() => import('./components/ScheduleTab.jsx'))
const BirthdayTab       = lazy(() => import('./components/BirthdayTab.jsx'))
const PrayerTab         = lazy(() => import('./components/PrayerTab.jsx'))
const ChatTab           = lazy(() => import('./components/ChatTab.jsx'))
const GuideTab          = lazy(() => import('./components/GuideTab.jsx'))
const GivingTab         = lazy(() => import('./components/GivingTab.jsx'))
const OverviewTab       = lazy(() => import('./components/OverviewTab.jsx'))
const EventsTab         = lazy(() => import('./components/EventsTab.jsx'))
const BibleTab          = lazy(() => import('./components/BibleTab.jsx'))
const AuthPage          = lazy(() => import('./components/AuthPage.jsx'))
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage.jsx'))
const WelcomeSplash     = lazy(() => import('./components/WelcomeSplash.jsx'))
const SettingsPage      = lazy(() => import('./components/SettingsPage.jsx'))
const AdminPage         = lazy(() => import('./components/AdminPage.jsx'))

const MEALS_CONFIG = {
  label: 'Meal Signup',
  Icon: ForkKnife,
  editLabel: 'Edit this meal',
  editSubLabel: 'Edit title, date, and ingredients',
  noun: 'Ingredient',
  itemNoun: 'Ingredient',
  pageNoun: 'Meal',
  pageNounPlural: 'Meals',
  tables: { pages: 'meal_pages', signups: 'signups', pauseRpc: 'toggle_meal_pause' },
  supportsCategories: true,
  autoFill: true,
  defaultTitle: () => 'Meal',
}

const SERVICES_CONFIG = {
  label: 'Service',
  Icon: HandHeart,
  editLabel: 'Edit this service',
  editSubLabel: 'Edit title, date, and sign-up slots',
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
  { path: '/events',   shortLabel: 'Events',   Icon: CalendarHeart },
  { path: '/chat',     shortLabel: 'Chat',     Icon: ChatCircleDots },
  { path: '/prayer',   shortLabel: 'Prayer',   Icon: HandsPraying },
  { path: '/bible',    shortLabel: 'Bible',    Icon: BookOpen },
]

const PATHS = TABS.map(t => t.path)
const OFF_NAV_PATHS = ['/settings', '/admin']

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    session, userId, authLoading, isRecovery, clearRecovery,
    displayName, groupId, groupName, isAdmin,
    avatarIcon, avatarColorKey, avatarImageUrl,
    groupSettings, setGroupSettings,
    mealsEnabled, servicesEnabled, chatEnabled, prayerEnabled,
    birthdaysEnabled, guideEnabled, givingEnabled, eventsEnabled, bibleEnabled,
    showScheduleTab,
    birthdays, refreshBirthdays,
    unreadChatCount, setUnreadChatCount,
    push,
    onDisplayNameChange, onAvatarChange, onGroupSettingsChange, onGroupNameChange,
    setProfile, refreshProfile,
  } = useAppContext()

  const prevIndexRef = useRef(PATHS.indexOf(location.pathname))
  const locationRef  = useRef(location.pathname)
  const enterFromRef = useRef('right')

  const [splashVisible, setSplashVisible] = useState(true)
  const [splashExiting, setSplashExiting] = useState(false)
  const [splashMinDone, setSplashMinDone] = useState(false)
  const [showWelcome, setShowWelcome] = useState(false)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const guide    = useAnimatedOverlay()
  const giving   = useAnimatedOverlay()
  const birthday = useAnimatedOverlay()

  const [birthdayBannerDismissed, setBirthdayBannerDismissed] = useState(false)
  const [birthdayBannerClosing,   setBirthdayBannerClosing]   = useState(false)
  const [announcement, setAnnouncement]           = useState(null)
  const [announcementClosing, setAnnouncementClosing] = useState(false)
  const [prayerBanner, setPrayerBanner]           = useState(null)
  const [prayerBannerClosing, setPrayerBannerClosing] = useState(false)

  // ── Splash screen ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setSplashMinDone(true), 1200)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (authLoading || !splashMinDone) return
    setSplashExiting(true)
    const t = setTimeout(() => setSplashVisible(false), 350)
    return () => clearTimeout(t)
  }, [authLoading, splashMinDone])

  // ── Network status ─────────────────────────────────────────────────────────
  useEffect(() => {
    const up   = () => setIsOnline(true)
    const down = () => setIsOnline(false)
    window.addEventListener('online',  up)
    window.addEventListener('offline', down)
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down) }
  }, [])

  // ── Welcome check (runs after profile loads) ───────────────────────────────
  useEffect(() => {
    if (!session || !groupId) return
    const key = `cg_welcomed_${userId}_${groupId}`
    if (!getCookie(key) && !localStorage.getItem(key)) {
      setCookie(key)
      setShowWelcome(true)
    } else {
      setCookie(key) // migrate existing localStorage users to cookie
    }
  }, [groupId])

  // ── iOS PWA safe-area fix ──────────────────────────────────────────────────
  // env(safe-area-inset-bottom) returns 0 until native scroll occurs on a
  // scrollable page. Scroll 1px (the root div is 1px taller than the viewport),
  // wait for iOS native layer to process, then read via probe and cache as a
  // JS inline style so it persists across SPA navigation without re-querying.
  useEffect(() => {
    const t = setTimeout(() => {
      window.scrollTo(0, 1)
      setTimeout(() => {
        const probe = document.createElement('div')
        probe.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;opacity:0'
        document.body.appendChild(probe)
        const sab = probe.getBoundingClientRect().height
        document.body.removeChild(probe)
        if (sab > 0) document.documentElement.style.setProperty('--sab', sab + 'px')
      }, 100)
    }, 50)
    return () => clearTimeout(t)
  }, [])

  // ── Announcement banner ────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    supabase
      .from('announcements')
      .select('id, message')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        const a = data?.[0]
        if (!a || getCookie(`dismissed_announcement_${a.id}`)) return
        setAnnouncement(a)
      })
  }, [session])

  // ── Close overlays when welcome splash opens ───────────────────────────────
  useEffect(() => {
    if (showWelcome) {
      guide.setOpen(false)
      giving.setOpen(false)
      birthday.setOpen(false)
    }
  }, [showWelcome])

  // ── SW postMessage navigation + prayer banner ──────────────────────────────
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    function onMessage(e) {
      if (e.data?.type !== 'NAVIGATE') return
      const url = e.data.url
      if (url === '/prayer' && userId) {
        if (e.data.notifTitle) setPrayerBanner({ reactorName: e.data.notifTitle })
        navigate('/prayer', { state: { featuredUserId: userId } })
      } else {
        navigate(url)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [userId])

  // ── Initial unread count ───────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId || !userId || locationRef.current === '/chat') return
    async function loadInitialUnread() {
      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId)

      const convIds = (memberships ?? []).map(m => m.conversation_id)
      if (!convIds.length) return

      const { data: msgs } = await supabase
        .from('messages')
        .select('conversation_id, created_at')
        .in('conversation_id', convIds)
        .neq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200)

      const readMap = Object.fromEntries((memberships ?? []).map(m => [m.conversation_id, m.last_read_at]))
      const count = (msgs ?? []).filter(msg => {
        const lastRead = readMap[msg.conversation_id]
        return !lastRead || msg.created_at > lastRead
      }).length
      if (count > 0) setUnreadChatCount(c => Math.max(c, count))
    }
    loadInitialUnread()
  }, [groupId, userId])

  // ── Prayer reaction banner ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId || !groupId) return
    const channel = supabase
      .channel(`prayer-reactions:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'prayer_reactions',
        filter: `community_group_id=eq.${groupId}`,
      }, ({ new: reaction }) => {
        if (reaction.prayer_request_owner_id !== userId) return
        if (reaction.user_id === userId) return
        setPrayerBanner({ reactorName: reaction.display_name ?? 'Someone' })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [userId, groupId])

  // ── Chat unread realtime ───────────────────────────────────────────────────
  useEffect(() => {
    if (!groupId) return
    const channel = supabase
      .channel(`chat-unread:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `community_group_id=eq.${groupId}`,
      }, ({ new: msg }) => {
        if (locationRef.current !== '/chat' && msg.user_id !== userId)
          setUnreadChatCount(c => c + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [groupId])

  // ── Location tracking + page view ─────────────────────────────────────────
  useEffect(() => {
    locationRef.current = location.pathname
    if (location.pathname === '/chat') {
      setUnreadChatCount(0)
      navigator.clearAppBadge?.().catch(() => {})
    }
    window.scrollTo(0, 0)
    trackPageView(location.pathname)
  }, [location.pathname])

  // ── Derived ────────────────────────────────────────────────────────────────
  const upcoming = session && !authLoading ? getUpcomingBirthdays(birthdays) : []
  const isChat = location.pathname === '/chat'
  const isFullHeight = isChat

  const visibleTabs = TABS.filter(t => {
    if (t.path === '/schedule') return showScheduleTab
    if (t.path === '/events')   return eventsEnabled
    if (t.path === '/chat')     return chatEnabled
    if (t.path === '/prayer')   return prayerEnabled
    if (t.path === '/bible')    return bibleEnabled
    return true
  })

  // ── Helpers ────────────────────────────────────────────────────────────────
  function dismissBirthdayBanner() {
    setBirthdayBannerClosing(true)
    setTimeout(() => { setBirthdayBannerDismissed(true); setBirthdayBannerClosing(false) }, 260)
  }

  function dismissAnnouncement() {
    setAnnouncementClosing(true)
    setTimeout(() => {
      if (announcement) setCookie(`dismissed_announcement_${announcement.id}`)
      setAnnouncement(null)
      setAnnouncementClosing(false)
    }, 260)
  }

  function dismissPrayerBanner() {
    setPrayerBannerClosing(true)
    setTimeout(() => { setPrayerBanner(null); setPrayerBannerClosing(false) }, 260)
  }

  function handleTabChange(path) {
    haptic()
    const newIndex = PATHS.indexOf(path)
    enterFromRef.current = newIndex > prevIndexRef.current ? 'right' : 'left'
    prevIndexRef.current = newIndex
    if (path === '/chat') setUnreadChatCount(0)
    trackEvent('tab_view', { tab_name: path.replace('/', '') || 'home' })
    if (path === location.pathname) {
      navigate(path, { replace: true, state: { tabReset: Date.now() } })
    } else {
      navigate(path)
    }
  }

  function navigateToSettings() { navigate('/settings') }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
    <Suspense fallback={null}>
    {authLoading ? null : !session ? (
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    ) : isRecovery ? (
      <ResetPasswordPage onDone={clearRecovery} />
    ) : (
    <div className="bg-sunrise-50 lg:pl-56" style={{ paddingTop: isChat ? 0 : 'var(--sat)', minHeight: isFullHeight ? 'var(--dvh)' : 'calc(var(--dvh) + var(--sat))' }}>
      {!isOnline && (
        <div className="fixed inset-x-0 lg:left-56 z-[150] flex items-center justify-center gap-2 bg-stone-800 text-white text-xs font-medium py-2 px-4 animate-toast-in" style={{ top: 'var(--sat)' }}>
          <WifiSlash size={14} weight="bold" />
          You're offline
        </div>
      )}
      {(announcement || announcementClosing) && !isFullHeight && (
        <AnnouncementBanner announcement={announcement} closing={announcementClosing} onDismiss={dismissAnnouncement} />
      )}
      {!isFullHeight && birthdaysEnabled && !birthdayBannerDismissed && (location.pathname !== '/home' || upcoming.some(b => b.daysUntil === 0)) && (
        <BirthdayBanner
          upcoming={upcoming}
          closing={birthdayBannerClosing}
          onDismiss={dismissBirthdayBanner}
          onTap={() => { dismissBirthdayBanner(); birthday.setOpen(true) }}
        />
      )}
      {(prayerBanner || prayerBannerClosing) && prayerEnabled && (
        <PrayerReactionBanner
          reactorName={prayerBanner?.reactorName}
          closing={prayerBannerClosing}
          onDismiss={dismissPrayerBanner}
          onTap={() => {
            dismissPrayerBanner()
            navigate('/prayer', { state: { featuredUserId: userId } })
          }}
        />
      )}

      <div
        key={location.pathname}
        className={`${isFullHeight ? '' : 'lg:pb-0'} ${
          OFF_NAV_PATHS.includes(location.pathname)
            ? 'animate-slide-in-up'
            : OFF_NAV_PATHS.includes(locationRef.current)
            ? 'animate-slide-in-left'
            : enterFromRef.current === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
        }`}
        style={isFullHeight ? undefined : {
          paddingBottom: 'calc(68px + var(--sab))',
          minHeight: 'calc(var(--dvh) - var(--sat))',
        }}
      >
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home"     element={
            <OverviewTab
              onOpenBirthdays={() => birthday.setOpen(true)}
              onOpenGuide={() => guide.setOpen(true)}
              onOpenGiving={() => giving.setOpen(true)}
              onOpenSettings={navigateToSettings}
              greetingReady={!splashVisible && !showWelcome}
            />
          } />
          <Route path="/schedule" element={<ScheduleTab mealsConfig={MEALS_CONFIG} servicesConfig={SERVICES_CONFIG} />} />
          <Route path="/events"   element={<EventsTab />} />
          <Route path="/chat"     element={
            <ChatTab
              upcoming={upcoming}
              birthdayBannerDismissed={birthdayBannerDismissed}
              birthdayBannerClosing={birthdayBannerClosing}
              onDismissBirthdayBanner={dismissBirthdayBanner}
              onOpenBirthdays={() => birthday.setOpen(true)}
            />
          } />
          <Route path="/prayer"   element={<PrayerTab />} />
          <Route path="/bible"    element={<BibleTab />} />
          <Route path="/admin"    element={<AdminPage />} />
          <Route path="/settings" element={
            <SettingsPage
              onClose={() => navigate(-1)}
              onRevisitGuide={() => {
                const key = `cg_welcomed_${userId}_${groupId}`
                removeCookie(key)
                navigate('/home')
                setShowWelcome(true)
              }}
            />
          } />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>

      {showWelcome && (
        <WelcomeSplash
          onDone={() => {
            setShowWelcome(false)
            refreshProfile()
            refreshBirthdays()
          }}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-56 bg-white border-r border-stone-200 z-40">
        <div className="px-4 py-5 border-b border-stone-100 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-ember flex items-center justify-center shrink-0">
            <svg viewBox="0 0 256 256" className="w-4 h-4 fill-white">
              <path d="M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z" />
            </svg>
          </div>
          <span className="font-league-gothic text-2xl text-ember tracking-wide">Coveyspace</span>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {visibleTabs.map(t => {
            const active = location.pathname === t.path
            return (
              <button
                key={t.path}
                onClick={() => handleTabChange(t.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  active ? 'bg-ember text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
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
            onClick={navigateToSettings}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-800 transition-colors"
          >
            <GearSix size={20} />
            Settings
          </button>
        </div>
      </aside>

      <LayoutGroup id="bottom-nav">
        <nav
          className="fixed bottom-nav inset-x-0 bg-white border-t border-stone-200 z-40 flex lg:hidden"
          style={{ paddingBottom: 'var(--sab)' }}
        >
          {visibleTabs.map(t => {
            const active = location.pathname === t.path
            return (
              <button
                key={t.path}
                onClick={() => handleTabChange(t.path)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 px-1 touch-manipulation ${active ? '' : 'text-stone-400'}`}
              >
                <span className={`relative px-3 py-1 ${active ? 'text-white' : ''}`}>
                  {active && (
                    <motion.span
                      layoutId="tab-pill"
                      className="absolute inset-0 bg-ember rounded-2xl"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}
                  <motion.span
                    className="relative z-10 block"
                    initial={false}
                    animate={active ? { scale: [1, 1.28, 1] } : { scale: 1 }}
                    transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <t.Icon size={26} weight={active ? 'fill' : 'regular'} />
                  </motion.span>
                  {t.path === '/chat' && unreadChatCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-coral rounded-full border-2 border-white z-20" />
                  )}
                </span>
                <span className={`text-[13px] font-medium tracking-wide ${active ? 'text-ember' : ''}`}>{t.shortLabel}</span>
              </button>
            )
          })}
        </nav>
      </LayoutGroup>

      {guide.open && (
        <div
          className={`fixed inset-0 lg:left-56 z-30 bg-sunrise-50 overflow-y-auto ${guide.closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
          style={{ paddingTop: 'var(--sat)' }}
        >
          <GuideTab
            onClose={guide.close}
            guideUrl={groupSettings?.guide_url}
            guideType={groupSettings?.guide_type}
            guideContent={groupSettings?.guide_content}
            isAdmin={isAdmin}
            groupId={groupId}
            onGuideSave={async ({ type, url, content }) => {
              const normalized = type === 'url' && url
                ? (!/^https?:\/\//i.test(url.trim()) ? `https://${url.trim()}` : url.trim())
                : (url ?? null)
              const { error } = await supabase
                .from('group_settings')
                .upsert({ group_id: groupId, guide_type: type, guide_url: normalized, guide_content: content ?? null }, { onConflict: 'group_id' })
              if (!error) setGroupSettings(prev => ({ ...prev, guide_type: type, guide_url: normalized, guide_content: content ?? null }))
              return { error }
            }}
          />
        </div>
      )}

      {birthday.open && (
        <div
          className={`fixed inset-0 lg:left-56 z-30 bg-sunrise-50 overflow-y-auto ${birthday.closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
          style={{ paddingTop: 'var(--sat)', overscrollBehavior: 'contain' }}
        >
          <BirthdayTab
            birthdays={birthdays}
            revealKey="birthdays"
            onClose={birthday.close}
            onRefresh={refreshBirthdays}
          />
        </div>
      )}

      {giving.open && (
        <div
          className={`fixed inset-0 lg:left-56 z-30 bg-sunrise-50 overflow-y-auto ${giving.closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
          style={{ paddingTop: 'var(--sat)' }}
        >
          <GivingTab
            onClose={giving.close}
            givingUrl={groupSettings?.giving_url}
            isAdmin={isAdmin}
            onGivingSave={async (url) => {
              const { error } = await supabase
                .from('group_settings')
                .upsert({ group_id: groupId, giving_url: url }, { onConflict: 'group_id' })
              if (!error) setGroupSettings(prev => ({ ...prev, giving_url: url }))
              return { error }
            }}
          />
        </div>
      )}

      <UpdatePrompt splashActive={splashVisible} />
    </div>
    )}
    </Suspense>
    {splashVisible && <SplashScreen exiting={splashExiting} />}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  )
}
