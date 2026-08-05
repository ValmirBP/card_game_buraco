import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import type { TurnPhase } from './Gameplay'

interface ActionPanelProps {
  phase: TurnPhase
  canTakeDiscard: boolean
  /** True when we can't already prove the top discard card is usable —
   * shown as a soft reminder rather than disabling the button (see
   * discardRules.ts: taking the discard pile is always allowed). */
  showTopCardReminder?: boolean
  onDraw: () => void
  onTakeDiscard: () => void
  onDiscard: () => void
  onPlayCanasta: () => void
}

const enabledClasses =
  'bg-gradient-to-b from-card-gold-light to-card-gold text-black shadow-lg shadow-black/30 hover:from-card-gold hover:to-card-gold-dark'
const disabledClasses = 'bg-white/10 text-white/40 cursor-not-allowed'

export default function ActionPanel({
  phase,
  canTakeDiscard,
  showTopCardReminder,
  onDraw,
  onTakeDiscard,
  onDiscard,
  onPlayCanasta,
}: ActionPanelProps) {
  // Subscribed so button enablement reacts to turn/hand mutations even
  // though `game` keeps the same object reference.
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const selectedCardIndices = useGameStore(s => s.selectedCardIndices)

  if (!game) return null

  const isHumanTurn = game.state.status === 'playing' && game.state.currentPlayerIndex === 0

  const canDraw = isHumanTurn && phase === 'draw'
  const canTake = canDraw && canTakeDiscard
  const canDiscard = isHumanTurn && phase === 'play' && selectedCardIndices.length === 1

  const selectedCards = selectedCardIndices
    .map(i => game.state.players[0].hand.getCards()[i])
    .filter((c): c is NonNullable<typeof c> => Boolean(c))
  const wouldEmptyHandIllegally =
    selectedCardIndices.length >= 3 && game.wouldPlayCanastaEmptyHandIllegally(selectedCards)
  const canPlayCanasta = isHumanTurn && phase === 'play' && selectedCardIndices.length >= 3 && !wouldEmptyHandIllegally

  const hint = !isHumanTurn
    ? null
    : wouldEmptyHandIllegally
      ? 'Você não pode baixar todas as cartas sem poder bater.'
      : phase === 'draw'
        ? 'Compre do monte ou pegue o descarte.'
        : 'Baixe/estenda jogos ou descarte 1 carta.'

  return (
    <div className="z-30 rounded-xl border border-card-gold/40 bg-card-green-dark/95 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md">
      {hint && <p className="mx-auto mb-1 max-w-7xl truncate text-center text-[11px] text-gray-300">{hint}</p>}
      <div className="mx-auto grid max-w-7xl grid-cols-4 gap-1.5">
        <motion.button
          type="button"
          whileTap={canDraw ? { scale: 0.96 } : undefined}
          onClick={onDraw}
          disabled={!canDraw}
          className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg px-1 py-1.5 text-xs font-bold leading-tight transition-colors ${
            canDraw ? enabledClasses : disabledClasses
          }`}
        >
          <span className="text-base">🂠</span>Comprar
        </motion.button>
        <motion.button
          type="button"
          whileTap={canTake ? { scale: 0.96 } : undefined}
          onClick={onTakeDiscard}
          disabled={!canTake}
          title={canTake && showTopCardReminder ? 'Lembre-se: você deve usar a carta do topo do descarte' : undefined}
          className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg px-1 py-1.5 text-xs font-bold leading-tight transition-colors ${
            canTake ? enabledClasses : disabledClasses
          }`}
        >
          <span className="text-base">🗃️</span>Descarte
        </motion.button>
        <motion.button
          type="button"
          whileTap={canPlayCanasta ? { scale: 0.96 } : undefined}
          onClick={onPlayCanasta}
          disabled={!canPlayCanasta}
          className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg px-1 py-1.5 text-xs font-bold leading-tight transition-colors ${
            canPlayCanasta ? enabledClasses : disabledClasses
          }`}
        >
          <span className="text-base">🃏</span>Canasta
        </motion.button>
        <motion.button
          type="button"
          whileTap={canDiscard ? { scale: 0.96 } : undefined}
          onClick={onDiscard}
          disabled={!canDiscard}
          className={`flex min-h-[44px] flex-col items-center justify-center rounded-lg px-1 py-1.5 text-xs font-bold leading-tight transition-colors ${
            canDiscard ? enabledClasses : disabledClasses
          }`}
        >
          <span className="text-base">🗑️</span>Descartar
        </motion.button>
      </div>
    </div>
  )
}
