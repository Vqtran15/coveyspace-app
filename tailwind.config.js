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
        'card-pulse': {
          '0%':   { boxShadow: '0 0 0 0 rgba(196,98,45,0.45)' },
          '70%':  { boxShadow: '0 0 0 10px rgba(196,98,45,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(196,98,45,0)' },
        },
        'card-slide-left': {
          '0%':   { opacity: '0', transform: 'translateX(-220px) scale(0.82) rotate(-4deg)' },
          '65%':  { opacity: '1', transform: 'translateX(16px) scale(1.03) rotate(1deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1) rotate(0)' },
        },
        'card-slide-right': {
          '0%':   { opacity: '0', transform: 'translateX(220px) scale(0.82) rotate(4deg)' },
          '65%':  { opacity: '1', transform: 'translateX(-16px) scale(1.03) rotate(-1deg)' },
          '100%': { opacity: '1', transform: 'translateX(0) scale(1) rotate(0)' },
        },
      },
      animation: {
        'modal-in':         'modal-in 0.25s cubic-bezier(0.32,0.72,0,1)',
        'modal-out':        'modal-out 0.18s cubic-bezier(0.32,0.72,0,1) forwards',
        'overlay-in':       'overlay-in 0.22s ease-out',
        'overlay-out':      'overlay-out 0.18s ease-in forwards',
        'slide-in-right':   'slide-in-right 0.22s ease-out',
        'slide-in-left':    'slide-in-left 0.22s ease-out',
        'card-pulse':       'card-pulse 0.65s ease-out',
        'card-slide-left':  'card-slide-left 0.85s cubic-bezier(0.16,1,0.3,1) backwards',
        'card-slide-right': 'card-slide-right 0.85s cubic-bezier(0.16,1,0.3,1) backwards',
      },
    },
  },
  plugins: [],
}
