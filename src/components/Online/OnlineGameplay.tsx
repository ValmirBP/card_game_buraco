import { useOnlineStore } from '../../online/onlineStore'
import OnlineGameBoard from './OnlineGameBoard'
import OnlinePlayerHand from './OnlinePlayerHand'
import OnlineActionPanel from './OnlineActionPanel'
import OnlineResult from './OnlineResult'

const TEAM_LABEL: Record<'A' | 'B', string> = { A: 'Nós', B: 'Eles' }

interface OnlineGameplayProps {
  onBackToMenu: () => void
}

/** Online equivalent of Gameplay.tsx: no local turn/AI-scheduling logic at
 * all (the server is authoritative and pushes a fresh `state` after every
 * change, including AI turns), just renders the current `SeatView`. */
export default function OnlineGameplay({ onBackToMenu }: OnlineGameplayProps) {
  const view = useOnlineStore((s) => s.view)
  const log = useOnlineStore((s) => s.log)
  const errorMsg = useOnlineStore((s) => s.errorMsg)
  const clearError = useOnlineStore((s) => s.clearError)

  if (!view) return null

  if (view.status === 'finished') {
    return <OnlineResult view={view} onBackToMenu={onBackToMenu} />
  }

  const lastLog = log[log.length - 1]

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Placar (topo compacto, uma linha) */}
      <div className="z-40 shrink-0 rounded-xl border border-card-gold/30 bg-black/40 px-2 py-1 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-nowrap items-center justify-center gap-2">
          {view.teams.map((team) => (
            <div
              key={team.id}
              className={`flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-0.5 ${
                team.id === 'A'
                  ? 'border border-card-gold/50 bg-card-gold/10'
                  : 'border border-fuchsia-400/40 bg-fuchsia-500/10'
              }`}
            >
              <span className={`font-display text-xs ${team.id === 'A' ? 'text-card-gold' : 'text-fuchsia-300'}`}>
                {TEAM_LABEL[team.id]}
              </span>
              <span className="text-base font-bold text-white">{team.score}</span>
              <span className="whitespace-nowrap text-[10px] text-gray-300">{team.melds.length}c</span>
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <p className="shrink-0 rounded-xl bg-red-500/15 px-4 py-2 text-center text-sm text-red-200">
          {errorMsg}
          <button type="button" onClick={clearError} className="ml-2 underline">
            ok
          </button>
        </p>
      )}

      {/* Mesa — meio flexível, rola internamente só se precisar */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <OnlineGameBoard view={view} />
      </div>

      {/* Registro em uma linha */}
      <div className="shrink-0 truncate rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-center text-xs text-gray-300">
        <span className="text-card-gold">Registro:</span> {lastLog ?? 'Nenhuma ação ainda.'}
      </div>

      {/* Mão (fixa, embaixo) */}
      <div className="shrink-0">
        <OnlinePlayerHand view={view} />
      </div>

      {/* Ações (fixas, rodapé) */}
      <div className="shrink-0">
        <OnlineActionPanel view={view} />
      </div>
    </div>
  )
}
