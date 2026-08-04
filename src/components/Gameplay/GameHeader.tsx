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
    <div className="sticky top-0 z-20 -mx-4 mb-2 border-b border-white/10 bg-card-green-dark/80 px-4 py-3 backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border sm:px-4">
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {game.state.players.map((player, i) => {
          const isCurrentTurn = game.state.status === 'playing' && game.state.currentPlayerIndex === i
          const isHuman = i === 0
          return (
            <motion.div
              key={player.name}
              animate={{ scale: isCurrentTurn ? 1.03 : 1 }}
              transition={{ duration: 0.25 }}
              className={`flex items-center gap-3 rounded-xl p-2.5 sm:p-3 ${
                isCurrentTurn
                  ? 'border-2 border-card-gold bg-card-gold/15 shadow-[0_0_16px_rgba(212,175,55,0.55)]'
                  : 'border-2 border-transparent bg-white/5'
              }`}
            >
              <div
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full font-display text-sm sm:h-11 sm:w-11 ${
                  isHuman ? 'bg-blue-500/80 text-white' : 'bg-purple-500/80 text-white'
                }`}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-bold">{player.name}</span>
                  {isCurrentTurn && (
                    <span className="flex-shrink-0 rounded-full bg-card-gold px-2 py-0.5 text-[10px] font-bold text-black">
                      {isHuman ? 'Sua vez' : 'IA jogando…'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-200 sm:text-sm">
                  {player.score} pts · {player.canastas.length} canastra{player.canastas.length === 1 ? '' : 's'}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
