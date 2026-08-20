import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'
import type { TurnPhase } from './Gameplay'

// MESMO footprint das cartas da mão (PlayerHand.HAND_CARD_SIZE), pra as duas
// fileiras — mão e descarte — ficarem paralelas e visualmente idênticas
// dentro do mesmo painel.
const HAND_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-14 landscape:h-[4.25rem]'
const BIG_CORNER = 'text-sm font-normal sm:text-base landscape:text-lg landscape:leading-none'

interface DiscardRowProps {
  phase: TurnPhase
  /** Whether "pegar o descarte" is currently a legal move (pile non-empty
   * and it's the human's turn to draw) — drives the glow. */
  canTakeDiscard: boolean
  onTakeDiscardPile: () => void
  onDiscardSelected: () => void
}

/**
 * Fileira do DESCARTE, embutida no mesmo painel da mão (lado a lado — pedido
 * do usuário: "o quadro do descarte imbuído no da minha mão, em paralelo").
 * Era a row-3 da grade do GameBoard; movida pra cá com os mesmos IDs de
 * âncora (#discard-pile / #discard-top) que as animações de voo usam.
 */
export default function DiscardRow({ phase, canTakeDiscard, onTakeDiscardPile, onDiscardSelected }: DiscardRowProps) {
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const selectedCardIndices = useGameStore(s => s.selectedCardIndices)
  const [hint, setHint] = useState<string | null>(null)

  if (!game) return null

  const { discardPile, status, currentPlayerIndex } = game.state
  const isHumanTurn = status === 'playing' && currentPlayerIndex === 0
  const canClickToDraw = isHumanTurn && phase === 'draw' && canTakeDiscard
  const canClickToDiscard = isHumanTurn && phase === 'play' && selectedCardIndices.length === 1

  const flashHint = (message: string) => {
    setHint(message)
    window.setTimeout(() => setHint(current => (current === message ? null : current)), 2600)
  }

  const handleClick = () => {
    if (!isHumanTurn) return
    if (phase === 'draw') {
      if (!canTakeDiscard) {
        flashHint('O descarte está vazio.')
        return
      }
      onTakeDiscardPile()
      return
    }
    // phase === 'play'
    if (selectedCardIndices.length === 0) {
      flashHint('Selecione 1 carta para descartar.')
      return
    }
    if (selectedCardIndices.length > 1) {
      flashHint('Selecione apenas 1 carta para descartar.')
      return
    }
    // Regra do lixo unitário: a carta pega de um descarte que só tinha ela
    // não pode voltar no mesmo turno (ver Game.takeDiscardPile).
    if (game.isDiscardBlockedCard(selectedCardIndices[0])) {
      flashHint('Você pegou essa carta do descarte agora — não pode devolvê-la neste turno.')
      return
    }
    if (game.wouldDiscardEmptyHandIllegally(selectedCardIndices[0])) {
      flashHint('Você não pode descartar a última carta sem poder bater.')
      return
    }
    onDiscardSelected()
  }

  return (
    <div className="relative flex h-full min-w-0 flex-col">
      <div className="flex flex-nowrap items-baseline justify-between gap-x-2">
        <h3 className="shrink-0 font-display text-sm text-card-gold landscape:text-[10px]">
          Descarte{' '}
          <span className="text-[10px] font-normal text-gray-400 landscape:text-[8px]">({discardPile.length})</span>
        </h3>
      </div>
      <div
        id="discard-pile"
        onClick={handleClick}
        className={`scrollbar-gold flex min-w-0 flex-1 items-start overflow-x-auto overflow-y-hidden rounded-lg px-1 pb-3 pt-3 -space-x-5 sm:-space-x-6 landscape:max-h-[2.7rem] landscape:-space-x-4 landscape:pb-0.5 landscape:pt-1 ${
          canClickToDraw || canClickToDiscard
            ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_16px_rgba(212,175,55,0.5)]'
            : ''
        }`}
      >
        {discardPile.length === 0 ? (
          <div
            id="discard-top"
            className="flex h-6 w-16 items-center justify-center self-center rounded-lg border border-dashed border-white/20 text-[10px] text-gray-400 sm:w-20 landscape:w-12 landscape:text-[8px]"
          >
            Vazio
          </div>
        ) : (
          discardPile.map((card, i) => {
            const isTop = i === discardPile.length - 1
            return (
              <div
                key={i}
                id={isTop ? 'discard-top' : undefined}
                style={{ zIndex: i }}
                className={`flex-shrink-0 rounded-lg ${isTop ? 'ring-2 ring-card-gold/80' : 'opacity-90'}`}
              >
                <CardComponent card={card} sizeClassName={HAND_CARD_SIZE} compactOnLandscape cornerClassName={BIG_CORNER} />
              </div>
            )
          })
        )}
      </div>

      {/* Toast de dica local (mesmo estilo do GameBoard) */}
      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-full z-40 mb-1 flex justify-center"
          >
            <span className="rounded-full border border-card-gold/50 bg-black/85 px-3 py-1 text-center text-[11px] text-card-gold shadow-lg backdrop-blur-sm landscape:text-[10px]">
              {hint}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
