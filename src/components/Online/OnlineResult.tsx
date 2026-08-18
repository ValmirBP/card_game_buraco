import { motion } from 'framer-motion'
import { useOnlineStore } from '../../online/onlineStore'
import { MATCH_TARGET } from '../../store/gameStore'
import type { SeatView, SeatTeamView } from '../../session/types'
import type { TeamId, TeamScoreBreakdown } from '../../engine/gameState'

function BreakdownRow({ label, value }: { label: string; value: number }) {
  const sign = value > 0 ? '+' : value < 0 ? '−' : ''
  const color = value > 0 ? 'text-green-300' : value < 0 ? 'text-red-300' : 'text-gray-400'
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-200">{label}</span>
      <span className={`font-semibold tabular-nums ${color}`}>
        {sign}
        {Math.abs(value)}
      </span>
    </div>
  )
}

interface OnlineResultProps {
  view: SeatView
  onBackToMenu: () => void
}

/** Online equivalent of Result.tsx — mesmo layout "fit" sem rolagem em
 * paisagem (cards + botões lado a lado), mesmo clamp de barra de progresso
 * (B2), mas "Nós"/"Eles" relativo ao próprio time (myTeamId), não fixo em A. */
export default function OnlineResult({ view, onBackToMenu }: OnlineResultProps) {
  const isHost = useOnlineStore(s => s.isHost)
  const nextRound = useOnlineStore(s => s.nextRound)

  const { teams, players, winnerTeam, scoreBreakdowns, matchScores, matchCanastras, round, matchWinner } = view
  const myTeamId: TeamId = players[view.seat]?.teamId ?? 'A'
  const won = matchWinner === myTeamId
  const sortedTeams = [...teams].sort((a, b) => b.score - a.score)

  const teamLabel = (id: TeamId) => (id === myTeamId ? 'Nós' : 'Eles')

  const breakdownOf = (id: TeamId): TeamScoreBreakdown | undefined => scoreBreakdowns?.find(b => b.teamId === id)

  const seatsOfTeam = (id: TeamId) =>
    players
      .filter(p => p.teamId === id)
      .map(p => p.name)
      .join(' e ')

  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center gap-8 overflow-y-auto px-4 py-6 text-center landscape:justify-start landscape:gap-2 landscape:overflow-y-auto landscape:py-2">
      <motion.div
        initial={{ opacity: 0, scale: 0.7, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <h1 className="font-display text-4xl text-card-gold drop-shadow-[0_2px_10px_rgba(212,175,55,0.5)] sm:text-6xl landscape:text-xl">
          {matchWinner
            ? won
              ? '🎉 Vocês venceram a partida!'
              : 'A dupla adversária venceu a partida'
            : `Fim da rodada ${round}`}
        </h1>
        {winnerTeam && (
          <p className="mt-3 text-lg text-gray-200 sm:text-xl landscape:mt-0.5 landscape:text-xs">
            {matchWinner ? (
              <>
                {teamLabel(matchWinner)} venceu a partida com {matchScores[matchWinner]} pontos!
              </>
            ) : (
              <>
                Nesta rodada, {teamLabel(winnerTeam)} ({seatsOfTeam(winnerTeam)}) venceu com{' '}
                {teams.find(t => t.id === winnerTeam)?.score} pontos.
              </>
            )}
          </p>
        )}
      </motion.div>

      <div className="flex w-full max-w-md flex-col gap-4 landscape:max-w-4xl landscape:flex-row landscape:items-stretch landscape:gap-3">
        <h2 className="font-display text-sm uppercase tracking-wider text-gray-300 landscape:hidden">
          Contagem de pontos
        </h2>
        {sortedTeams.map((team: SeatTeamView, i) => {
          const isWinner = winnerTeam === team.id
          const b = breakdownOf(team.id)
          const canastraCount = team.melds.filter(m => m.isCanastra).length
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
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isWinner && <span className="text-2xl">🏆</span>}
                  <div>
                    <div className="font-bold text-white">
                      {teamLabel(team.id)} · {seatsOfTeam(team.id)}
                    </div>
                    <div className="text-xs text-gray-300">
                      {canastraCount} canastra{canastraCount === 1 ? '' : 's'}
                      {team.hasTakenMorto ? ' · pegou o morto' : ' · não pegou o morto'}
                    </div>
                  </div>
                </div>
                <div className={`text-3xl font-bold tabular-nums landscape:text-xl ${isWinner ? 'text-card-gold' : 'text-gray-200'}`}>
                  {b ? b.total : team.score}
                </div>
              </div>

              {b && (
                <div className="space-y-1 border-t border-white/10 pt-2">
                  <BreakdownRow label="Jogos na mesa (cartas + canastras)" value={b.meldPoints} />
                  {b.batidaBonus !== 0 && <BreakdownRow label="Bônus de batida" value={b.batidaBonus} />}
                  {b.mortoPenalty !== 0 && (
                    <BreakdownRow label="Penalidade do morto não pego" value={b.mortoPenalty} />
                  )}
                  {b.handPenalty !== 0 && <BreakdownRow label="Cartas na mão (descontadas)" value={b.handPenalty} />}
                  <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-1 text-sm font-bold">
                    <span className="text-white">Total</span>
                    <span className={`tabular-nums ${isWinner ? 'text-card-gold' : 'text-gray-100'}`}>{b.total}</span>
                  </div>
                </div>
              )}

              <div className="mt-2 border-t border-white/10 pt-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-gray-200">Total da partida</span>
                  <span className="font-bold tabular-nums text-card-gold">
                    {matchScores[team.id]} / {MATCH_TARGET}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-card-gold transition-[width]"
                    style={{ width: `${Math.max(0, Math.min(100, (matchScores[team.id] / MATCH_TARGET) * 100))}%` }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-400">
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
        {!matchWinner &&
          (isHost ? (
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={nextRound}
              className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark landscape:min-h-0 landscape:py-2 landscape:text-sm"
            >
              Próxima Rodada
            </motion.button>
          ) : (
            <p className="text-sm text-gray-300 landscape:text-xs">Aguardando o host iniciar a próxima rodada…</p>
          ))}
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
