import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { CardComponent, CardBack } from '../Card'

export default function GameBoard() {
  // Subscribed so the board re-renders whenever melds/discard pile mutate.
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)

  if (!game) return null

  const topDiscard = game.state.discardPile[game.state.discardPile.length - 1]
  const isAiTurn = game.state.status === 'playing' && game.state.currentPlayerIndex === 1

  return (
    <div className="space-y-6 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-card-gold">Mesa</h3>
        <AnimatePresence>
          {isAiTurn && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200"
            >
              <motion.span
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              >
                🤖
              </motion.span>
              IA pensando…
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Draw pile / discard pile */}
      <div className="flex items-center justify-center gap-8 sm:gap-12">
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">Monte</span>
          {game.state.deck.length > 0 ? (
            <div className="relative">
              {/* Buraco is played with 2 merged decks: show both back
                  colors stacked to hint at that, even though the draw
                  pile itself is a single shuffled stack. */}
              <div className="absolute left-1.5 top-1.5 -z-10">
                <CardBack variant="red" />
              </div>
              <CardBack variant="blue" />
              <span className="absolute -right-3 -top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-card-gold px-1.5 text-xs font-bold text-black shadow">
                {game.state.deck.length}
              </span>
            </div>
          ) : (
            <div className="flex h-24 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 text-[10px] text-gray-400 sm:h-28 sm:w-20">
              Vazio
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-300">Descarte</span>
          <AnimatePresence mode="wait">
            {topDiscard ? (
              <motion.div
                key={game.state.discardPile.length}
                initial={{ opacity: 0, y: -12, rotate: -6 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
              >
                <CardComponent card={topDiscard} />
              </motion.div>
            ) : (
              <div className="flex h-24 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 text-[10px] text-gray-400 sm:h-28 sm:w-20">
                Vazio
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Melds */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {game.state.players.map(player => {
          const canastras = game.state.melds.get(player.name) || []
          return (
            <div key={player.name} className="space-y-2 rounded-xl bg-white/5 p-3">
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
                        <div className="flex -space-x-9 sm:-space-x-10">
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
    </div>
  )
}
