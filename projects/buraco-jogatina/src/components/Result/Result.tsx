import { motion } from 'framer-motion'
import { useGameStore, MATCH_TARGET } from '../../store/gameStore'
import type { TeamId, TeamScoreBreakdown } from '../../engine/gameState'

interface ResultProps {
  onBackToMenu: () => void
  /** Advances to the next round of the SAME match (match still in
   * progress — no `matchWinner` yet). */
  onNextRound: () => void
  /** Starts a brand-new match (current match just ended — `matchWinner`
   * is set). */
  onNewMatch: () => void
}

const TEAM_LABEL: Record<TeamId, string> = { A: 'Nós', B: 'Eles' }

/** One line of the score breakdown (label + signed value). */
function BreakdownRow({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const color = value > 0 ? 'text-green-300' : value < 0 ? 'text-red-300' : 'text-gray-400'
  return (
    <div className="flex items-center justify-between text-sm landscape:text-xs landscape:leading-tight">
      <span className={muted ? 'text-gray-400' : 'text-gray-200'}>{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>
        {sign}
        {Math.abs(value)}
      </span>
    </div>
  )
}

export default function Result({ onBackToMenu, onNextRound, onNewMatch }: ResultProps) {
  // `version` selected alongside `game` per the store's reactivity contract
  // (game is a mutable engine instance with a stable reference).
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const matchScores = useGameStore(s => s.matchScores)
  const matchCanastras = useGameStore(s => s.matchCanastras)
  const round = useGameStore(s => s.round)
  const matchWinner = useGameStore(s => s.matchWinner)

  if (!game) return null

  const { teams, players, winnerTeam, scoreBreakdowns } = game.state
  // Team A is always seats [0, 2] = the human + their AI partner ("Nós").
  const humanMatchWon = matchWinner === 'A'
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score)

  const breakdownOf = (id: TeamId): TeamScoreBreakdown | undefined =>
    scoreBreakdowns?.find(b => b.teamId === id)

  const seatsOfTeam = (id: TeamId) =>
    teams
      .find(t => t.id === id)!
      .seats.map(seat => players[seat]?.name)
      .filter(Boolean)
      .join(' e ')

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-8 overflow-y-auto px-4 py-6 text-center landscape:justify-center landscape:gap-1.5 landscape:overflow-hidden landscape:px-2 landscape:py-1">
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <h1 className="font-display text-4xl text-card-gold drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)] sm:text-6xl landscape:text-xl">
          {matchWinner
            ? humanMatchWon
              ? '🎉 Vocês venceram a partida!'
              : 'A dupla adversária venceu a partida'
            : `Fim da rodada ${round}`}
        </h1>
        {winnerTeam && (
          <p className="mt-3 text-lg text-gray-200 sm:text-xl landscape:mt-0.5 landscape:text-xs">
            {matchWinner ? (
              <>
                {TEAM_LABEL[matchWinner]} venceu a partida com {matchScores[matchWinner]} pontos!
              </>
            ) : (
              <>
                Nesta rodada, {TEAM_LABEL[winnerTeam]} ({seatsOfTeam(winnerTeam)}) venceu com{' '}
                {teams.find(t => t.id === winnerTeam)!.score} pontos.
              </>
            )}
          </p>
        )}
      </motion.div>

      <div className="flex w-full max-w-md flex-col gap-4 landscape:max-w-4xl landscape:flex-row landscape:items-stretch landscape:gap-3">
        <h2 className="font-display text-sm uppercase tracking-wider text-gray-300 landscape:hidden">Contagem de pontos</h2>
        {sortedTeams.map((team, i) => {
          const isWinner = winnerTeam === team.id
          const b = breakdownOf(team.id)
          return (
            <motion.div
              key={team.id}
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
              className={`rounded-2xl border p-4 text-left shadow-lg backdrop-blur-sm landscape:flex-1 landscape:rounded-xl landscape:p-2 ${
                isWinner
                  ? 'border-card-gold bg-card-gold/15 shadow-[0_0_20px_rgba(212,175,55,0.45)]'
                  : 'border-white/10 bg-black/25'
              }`}
            >
              <div className="mb-2 flex items-center justify-between landscape:mb-1">
                <div className="flex items-center gap-2">
                  {isWinner && <span className="text-2xl">🏆</span>}
                  <div>
                    <div className="font-bold text-white">
                      {TEAM_LABEL[team.id]} · {seatsOfTeam(team.id)}
                    </div>
                    <div className="text-xs text-gray-300">
                      {(() => {
                        const canastras = team.melds.filter(m => m.isCanastra).length
                        return `${canastras} canastra${canastras === 1 ? '' : 's'}`
                      })()}
                      {team.hasTakenMorto ? ' · pegou o morto' : ' · não pegou o morto'}
                    </div>
                  </div>
                </div>
                <div className={`text-3xl font-bold tabular-nums landscape:text-xl ${isWinner ? 'text-card-gold' : 'text-gray-200'}`}>
                  {b ? b.total : team.score}
                </div>
              </div>

              {b && (
                <div className="space-y-1 border-t border-white/10 pt-2 landscape:space-y-0.5 landscape:pt-1">
                  <BreakdownRow label="Jogos na mesa (cartas + canastras)" value={b.meldPoints} />
                  {b.batidaBonus !== 0 && <BreakdownRow label="Bônus de batida" value={b.batidaBonus} />}
                  {b.mortoPenalty !== 0 && (
                    <BreakdownRow
                      label={team.hasTakenMorto ? 'Morto pego mas não usado' : 'Penalidade do morto não pego'}
                      value={b.mortoPenalty}
                    />
                  )}
                  {/* Cartas na mão de CADA jogador, separadamente. Um
                      jogador com counted=false (pegou o morto e não chegou a
                      usar) aparece riscado: as cartas dele não descontam -
                      o time já pagou os -100 do morto acima. */}
                  {b.handBySeat.map(h =>
                    h.points === 0 ? null : h.counted ? (
                      <BreakdownRow key={h.seat} label={`Mão de ${h.playerName}`} value={-h.points} />
                    ) : (
                      <div
                        key={h.seat}
                        className="flex items-center justify-between text-sm landscape:text-xs landscape:leading-tight"
                      >
                        <span className="text-gray-500">Mão de {h.playerName} (morto não usado — não conta)</span>
                        <span className="font-semibold tabular-nums text-gray-500 line-through">
                          −{h.points}
                        </span>
                      </div>
                    )
                  )}
                  <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1 text-sm font-bold landscape:text-xs">
                    <span className="text-white">Total</span>
                    <span className={`tabular-nums ${isWinner ? 'text-card-gold' : 'text-gray-100'}`}>
                      {b.total}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-2 border-t border-white/10 pt-2 landscape:mt-1 landscape:pt-1">
                <div className="flex items-center justify-between text-sm landscape:text-xs">
                  <span className="font-semibold text-gray-200">Total da partida</span>
                  <span className="font-bold tabular-nums text-card-gold">
                    {matchScores[team.id]} / {MATCH_TARGET}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10 landscape:mt-1 landscape:h-1">
                  <div
                    className="h-full rounded-full bg-card-gold transition-[width]"
                    style={{ width: `${Math.max(0, Math.min(100, (matchScores[team.id] / MATCH_TARGET) * 100))}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-400 landscape:mt-0.5 landscape:text-[10px]">
                  {matchCanastras[team.id].clean} canastra
                  {matchCanastras[team.id].clean === 1 ? '' : 's'} limpa
                  {matchCanastras[team.id].clean === 1 ? '' : 's'}
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="flex w-full max-w-md flex-col gap-4 landscape:flex-row landscape:gap-3"
      >
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={matchWinner ? onNewMatch : onNextRound}
          className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark landscape:min-h-0 landscape:py-2 landscape:text-sm"
        >
          {matchWinner ? 'Nova Partida' : 'Próxima Rodada'}
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={onBackToMenu}
          className="min-h-[44px] w-full rounded-xl border-2 border-card-gold/70 bg-black/20 px-6 py-3 font-bold text-card-gold backdrop-blur-sm transition-colors hover:bg-card-gold/10 landscape:min-h-0 landscape:py-2 landscape:text-sm"
        >
          Voltar ao Menu
        </motion.button>
      </motion.div>
    </div>
  )
}
