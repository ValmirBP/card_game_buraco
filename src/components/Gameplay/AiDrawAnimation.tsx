import { motion, AnimatePresence } from 'framer-motion'

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
 */
export default function AiDrawAnimation({ anim }: { anim: BackFlyState | null }) {
  return (
    <AnimatePresence>
      {anim && (
        <motion.div
          key={anim.id}
          className="pointer-events-none fixed z-[100]"
          style={{ left: 0, top: 0, width: anim.fromRect.width, height: anim.fromRect.height }}
          initial={{ x: anim.fromRect.left, y: anim.fromRect.top, scale: 1, opacity: 1, rotate: 0 }}
          animate={{
            x: anim.toRect.left + anim.toRect.width / 2 - anim.fromRect.width / 2,
            y: anim.toRect.top + anim.toRect.height / 2 - anim.fromRect.height / 2,
            scale: 0.55,
            opacity: [1, 1, 0],
            rotate: 8,
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: DURATION_S, ease: 'easeInOut', times: [0, 0.75, 1] }}
        >
          <div className="card-back-pattern-blue h-full w-full rounded-lg border border-white/40 shadow-md" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
