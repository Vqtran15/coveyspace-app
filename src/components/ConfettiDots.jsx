import { Confetti } from '@phosphor-icons/react'

const DOTS = [
  { left: '8%',  top: '22%', color: '#B85A3A', delay: 0,    size: 11 },
  { left: '22%', top: '62%', color: '#E8A838', delay: 0.5,  size: 9  },
  { left: '38%', top: '26%', color: '#C4622D', delay: 1.0,  size: 13 },
  { left: '53%', top: '68%', color: '#A1CCA6', delay: 0.25, size: 9  },
  { left: '67%', top: '30%', color: '#E8A838', delay: 0.75, size: 11 },
  { left: '80%', top: '60%', color: '#B85A3A', delay: 0.4,  size: 9  },
  { left: '91%', top: '20%', color: '#A1CCA6', delay: 1.2,  size: 11 },
  { left: '15%', top: '70%', color: '#E8A838', delay: 1.5,  size: 8  },
]

export default function ConfettiDots() {
  return DOTS.map((dot, i) => (
    <span
      key={i}
      className="absolute pointer-events-none animate-confetti-float select-none flex items-center justify-center"
      style={{ left: dot.left, top: dot.top, color: dot.color, animationDelay: `${dot.delay}s` }}
    >
      <Confetti size={dot.size} weight="fill" />
    </span>
  ))
}
