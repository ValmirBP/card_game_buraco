import { motion, AnimatePresence } from 'framer-motion'
import { CardComponent, CARD_SIZE_CLASSES } from '../Card'
import type { Card } from '../../engine/card'
import { clampToViewport } from './flightMath'

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
  /** Overrides o footprint do fantasma (default CARD_SIZE_CLASSES). Opt-in —
   * quem chama passa o mesmo tamanho landscape-aware da carta real na
   * origem/destino (ex.: TABLE_CARD_SIZE), pra o fantasma não ficar maior
   * (ou menor) que a carta que ele representa. Nunca definido pelo modo
   * Online, que fica no tamanho padrão. */
  sizeClassName?: string
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
 *
 * POSITIONING: the wrapper is sized by CSS classes (sizeClassName, matching
 * the real card footprint), NOT by fromRect's dimensions — fromRect is often
 * a whole row/panel (e.g. #discard-pile, #player-hand-anchor), many times
 * wider than a single card. `x`/`y` target the CENTER POINT of the
 * source/destination rects, and `-translate-x-1/2 -translate-y-1/2` centers
 * the (CSS-sized, not JS-measured) wrapper on that point — so this is
 * correct regardless of how big fromRect/toRect are, and regardless of the
 * exact resolved pixel size of the responsive size classes.
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

          const fromCenter = {
            x: anim.fromRect.left + anim.fromRect.width / 2,
            y: anim.fromRect.top + anim.fromRect.height / 2,
          }
          const toCenter = clampToViewport(
            anim.toRect.left + anim.toRect.width / 2 + offsetX,
            anim.toRect.top + anim.toRect.height / 2 + offsetY
          )

          return (
            <motion.div
              key={`${anim.id}-${i}`}
              className={`pointer-events-none fixed left-0 top-0 z-[100] -translate-x-1/2 -translate-y-1/2 ${anim.sizeClassName ?? CARD_SIZE_CLASSES}`}
              initial={{
                x: fromCenter.x,
                y: fromCenter.y,
                rotate: 0,
                scale: 1,
                opacity: 1,
              }}
              animate={{
                x: toCenter.x,
                y: toCenter.y,
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
              <CardComponent card={card} />
            </motion.div>
          )
        })}
    </AnimatePresence>
  )
}
