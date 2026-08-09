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
  const matchScores = useGameStore(s => s.matchScores)
  const previousMatchScores = useGameStore(s => s.previousMatchScores)

  if (!game) return null

  const { teams } = game.state

  return (
    <div className="z-40 rounded-xl border border-card-gold/30 bg-black/40 px-2 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md landscape:px-1.5 landscape:py-0.5">
      <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-center gap-2 landscape:gap-1.5">
        {teams.map(team => {
          // "Pontos atuais" da partida = rodadas já fechadas (matchScores) +
          // a rodada em andamento (team.score).
          const matchTotal = matchScores[team.id] + team.score
          const prev = previousMatchScores?.[team.id]
          return (
            <div
              key={team.id}
              className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-0.5 ${
                team.id === 'A'
                  ? 'border border-card-gold/50 bg-card-gold/10'
                  : 'border border-fuchsia-400/40 bg-fuchsia-500/10'
              }`}
            >
              <span
                className={`font-display text-xs ${
                  team.id === 'A' ? 'text-card-gold' : 'text-fuchsia-300'
                }`}
              >
                {TEAM_LABEL[team.id]}
              </span>
              <span className="text-base font-bold text-white" title="Pontos da partida atual">
                {matchTotal}
              </span>
              {prev !== undefined && (
                <span className="whitespace-nowrap text-[10px] text-gray-400" title="Partida anterior">
                  / {prev}
                </span>
              )}
              <span className="whitespace-nowrap text-[10px] text-gray-300">{team.melds.length}c</span>
              <span
                className={`text-[10px] ${team.hasTakenMorto ? 'text-green-300' : 'text-gray-500'}`}
                title="Morto pego?"
              >
                {team.hasTakenMorto ? '✓morto' : '✗morto'}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
