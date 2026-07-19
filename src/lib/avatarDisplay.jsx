import { lazy, Suspense } from 'react'

export const AVATAR_COLOR_OPTIONS = [
  { key: 'jade',        bgClass: 'bg-jade',         label: 'Rust'     },
  { key: 'coral',       bgClass: 'bg-coral',         label: 'Clay'     },
  { key: 'lagoon-700',  bgClass: 'bg-lagoon-700',    label: 'Amber'    },
  { key: 'sage-700',    bgClass: 'bg-sage-700',      label: 'Forest'   },
  { key: 'sunrise-800', bgClass: 'bg-sunrise-800',   label: 'Brown'    },
  { key: 'stone-500',   bgClass: 'bg-stone-500',     label: 'Stone'    },
]

const AVATAR_COLOR_MAP = Object.fromEntries(AVATAR_COLOR_OPTIONS.map(o => [o.key, o.bgClass]))
const AVATAR_COLORS_DEFAULT = ['bg-jade', 'bg-coral', 'bg-lagoon-700']

export function avatarColor(userId = '', colorKey = null) {
  if (colorKey && AVATAR_COLOR_MAP[colorKey]) return AVATAR_COLOR_MAP[colorKey]
  const n = (userId.charCodeAt(0) ?? 0) + (userId.charCodeAt((userId.length - 1) || 0) ?? 0)
  return AVATAR_COLORS_DEFAULT[n % AVATAR_COLORS_DEFAULT.length]
}

const SIZE_DIM  = { xs: 'w-4 h-4', '8': 'w-8 h-8', '9': 'w-9 h-9', sm: 'w-7 h-7', md: 'w-10 h-10', '11': 'w-11 h-11', lg: 'w-16 h-16' }
const SIZE_ICON = { xs: 7,         '8': 16,          '9': 18,         sm: 13,         md: 20,          '11': 22,          lg: 28 }
const SIZE_TEXT = { xs: 'text-[7px] font-bold', '8': 'text-xs font-bold', '9': 'text-xs font-bold', sm: 'text-[11px] font-bold', md: 'text-sm font-bold', '11': 'text-sm font-bold', lg: 'text-xl font-bold' }

const LazyAvatarIcon = lazy(() => import('./avatarIcons.jsx').then(m => ({ default: m.AvatarIcon })))

function _initials(name) {
  return (name ?? '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

export function AvatarCircle({ icon, name, userId, colorKey, size = 'md', imageUrl }) {
  const dim = SIZE_DIM[size] ?? SIZE_DIM.md
  if (imageUrl) {
    return (
      <div className={`${dim} rounded-full overflow-hidden shrink-0 bg-stone-200 shadow-md`}>
        <img src={imageUrl} alt={name ?? ''} className="w-full h-full object-cover" />
      </div>
    )
  }
  const iconSize = SIZE_ICON[size] ?? SIZE_ICON.md
  return (
    <div className={`${dim} rounded-full ${avatarColor(userId, colorKey)} flex items-center justify-center shrink-0`}>
      {icon
        ? <Suspense fallback={<span className={`${SIZE_TEXT[size] ?? SIZE_TEXT.md} text-white`}>{_initials(name)}</span>}>
            <LazyAvatarIcon name={icon} size={iconSize} />
          </Suspense>
        : <span className={`${SIZE_TEXT[size] ?? SIZE_TEXT.md} text-white`}>{_initials(name)}</span>
      }
    </div>
  )
}
