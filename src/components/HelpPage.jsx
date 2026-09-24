import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, CaretDown, UsersThree, ChatCircleDots, HandsPraying, BookOpen, GearSix, ChatTeardropDots } from '@phosphor-icons/react'
import { useAppContext } from '../contexts/AppContext.jsx'
import FeedbackModal from './FeedbackModal.jsx'

const SECTIONS = [
  {
    label: 'Getting Started',
    icon: <UsersThree size={16} weight="fill" />,
    color: 'text-ember bg-ember/10',
    items: [
      {
        q: 'How do I invite someone to my group?',
        a: "Go to Admin → Group Settings → scroll to the Invite Code section. Share that code with anyone you want to add. They'll enter it when they sign up for Coveyspace.",
        adminOnly: false,
      },
      {
        q: 'How do I install Coveyspace on my phone?',
        a: "On iPhone or iPad: open this page in Safari, tap the Share icon at the bottom, then tap \"Add to Home Screen.\"\n\nOn Android: tap the ⋮ menu in your browser, then tap \"Install app\" or \"Add to Home Screen.\"",
        adminOnly: false,
      },
      {
        q: 'Does everyone need to create an account?',
        a: "Yes — each member signs up with their email and the group's invite code. This keeps the group private and lets everyone have their own profile, prayer requests, and message history.",
        adminOnly: false,
      },
    ],
  },
  {
    label: 'Managing Your Group',
    icon: <GearSix size={16} weight="fill" />,
    color: 'text-stone-500 bg-stone-100',
    items: [
      {
        q: 'How do I turn features (tabs) on or off?',
        a: 'Go to Admin → Group Settings → Features. Toggle any tab on or off. Changes take effect immediately for all members.',
        adminOnly: true,
      },
      {
        q: 'How do I set up a service schedule?',
        a: 'Enable the Services feature in Admin → Group Settings → Features. Once enabled, you can configure the day of the week and time your group meets.',
        adminOnly: true,
      },
      {
        q: 'How do I change the group name?',
        a: 'Go to Admin → Group Settings → tap the group name at the top to edit it.',
        adminOnly: true,
      },
      {
        q: 'How do I remove a member?',
        a: 'Go to Admin → Members → tap the member\'s name → Remove from Group.',
        adminOnly: true,
      },
      {
        q: 'Can I make someone else an admin?',
        a: 'Go to Admin → Members → tap the member\'s name → Make Admin. Admins can manage features, members, and group settings.',
        adminOnly: true,
      },
    ],
  },
  {
    label: 'Chat',
    icon: <ChatCircleDots size={16} weight="fill" />,
    color: 'text-sky-600 bg-sky-100',
    items: [
      {
        q: 'How do I send a message to the whole group?',
        a: "Tap the Chat tab and make sure you're in the group conversation (the one with your group's name). Type your message and send.",
        adminOnly: false,
      },
      {
        q: 'How do I edit or delete a message?',
        a: 'Long-press any message you sent to see options for editing or deleting it.',
        adminOnly: false,
      },
      {
        q: 'How do I start a direct message with someone?',
        a: 'In the Chat tab, tap the compose icon in the top right to start a new direct message. Search for the person by name.',
        adminOnly: false,
      },
      {
        q: 'How do I share a photo in chat?',
        a: 'Tap the photo icon next to the message input to pick an image from your camera roll.',
        adminOnly: false,
      },
    ],
  },
  {
    label: 'Prayer',
    icon: <HandsPraying size={16} weight="fill" />,
    color: 'text-sage-700 bg-sage-50',
    items: [
      {
        q: 'How do I add a prayer request?',
        a: "Tap the Prayer tab, then the + button in the top right. Write your request and choose whether it's private (only you can see it) or shared with the group.",
        adminOnly: false,
      },
      {
        q: "How do I pray for someone's request?",
        a: 'Tap the request to open it, then tap "I prayed for this." The person who posted it will get a notification.',
        adminOnly: false,
      },
      {
        q: 'How do I mark a request as answered?',
        a: 'Open the request and tap "Mark as Answered." Answered requests are moved to a separate section so the active list stays focused.',
        adminOnly: false,
      },
      {
        q: 'Can I keep a prayer request private?',
        a: 'Yes — when adding a request, choose "Private" and only you will be able to see it.',
        adminOnly: false,
      },
    ],
  },
  {
    label: 'The Guide',
    icon: <BookOpen size={16} weight="fill" />,
    color: 'text-amber-600 bg-amber-50',
    items: [
      {
        q: 'What is the Guide tab for?',
        a: "The Guide is where you share discussion questions, notes, or resources for your group's meetings. Only admins can post; all members can read.",
        adminOnly: false,
      },
      {
        q: 'How do I post new discussion questions?',
        a: 'Tap the Guide tab, then the + or edit button. You can type content directly or upload a PDF.',
        adminOnly: true,
      },
      {
        q: 'Can members see previous guides?',
        a: 'Yes — all past guides are stored and accessible in the Guide tab.',
        adminOnly: false,
      },
    ],
  },
]

