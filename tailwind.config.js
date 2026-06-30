import scrollbarHide from 'tailwind-scrollbar-hide'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        'league-gothic': ['"League Gothic"', 'sans-serif'],
      },
      colors: {
        coral: {
          light: '#FEF4EE',
          100:   '#FBDDD0',
          DEFAULT:'#B85A3A',
          600:   '#9E4A2E',
          700:   '#833C22',
        },
        jade: {
          50:    '#FEF4EE',
          DEFAULT:'#C4622D',
          700:   '#A85228',
          800:   '#8C4220',
        },
        lagoon: {
          50:    '#FEF9EC',
          100:   '#FDEDC8',
          200:   '#FBD98A',
          DEFAULT:'#E8A838',
          600:   '#C48A20',
          700:   '#A07015',
        },
        sage: {
          50:    '#EDF6EE',
          DEFAULT:'#A1CCA6',
          700:   '#3D6E44',
        },
        sunrise: {
          50:    '#FBF8F4',
          DEFAULT:'#D4890A',
          800:   '#7A5010',
          900:   '#5A3A08',
        },
      },
      keyframes: {
        'modal-in': {
          '0%':   { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'modal-out': {
          '0%':   { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(100%)' },
        },
        'overlay-in': {
          '0%':   { opacity: '0', transform: 'translateY(18px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'overlay-out': {
          '0%':   { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-12px)' },
        },
        'slide-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(36px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-left': {
          '0%':   { opacity: '0', transform: 'translateX(-36px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out-right': {
          '0%':   { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(40px)' },
        },
        'slide-out-left': {
          '0%':   { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(-40px)' },
        },
        'card-pulse': {
          '0%':   { boxShadow: '0 0 0 0 rgba(196,98,45,0.45)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(196,98,45,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(196,98,45,0)' },
        },
        'card-slide-left': {
          '0%':   { opacity: '0', transform: 'translateX(-80px) scale(0.92) rotate(-1.5deg)' },
          '65%':  { opacity: '1', transform: 'translateX(4px) scale(1.01) rotate(0.5deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1) rotate(0)' },
        },
        'card-slide-right': {
          '0%':   { opacity: '0', transform: 'translateX(80px) scale(0.92) rotate(1.5deg)' },
          '65%':  { opacity: '1', transform: 'translateX(-4px) scale(1.01) rotate(-0.5deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1) rotate(0)' },
        },
        'stack-in': {
          '0%':   { opacity: '0', transform: 'translateY(14px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'welcome-pop': {
          '0%':   { opacity: '0', transform: 'scale(0.3)' },
          '60%':  { opacity: '1', transform: 'scale(1.15)' },
          '80%':  { transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'fade-up': {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'icon-wiggle': {
          '0%':   { transform: 'rotate(0deg) scale(1)' },
          '8%':   { transform: 'rotate(16deg) scale(1.1)' },
          '16%':  { transform: 'rotate(-12deg) scale(1.06)' },
          '24%':  { transform: 'rotate(10deg) scale(1.04)' },
          '32%':  { transform: 'rotate(-6deg) scale(1.01)' },
          '40%':  { transform: 'rotate(0deg) scale(1)' },
          '100%': { transform: 'rotate(0deg) scale(1)' },
        },
        'msg-in-right': {
          '0%':   { opacity: '0', transform: 'translateX(20px) scale(0.88)' },
          '55%':  { transform: 'translateX(-3px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'msg-in-left': {
          '0%':   { opacity: '0', transform: 'translateX(-20px) scale(0.88)' },
          '55%':  { transform: 'translateX(3px) scale(1.02)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1)' },
        },
        'wave': {
          '0%':   { transform: 'rotate(0deg)' },
          '10%':  { transform: 'rotate(14deg)' },
          '20%':  { transform: 'rotate(-8deg)' },
          '30%':  { transform: 'rotate(14deg)' },
          '40%':  { transform: 'rotate(-4deg)' },
          '50%':  { transform: 'rotate(10deg)' },
          '60%':  { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(0deg)' },
        },
        'toast-in': {
          '0%':   { opacity: '0', transform: 'translateY(-8px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'confetti-float': {
          '0%':   { opacity: '0', transform: 'scale(0)' },
          '50%':  { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0)' },
        },
        'party-launch': {
          '0%':   { opacity: '0', transform: 'translate(0, 0) scale(0.6) rotate(0deg)' },
          '8%':   { opacity: '1', transform: 'translate(6px, -9px) scale(1.2) rotate(5deg)' },
          '80%':  { opacity: '1', transform: 'translate(28px, -33px) scale(1.1) rotate(14deg)' },
          '100%': { opacity: '0', transform: 'translate(36px, -40px) scale(0.5) rotate(18deg)' },
        },
        'edit-pop': {
          '0%':   { transform: 'scale(1)' },
          '25%':  { transform: 'scale(0.96)' },
          '70%':  { transform: 'scale(1.03)' },
          '100%': { transform: 'scale(1)' },
        },
        'popup-in': {
          '0%':   { opacity: '0', transform: 'scale(0.88) translateY(10px)' },
          '65%':  { transform: 'scale(1.03) translateY(-2px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        'popup-out': {
          '0%':   { opacity: '1', transform: 'scale(1) translateY(0)' },
          '100%': { opacity: '0', transform: 'scale(0.88) translateY(8px)' },
        },
        'edit-close': {
          '0%':   { transform: 'scale(1.02)' },
          '55%':  { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
        'announcement-shake': {
          '0%':   { transform: 'translateX(0) rotate(0deg)' },
          '20%':  { transform: 'translateX(-6px) rotate(-1deg)' },
          '40%':  { transform: 'translateX(6px) rotate(1deg)' },
          '60%':  { transform: 'translateX(-4px) rotate(-0.5deg)' },
          '80%':  { transform: 'translateX(4px) rotate(0.5deg)' },
          '100%': { transform: 'translateX(0) rotate(0deg)' },
        },
      },
      animation: {
        'modal-in':         'modal-in 0.25s cubic-bezier(0.32,0.72,0,1) backwards',
        'modal-out':        'modal-out 0.25s cubic-bezier(0.32,0.72,0,1) forwards',
        'overlay-in':       'overlay-in 0.22s ease-out backwards',
        'overlay-out':      'overlay-out 0.25s ease-in forwards',
        'slide-in-right':   'slide-in-right 0.22s ease-out backwards',
        'slide-in-left':    'slide-in-left 0.22s ease-out backwards',
        'slide-out-right':  'slide-out-right 0.2s ease-in forwards',
        'slide-out-left':   'slide-out-left 0.18s ease-in forwards',
        'card-pulse':       'card-pulse 0.65s ease-out',
        'card-slide-left':  'card-slide-left 0.65s cubic-bezier(0.16,1,0.3,1) backwards',
        'card-slide-right': 'card-slide-right 0.65s cubic-bezier(0.16,1,0.3,1) backwards',
        'stack-in':         'stack-in 0.3s ease-out backwards',
        'welcome-pop':      'welcome-pop 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'fade-up':          'fade-up 0.5s ease-out both',
        'icon-wiggle':      'icon-wiggle 3s ease-in-out infinite',
        'msg-in-right':     'msg-in-right 0.38s cubic-bezier(0.16,1,0.3,1) both',
        'msg-in-left':      'msg-in-left 0.38s cubic-bezier(0.16,1,0.3,1) both',
        'wave':             'wave 2.5s ease-in-out infinite',
        'toast-in':        'toast-in 0.2s cubic-bezier(0.16,1,0.3,1)',
        'confetti-float':  'confetti-float 1.5s ease-in-out infinite',
        'party-launch':    'party-launch 2.25s linear infinite',
        'edit-pop':        'edit-pop 0.28s cubic-bezier(0.16,1,0.3,1)',
        'popup-in':        'popup-in 0.22s cubic-bezier(0.16,1,0.3,1) both',
        'popup-out':       'popup-out 0.15s ease-in forwards',
        'edit-close':          'edit-close 0.26s cubic-bezier(0.16,1,0.3,1)',
        'announcement-shake':  'announcement-shake 0.5s cubic-bezier(0.36,0.07,0.19,0.97) both',
      },
    },
  },
  plugins: [scrollbarHide],
}
