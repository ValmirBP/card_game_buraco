import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'
import { rankToNumber } from '../../engine/utils'
import type { Card } from '../../engine/card'
import type { TurnPhase } from './Gameplay'

interface PlayerHandProps {
  phase: TurnPhase
}

// Ordem de exibição dos naipes na mão (agrupa cartas do mesmo naipe).
const SUIT_ORDER: Record<Card['suit'], number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
}

/** Ordena a mão para exibição — agrupa por naipe e, dentro do naipe, em ordem
 * decrescente A K Q J 10 9 8 7 6 5 4 3 2. Curingas ficam por último.
 * Preserva o índice original de cada carta (usado para seleção/descarte). */
function orderedHand(hand: Card[]): { card: Card; index: number }[] {
  return hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      if (a.card.isWild !== b.card.isWild) return a.card.isWild ? 1 : -1
      if (a.card.isWild && b.card.isWild) return 0
      if (a.card.suit !== b.card.suit) return SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit]
      return rankToNumber(b.card.rank) - rankToNumber(a.card.rank)
    })
}

export default function PlayerHand({ phase }: PlayerHandProps) {
  // Subscribed so the hand re-renders after draw/discard/playCanasta mutate
  // the human player's cards in place.
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const selectedCardIndices = useGameStore(s => s.selectedCardIndices)
  const toggleCardSelection = useGameStore(s => s.toggleCardSelection)

  if (!game) return null

  const hand = game.state.players[0].hand.getCards()
  const isHumanTurn = game.state.status === 'playing' && game.state.currentPlayerIndex === 0

  const hint = !isHumanTurn
    ? null
    : phase === 'draw'
      ? 'Compre uma carta para começar sua jogada.'
      : 'Selecione 1 carta para descartar ou 3+ para formar uma canasta.'

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-lg text-card-gold">Sua Mão</h3>
        {hint && <span className="text-xs text-gray-300 sm:text-sm">{hint}</span>}
      </div>
      {/* Seleção NÃO eleva o z-index — a carta selecionada sobe
          verticalmente mas mantém o empilhamento natural do leque, sem
          cobrir o canto (rank/naipe) da carta vizinha. Só o hover traz a
          carta pra frente, temporariamente, pra leitura. */}
      <div
        id="player-hand-anchor"
        className="scrollbar-gold flex -space-x-8 overflow-x-auto px-1 pb-6 pt-4 sm:-space-x-10"
      >
        {orderedHand(hand).map(({ card, index }, position) => (
          <div
            key={`${card.suit}-${card.rank}-${index}`}
            className="relative flex-shrink-0 hover:z-30"
          >
            <CardComponent
              card={card}
              index={position}
              selected={selectedCardIndices.includes(index)}
              onClick={() => toggleCardSelection(index)}
            />
          </div>
        ))}
      </div>
      <div className="text-sm text-gray-300">
        Cartas: {hand.length} · Selecionadas: {selectedCardIndices.length}
      </div>
    </div>
  )
}
