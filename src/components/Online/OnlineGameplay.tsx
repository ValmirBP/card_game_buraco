import { useOnlineStore } from '../../online/onlineStore'
import OnlineGameBoard from './OnlineGameBoard'
import OnlinePlayerHand from './OnlinePlayerHand'
import OnlineDiscardRow from './OnlineDiscardRow'
import OnlineResult from './OnlineResult'
import type { TeamId } from '../../engine/gameState'

const TEAM_LABEL: Record<'A' | 'B', string> = { A: 'Nós', B: 'Eles' }

interface OnlineGameplayProps {
  onBackToMenu: () => void
}

/** Online equivalent of Gameplay.tsx: no local turn/AI-scheduling logic at
 * all (the server is authoritative and pushes a fresh `state` after every
 * change, including AI turns) — só renderiza a SeatView atual. Manipulação
 * direta (clicar no monte/descarte/mesa) substitui o antigo painel de
 * botões (OnlineActionPanel, removido), igual ao modo offline. */
export default function OnlineGameplay({ onBackToMenu }: OnlineGameplayProps) {
  const view = useOnlineStore(s => s.view)
  const log = useOnlineStore(s => s.log)
  const errorMsg = useOnlineStore(s => s.errorMsg)
  const clearError = useOnlineStore(s => s.clearError)

  if (!view) return null

  if (view.status === 'finished') {
    return <OnlineResult view={view} onBackToMenu={onBackToMenu} />
  }

  const lastLog = log[log.length - 1]
  // "Nós"/"Eles" relativo ao próprio time, igual ao GameBoard online.
  const myTeamId: TeamId = view.players[view.seat]?.teamId ?? 'A'
  const sortedTeams = [...view.teams].sort((a, b) => (a.id === myTeamId ? -1 : 1) - (b.id === myTeamId ? -1 : 1))

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 landscape:gap-0.5">
      {/* Placar — mesmo tratamento visual do Scoreboard.tsx offline */}
      <div className="shrink-0 z-40 rounded-xl border border-card-gold/30 bg-black/40 px-2 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md landscape:rounded-md landscape:px-1.5 landscape:py-0">
        <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-center gap-2 landscape:gap-1.5">
          {sortedTeams.map(team => {
            const isMine = team.id === myTeamId
            const matchTotal = view.matchScores[team.id] + team.score
            const canastraCount = team.melds.filter(m => m.isCanastra).length
            return (
              <div
                key={team.id}
                className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-0.5 ${
                  isMine ? 'border border-card-gold/50 bg-card-gold/10' : 'border border-fuchsia-400/40 bg-fuchsia-500/10'
                }`}
              >
                <span className={`font-display text-xs ${isMine ? 'text-card-gold' : 'text-fuchsia-300'}`}>
                  {TEAM_LABEL[isMine ? 'A' : 'B']}
                </span>
                <span className="text-base font-bold text-white" title="Pontos da partida atual">
                  {matchTotal}
                </span>
                <span className="whitespace-nowrap text-[10px] text-gray-300" title="Canastras (jogos de 7+ cartas)">
                  {canastraCount} can.
                </span>
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

      {errorMsg && (
        <p className="shrink-0 rounded-xl bg-red-500/15 px-4 py-2 text-center text-sm text-red-200 landscape:py-1 landscape:text-xs">
          {errorMsg}
          <button type="button" onClick={clearError} className="ml-2 underline">
            ok
          </button>
        </p>
      )}

      {/* Mesa — mesmo tratamento do GameBoard offline: ocupa o espaço
          flexível do meio, sem rolar em paisagem. */}
      <div className="min-h-0 flex-1 overflow-y-auto landscape:overflow-hidden">
        <OnlineGameBoard view={view} />
      </div>

      {/* Registro — escondido em paisagem, igual offline */}
      <div className="shrink-0 truncate rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-center text-xs text-gray-300 landscape:hidden">
        <span className="text-card-gold">Registro:</span> {lastLog ?? 'Nenhuma ação ainda.'}
      </div>

      {/* Rodapé: UM painel só com a Mão e o Descarte lado a lado ("em
          paralelo") — igual ao Gameplay offline. */}
      <div className="flex shrink-0 items-stretch gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 shadow-lg backdrop-blur-sm landscape:gap-1.5 landscape:px-2 landscape:py-0.5">
        <div className="min-w-0 flex-[3]">
          <OnlinePlayerHand view={view} />
        </div>
        <div className="w-px shrink-0 self-stretch bg-white/15" />
        <div className="min-w-0 flex-[2]">
          <OnlineDiscardRow view={view} />
        </div>
      </div>
    </div>
  )
}
