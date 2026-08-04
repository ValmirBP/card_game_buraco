import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'

export default function GameBoard() {
  // Subscribed so the board re-renders whenever melds/discard pile mutate.
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)

  if (!game) return null

  const topDiscard = game.state.discardPile[game.state.discardPile.length - 1]

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold text-card-gold">Mesa</h3>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {game.state.players.map(player => {
          const canastras = game.state.melds.get(player.name) || []
          return (
            <div key={player.name} className="space-y-2 rounded-lg bg-white/5 p-3">
              <h4 className="text-sm font-semibold text-gray-100">Canastras de {player.name}</h4>
              {canastras.length === 0 ? (
                <span className="text-sm text-gray-400">Nenhuma canasta ainda</span>
              ) : (
                <div className="flex flex-wrap gap-3">
                  <AnimatePresence>
                    {canastras.map((canasta, ci) => (
                      <motion.div
                        key={ci}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="space-y-1"
                      >
                        <div className="flex -space-x-8">
                          {canasta.cards.map((card, cii) => (
                            <div key={cii} style={{ zIndex: cii }}>
                              <CardComponent card={card} />
                            </div>
                          ))}
                        </div>
                        <div
                          className={`text-center text-xs font-semibold ${
                            canasta.isClean ? 'text-green-300' : 'text-orange-300'
                          }`}
                        >
                          {canasta.isClean ? 'Limpa' : 'Suja'} (+{canasta.points})
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-100">Descarte</h4>
        <div className="flex min-h-32 items-center justify-center rounded-lg bg-white/5 p-4">
          <AnimatePresence mode="wait">
            {topDiscard ? (
              <motion.div
                key={game.state.discardPile.length}
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <CardComponent card={topDiscard} />
              </motion.div>
            ) : (
              <span className="text-gray-400">Vazio</span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
