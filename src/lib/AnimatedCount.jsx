import { AnimatePresence, motion } from 'framer-motion'

export default function AnimatedCount({ value }) {
  return (
    <span className="relative inline-flex overflow-hidden leading-none align-baseline">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: '110%', opacity: 0 }}
          animate={{ y: '0%',   opacity: 1 }}
          exit={{    y: '-110%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30, mass: 0.5 }}
          className="inline-block"
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}
