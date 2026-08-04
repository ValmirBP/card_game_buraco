import { motion } from 'framer-motion'

interface RulesModalProps {
  onClose: () => void
}

export default function RulesModal({ onClose }: RulesModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-modal-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-card-green p-8 shadow-2xl"
      >
        <h2 id="rules-modal-title" className="mb-4 text-2xl font-bold text-card-gold">
          Como Jogar Buraco
        </h2>
        <div className="space-y-4 overflow-y-auto pr-2 text-sm text-gray-200">
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
          className="mt-6 min-h-[44px] w-full rounded-lg bg-card-gold px-4 py-2 font-bold text-black transition-colors hover:bg-yellow-400"
        >
          Fechar
        </button>
      </motion.div>
    </motion.div>
  )
}
