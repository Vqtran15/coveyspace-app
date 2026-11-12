import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { ForkKnife, HandHeart, ChatCircleDots, HandsPraying, House, WifiSlash, NotePencil, GearSix, CalendarHeart, Books, ShieldCheck, Church } from '@phosphor-icons/react'
import { haptic } from './lib/haptic.js'
import { trackEvent, trackPageView } from './lib/analytics.js'
import { useAnimatedOverlay } from './hooks/useAnimatedOverlay.js'
import { useSwipeNavigation } from './hooks/useSwipeNavigation.js'
import { getUpcomingBirthdays } from './utils/birthdays.js'
import { supabase } from './lib/supabase.js'
import { getCookie, setCookie, removeCookie } from './lib/cookies.js'
import { AppProvider, useAppContext } from './contexts/AppContext.jsx'
import { tabScrollRef } from './lib/tabScrollRef.js'
import { AvatarCircle } from './lib/avatarIcons.jsx'
import SplashScreen from './components/SplashScreen.jsx'

import BirthdayBanner       from './components/BirthdayBanner.jsx'
import FullScreenConfetti   from './components/FullScreenConfetti.jsx'
import PrayerReactionBanner from './components/PrayerReactionBanner.jsx'
import UpdatePrompt         from './components/UpdatePrompt.jsx'
import AnnouncementBanner   from './components/AnnouncementBanner.jsx'
import GroupWelcomeBack     from './components/GroupWelcomeBack.jsx'
import NoGroupScreen        from './components/NoGroupScreen.jsx'

const ScheduleTab       = lazy(() => import('./components/ScheduleTab.jsx'))
const BirthdayTab       = lazy(() => import('./components/BirthdayTab.jsx'))
const PrayerTab         = lazy(() => import('./components/PrayerTab.jsx'))
const ChatTab           = lazy(() => import('./components/ChatTab.jsx'))
const GuideTab          = lazy(() => import('./components/GuideTab.jsx'))
const GivingTab         = lazy(() => import('./components/GivingTab.jsx'))
const OverviewTab       = lazy(() => import('./components/OverviewTab.jsx'))
const EventsTab         = lazy(() => import('./components/EventsTab.jsx'))
const ResourcesTab      = lazy(() => import('./components/ResourcesTab.jsx'))
const AuthPage          = lazy(() => import('./components/AuthPage.jsx'))
const ResetPasswordPage = lazy(() => import('./components/ResetPasswordPage.jsx'))
const WelcomeSplash     = lazy(() => import('./components/WelcomeSplash.jsx'))
const SettingsPage      = lazy(() => import('./components/SettingsPage.jsx'))
const AdminPage         = lazy(() => import('./components/AdminPage.jsx'))
const ChurchSettingsPage   = lazy(() => import('./components/ChurchSettingsPage.jsx'))
const ChurchAnalyticsPage = lazy(() => import('./components/ChurchAnalyticsPage.jsx'))
const DangerZonePage     = lazy(() => import('./components/DangerZonePage.jsx'))
const HelpPage           = lazy(() => import('./components/HelpPage.jsx'))
const NewMessagePage     = lazy(() => import('./components/NewMessagePage.jsx'))
const FeedbackPage       = lazy(() => import('./components/FeedbackPage.jsx'))
const AddEventPage       = lazy(() => import('./components/AddEventPage.jsx'))
const SignupPage         = lazy(() => import('./components/SignupPage.jsx'))
const AddPassagePage     = lazy(() => import('./components/AddPassagePage.jsx'))

const MEALS_CONFIG = {
  label: 'Meal Signup',
  Icon: ForkKnife,
  editLabel: 'Edit this meal',
  editSubLabel: 'Edit title, date, and options',
  noun: 'Option',
  itemNoun: 'Option',
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
  editSubLabel: 'Edit title, date, and options',
  noun: 'Option',
  itemNoun: 'Option',
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
  { path: '/bible',    shortLabel: 'Resources', Icon: Books },
]

