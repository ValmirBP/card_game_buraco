import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'

interface ResultProps {
  onBackToMenu: () => void
  onPlayAgain: () => void
}

export default function Result({ onBackToMenu, onPlayAgain }: ResultProps) {
  // `version` selected alongside `game` per the store's reactivity contract
  // (game is a mutable engine instance with a stable reference).
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)

  if (!game) return null

  const winner = game.state.winner
  // players[0] is always the human (see gameStore.initGame: new Game([human, ai])).
  const humanWon = winner === game.state.players[0]
  const sortedPlayers = [...game.state.players].sort((a, b) => b.score - a.score)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <h1 className="font-display text-4xl text-card-gold drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)] sm:text-6xl">
          {humanWon ? '🎉 Você Venceu!' : 'Fim de Jogo'}
        </h1>
        {winner && (
          <p className="mt-3 text-lg text-gray-200 sm:text-xl">
            {winner.name} venceu com {winner.score} pontos!
          </p>
        )}
      </motion.div>

      <div className="flex w-full max-w-md flex-col gap-4">
        {sortedPlayers.map((p, i) => {
          const isWinner = winner ? p === winner : false
          return (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className={`flex items-center justify-between rounded-2xl border p-4 shadow-lg backdrop-blur-sm ${
                isWinner
                  ? 'border-card-gold bg-card-gold/15 shadow-[0_0_20px_rgba(212,175,55,0.45)]'
                  : 'border-white/10 bg-black/25'
              }`}
            >
              <div className="flex items-center gap-3">
                {isWinner && <span className="text-2xl">🏆</span>}
                <div className="text-left">
                  <div className="font-bold text-white">{p.name}</div>
                  <div className="text-xs text-gray-300">
                    {p.canastas.length} canastra{p.canastas.length === 1 ? '' : 's'}
                  </div>
                </div>
              </div>
              <div className={`text-2xl font-bold ${isWinner ? 'text-card-gold' : 'text-gray-200'}`}>
                {p.score}
              </div>
            </motion.div>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex w-full max-w-md flex-col gap-4"
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onPlayAgain}
          className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark"
        >
          Jogar Novamente
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onBackToMenu}
          className="min-h-[44px] w-full rounded-xl border-2 border-card-gold/70 bg-black/20 px-6 py-3 font-bold text-card-gold backdrop-blur-sm transition-colors hover:bg-card-gold/10"
        >
          Voltar ao Menu
        </motion.button>
      </motion.div>
    </div>
  )
}
