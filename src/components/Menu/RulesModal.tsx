import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'

interface RulesModalProps {
  onClose: () => void
}

export default function RulesModal({ onClose }: RulesModalProps) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-2xl border border-white/10 bg-card-green-dark/90 p-8 shadow-2xl backdrop-blur-xl landscape:max-h-[94dvh] landscape:p-4"
      >
        <h2 id="rules-modal-title" className="mb-4 font-display text-2xl text-card-gold landscape:mb-2 landscape:text-base">
          Como Jogar Buraco
        </h2>
        <div className="space-y-4 overflow-y-auto pr-2 text-sm text-gray-200 landscape:space-y-2 landscape:text-xs">
          <div>
            <h3 className="font-bold text-white">Objetivo</h3>
            <p>
              Ser o primeiro jogador a se livrar de todas as cartas da mão, formando o máximo de
              canastras (sequências) possível para somar pontos.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">Preparação</h3>
            <p>
              Cada jogador recebe 14 cartas. O restante do baralho forma o monte de compra, e a
              primeira carta virada inicia o descarte.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">Seu Turno</h3>
            <p>
              1. Compre uma carta do monte. 2. Forme canastras (3 ou mais cartas em sequência do
              mesmo naipe, podendo usar curingas). 3. Descarte uma carta para encerrar o turno.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">Pontuação</h3>
            <p>
              Canasta limpa (sem curingas): 500 pontos. Canasta suja (com curingas): 300 pontos.
              Fechar o jogo (bater) rende um bônus de +100 pontos. Cartas que sobrarem na mão ao
              final contam pontos negativos.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-6 min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-4 py-2 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark landscape:mt-2 landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
        >
          Fechar
        </button>
      </motion.div>
    </motion.div>,
    document.body
  )
}
