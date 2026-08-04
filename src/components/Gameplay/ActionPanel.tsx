import { useGameStore } from '../../store/gameStore'
import type { TurnPhase } from './Gameplay'

interface ActionPanelProps {
  phase: TurnPhase
  onDraw: () => void
  onDiscard: () => void
  onPlayCanasta: () => void
}

export default function ActionPanel({ phase, onDraw, onDiscard, onPlayCanasta }: ActionPanelProps) {
  // Subscribed so button enablement reacts to turn/hand mutations even
  // though `game` keeps the same object reference.
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const selectedCardIndices = useGameStore(s => s.selectedCardIndices)

  if (!game) return null

  const isHumanTurn = game.state.status === 'playing' && game.state.currentPlayerIndex === 0

  const canDraw = isHumanTurn && phase === 'draw'
  const canDiscard = isHumanTurn && phase === 'play' && selectedCardIndices.length === 1
  const canPlayCanasta = isHumanTurn && phase === 'play' && selectedCardIndices.length >= 3

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-card-gold bg-card-green/95 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-7xl gap-3">
        <button
          type="button"
          onClick={onDraw}
          disabled={!canDraw}
          className="min-h-[44px] flex-1 rounded-lg bg-blue-600 px-4 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:opacity-50"
        >
          Comprar
        </button>
        <button
          type="button"
          onClick={onPlayCanasta}
          disabled={!canPlayCanasta}
          className="min-h-[44px] flex-1 rounded-lg bg-green-600 px-4 py-3 font-bold text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:opacity-50"
        >
          Jogar Canasta
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={!canDiscard}
          className="min-h-[44px] flex-1 rounded-lg bg-red-600 px-4 py-3 font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-gray-600 disabled:opacity-50"
        >
          Descartar
        </button>
      </div>
      {!isHumanTurn && game.state.status === 'playing' && (
        <p className="mx-auto mt-2 max-w-7xl text-center text-xs text-gray-300">
          Aguardando o Bot jogar...
        </p>
      )}
    </div>
  )
}
