import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { HAND_SIZE } from '../../engine/game'
import { canastaPoints } from '../../engine/utils'
import { MATCH_TARGET } from '../../store/gameStore'

interface RulesModalProps {
  onClose: () => void
}

// Valores lidos DIRETO do motor (não hardcoded) — B1: o texto já divergiu do
// motor de verdade uma vez (dizia "14 cartas"/"500/300 pontos" quando o
// motor usa 11 cartas e 200/100/500/1000). Importar em vez de repetir os
// números evita a próxima divergência.
const CLEAN_POINTS = canastaPoints('limpa', 7)
const DIRTY_POINTS = canastaPoints('suja', 7)
const QUINHENTOS_POINTS = canastaPoints('quinhentos', 13)
const REAL_POINTS = canastaPoints('real', 14)

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
              Ser a primeira dupla a bater (esvaziar a mão), formando o máximo de canastras
              (sequências de 7+ cartas) possível. A partida vai até {MATCH_TARGET} pontos,
              somando várias rodadas.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">Preparação</h3>
            <p>
              Cada jogador recebe {HAND_SIZE} cartas. O restante do baralho forma o monte de
              compra (com 2 mortos reservados à parte), e a primeira carta virada inicia o
              descarte.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">Seu Turno</h3>
            <p>
              1. Compre uma carta do monte (ou pegue a pilha de descarte). 2. Baixe ou estenda
              jogos (3 ou mais cartas em sequência do mesmo naipe, com no máximo 1 curinga; ou
              uma trinca de 2+ Áses). 3. Descarte uma carta para encerrar o turno.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">Canastras (7+ cartas)</h3>
            <p>
              Limpa (sem curinga): {CLEAN_POINTS} pontos. Suja (com 1 curinga): {DIRTY_POINTS}{' '}
              pontos. Canastra de Quinhentos (13 cartas, 2 ao Ás, limpa): {QUINHENTOS_POINTS}{' '}
              pontos. Canastra Real (14 cartas, Ás ao Ás, limpa): {REAL_POINTS} pontos.
            </p>
          </div>
          <div>
            <h3 className="font-bold text-white">Bater</h3>
            <p>
              Só é permitido esvaziar a mão quando a dupla já pegou o morto (ou não há mais
              morto disponível) E tem pelo menos uma canastra limpa. Bater rende um bônus de
              +100 pontos; não pegar o morto quando ainda era possível custa -100. Cartas que
              sobrarem na mão ao final contam pontos negativos.
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
