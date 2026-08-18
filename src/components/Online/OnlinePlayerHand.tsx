import { useOnlineStore } from '../../online/onlineStore'
import { CardComponent } from '../Card'
import { asCard } from '../../online/cardAdapter'
import type { PlainCard, SeatView } from '../../session/types'

/** Idêntico ao HAND_CARD_SIZE de PlayerHand.tsx (offline) — ver lá para a
 * explicação completa. */
const HAND_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-12 landscape:h-[4.25rem]'

const SUIT_ORDER: Record<PlainCard['suit'], number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
}

/** Idêntico a handRankValue de PlayerHand.tsx: Ás BAIXO (A=1), crescente:
 * A 2 3 4 5 6 7 8 9 10 J Q K. */
function handRankValue(rank: PlainCard['rank']): number {
  if (rank === 'A') return 1
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  const n = parseInt(rank, 10)
  return isNaN(n) ? 0 : n
}

/** Idêntico a orderedHand de PlayerHand.tsx: agrupa por naipe, A→K dentro do
 * naipe, curingas por último. */
function orderedHand(hand: PlainCard[]): { card: PlainCard; index: number }[] {
  return hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      if (a.card.isWild !== b.card.isWild) return a.card.isWild ? 1 : -1
      if (a.card.isWild && b.card.isWild) return 0
      if (a.card.suit !== b.card.suit) return SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit]
      return handRankValue(a.card.rank) - handRankValue(b.card.rank)
    })
}

interface OnlinePlayerHandProps {
  view: SeatView
}

/** Online equivalent of PlayerHand.tsx — mesma ordenação (A→K por naipe),
 * mesma "meia carta" em paisagem, mesmos naipes grandes no canto, mesma
 * seleção sem subir a carta (só realce). */
export default function OnlinePlayerHand({ view }: OnlinePlayerHandProps) {
  const selectedCardIndices = useOnlineStore(s => s.selectedCardIndices)
  const toggleCardSelection = useOnlineStore(s => s.toggleCardSelection)

  const isMyTurn = view.status === 'playing' && view.currentSeat === view.seat
  const hand = view.yourHand

  const hint = !isMyTurn
    ? 'Aguardando os outros jogadores…'
    : view.phase === 'draw'
      ? 'Clique no monte para comprar (ou no descarte, se houver).'
      : selectedCardIndices.length === 1
        ? 'Selecione 1 carta e clique no descarte para descartar.'
        : selectedCardIndices.length >= 3
          ? 'Selecione cartas e clique na mesa para baixar, ou num jogo do time para estender.'
          : 'Selecione cartas: 1 para descartar, 3+ para baixar um jogo.'

  return (
    <div className="space-y-1 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 shadow-lg backdrop-blur-sm landscape:space-y-0 landscape:px-2 landscape:py-0.5">
      <div className="flex flex-nowrap items-baseline justify-between gap-x-3">
        <h3 className="shrink-0 font-display text-sm text-card-gold landscape:text-[10px]">
          Sua Mão <span className="text-[10px] font-normal text-gray-400 landscape:text-[8px]">({hand.length})</span>
        </h3>
        {hint && <span className="truncate text-[10px] text-gray-300 sm:text-xs landscape:text-[8px]">{hint}</span>}
      </div>
      <div
        id="player-hand-anchor"
        className="scrollbar-gold flex -space-x-6 overflow-x-auto px-1 pb-3 pt-3 sm:-space-x-7 landscape:max-h-[2.7rem] landscape:-space-x-2.5 landscape:overflow-y-hidden landscape:pb-0.5 landscape:pt-1"
      >
        {orderedHand(hand).map(({ card, index }, position) => (
          <div
            key={`${card.suit}-${card.rank}-${index}`}
            data-hand-index={index}
            className="relative flex-shrink-0 hover:z-30"
          >
            <CardComponent
              card={asCard(card)}
              index={position}
              selected={selectedCardIndices.includes(index)}
              onClick={isMyTurn ? () => toggleCardSelection(index) : undefined}
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
