import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'
import type { Card } from '../../engine/card'
import type { TurnPhase } from './Gameplay'

const HAND_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-14 landscape:h-[4.25rem]'

interface PlayerHandProps {
  phase: TurnPhase
}

const SUIT_ORDER: Record<Card['suit'], number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
}

function handRankValue(rank: Card['rank']): number {
  if (rank === 'A') return 1
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  const n = parseInt(rank, 10)
  return isNaN(n) ? 0 : n
}

function orderedHand(hand: Card[]): { card: Card; index: number }[] {
  return hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      if (a.card.isWild !== b.card.isWild) return a.card.isWild ? 1 : -1
      if (a.card.isWild && b.card.isWild) return 0
      if (a.card.suit !== b.card.suit) return SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit]
      return handRankValue(a.card.rank) - handRankValue(b.card.rank)
    })
}

export default function PlayerHand({ phase }: PlayerHandProps) {
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const selectedCardIndices = useGameStore(s => s.selectedCardIndices)
  const toggleCardSelection = useGameStore(s => s.toggleCardSelection)

  if (!game) return null

  const hand = game.state.players[0].hand.getCards()
  const isHumanTurn = game.state.status === 'playing' && game.state.currentPlayerIndex === 0

  const hint = !isHumanTurn
    ? 'IA jogando…'
    : phase === 'draw'
      ? 'Clique no monte para comprar (ou no descarte, se houver).'
      : selectedCardIndices.length === 1
        ? 'Selecione 1 carta e clique no descarte para descartar.'
        : selectedCardIndices.length >= 3
          ? 'Selecione cartas e clique na mesa para baixar, ou num jogo do time para estender.'
          : 'Selecione cartas: 1 para descartar, 3+ para baixar um jogo.'

  return (
    <div className="flex h-full min-w-0 flex-col space-y-1 landscape:space-y-0">
      <div className="flex flex-nowrap items-baseline justify-between gap-x-3">
        <h3 className="shrink-0 font-display text-sm text-card-gold landscape:text-[10px]">
          Sua Mão <span className="text-[10px] font-normal text-gray-400 landscape:text-[8px]">({hand.length})</span>
        </h3>
        {hint && <span className="truncate text-[10px] text-gray-300 sm:text-xs landscape:text-[8px]">{hint}</span>}
      </div>
      <div
        id="player-hand-anchor"
        className="scrollbar-gold flex -space-x-6 overflow-x-auto px-1 pb-3 pt-3 sm:-space-x-7 landscape:max-h-[2.7rem] landscape:-space-x-4 landscape:overflow-y-hidden landscape:pb-0.5 landscape:pt-1"
      >
        {orderedHand(hand).map(({ card, index }, position) => (
          <div
            key={`${card.suit}-${card.rank}-${index}`}
            data-hand-index={index}
            className="relative flex-shrink-0 hover:z-30"
          >
            <CardComponent
              card={card}
              index={position}
              selected={selectedCardIndices.includes(index)}
              onClick={isHumanTurn ? () => toggleCardSelection(index) : undefined}
              sizeClassName={HAND_CARD_SIZE}
              compactOnLandscape
              cornerClassName="text-sm font-normal sm:text-base landscape:text-lg landscape:leading-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
