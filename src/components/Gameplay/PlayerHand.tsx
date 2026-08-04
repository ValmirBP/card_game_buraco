import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'
import type { TurnPhase } from './Gameplay'

interface PlayerHandProps {
  phase: TurnPhase
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
      <div className="scrollbar-gold flex -space-x-8 overflow-x-auto px-1 pb-6 pt-4 sm:-space-x-10">
        {hand.map((card, i) => (
          <div
            key={`${card.suit}-${card.rank}-${i}`}
            className={`relative flex-shrink-0 transition-[z-index] hover:z-30 ${
              selectedCardIndices.includes(i) ? 'z-20' : ''
            }`}
          >
            <CardComponent
              card={card}
              index={i}
              selected={selectedCardIndices.includes(i)}
              onClick={() => toggleCardSelection(i)}
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
