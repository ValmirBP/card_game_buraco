import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import type { TurnPhase } from './Gameplay'

interface ActionPanelProps {
  phase: TurnPhase
  onDraw: () => void
  onDiscard: () => void
  onPlayCanasta: () => void
}

const enabledClasses =
  'bg-gradient-to-b from-card-gold-light to-card-gold text-black shadow-lg shadow-black/30 hover:from-card-gold hover:to-card-gold-dark'
const disabledClasses = 'bg-white/10 text-white/40 cursor-not-allowed'

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
    <div
      className="fixed inset-x-0 bottom-0 z-30 border-t border-card-gold/40 bg-card-green-dark/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md"
    >
      <div className="mx-auto flex max-w-7xl gap-3">
        <motion.button
          type="button"
          whileHover={canDraw ? { scale: 1.03 } : undefined}
          whileTap={canDraw ? { scale: 0.97 } : undefined}
          onClick={onDraw}
          disabled={!canDraw}
          className={`min-h-[44px] flex-1 rounded-xl px-3 py-3 font-bold transition-colors ${
            canDraw ? enabledClasses : disabledClasses
          }`}
        >
          🂠 Comprar
        </motion.button>
        <motion.button
          type="button"
          whileHover={canPlayCanasta ? { scale: 1.03 } : undefined}
          whileTap={canPlayCanasta ? { scale: 0.97 } : undefined}
          onClick={onPlayCanasta}
          disabled={!canPlayCanasta}
          className={`min-h-[44px] flex-1 rounded-xl px-3 py-3 font-bold transition-colors ${
            canPlayCanasta ? enabledClasses : disabledClasses
          }`}
        >
          🃏 Jogar Canasta
        </motion.button>
        <motion.button
          type="button"
          whileHover={canDiscard ? { scale: 1.03 } : undefined}
          whileTap={canDiscard ? { scale: 0.97 } : undefined}
          onClick={onDiscard}
          disabled={!canDiscard}
          className={`min-h-[44px] flex-1 rounded-xl px-3 py-3 font-bold transition-colors ${
            canDiscard ? enabledClasses : disabledClasses
          }`}
        >
          🗑️ Descartar
        </motion.button>
      </div>
      {!isHumanTurn && game.state.status === 'playing' && (
        <p className="mx-auto mt-2 max-w-7xl text-center text-xs text-gray-300">
          Aguardando o Bot jogar...
        </p>
      )}
    </div>
  )
}