const PATHS = TABS.map(t => t.path)
const OFF_NAV_PATHS = ['/settings', '/admin', '/church-settings', '/church-analytics', '/danger-zone', '/help', '/new-message', '/feedback']

const IS_PWA =
  window.matchMedia?.('(display-mode: standalone)').matches ||
  ('standalone' in window.navigator && window.navigator.standalone === true)

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    session, userId, authLoading, isRecovery, clearRecovery, profileLoaded,
    displayName, groupId, groupName, isAdmin, isChurchAdmin,
    avatarIcon, avatarColorKey, avatarImageUrl,
    groupSettings, setGroupSettings,
    mealsEnabled, servicesEnabled, chatEnabled, prayerEnabled,
    birthdaysEnabled, guideEnabled, givingEnabled, eventsEnabled, bibleEnabled,
    showScheduleTab,
    birthdays, refreshBirthdays,
    unreadChatCount, setUnreadChatCount,
    unreadPrayerCount, setUnreadPrayerCount,
    push,
    onDisplayNameChange, onAvatarChange, onGroupSettingsChange, onGroupNameChange,
    setProfile, refreshProfile,
  } = useAppContext()

  const prevIndexRef       = useRef(PATHS.indexOf(location.pathname))
  const locationRef        = useRef(location.pathname)
  const enterFromRef       = useRef('right')
  const scrollContainerRef = useRef(null)
  const navRef          = useRef(null)
  const pillInitialized = useRef(false)
  const [pillStyle, setPillStyle] = useState(null)
  const [navMounted, setNavMounted] = useState(0)

  // Callback ref: reset pill when nav unmounts (chat opens) so it snaps on next mount.
  // Increment navMounted when the nav element appears so the pill effect re-runs and
  // snaps the indicator into place before the user's first tap.
  const setNavRef = useCallback(el => {
    navRef.current = el
    if (!el) { pillInitialized.current = false; setPillStyle(null) }
    else { setNavMounted(n => n + 1) }
  }, [])

  const setScrollRef = useCallback(el => {
    scrollContainerRef.current = el
    tabScrollRef.current = el
  }, [])

  const [splashVisible, setSplashVisible] = useState(true)
  const [splashExiting, setSplashExiting] = useState(false)
  const [splashMinDone, setSplashMinDone] = useState(false)
  const [resumeKey,     setResumeKey]     = useState(0)
  const hiddenAtRef      = useRef(null)
  const splashShownAtRef = useRef(Date.now())
  const [showWelcome, setShowWelcome] = useState(false)
  const [welcomeBackGroupName, setWelcomeBackGroupName] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  const guide    = useAnimatedOverlay(260)
  const giving   = useAnimatedOverlay(260)
  const birthday = useAnimatedOverlay(260)

  const [birthdayBannerDismissed, setBirthdayBannerDismissed] = useState(false)
  const [birthdayBannerClosing,   setBirthdayBannerClosing]   = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [announcement, setAnnouncement]           = useState(null)
  const [announcementClosing, setAnnouncementClosing] = useState(false)
  const [prayerBanner, setPrayerBanner]           = useState(null)
  const [prayerBannerClosing, setPrayerBannerClosing] = useState(false)

  // ── Fresh-session redirect: always open on /home after kill+relaunch ──────
  useEffect(() => {
    if (!sessionStorage.getItem('covey_session')) {
      sessionStorage.setItem('covey_session', '1')
      if (location.pathname !== '/home' && location.pathname !== '/login') {
        navigate('/home', { replace: true })
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Splash screen ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setSplashMinDone(true), 1200)
    return () => clearTimeout(t)
  }, [])

  // Re-show splash when the app resumes from a long background session so the
  // viewport stability polling can run again before the nav appears.
  useEffect(() => {
    const THRESHOLD_MS = 10_000
    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      if (hiddenAtRef.current === null) return
      const ms = Date.now() - hiddenAtRef.current
      hiddenAtRef.current = null
      if (ms < THRESHOLD_MS) return
      splashShownAtRef.current = Date.now()
      setSplashVisible(true)
      setSplashExiting(false)
      setResumeKey(k => k + 1)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(() => {
    if (authLoading || !splashMinDone) return

    // iOS PWA launch: window.innerHeight expands silently (no resize events) for
    // ~700ms while the system zoom animation runs. Wait for it to settle BEFORE
    // starting the splash fade-out so the nav never appears mid-expansion.
    let lastH = window.innerHeight
    let stableTimer = null
    let poll = null

    // Guarantee the splash is visible long enough for its content animations to
    // complete (~680ms) plus a brief settle. 1400ms from when the splash was
    // shown covers both cold launch (splashMinDone fires at 1200ms) and resume
    // (shown immediately, viewport may already be stable within 300ms).
    const MIN_SHOW_MS = 1400
    function onStable() {
      clearInterval(poll)
      const delay = Math.max(0, MIN_SHOW_MS - (Date.now() - splashShownAtRef.current))
      setTimeout(() => {
        setSplashExiting(true)
        setTimeout(() => setSplashVisible(false), 350)
      }, delay)
    }
    function resetStable() {
      clearTimeout(stableTimer)
      stableTimer = setTimeout(onStable, 300)
    }

    resetStable()
    poll = setInterval(() => {
      const h = window.innerHeight
      if (h !== lastH) { lastH = h; resetStable() }
    }, 50)

    return () => { clearTimeout(stableTimer); clearInterval(poll) }
  }, [authLoading, splashMinDone, resumeKey])

  // ── Stale-chunk reload — fires when old SW serves index.html for a new JS chunk ──
  useEffect(() => {
    function onUnhandledRejection(e) {
      const msg = String(e.reason?.message ?? e.reason ?? '')
      if (
        msg.includes('MIME type') ||
        msg.includes('dynamically imported module') ||
        msg.includes('Failed to fetch dynamically') ||
        msg.includes('Importing a module script failed')
      ) {
        window.location.reload()
      }
    }
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }, [])

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

  // ── PWA class on <html> for CSS branching ─────────────────────────────────
  useEffect(() => {
    if (IS_PWA) document.documentElement.classList.add('is-pwa')
  }, [])

  // Phase 2 SAB measurement: by the time this effect runs, the +1px minHeight
  // is in the DOM, so env(safe-area-inset-bottom) returns the correct value on
  // iOS without needing scrollTo(0,1). No forced scroll = no viewport shift.
  useEffect(() => {
    function measureSAB() {
      const el = document.createElement('div')
      el.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom,0px);pointer-events:none;visibility:hidden;opacity:0'
      document.body.appendChild(el)
      const h = el.getBoundingClientRect().height
      document.body.removeChild(el)
      return h
    }
    function applySAB(h) {
      document.documentElement.style.setProperty('--sab', h + 'px')
      try { localStorage.setItem('covey_sab', String(h)) } catch {}
    }
    const h = measureSAB()
    if (h > 0) { applySAB(h); return }
    // env() still 0 — retry once after a short delay
    const id = setTimeout(() => {
      const h2 = measureSAB()
      if (h2 > 0) applySAB(h2)
    }, 300)
    return () => clearTimeout(id)
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
  }, [groupId, userId])

  // ── Prayer unread — initial load + realtime ────────────────────────────────
  useEffect(() => {
    if (!groupId || !userId) return
    const since = localStorage.getItem('lastSeenPrayerAt') ?? new Date(0).toISOString()
    Promise.all([
      supabase.from('prayer_requests')
        .select('id', { count: 'exact', head: true })
        .eq('community_group_id', groupId)
        .neq('member_user_id', userId)
        .gt('created_at', since),
      supabase.from('group_prayer_requests')
        .select('id', { count: 'exact', head: true })
        .eq('community_group_id', groupId)
        .gt('created_at', since),
    ]).then(([indRes, grpRes]) => {
      const total = (indRes.count ?? 0) + (grpRes.count ?? 0)
      if (total > 0 && locationRef.current !== '/prayer') setUnreadPrayerCount(total)
    })
    const channel = supabase
      .channel(`prayer-unread:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'prayer_requests',
        filter: `community_group_id=eq.${groupId}`,
      }, ({ new: req }) => {
        if (locationRef.current !== '/prayer' && req.member_user_id !== userId)
          setUnreadPrayerCount(c => c + 1)
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_prayer_requests',
        filter: `community_group_id=eq.${groupId}`,
      }, () => {
        if (locationRef.current !== '/prayer') setUnreadPrayerCount(c => c + 1)
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [groupId, userId])

  // ── Location tracking + page view ─────────────────────────────────────────
  useEffect(() => {
    locationRef.current = location.pathname
    if (location.pathname === '/chat') {
      setUnreadChatCount(0)
      navigator.clearAppBadge?.().catch(() => {})
    }
    if (location.pathname === '/prayer') {
      setUnreadPrayerCount(0)
      localStorage.setItem('lastSeenPrayerAt', new Date().toISOString())
    }
    scrollContainerRef.current?.scrollTo({ top: 0 })
    trackPageView(location.pathname)
  }, [location.pathname])

  // ── Derived ────────────────────────────────────────────────────────────────
  const upcoming = session && !authLoading ? getUpcomingBirthdays(birthdays) : []
  const hasTodayBirthday = birthdaysEnabled && upcoming.some(b => b.daysUntil === 0)

  // ── Birthday confetti — fires once when a group member has a birthday today ──
  const confettiFiredRef = useRef(false)
  useEffect(() => {
    if (hasTodayBirthday && !confettiFiredRef.current && !splashVisible) {
      confettiFiredRef.current = true
      setShowConfetti(true)
    }
  }, [hasTodayBirthday, splashVisible])
  // Stable reference so FullScreenConfetti's useEffect([onDone]) never re-fires mid-animation
  const handleConfettiDone = useCallback(() => setShowConfetti(false), [])

  useEffect(() => {
    import('./components/BirthdayTab.jsx')
    import('./components/GuideTab.jsx')
    import('./components/GivingTab.jsx')
  }, [])

  useEffect(() => {
    if (isAdmin) {
      import('./components/AdminPage.jsx')
      import('./components/DangerZonePage.jsx')
    }
    if (isChurchAdmin) {
      import('./components/ChurchSettingsPage.jsx')
      import('./components/ChurchAnalyticsPage.jsx')
    }
  }, [isAdmin, isChurchAdmin])

  const isChat = location.pathname === '/chat'
  const isFullHeight = isChat
  const [chatViewOpen, setChatViewOpen] = useState(false)

  const visibleTabs = useMemo(() => TABS.filter(t => {
    if (t.path === '/schedule') return showScheduleTab
    if (t.path === '/events')   return eventsEnabled
    if (t.path === '/chat')     return chatEnabled
    if (t.path === '/prayer')   return prayerEnabled
    if (t.path === '/bible')    return bibleEnabled || guideEnabled || givingEnabled
    return true
  }), [showScheduleTab, eventsEnabled, chatEnabled, prayerEnabled, bibleEnabled, guideEnabled, givingEnabled])

  // ── Sliding nav pill indicator ─────────────────────────────────────────────
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const btn = nav.querySelector('[data-active]')
    if (!btn) { setPillStyle(null); return }
    const nr       = nav.getBoundingClientRect()
    const br       = btn.getBoundingClientRect()
    const tabCount = nav.querySelectorAll('button').length
    const inset    = tabCount <= 3 ? 0 : 4
    const next = {
      position: 'absolute',
      left:   br.left - nr.left + inset,
      top:    br.top  - nr.top  + inset,
      width:  br.width  - inset * 2,
      height: br.height - inset * 2,
      borderRadius: tabCount <= 3 ? '1rem' : '9999px',
    }
    if (!pillInitialized.current) {
      setPillStyle({ ...next, transition: 'none' })
      pillInitialized.current = true
    } else {
      setPillStyle({ ...next, transition: 'left .42s cubic-bezier(.34,1.56,.64,1), top .42s cubic-bezier(.34,1.56,.64,1), width .25s ease, height .25s ease, border-radius .2s ease' })
    }
  }, [location.pathname, chatViewOpen, visibleTabs.length, navMounted])

  // ── Desktop keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      const inInput = e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable
      if (e.key === 'Escape' && !inInput) {
        if (welcomeBackGroupName) { setWelcomeBackGroupName(null); return }
        if (guide.open) guide.close()
        else if (giving.open) giving.close()
        else if (birthday.open) birthday.close()
        return
      }
      if (inInput || e.metaKey || e.ctrlKey || e.altKey) return
      const num = parseInt(e.key)
      if (!isNaN(num) && num >= 1 && num <= visibleTabs.length) {
        handleTabChange(visibleTabs[num - 1].path)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [guide.open, giving.open, birthday.open, welcomeBackGroupName, visibleTabs])

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
    if (guide.open) guide.close()
    if (giving.open) giving.close()
    if (birthday.open) birthday.close()
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

  // ── Swipe navigation ───────────────────────────────────────────────────────
  useSwipeNavigation({
    enabled: !chatViewOpen && !showWelcome && !guide.open && !giving.open && !birthday.open && !OFF_NAV_PATHS.includes(location.pathname),
    onSwipeLeft: () => {
      const idx = visibleTabs.findIndex(t => t.path === location.pathname)
      if (idx >= 0 && idx < visibleTabs.length - 1) handleTabChange(visibleTabs[idx + 1].path)
    },
    onSwipeRight: () => {
      const idx = visibleTabs.findIndex(t => t.path === location.pathname)
      if (idx > 0) handleTabChange(visibleTabs[idx - 1].path)
    },
  })

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
    ) : profileLoaded && !groupId ? (
      <NoGroupScreen />
    ) : (
    <div className="bg-sunrise-50 lg:pl-56" style={{ minHeight: 'calc(100dvh + 1px)' }}>
      {!isOnline && (
        <div className="fixed inset-x-0 lg:left-56 z-[150] flex items-center justify-center gap-2 bg-stone-800 text-white text-xs font-medium py-2 px-4 animate-toast-in" style={{ top: 'var(--sat)' }}>
          <WifiSlash size={14} weight="bold" />
          You're offline
        </div>
      )}

      {!isFullHeight ? (
        // Non-chat tabs: in-flow flex column, height: 100dvh.
        //
        // IMPORTANT: do NOT use position:fixed here. A fixed element always creates
        // a CSS stacking context. Any child z-index is then LOCAL to that context,
        // so a modal at z-50 inside a fixed container competes only within that
        // container — never against the nav pill at z-40 in the root context. The
        // nav pill would cover every modal regardless of the modal's z-index.
        //
        // Using in-flow (no position) means no stacking context is created, so
        // position:fixed modals rendered inside Route components escape to the root
        // stacking context and their z-50 correctly beats the nav pill's z-40.
        //
        // 100dvh (native CSS) gives the full-screen height without any JS dependency.
        // paddingTop:sat offsets content below the status bar. With box-sizing:border-box
        // the total height stays 100dvh, keeping the document exactly at viewport
        // height so preventElasticScroll blocks all document bounce.
        <div
          className="bg-sunrise-50 flex flex-col"
          style={{ height: '100dvh', paddingTop: 'var(--sat)' }}
        >
          {showConfetti && (
            <FullScreenConfetti onDone={handleConfettiDone} />
          )}

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            <div
              ref={setScrollRef}
              className="tab-scroll-content"
              style={{
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                overscrollBehavior: 'contain',
                paddingBottom: 'calc(max(16px, var(--sab) + 8px) + 68px)',
              }}
            >
              {/* Banners inside scroll area — scroll with content */}
              {(announcement || announcementClosing) && (
                <AnnouncementBanner announcement={announcement} closing={announcementClosing} onDismiss={dismissAnnouncement} />
              )}
              {birthdaysEnabled && !birthdayBannerDismissed && location.pathname !== '/bible' && (location.pathname !== '/home' || upcoming.some(b => b.daysUntil === 0)) && (
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
                className={`lg:pb-0 ${
                  OFF_NAV_PATHS.includes(location.pathname)
                    ? 'animate-slide-in-up'
                    : OFF_NAV_PATHS.includes(locationRef.current)
                    ? 'animate-slide-in-left'
                    : enterFromRef.current === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
                }`}
              >
              <Routes>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home"     element={
                  <OverviewTab
                    onOpenBirthdays={() => birthday.setOpen(true)}
                    onOpenSettings={navigateToSettings}
                    greetingReady={!splashVisible && !showWelcome}
                  />
                } />
                <Route path="/schedule" element={<ScheduleTab mealsConfig={MEALS_CONFIG} servicesConfig={SERVICES_CONFIG} />} />
                <Route path="/events"   element={<EventsTab />} />
                <Route path="/prayer"   element={<PrayerTab />} />
                <Route path="/bible"    element={<ResourcesTab
                  onOpenGuide={() => guide.setOpen(true)}
                  onOpenGiving={() => giving.setOpen(true)}
                  birthdayBanner={birthdaysEnabled && !birthdayBannerDismissed && upcoming.length > 0 ? (
                    <BirthdayBanner
                      upcoming={upcoming}
                      closing={birthdayBannerClosing}
                      onDismiss={dismissBirthdayBanner}
                      onTap={() => { dismissBirthdayBanner(); birthday.setOpen(true) }}
                    />
                  ) : null}
                />} />
                <Route path="/admin"           element={<AdminPage />} />
                <Route path="/church-settings"  element={<ChurchSettingsPage />} />
                <Route path="/church-analytics" element={isChurchAdmin ? <ChurchAnalyticsPage /> : <Navigate to="/settings" replace />} />
                <Route path="/danger-zone"     element={<DangerZonePage />} />
                <Route path="/help"            element={<HelpPage />} />
                <Route path="/new-message"     element={<NewMessagePage />} />
                <Route path="/events/new"       element={<AddEventPage />} />
                <Route path="/schedule/signup"  element={<SignupPage />} />
                <Route path="/bible/add-passage" element={<AddPassagePage />} />
                <Route path="/feedback"        element={<FeedbackPage />} />
                <Route path="/settings" element={
                  <SettingsPage
                    onClose={() => navigate(-1)}
                    onRevisitGuide={() => {
                      const key = `cg_welcomed_${userId}_${groupId}`
                      removeCookie(key)
                      navigate('/home')
                      setShowWelcome(true)
                    }}
                    onGroupSwitch={(name) => setWelcomeBackGroupName(name)}
                  />
                } />
                <Route path="*" element={<Navigate to="/home" replace />} />
              </Routes>
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Chat tab: ChatView manages its own full-screen sizing via .chat-container
        // CSS. Keep it in document flow so that class-based height rule applies.
        <div
          key={location.pathname}
          className={
            OFF_NAV_PATHS.includes(location.pathname)
              ? 'animate-slide-in-up'
              : OFF_NAV_PATHS.includes(locationRef.current)
              ? 'animate-slide-in-left'
              : enterFromRef.current === 'right' ? 'animate-slide-in-right' : 'animate-slide-in-left'
          }
        >
          <Routes>
            <Route path="/chat" element={
              <ChatTab
                upcoming={upcoming}
                birthdayBannerDismissed={birthdayBannerDismissed}
                birthdayBannerClosing={birthdayBannerClosing}
                onDismissBirthdayBanner={dismissBirthdayBanner}
                onOpenBirthdays={() => birthday.setOpen(true)}
                onConvOpen={setChatViewOpen}
              />
            } />
          </Routes>
        </div>
      )}

      {showWelcome && (
        <WelcomeSplash
          onDone={() => {
            setShowWelcome(false)
            refreshProfile()
            refreshBirthdays()
          }}
        />
      )}

      {welcomeBackGroupName && (
        <GroupWelcomeBack
          name={welcomeBackGroupName}
          onDone={() => setWelcomeBackGroupName(null)}
        />
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col fixed inset-y-0 left-0 w-56 bg-stone-50 border-r border-stone-200 z-40">
        <div className="px-4 py-5 border-b border-stone-200 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-ember flex items-center justify-center shrink-0">
            <svg viewBox="0 0 256 256" className="w-4 h-4 fill-white">
              <path d="M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z" />
            </svg>
          </div>
          <span className="text-2xl font-bold text-stone-800 tracking-tight">Coveyspace</span>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          {visibleTabs.map((t, i) => {
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
                {t.path === '/chat' && unreadChatCount > 0
                  ? <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-coral text-white text-[11px] font-bold rounded-full flex items-center justify-center tabular-nums">{unreadChatCount > 99 ? '99+' : unreadChatCount}</span>
                  : t.path === '/prayer' && unreadPrayerCount > 0
                  ? <span className="ml-auto min-w-[18px] h-[18px] px-1 bg-coral text-white text-[11px] font-bold rounded-full flex items-center justify-center tabular-nums">{unreadPrayerCount > 99 ? '99+' : unreadPrayerCount}</span>
                  : <span className={`ml-auto text-[10px] font-medium tabular-nums ${active ? 'text-white/50' : 'text-stone-300'}`}>{i + 1}</span>
                }
              </button>
            )
          })}
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mt-1 ${
                location.pathname === '/admin' ? 'bg-ember text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
              }`}
            >
              <ShieldCheck size={20} weight={location.pathname === '/admin' ? 'fill' : 'regular'} />
              Group Settings
            </button>
          )}
          {isChurchAdmin && (
            <button
              onClick={() => navigate('/church-settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors mt-1 ${
                location.pathname === '/church-settings' ? 'bg-ember text-white' : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
              }`}
            >
              <Church size={20} weight={location.pathname === '/church-settings' ? 'fill' : 'regular'} />
              Church Settings
            </button>
          )}
        </nav>
        <div className="px-3 py-3 border-t border-stone-100">
          <button
            onClick={navigateToSettings}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-100 transition-colors text-left"
          >
            <AvatarCircle size="8" icon={avatarIcon} colorKey={avatarColorKey} userId={userId} name={displayName} imageUrl={avatarImageUrl} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-800 truncate leading-tight">{displayName}</p>
              {groupName && <p className="text-xs text-stone-400 truncate leading-tight mt-0.5">{groupName}</p>}
            </div>
            <GearSix size={16} className="text-stone-400 shrink-0" />
          </button>
        </div>
      </aside>

      {!chatViewOpen && (splashExiting || !splashVisible) && (
          <nav
            ref={setNavRef}
            className={`pill-nav fixed left-1/2 -translate-x-1/2 z-40 lg:hidden bg-white/90 backdrop-blur-sm shadow-lg border border-stone-100 flex items-center py-1.5 ${visibleTabs.length <= 3 ? 'rounded-3xl px-3 gap-2' : 'rounded-full px-2'}`}
            style={{ bottom: 'max(16px, calc(var(--sab) + 8px))' }}
          >
            {pillStyle && <span className="bg-ember pointer-events-none" style={pillStyle} />}
            {visibleTabs.map(t => {
              const active = location.pathname === t.path
              const showLabel = visibleTabs.length <= 3
              return (
                <button
                  key={t.path}
                  onClick={() => handleTabChange(t.path)}
                  className={`relative flex flex-col items-center justify-center touch-manipulation ${showLabel ? 'w-16 h-16 gap-0.5 rounded-2xl' : 'w-14 h-12 rounded-full'}`}
                  style={{ contain: 'layout' }}
                  {...(active ? { 'data-active': '' } : {})}
                >
                  {/* Static fallback until the shared sliding indicator is positioned */}
                  {active && !pillStyle && (
                    <span className={`absolute bg-ember ${showLabel ? 'rounded-2xl inset-0' : 'rounded-full inset-1'}`} />
                  )}
                  <span
                    key={active ? `${t.path}-on` : `${t.path}-off`}
                    className={`relative z-10${active ? ' animate-icon-bounce' : ''}`}
                  >
                    <t.Icon
                      size={26}
                      weight={active ? 'fill' : 'regular'}
                      className={active ? 'text-white' : 'text-stone-500'}
                    />
                  </span>
                  {showLabel && (
                    <span className={`relative z-10 text-[13px] font-medium leading-none ${active ? 'text-white' : 'text-stone-500'}`}>
                      {t.shortLabel}
                    </span>
                  )}
                  {((t.path === '/chat' && unreadChatCount > 0) || (t.path === '/prayer' && unreadPrayerCount > 0)) && (
                    <>
                      <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-coral/50 rounded-full animate-ping" />
                      <span className="absolute top-1.5 right-2 w-2.5 h-2.5 bg-coral rounded-full border-2 border-white z-20" />
                    </>
                  )}
                </button>
              )
            })}
          </nav>
      )}

      {guide.open && (
        <>
          <div
            className={`hidden lg:block fixed inset-0 lg:left-56 z-[29] bg-black/40 ${guide.closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
            onClick={guide.close}
          />
          <div
            className={`fixed inset-0 lg:left-56 z-30 overflow-y-auto lg:overflow-hidden bg-sunrise-50 lg:bg-transparent lg:flex lg:items-start lg:justify-center lg:py-12 ${guide.closing ? 'animate-guide-close' : 'animate-guide-open'}`}
            style={{ paddingTop: 'var(--sat)', willChange: 'transform, opacity' }}
          >
            <div className="w-full min-h-full bg-sunrise-50 lg:min-h-0 lg:max-w-3xl lg:rounded-2xl lg:shadow-2xl lg:overflow-y-auto lg:max-h-full">
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
          </div>
        </>
      )}

      {birthday.open && (
        <>
          <div
            className={`hidden lg:block fixed inset-0 lg:left-56 z-[29] bg-black/40 ${birthday.closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
            onClick={birthday.close}
          />
          <div
            className={`fixed inset-0 lg:left-56 z-30 lg:flex lg:items-start lg:justify-center lg:py-12 lg:bg-transparent ${birthday.closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
          >
            <div className="w-full h-full bg-sunrise-50 lg:h-auto lg:max-h-full lg:max-w-xl lg:rounded-2xl lg:shadow-2xl lg:overflow-hidden">
              <BirthdayTab
                birthdays={birthdays}
                revealKey="birthdays"
                onClose={birthday.close}
              />
            </div>
          </div>
        </>
      )}

      {giving.open && (
        <>
          <div
            className={`hidden lg:block fixed inset-0 lg:left-56 z-[29] bg-black/40 ${giving.closing ? 'animate-overlay-out' : 'animate-overlay-in'}`}
            onClick={giving.close}
          />
          <div
            className={`fixed inset-0 lg:left-56 z-30 overflow-y-auto lg:overflow-hidden bg-sunrise-50 lg:bg-transparent lg:flex lg:items-start lg:justify-center lg:py-12 ${giving.closing ? 'animate-slide-out-right' : 'animate-slide-in-right'}`}
            style={{ paddingTop: 'var(--sat)' }}
          >
            <div className="w-full min-h-full bg-sunrise-50 lg:min-h-0 lg:max-w-2xl lg:rounded-2xl lg:shadow-2xl lg:overflow-y-auto lg:max-h-full">
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
          </div>
        </>
      )}

      <UpdatePrompt />
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
