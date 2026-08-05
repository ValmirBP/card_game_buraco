import { motion, AnimatePresence } from 'framer-motion'
import { CardComponent, CardBack, CARD_SIZE_CLASSES } from '../Card'
import type { Card } from '../../engine/card'

export interface DrawAnimState {
  /** Unique key so React remounts the ghost for each new draw. */
  id: number
  fromRect: DOMRect
  toRect: DOMRect
  card: Card
}

const DRAW_ANIM_DURATION_S = 0.8

/**
 * Ghost card overlay for the "Comprar" action: slides from the monte (draw
 * pile) to the player's hand area, flipping from face-down to face-up along
 * the way, then fades out. Purely decorative — it doesn't touch game state,
 * it just renders on top of everything else (fixed position) for the
 * duration of the animation while the real card has already been added to
 * the hand underneath. Non-blocking: the game is fully interactive while
 * this plays.
 */
export default function DrawAnimation({ anim }: { anim: DrawAnimState | null }) {
  return (
    <AnimatePresence>
      {anim && (
        <motion.div
          key={anim.id}
          className="pointer-events-none fixed z-[100]"
          style={{ left: 0, top: 0, width: anim.fromRect.width, height: anim.fromRect.height }}
          initial={{
            x: anim.fromRect.left,
            y: anim.fromRect.top,
            opacity: 1,
          }}
          animate={{
            x: anim.toRect.left + anim.toRect.width / 2 - anim.fromRect.width / 2,
            y: anim.toRect.top + anim.toRect.height / 2 - anim.fromRect.height / 2,
            opacity: [1, 1, 0],
          }}
          transition={{ duration: DRAW_ANIM_DURATION_S, ease: 'easeInOut', times: [0, 0.85, 1] }}
        >
          <motion.div
            className={`relative ${CARD_SIZE_CLASSES}`}
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 180 }}
            transition={{ duration: DRAW_ANIM_DURATION_S * 0.55, ease: 'easeIn', delay: DRAW_ANIM_DURATION_S * 0.2 }}
          >
            <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
              <CardBack variant="blue" />
            </div>
            <div
              className="absolute inset-0"
              style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
            >
              <CardComponent card={anim.card} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
