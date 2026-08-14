import { motion, AnimatePresence } from 'framer-motion'
import { CardComponent, CARD_SIZE_CLASSES } from '../Card'
import type { Card } from '../../engine/card'

export interface FlyAnimState {
  /** Unique key so React remounts the ghost group for each new flight. */
  id: number
  fromRect: DOMRect
  toRect: DOMRect
  cards: Card[]
  /** Duração do voo em segundos (default DURATION_S). Voos mais "longos"
   * (ex.: lixo indo pro assento de um adversário) usam um valor maior pra
   * dar tempo de acompanhar. */
  durationS?: number
}

const DURATION_S = 0.5

/**
 * Generic "ghost cards fly from anchor A to anchor B" overlay, used for
 * discard (hand -> discard pile), pick-up-discard (discard pile -> hand) and
 * baixar/estender (hand -> mesa). Purely decorative and non-blocking — the
 * real game state has already been updated by the time this plays; it just
 * gives the eye something to follow. Unlike DrawAnimation this never flips
 * (all these cards are already face-up), and supports a small stack of
 * cards flying together with a slight stagger/offset.
 */
export default function CardFlyAnimation({ anim }: { anim: FlyAnimState | null }) {
  return (
    <AnimatePresence>
      {anim &&
        anim.cards.map((card, i) => {
          // Slight fan-out so a multi-card flight (baixar, pegar descarte)
          // reads as several cards rather than one stacked blob.
          const offsetX = (i - (anim.cards.length - 1) / 2) * 10
          const offsetY = i * 4
          const landingRotate = i % 2 === 0 ? -6 : 6

          return (
            <motion.div
              key={`${anim.id}-${i}`}
              className="pointer-events-none fixed z-[100]"
              style={{ left: 0, top: 0, width: anim.fromRect.width, height: anim.fromRect.height }}
              initial={{
                x: anim.fromRect.left,
                y: anim.fromRect.top,
                rotate: 0,
                scale: 1,
                opacity: 1,
              }}
              animate={{
                x: anim.toRect.left + anim.toRect.width / 2 - anim.fromRect.width / 2 + offsetX,
                y: anim.toRect.top + anim.toRect.height / 2 - anim.fromRect.height / 2 + offsetY,
                rotate: landingRotate,
                scale: 0.9,
                opacity: [1, 1, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: anim.durationS ?? DURATION_S,
                delay: i * 0.05,
                ease: 'easeInOut',
                times: [0, 0.85, 1],
              }}
            >
              <div className={CARD_SIZE_CLASSES}>
                <CardComponent card={card} />
              </div>
            </motion.div>
          )
        })}
    </AnimatePresence>
  )
}
