import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

export default function GameHeader() {
  // `version` is subscribed (even though unused directly) to force a
  // re-render whenever the mutable `game` instance changes (see
  // gameStore.ts reactivity contract).
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)

  if (!game) return null

  return (
    <div className="grid grid-cols-2 gap-4">
      {game.state.players.map((player, i) => {
        const isCurrentTurn = game.state.currentPlayerIndex === i
        return (
          <motion.div
            key={player.name}
            animate={{
              scale: isCurrentTurn ? 1.03 : 1,
            }}
            transition={{ duration: 0.25 }}
            className={`rounded-lg p-4 transition-colors duration-200 ${
              isCurrentTurn
                ? 'border-2 border-card-gold bg-yellow-400/20 shadow-lg'
                : 'border-2 border-transparent bg-white/10'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="font-bold">{player.name}</span>
              {isCurrentTurn && (
                <span className="rounded-full bg-card-gold px-2 py-0.5 text-xs font-bold text-black">
                  Vez
                </span>
              )}
            </div>
            <div className="text-sm text-gray-100">Pontos: {player.score}</div>
            <div className="text-xs text-gray-300">Canastras: {player.canastas.length}</div>
          </motion.div>
        )
      })}
    </div>
  )
}
