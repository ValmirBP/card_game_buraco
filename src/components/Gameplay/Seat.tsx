import { motion } from 'framer-motion'
import type { TeamId } from '../../engine/gameState'

interface SeatProps {
  name: string
  cardCount: number
  isCurrentTurn: boolean
  teamId: TeamId
  /** Seat 0 (the human) doesn't show a card-back fan here — their hand is
   * rendered in full below the table, so the seat badge stays compact. */
  compact?: boolean
  /** True once the game has ended, to freeze any "jogando…" language. */
  isThinking?: boolean
}

const TEAM_RING: Record<TeamId, string> = {
  A: 'border-card-gold bg-card-gold/15 shadow-[0_0_16px_rgba(212,175,55,0.55)]',
  B: 'border-fuchsia-400 bg-fuchsia-500/15 shadow-[0_0_16px_rgba(217,70,239,0.45)]',
}

const TEAM_AVATAR: Record<TeamId, string> = {
  A: 'bg-card-gold/80 text-black',
  B: 'bg-fuchsia-500/80 text-white',
}

/** One seat around the table: avatar, name, card-back fan (opponents/partner
 * only) and a gold highlight + "jogando…" pill while it's this seat's turn. */
export default function Seat({ name, cardCount, isCurrentTurn, teamId, compact, isThinking }: SeatProps) {
  const fanSize = Math.min(cardCount, 7)

  return (
    <motion.div
      animate={{ scale: isCurrentTurn ? 1.05 : 1 }}
      transition={{ duration: 0.25 }}
      className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 sm:p-3 ${
        isCurrentTurn ? TEAM_RING[teamId] : 'border-transparent bg-white/5'
      }`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full font-display text-xs sm:h-10 sm:w-10 sm:text-sm ${TEAM_AVATAR[teamId]}`}
        >
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 text-left">
          <div className="truncate text-xs font-bold sm:text-sm">{name}</div>
          {isCurrentTurn && (
            <span className="inline-block rounded-full bg-card-gold px-1.5 py-0.5 text-[9px] font-bold text-black sm:text-[10px]">
              {isThinking ? '🤖 jogando…' : 'Sua vez'}
            </span>
          )}
        </div>
      </div>

      {!compact && (
        <div className="flex -space-x-4 pt-1 sm:-space-x-5">
          {Array.from({ length: fanSize }).map((_, i) => (
            <div
              key={i}
              style={{ zIndex: i }}
              className={`h-9 w-6 flex-shrink-0 rounded-sm border border-white/40 shadow-sm sm:h-10 sm:w-7 ${
                teamId === 'A' ? 'card-back-pattern-blue' : 'card-back-pattern-red'
              }`}
            />
          ))}
        </div>
      )}
      {!compact && (
        <span className="text-[10px] text-gray-300 sm:text-xs">{cardCount} carta{cardCount === 1 ? '' : 's'}</span>
      )}
    </motion.div>
  )
}
