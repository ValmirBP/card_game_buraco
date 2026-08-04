import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'

export default function PlayerHand() {
  // Subscribed so the hand re-renders after draw/discard/playCanasta mutate
  // the human player's cards in place.
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const selectedCardIndices = useGameStore(s => s.selectedCardIndices)
  const toggleCardSelection = useGameStore(s => s.toggleCardSelection)

  if (!game) return null

  const hand = game.state.players[0].hand.getCards()

  return (
    <div className="space-y-2">
      <h3 className="text-lg font-bold text-card-gold">Sua Mão</h3>
      <div className="flex gap-3 overflow-x-auto rounded-lg bg-white/5 p-4 pb-6">
        {hand.map((card, i) => (
          <div key={i} className="flex-shrink-0">
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
        Cartas: {hand.length} | Selecionadas: {selectedCardIndices.length}
      </div>
    </div>
  )
}
