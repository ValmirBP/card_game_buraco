import { motion, AnimatePresence } from 'framer-motion'
import { clampToViewport } from './flightMath'

export interface BackFlyState {
  id: number
  fromRect: DOMRect
  toRect: DOMRect
}

const DURATION_S = 0.7

export default function AiDrawAnimation({ anim }: { anim: BackFlyState | null }) {
  return (
    <AnimatePresence>
      {anim && (
        <motion.div
          key={anim.id}
          className="pointer-events-none fixed left-0 top-0 z-[100] -translate-x-1/2 -translate-y-1/2"
          style={{ width: anim.fromRect.width, height: anim.fromRect.height }}
          initial={{
            x: anim.fromRect.left + anim.fromRect.width / 2,
            y: anim.fromRect.top + anim.fromRect.height / 2,
            scale: 1,
            opacity: 1,
            rotate: 0,
          }}
          animate={(() => {
            const landing = clampToViewport(
              anim.toRect.left + anim.toRect.width / 2,
              anim.toRect.top + anim.toRect.height / 2
            )
            return { x: landing.x, y: landing.y, scale: 0.55, opacity: [1, 1, 0], rotate: 8 }
          })()}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION_S, ease: 'easeInOut', times: [0, 0.75, 1] }}
        >
          <div className="card-back-pattern-blue h-full w-full rounded-lg border border-white/40 shadow-md" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
