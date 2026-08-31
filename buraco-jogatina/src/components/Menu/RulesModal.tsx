import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { HAND_SIZE, MORTO_SIZE } from '../../engine/game'
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

/** Um ícone por seção, mesmo tratamento visual do DifficultySelector (cartão
 * com ícone à esquerda) - antes disso as Regras eram a única tela do Menu
 * sem esse acabamento, só um bloco de texto corrido. Puramente visual: o
 * texto de cada seção não muda, então os testes de regressão do conteúdo
 * continuam batendo. */
const SECTION_ICONS = {
  objetivo: '🎯',
  preparacao: '🎴',
  morto: '📦',
  curingas: '🃏',
  turno: '🔄',
  canastras: '🏅',
  bater: '🏁',
} as const

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
        <div className="space-y-3 overflow-y-auto pr-2 text-sm text-gray-200 landscape:space-y-1.5 landscape:text-xs">
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 landscape:gap-2 landscape:p-1.5">
            <span className="text-2xl leading-none landscape:text-base">{SECTION_ICONS.objetivo}</span>
            <div>
              <h3 className="font-bold text-white">Objetivo</h3>
              <p>
                Jogam 4 pessoas, em 2 duplas fixas sentadas em lados opostos da mesa. Ser a
                primeira dupla a bater (esvaziar a mão), formando o máximo de canastras
                (sequências de 7+ cartas) possível. A partida vai até {MATCH_TARGET} pontos,
                somando várias rodadas.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 landscape:gap-2 landscape:p-1.5">
            <span className="text-2xl leading-none landscape:text-base">{SECTION_ICONS.preparacao}</span>
            <div>
              <h3 className="font-bold text-white">Preparação</h3>
              <p>
                Cada jogador recebe {HAND_SIZE} cartas. O restante do baralho forma o monte de
                compra (com 2 mortos reservados à parte — veja abaixo), e a primeira carta virada
                inicia o descarte.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 landscape:gap-2 landscape:p-1.5">
            <span className="text-2xl leading-none landscape:text-base">{SECTION_ICONS.morto}</span>
            <div>
              <h3 className="font-bold text-white">O Morto</h3>
              <p>
                Cada dupla tem direito a um morto: um monte reservado de {MORTO_SIZE} cartas
                viradas para baixo. Assim que um jogador da dupla esvazia a mão pela primeira
                vez, ele pega automaticamente o morto como cartas novas e continua jogando — é
                isso que dá à dupla o direito de bater de vez (veja "Bater" abaixo). Se o monte de
                compra acabar antes de alguém pegar um morto, esse morto vira o novo monte.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 landscape:gap-2 landscape:p-1.5">
            <span className="text-2xl leading-none landscape:text-base">{SECTION_ICONS.curingas}</span>
            <div>
              <h3 className="font-bold text-white">Curingas</h3>
              <p>
                O coringa e qualquer carta 2 podem substituir a carta que falta no meio de uma
                sequência (por exemplo, 5-6-8 de copas mais um curinga forma 5-6-7-8). Cada jogo
                aceita no máximo 1 curinga.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 landscape:gap-2 landscape:p-1.5">
            <span className="text-2xl leading-none landscape:text-base">{SECTION_ICONS.turno}</span>
            <div>
              <h3 className="font-bold text-white">Seu Turno</h3>
              <p>
                1. Compre uma carta do monte (ou pegue a pilha de descarte inteira). 2. Baixe ou
                estenda jogos (3 ou mais cartas em sequência do mesmo naipe, com no máximo 1
                curinga; ou uma trinca de 2+ Áses). 3. Descarte uma carta para encerrar o turno.
                Atenção: se o descarte tinha só 1 carta quando você o pegou, essa carta específica
                não pode voltar pro descarte nesse mesmo turno.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 landscape:gap-2 landscape:p-1.5">
            <span className="text-2xl leading-none landscape:text-base">{SECTION_ICONS.canastras}</span>
            <div>
              <h3 className="font-bold text-white">Canastras (7+ cartas)</h3>
              <p>
                Limpa (sem curinga): {CLEAN_POINTS} pontos. Suja (com 1 curinga): {DIRTY_POINTS}{' '}
                pontos. Canastra de Quinhentos (13 cartas, 2 ao Ás, limpa): {QUINHENTOS_POINTS}{' '}
                pontos. Canastra Real (14 cartas, Ás ao Ás, limpa): {REAL_POINTS} pontos.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 landscape:gap-2 landscape:p-1.5">
            <span className="text-2xl leading-none landscape:text-base">{SECTION_ICONS.bater}</span>
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
