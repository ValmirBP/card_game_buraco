import { useOnlineStore } from '../../online/onlineStore'
import { CardComponent } from '../Card'
import { rankToNumber } from '../../engine/utils'
import { asCard } from '../../online/cardAdapter'
import type { PlainCard, SeatView } from '../../session/types'

const SUIT_ORDER: Record<PlainCard['suit'], number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
}

function orderedHand(hand: PlainCard[]): { card: PlainCard; index: number }[] {
  return hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      if (a.card.isWild !== b.card.isWild) return a.card.isWild ? 1 : -1
      if (a.card.isWild && b.card.isWild) return 0
      if (a.card.suit !== b.card.suit) return SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit]
      return rankToNumber(b.card.rank as never) - rankToNumber(a.card.rank as never)
    })
}

interface OnlinePlayerHandProps {
  view: SeatView
}

export default function OnlinePlayerHand({ view }: OnlinePlayerHandProps) {
  const selectedCardIndices = useOnlineStore((s) => s.selectedCardIndices)
  const toggleCardSelection = useOnlineStore((s) => s.toggleCardSelection)

  const isYourTurn = view.status === 'playing' && view.currentSeat === view.seat

  const hint = !isYourTurn
    ? null
    : view.phase === 'draw'
      ? 'Compre uma carta para começar sua jogada.'
      : 'Selecione 1 carta para descartar ou 3+ para formar uma canasta.'

  return (
    <div className="space-y-2 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="font-display text-lg text-card-gold">Sua Mão</h3>
        {hint && <span className="text-xs text-gray-300 sm:text-sm">{hint}</span>}
      </div>
      <div
        id="player-hand-anchor"
        className="scrollbar-gold flex -space-x-8 overflow-x-auto px-1 pb-6 pt-4 sm:-space-x-10"
      >
        {orderedHand(view.yourHand).map(({ card, index }, position) => (
          <div key={`${card.suit}-${card.rank}-${index}`} className="relative flex-shrink-0 hover:z-30">
            <CardComponent
              card={asCard(card)}
              index={position}
              selected={selectedCardIndices.includes(index)}
              onClick={() => toggleCardSelection(index)}
            />
          </div>
        ))}
      </div>
      <div className="text-sm text-gray-300">
        Cartas: {view.yourHand.length} · Selecionadas: {selectedCardIndices.length}
      </div>
    </div>
  )
}
