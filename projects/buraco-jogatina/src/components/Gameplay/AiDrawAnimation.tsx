import { motion, AnimatePresence } from 'framer-motion'
import { clampToViewport } from './flightMath'

export interface BackFlyState {
  /** Chave única pra o React remontar o fantasma a cada compra. */
  id: number
  fromRect: DOMRect
  toRect: DOMRect
}

const DURATION_S = 0.7

/**
 * Fantasma decorativo da COMPRA de um jogador da IA: um verso de carta
 * (face pra baixo) desliza do monte até o assento do jogador da vez, dando
 * o feedback visual de "a carta indo para ele". Não toca no estado do jogo —
 * o `aiTurn()` real roda em paralelo/logo depois. Tamanho = o do monte
 * (fromRect), pra sair exatamente de lá.
 *
 * POSITIONING: mesmo padrão de ponto-central + `-translate-x/y-1/2` dos
 * outros fantasmas (ver CardFlyAnimation) - aqui o box É dimensionado por
 * fromRect (o monte), o que faz sentido (representa uma carta saindo dali),
 * mas o ponto de partida/pouso usa o CENTRO dos retângulos, não o canto
 * superior-esquerdo, e o pouso passa por clampToViewport como rede de
 * segurança.
 */
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
