import { motion, AnimatePresence } from 'framer-motion'
import { CardComponent, CARD_SIZE_CLASSES } from '../Card'
import type { Card } from '../../engine/card'
import { clampToViewport } from './flightMath'

export interface FlyAnimState {
  id: number
  fromRect: DOMRect
  toRect: DOMRect
  cards: Card[]
  durationS?: number
  sizeClassName?: string
}

const DURATION_S = 0.5

export default function CardFlyAnimation({ anim }: { anim: FlyAnimState | null }) {
  return (
    <AnimatePresence>
      {anim &&
        anim.cards.map((card, i) => {
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
