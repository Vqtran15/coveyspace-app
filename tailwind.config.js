/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
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
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'overlay-out': {
          '0%':   { opacity: '1' },
          '100%': { opacity: '0' },
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
          '0%':   { opacity: '0', transform: 'translateY(22px) scale(0.96)' },
          '60%':  { opacity: '1', transform: 'translateY(-4px) scale(1.008)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
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
        'message-in': {
          '0%':   { opacity: '0', transform: 'scale(0.8)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
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
        'confetti-float': {
          '0%':   { opacity: '0', transform: 'scale(0)' },
          '50%':  { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0)' },
        },
      },
      animation: {
        'modal-in':         'modal-in 0.25s cubic-bezier(0.32,0.72,0,1) backwards',
        'modal-out':        'modal-out 0.18s cubic-bezier(0.32,0.72,0,1) forwards',
        'overlay-in':       'overlay-in 0.22s ease-out backwards',
        'overlay-out':      'overlay-out 0.18s ease-in forwards',
        'slide-in-right':   'slide-in-right 0.22s ease-out',
        'slide-in-left':    'slide-in-left 0.22s ease-out',
        'slide-out-right':  'slide-out-right 0.2s ease-in forwards',
        'card-pulse':       'card-pulse 0.65s ease-out',
        'card-slide-left':  'card-slide-left 0.65s cubic-bezier(0.16,1,0.3,1) backwards',
        'card-slide-right': 'card-slide-right 0.65s cubic-bezier(0.16,1,0.3,1) backwards',
        'stack-in':         'stack-in 0.5s cubic-bezier(0.34,1.4,0.64,1) backwards',
        'welcome-pop':      'welcome-pop 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'fade-up':          'fade-up 0.5s ease-out both',
        'icon-wiggle':      'icon-wiggle 3s ease-in-out infinite',
        'message-in':       'message-in 0.3s cubic-bezier(0.16,1,0.3,1)',
        'wave':             'wave 2.5s ease-in-out infinite',
        'confetti-float':  'confetti-float 2s ease-in-out infinite backwards',
      },
    },
  },
  plugins: [],
}
