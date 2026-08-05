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

/**
 * Timeline (total ~2.15s):
 *   0.00–0.70s  slide from the monte to the hand area (face-down)
 *   0.25–0.70s  3D flip revealing the face
 *   0.70–1.90s  HOLD — card stays face-up and slightly enlarged so the
 *               player can actually read which card was drawn
 *   1.90–2.15s  fade out; the real card (already in the hand underneath)
 *               takes over and the hand reorganizes via layout animation
 */
const SLIDE_S = 0.7
const HOLD_S = 1.2
const FADE_S = 0.25
const TOTAL_S = SLIDE_S + HOLD_S + FADE_S

/**
 * Ghost card overlay for the "Comprar" action. Purely decorative — it
 * doesn't touch game state; the real card is already in the hand
 * underneath. Non-blocking: the game stays interactive while this plays.
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
            scale: 1,
            opacity: 1,
          }}
          animate={{
            x: anim.toRect.left + anim.toRect.width / 2 - anim.fromRect.width / 2,
            y: anim.toRect.top + anim.toRect.height / 2 - anim.fromRect.height / 2,
            // Slight zoom during the hold so the drawn card is easy to read.
            scale: [1, 1.25, 1.25, 1],
            opacity: [1, 1, 1, 0],
          }}
          transition={{
            duration: TOTAL_S,
            ease: 'easeInOut',
            times: [0, SLIDE_S / TOTAL_S, (SLIDE_S + HOLD_S) / TOTAL_S, 1],
          }}
        >
          <motion.div
            className={`relative ${CARD_SIZE_CLASSES}`}
            style={{ transformStyle: 'preserve-3d' }}
            initial={{ rotateY: 0 }}
            animate={{ rotateY: 180 }}
            transition={{ duration: SLIDE_S * 0.65, ease: 'easeIn', delay: SLIDE_S * 0.35 }}
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
