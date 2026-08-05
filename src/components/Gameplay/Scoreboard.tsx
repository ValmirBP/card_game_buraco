import { useGameStore } from '../../store/gameStore'
import type { TeamId } from '../../engine/gameState'

const TEAM_LABEL: Record<TeamId, string> = { A: 'Nós', B: 'Eles' }

/**
 * Always-visible team scoreboard: sticks to the top of the viewport while
 * scrolling so the score/canastras/morto status for both teams stay in
 * sight throughout the round, casino-style (dark background, gold accents
 * for Team A, magenta for Team B).
 */
export default function Scoreboard() {
  // Subscribed per the store's REACTIVITY CONTRACT (see gameStore.ts):
  // `game` keeps a stable reference across mutations.
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)

  if (!game) return null

  const { teams } = game.state

  return (
    <div className="sticky top-0 z-40 -mx-4 border-b border-card-gold/40 bg-gradient-to-b from-black/85 to-black/60 px-4 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 sm:gap-6">
        {teams.map(team => {
          return (
            <div
              key={team.id}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 sm:gap-3 sm:px-4 ${
                team.id === 'A'
                  ? 'border border-card-gold/50 bg-card-gold/10'
                  : 'border border-fuchsia-400/40 bg-fuchsia-500/10'
              }`}
            >
              <span
                className={`font-display text-xs sm:text-sm ${
                  team.id === 'A' ? 'text-card-gold' : 'text-fuchsia-300'
                }`}
              >
                {TEAM_LABEL[team.id]}
              </span>
              <span className="text-base font-bold text-white sm:text-lg">{team.score}</span>
              <span className="text-[10px] text-gray-300 sm:text-xs">
                {team.melds.length} canastra{team.melds.length === 1 ? '' : 's'}
              </span>
              <span
                className={`text-[10px] sm:text-xs ${team.hasTakenMorto ? 'text-green-300' : 'text-gray-500'}`}
                title="Morto pego?"
              >
                {team.hasTakenMorto ? '✓ morto' : '✗ morto'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
