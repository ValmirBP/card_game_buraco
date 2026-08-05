import { motion } from 'framer-motion'
import { useOnlineStore } from '../../online/onlineStore'
import type { SeatView } from '../../session/types'

const enabledClasses =
  'bg-gradient-to-b from-card-gold-light to-card-gold text-black shadow-lg shadow-black/30 hover:from-card-gold hover:to-card-gold-dark'
const disabledClasses = 'bg-white/10 text-white/40 cursor-not-allowed'

interface OnlineActionPanelProps {
  view: SeatView
}

export default function OnlineActionPanel({ view }: OnlineActionPanelProps) {
  const selectedCardIndices = useOnlineStore((s) => s.selectedCardIndices)
  const sendIntent = useOnlineStore((s) => s.sendIntent)

  const isYourTurn = view.status === 'playing' && view.currentSeat === view.seat

  const canDraw = isYourTurn && view.phase === 'draw'
  // Simplified rule mirrored from the single-player discardRules.ts:
  // taking the discard pile is always legal whenever it's non-empty; the
  // "must use the top card" constraint is a soft reminder, not a hard gate.
  const canTake = canDraw && view.discardPile.length > 0
  const canDiscard = isYourTurn && view.phase === 'play' && selectedCardIndices.length === 1
  const canPlayCanasta = isYourTurn && view.phase === 'play' && selectedCardIndices.length >= 3

  const hint = !isYourTurn
    ? null
    : view.phase === 'draw'
      ? 'Compre do monte ou pegue o descarte.'
      : 'Baixe/estenda jogos ou descarte 1 carta.'

  const handleDraw = () => sendIntent({ type: 'draw' })
  const handleTakeDiscard = () => sendIntent({ type: 'takeDiscard' })
  const handleDiscard = () => {
    if (selectedCardIndices.length !== 1) return
    sendIntent({ type: 'discard', cardIndex: selectedCardIndices[0] })
  }
  const handlePlayCanasta = () => {
    if (selectedCardIndices.length < 3) return
    sendIntent({ type: 'playCanasta', cardIndices: selectedCardIndices })
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-card-gold/40 bg-card-green-dark/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md">
      {hint && <p className="mx-auto mb-2 max-w-7xl text-center text-xs text-gray-300">{hint}</p>}
      <div className="mx-auto flex max-w-7xl flex-wrap gap-2 sm:gap-3">
        <motion.button
          type="button"
          whileHover={canDraw ? { scale: 1.03 } : undefined}
          whileTap={canDraw ? { scale: 0.97 } : undefined}
          onClick={handleDraw}
          disabled={!canDraw}
          className={`min-h-[44px] flex-1 rounded-xl px-3 py-3 font-bold transition-colors ${
            canDraw ? enabledClasses : disabledClasses
          }`}
        >
          🂠 Comprar
        </motion.button>
        <motion.button
          type="button"
          whileHover={canTake ? { scale: 1.03 } : undefined}
          whileTap={canTake ? { scale: 0.97 } : undefined}
          onClick={handleTakeDiscard}
          disabled={!canTake}
          className={`min-h-[44px] flex-1 rounded-xl px-3 py-3 font-bold transition-colors ${
            canTake ? enabledClasses : disabledClasses
          }`}
        >
          🗃️ Pegar Descarte
        </motion.button>
        <motion.button
          type="button"
          whileHover={canPlayCanasta ? { scale: 1.03 } : undefined}
          whileTap={canPlayCanasta ? { scale: 0.97 } : undefined}
          onClick={handlePlayCanasta}
          disabled={!canPlayCanasta}
          className={`min-h-[44px] flex-1 rounded-xl px-3 py-3 font-bold transition-colors ${
            canPlayCanasta ? enabledClasses : disabledClasses
          }`}
        >
          🃏 Jogar Canasta
        </motion.button>
        <motion.button
          type="button"
          whileHover={canDiscard ? { scale: 1.03 } : undefined}
          whileTap={canDiscard ? { scale: 0.97 } : undefined}
          onClick={handleDiscard}
          disabled={!canDiscard}
          className={`min-h-[44px] flex-1 rounded-xl px-3 py-3 font-bold transition-colors ${
            canDiscard ? enabledClasses : disabledClasses
          }`}
        >
          🗑️ Descartar
        </motion.button>
      </div>
      {!isYourTurn && view.status === 'playing' && (
        <p className="mx-auto mt-2 max-w-7xl text-center text-xs text-gray-300">
          Aguardando os outros jogadores...
        </p>
      )}
    </div>
  )
}
