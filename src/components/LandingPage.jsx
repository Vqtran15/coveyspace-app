import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ForkKnife, CalendarCheck, ChatCircleDots, HandsPraying, ArrowRight, DeviceMobile, EnvelopeSimple } from '@phosphor-icons/react'

const FEATURES = [
  {
    Icon: ForkKnife,
    title: 'Meal Signups',
    description: 'Automatically rotate dinner ideas, week after week. No more figuring out what to eat or managing a Google Sheet signup.',
    color: 'bg-jade/10 text-jade',
  },
  {
    Icon: CalendarCheck,
    title: 'Service Schedules',
    description: "Organize who's serving and when. Members sign up directly in the app — no spreadsheets required.",
    color: 'bg-lagoon/10 text-lagoon-600',
  },
  {
    Icon: ChatCircleDots,
    title: 'Group Chat',
    description: 'One place for all your group conversations — no more juggling group texts, GroupMe, or WhatsApp.',
    color: 'bg-sage/20 text-sage-700',
  },
  {
    Icon: HandsPraying,
    title: 'Prayer Requests',
    description: "Prayer requests get their own dedicated space — never buried in a chat thread, always easy to find and revisit.",
    color: 'bg-sunrise/10 text-sunrise',
  },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [leaving, setLeaving] = useState(false)

  function goToLogin() {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => navigate('/login'), 350)
  }

  return (
    <div
      className={`min-h-screen bg-white font-sans transition-all duration-300 ease-in-out ${leaving ? 'opacity-0 translate-y-3' : 'opacity-100 translate-y-0'}`}
    >

      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur border-b border-stone-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-jade flex items-center justify-center">
              <svg viewBox="0 0 256 256" className="w-4 h-4 fill-white">
                <path d="M64.12,147.8a4,4,0,0,1-4,4.2H16a8,8,0,0,1-7.8-6.17,8.35,8.35,0,0,1,1.62-6.93A67.79,67.79,0,0,1,37,117.51a40,40,0,1,1,66.46-35.8,3.94,3.94,0,0,1-2.27,4.18A64.08,64.08,0,0,0,64,144C64,145.28,64,146.54,64.12,147.8Zm182-8.91A67.76,67.76,0,0,0,219,117.51a40,40,0,1,0-66.46-35.8,3.94,3.94,0,0,0,2.27,4.18A64.08,64.08,0,0,1,192,144c0,1.28,0,2.54-.12,3.8a4,4,0,0,0,4,4.2H240a8,8,0,0,0,7.8-6.17A8.33,8.33,0,0,0,246.17,138.89Zm-89,43.18a48,48,0,1,0-58.37,0A72.13,72.13,0,0,0,65.07,212,8,8,0,0,0,72,224H184a8,8,0,0,0,6.93-12A72.15,72.15,0,0,0,157.19,182.07Z" />
              </svg>
            </div>
            <span className="font-league-gothic text-2xl text-jade tracking-wide">Covey Space</span>
          </div>
          <button
            onClick={goToLogin}
            disabled={leaving}
            className="px-4 py-2 bg-jade text-white text-sm font-semibold rounded-xl hover:bg-jade-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Log in
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-b from-jade-50 to-white px-6 pt-20 pb-16 lg:pt-28 lg:pb-24">
        <div className="max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-10">
          {/* Text */}
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-block bg-jade/10 text-jade text-xs font-semibold uppercase tracking-widest px-3 py-1.5 rounded-full mb-6">
              Gathering community made simple
            </div>
            <h1 className="font-league-gothic text-6xl sm:text-7xl lg:text-8xl tracking-wide text-stone-900 leading-none mb-6">
              One place for your<br />whole community.
            </h1>
            <p className="text-stone-500 text-lg leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8">
              Covey Space brings automated meal signups, service schedules, group chats, and prayer requests into one place — built for those who share life together around a table and out in the community.
            </p>
            <div className="flex justify-center lg:justify-start">
              <button
                onClick={goToLogin}
                disabled={leaving}
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-jade text-white font-semibold rounded-2xl text-base hover:bg-jade-700 transition-colors shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Sign up for free <ArrowRight size={18} weight="bold" />
              </button>
            </div>
          </div>

          {/* Phone mockup — desktop only */}
          <div className="hidden lg:flex shrink-0">
            <div className="w-64 p-2.5 bg-stone-800 rounded-[2rem] shadow-2xl">
              <div className="rounded-[1.5rem] overflow-hidden">
                <img src="/screenshots/home-screen.PNG" alt="Covey Space home screen" className="w-full h-auto block" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-league-gothic text-4xl sm:text-5xl text-stone-800 tracking-wide text-center mb-12">
            Everything your group needs.
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ Icon, title, description, color }) => (
              <div key={title} className="rounded-2xl border border-stone-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon size={22} weight="fill" />
                </div>
                <h3 className="font-semibold text-stone-800 mb-1.5">{title}</h3>
                <p className="text-stone-500 text-sm leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="py-16 bg-stone-50 overflow-hidden">
        <h2 className="font-league-gothic text-4xl sm:text-5xl text-stone-800 tracking-wide text-center mb-10">See it in action.</h2>
        <div className="relative">
          <div className="flex gap-5 px-8 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide justify-start lg:justify-center">
            {[
              { src: '/screenshots/home-screen.PNG', label: 'Home' },
              { src: '/screenshots/meal-signup.PNG', label: 'Meal Signup' },
              { src: '/screenshots/service-signup.PNG', label: 'Service Signup' },
              { src: '/screenshots/chat-list.PNG', label: 'Chats' },
              { src: '/screenshots/group-chat.PNG', label: 'Group Chat' },
              { src: '/screenshots/prayer-request.PNG', label: 'Prayer Requests' },
            ].map(({ src, label }) => (
              <div key={label} className="shrink-0 snap-center flex flex-col items-center gap-3">
                <div className="w-44 lg:w-48 p-2 bg-stone-800 rounded-[1.75rem] shadow-2xl">
                  <div className="rounded-[1.25rem] overflow-hidden">
                    <img src={src} alt={label} className="w-full h-auto block" />
                  </div>
                </div>
                <span className="text-xs font-medium text-stone-400">{label}</span>
              </div>
            ))}
          </div>
          {/* Scroll hint — mobile only */}
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-stone-50 to-transparent pointer-events-none lg:hidden" />
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 lg:py-28 bg-jade text-center">
        <div className="max-w-4xl mx-auto">
          <h2 className="font-league-gothic text-5xl sm:text-6xl lg:text-7xl text-white tracking-wide mb-6">
            Bring your whole group together.
          </h2>
          <button
            onClick={goToLogin}
            disabled={leaving}
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-white text-jade font-semibold rounded-2xl text-base hover:bg-jade-50 transition-colors shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Sign up for free <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      </section>

      {/* Add to Home Screen */}
      <section className="px-6 py-20 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-3">
            <DeviceMobile size={28} weight="fill" className="text-jade" />
            <h2 className="font-league-gothic text-4xl sm:text-5xl text-stone-800 tracking-wide">
              Use it like an app.
            </h2>
          </div>
          <p className="text-stone-400 text-sm text-center mb-12">
            Covey Space is a web app — no app store needed. Add it to your home screen for the full app experience.
          </p>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center gap-8">
            {/* Instruction cards */}
            <div className="grid grid-cols-1 gap-6 w-full max-w-sm mx-auto lg:mx-0">
              {/* iOS */}
              <div className="bg-stone-50 rounded-2xl border border-stone-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">iPhone / iPad</p>
                <ol className="flex flex-col gap-3">
                  {[
                    'Open coveyspace.com in Safari',
                    'Tap the Share button (box with arrow) at the bottom of the screen',
                    'Scroll down and tap "Add to Home Screen"',
                    'Tap "Add" in the top right',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-jade/10 text-jade text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-stone-600 text-sm leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Android */}
              <div className="bg-stone-50 rounded-2xl border border-stone-100 shadow-sm p-6">
                <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-4">Android</p>
                <ol className="flex flex-col gap-3">
                  {[
                    'Open coveyspace.com in Chrome',
                    'Tap the three-dot menu in the top right',
                    'Tap "Add to Home Screen" or "Install App"',
                    'Tap "Add" to confirm',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-jade/10 text-jade text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-stone-600 text-sm leading-relaxed">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {/* Phone screenshot */}
            <div className="flex justify-center shrink-0">
              <div className="w-52 lg:w-60 p-2 bg-stone-800 rounded-[1.75rem] shadow-2xl">
                <div className="rounded-[1.25rem] overflow-hidden">
                  <img src="/screenshots/add-to-home.PNG" alt="Add to Home Screen" className="w-full h-auto block" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="px-6 py-20 bg-stone-50 text-center">
        <div className="max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-jade/10 flex items-center justify-center mx-auto mb-5">
            <EnvelopeSimple size={24} weight="fill" className="text-jade" />
          </div>
          <h2 className="font-league-gothic text-4xl sm:text-5xl text-stone-800 tracking-wide mb-3">
            Have questions?
          </h2>
          <p className="text-stone-400 text-sm leading-relaxed mb-6">
            Whether you're a pastor, group leader, or just curious — reach out and I'll get back to you.
          </p>
          <a
            href="mailto:hello@coveyspace.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-jade hover:bg-jade-700 text-white font-semibold rounded-2xl text-sm transition-colors"
          >
            <EnvelopeSimple size={16} weight="bold" />
            hello@coveyspace.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 bg-stone-900">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-league-gothic text-xl text-stone-400 tracking-wide">Covey Space</span>
          <p className="text-stone-600 text-xs">© {new Date().getFullYear()} Covey Space. All rights reserved.</p>
        </div>
      </footer>

    </div>
  )
}
