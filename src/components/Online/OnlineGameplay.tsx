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

  const recentLog = log.slice(-6)

  return (
    <div className="flex flex-col gap-4 pb-32">
      <div className="sticky top-0 z-40 -mx-4 border-b border-card-gold/40 bg-gradient-to-b from-black/85 to-black/60 px-4 py-2 shadow-[0_4px_16px_rgba(0,0,0,0.35)] backdrop-blur-md sm:mx-0 sm:rounded-2xl sm:border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-3 sm:gap-6">
          {view.teams.map((team) => (
            <div
              key={team.id}
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 sm:gap-3 sm:px-4 ${
                team.id === 'A'
                  ? 'border border-card-gold/50 bg-card-gold/10'
                  : 'border border-fuchsia-400/40 bg-fuchsia-500/10'
              }`}
            >
              <span
                className={`font-display text-xs sm:text-sm ${team.id === 'A' ? 'text-card-gold' : 'text-fuchsia-300'}`}
              >
                {TEAM_LABEL[team.id]}
              </span>
              <span className="text-base font-bold text-white sm:text-lg">{team.score}</span>
              <span className="text-[10px] text-gray-300 sm:text-xs">
                {team.melds.length} canastra{team.melds.length === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {errorMsg && (
        <p className="rounded-xl bg-red-500/15 px-4 py-2 text-center text-sm text-red-200">
          {errorMsg}
          <button type="button" onClick={clearError} className="ml-2 underline">
            ok
          </button>
        </p>
      )}

      <OnlineGameBoard view={view} />
      <OnlinePlayerHand view={view} />

      <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4 shadow-lg backdrop-blur-sm">
        <h3 className="font-display text-base text-card-gold">Registro</h3>
        <div className="max-h-40 space-y-1.5 overflow-y-auto text-xs text-gray-300 sm:text-sm">
          {recentLog.length === 0 ? (
            <p className="text-gray-500">Nenhuma ação ainda.</p>
          ) : (
            recentLog.map((entry, i) => (
              <div key={i} className="border-b border-white/5 pb-1.5 last:border-0 last:pb-0">
                {entry}
              </div>
            ))
          )}
        </div>
      </div>

      <OnlineActionPanel view={view} />
    </div>
  )
}
