import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import GameBoard from './GameBoard'
import PlayerHand from './PlayerHand'
import ActionPanel from './ActionPanel'
import { canTakeDiscardPile } from './discardRules'

export type TurnPhase = 'draw' | 'play'

interface GameplayProps {
  onGameEnd: () => void
}

const AI_THINK_DELAY_MS = 800

export default function Gameplay({ onGameEnd }: GameplayProps) {
  // `version` MUST be selected alongside `game`: `game` is a mutable engine
  // instance whose object reference never changes across actions, so
  // Zustand/React would otherwise never re-render this component (or any
  // child that reads game state) when the store mutates it. See the
  // "REACTIVITY CONTRACT" comment on GameStore.game in ../../store/gameStore.ts.
  const version = useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const gameLog = useGameStore(s => s.gameLog)

  // Turn-phase control lives here (local UI state), not in the store: the
  // engine/store don't enforce a "draw then play" phase within a human
  // turn, so Gameplay is the source of truth for it.
  const [phase, setPhase] = useState<TurnPhase>('draw')

  // Schedule one AI seat's turn whenever it becomes an AI's turn
  // (currentPlayerIndex !== 0) and the game is still playing. The effect
  // re-fires after every aiTurn() call (version bumps, currentPlayerIndex
  // advances 1 -> 2 -> 3 -> 0), running exactly one seat's turn per firing
  // until control returns to the human.
  //
  // No ref-based "already scheduled" guard here on purpose: under
  // React.StrictMode (or any remount that happens to land mid-AI-turn), a
  // ref survives the mount/unmount/remount cycle but the timeout it guarded
  // does not — the cleanup clears the pending setTimeout, the ref still
  // says "already scheduled for this version", and the effect never
  // reschedules, so the AI turn silently never runs. Depending only on
  // `[version, game?.state.currentPlayerIndex, game?.state.status]` sidesteps
  // that: the effect naturally fires once whenever those values settle into
  // "an AI's turn", schedules exactly one timeout, and cleans it up
  // correctly on every re-run.
  useEffect(() => {
    if (!game) return
    if (game.state.status !== 'playing') return
    if (game.state.currentPlayerIndex === 0) return

    const timeoutId = setTimeout(() => {
      useGameStore.getState().aiTurn()
    }, AI_THINK_DELAY_MS)

    return () => clearTimeout(timeoutId)
  }, [version, game?.state.currentPlayerIndex, game?.state.status])

  // Detect game over (the store already calls game.finish() internally when
  // a discard/aiTurn/playCanasta/extendMeld ends the game) and notify the
  // parent screen.
  useEffect(() => {
    if (!game) return
    if (game.state.status === 'finished') {
      onGameEnd()
    }
  }, [version, game, onGameEnd])

  const canTakeDiscard = useMemo(() => {
    if (!game) return false
    if (game.state.status !== 'playing' || game.state.currentPlayerIndex !== 0) return false
    return canTakeDiscardPile(game)
    // Re-derive whenever the game mutates (version) — hand/discard/melds can
    // all change what's takeable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, version])

  if (!game) return null

  const handleDraw = () => {
    useGameStore.getState().drawFromDeck()
    setPhase('play')
  }

  const handleTakeDiscard = () => {
    useGameStore.getState().takeDiscardPile()
    setPhase('play')
  }

  const handleDiscard = () => {
    const { selectedCardIndices } = useGameStore.getState()
    if (selectedCardIndices.length !== 1) return
    useGameStore.getState().discard(selectedCardIndices[0])
    // Turn moves on; reset phase so it's ready for the next human turn.
    setPhase('draw')
  }

  const handlePlayCanasta = () => {
    const { selectedCardIndices } = useGameStore.getState()
    if (selectedCardIndices.length < 3) return
    useGameStore.getState().playCanasta(selectedCardIndices)
    // Stays in 'play' phase: the human may play more canastas or discard.
  }

  const recentLog = gameLog.slice(-5)

  return (
    <div className="flex flex-col gap-4 pb-32">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GameBoard phase={phase} />
        </div>
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
      </div>
      <PlayerHand phase={phase} />
      <ActionPanel
        phase={phase}
        canTakeDiscard={canTakeDiscard}
        onDraw={handleDraw}
        onTakeDiscard={handleTakeDiscard}
        onDiscard={handleDiscard}
        onPlayCanasta={handlePlayCanasta}
      />
    </div>
  )
}
