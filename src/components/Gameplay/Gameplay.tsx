import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import GameHeader from './GameHeader'
import GameBoard from './GameBoard'
import PlayerHand from './PlayerHand'
import ActionPanel from './ActionPanel'

export type TurnPhase = 'draw' | 'play'

interface GameplayProps {
  onGameEnd: () => void
}

const AI_THINK_DELAY_MS = 900

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

  // Tracks which `version` we've already scheduled (or run) an AI turn for,
  // so the AI-turn effect below never double-schedules `aiTurn()` for the
  // same turn (e.g. due to an extra effect run in React StrictMode).
  const scheduledAiVersionRef = useRef<number | null>(null)

  // Schedule the AI's turn with a short "thinking" delay whenever it
  // becomes the AI's turn (currentPlayerIndex === 1) and the game is still
  // playing. Cleans up its timeout on every re-run/unmount so a turn is
  // never executed twice.
  useEffect(() => {
    if (!game) return
    if (game.state.status !== 'playing') return
    if (game.state.currentPlayerIndex !== 1) return
    if (scheduledAiVersionRef.current === version) return

    scheduledAiVersionRef.current = version
    const timeoutId = setTimeout(() => {
      useGameStore.getState().aiTurn()
    }, AI_THINK_DELAY_MS)

    return () => clearTimeout(timeoutId)
  }, [version, game])

  // Detect game over (the store already calls game.finish() internally via
  // appendGameOverLog when a discard/aiTurn ends the game) and notify the
  // parent screen.
  useEffect(() => {
    if (!game) return
    if (game.state.status === 'finished') {
      onGameEnd()
    }
  }, [version, game, onGameEnd])

  if (!game) return null

  const handleDraw = () => {
    useGameStore.getState().draw()
    setPhase('play')
  }

  const handleDiscard = () => {
    const { selectedCardIndices } = useGameStore.getState()
    if (selectedCardIndices.length !== 1) return
    useGameStore.getState().discard(selectedCardIndices[0])
    // Turn moves to the AI; reset phase so it's ready for the next human turn.
    setPhase('draw')
  }

  const handlePlayCanasta = () => {
    const { selectedCardIndices } = useGameStore.getState()
    if (selectedCardIndices.length < 3) return
    useGameStore.getState().playCanasta(selectedCardIndices)
    // Stays in 'play' phase: the human may play more canastas or discard.
  }

  return (
    <div className="flex flex-col gap-6 pb-28">
      <GameHeader />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <GameBoard />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-card-gold">Log</h3>
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg bg-white/10 p-4 text-sm">
            {gameLog.map((entry, i) => (
              <div key={i} className="text-gray-200">
                {entry}
              </div>
            ))}
          </div>
        </div>
      </div>
      <PlayerHand />
      <ActionPanel
        phase={phase}
        onDraw={handleDraw}
        onDiscard={handleDiscard}
        onPlayCanasta={handlePlayCanasta}
      />
    </div>
  )
}