function FAQItem({ q, a, adminOnly }) {
  const [open, setOpen] = useState(false)
  const lines = a.split('\n\n')
  return (
    <div className="border-b border-stone-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-3 px-4 py-3.5 text-left hover:bg-stone-50 transition-colors"
        aria-expanded={open}
      >
        <span className="flex-1 text-sm font-medium text-stone-800 leading-snug">{q}</span>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          {adminOnly && (
            <span className="text-[11px] font-semibold text-ember bg-ember/10 px-1.5 py-0.5 rounded-full leading-none">
              Admin
            </span>
          )}
          <CaretDown
            size={14}
            weight="bold"
            className={`text-stone-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      <div
        className="grid"
        style={{ gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows 200ms cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div className="overflow-hidden min-h-0">
          <div className="px-4 pb-4 flex flex-col gap-2">
            {lines.map((line, i) => (
              <p key={i} className="text-sm text-stone-500 leading-relaxed">{line}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HelpPage() {
  const navigate = useNavigate()
  const { userId, displayName, session } = useAppContext()
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <>
    <main className="max-w-md mx-auto px-4 pt-8 pb-16">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-1 min-w-0 -ml-2">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-11 h-11 flex items-center justify-center rounded-full text-stone-400 hover:text-stone-700 hover:bg-black/5 transition-colors shrink-0"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <h1 className="text-3xl font-bold text-stone-800">Help</h1>
        </div>
        <p className="text-sm text-stone-500 mt-1 ml-1">Answers to common questions about Coveyspace.</p>
      </div>

      {/* FAQ Sections */}
      <div className="flex flex-col gap-4">
        {SECTIONS.map(section => (
          <div key={section.label}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className={`w-5 h-5 rounded-md flex items-center justify-center ${section.color}`}>
                {section.icon}
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{section.label}</p>
            </div>
            <div className="bg-white border border-stone-100 rounded-2xl shadow overflow-hidden">
              {section.items.map(item => (
                <FAQItem key={item.q} {...item} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Send feedback */}
      <div className="mt-6 bg-white border border-stone-100 rounded-2xl shadow overflow-hidden">
        <button
          onClick={() => setFeedbackOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-stone-50 transition-colors"
        >
          <div className="w-8 h-8 rounded-xl bg-ember/10 flex items-center justify-center shrink-0">
            <ChatTeardropDots size={16} weight="fill" className="text-ember" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-stone-800">Still have a question?</p>
            <p className="text-xs text-stone-500 mt-0.5">Send us a message directly.</p>
          </div>
        </button>
      </div>

    </main>

    {feedbackOpen && (
      <FeedbackModal
        userId={userId}
        displayName={displayName}
        email={session?.user?.email}
        onClose={() => setFeedbackOpen(false)}
      />
    )}
    </>
  )
}
