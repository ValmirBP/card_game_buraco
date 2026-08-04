import { motion } from 'framer-motion'
import type { Card as CardType } from '../engine/card'

interface CardProps {
  card: CardType
  onClick?: () => void
  selected?: boolean
  index?: number
}

const SUIT_SYMBOLS: Record<CardType['suit'], string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const SUIT_COLOR_CLASS: Record<CardType['suit'], string> = {
  hearts: 'text-suit-hearts',
  diamonds: 'text-suit-diamonds',
  clubs: 'text-suit-clubs',
  spades: 'text-suit-spades',
}

/** Shared footprint for both the face card and the card back so hands, melds
 * and the draw pile all line up visually. Sized generously so rank + suit
 * stay legible even with a full hand (rows scroll horizontally). */
export const CARD_SIZE_CLASSES = 'w-16 h-24 sm:w-20 sm:h-28'

/** Small illustrated jester — cap with three bell-tipped points over a
 * simple masked face — used on wild cards instead of a plain star so the
 * card reads as an actual illustrated Joker. */
function JesterIllustration() {
  return (
    <svg
      viewBox="0 0 48 56"
      className="h-9 w-9 sm:h-11 sm:w-11"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 30 L6 14 Q6 4 14 10 L20 20 L24 6 L28 20 L34 10 Q42 4 42 14 L42 30 Z"
        fill="#f5d576"
        stroke="#ffffff"
        strokeWidth="1.2"
      />
      <circle cx="6" cy="11" r="3" fill="#ffffff" />
      <circle cx="24" cy="4" r="3" fill="#ffffff" />
      <circle cx="42" cy="11" r="3" fill="#ffffff" />
      <path d="M4 30 Q24 42 44 30 L44 38 Q24 50 4 38 Z" fill="#fdfaf2" />
      <circle cx="15" cy="33" r="2.3" fill="#6d28d9" />
      <circle cx="33" cy="33" r="2.3" fill="#6d28d9" />
      <path d="M15 41 Q24 46 33 41" stroke="#6d28d9" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function CardComponent({ card, onClick, selected, index }: CardProps) {
  const suitClass = SUIT_COLOR_CLASS[card.suit]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: selected ? -12 : 0, scale: 1 }}
      whileHover={{ y: selected ? -16 : -10, scale: 1.08, zIndex: 40 }}
      whileTap={{ scale: 0.94 }}
      transition={{
        delay: (index ?? 0) * 0.04,
        type: 'spring',
        stiffness: 340,
        damping: 24,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick ? Boolean(selected) : undefined}
      className={[
        CARD_SIZE_CLASSES,
        'relative select-none rounded-xl border shadow-md',
        onClick ? 'cursor-pointer' : '',
        card.isWild
          ? 'border-purple-300/50 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-800 text-white'
          : 'border-black/10 bg-white',
        selected ? 'shadow-[0_0_18px_rgba(212,175,55,0.85)] ring-4 ring-card-gold' : '',
      ].join(' ')}
    >
      {card.isWild ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1">
          <JesterIllustration />
          <span className="text-[10px] font-black leading-none tracking-wide text-white drop-shadow sm:text-xs">
            CURINGA
          </span>
        </div>
      ) : (
        <>
          <div className={`absolute left-2 top-1.5 flex flex-col items-center leading-none ${suitClass}`}>
            <span className="text-sm font-black sm:text-base">{card.rank}</span>
            <span className="text-sm sm:text-base">{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          <div
            className={`absolute bottom-1.5 right-2 flex rotate-180 flex-col items-center leading-none ${suitClass}`}
          >
            <span className="text-sm font-black sm:text-base">{card.rank}</span>
            <span className="text-sm sm:text-base">{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          <div className={`flex h-full w-full items-center justify-center text-4xl sm:text-5xl ${suitClass}`}>
            {SUIT_SYMBOLS[card.suit]}
          </div>
        </>
      )}
    </motion.div>
  )
}

/** Face-down card used for the draw pile / opponent's hand. Purely
 * decorative — same footprint as CardComponent so it lines up in rows.
 * `variant` gives the two physical decks (Buraco is played with 2 merged
 * 52-card decks + wilds) distinct back colors, blue and red, as on a real
 * casino table. */
export function CardBack({
  className = '',
  variant = 'blue',
}: {
  className?: string
  variant?: 'blue' | 'red'
}) {
  return (
    <div
      className={[
        CARD_SIZE_CLASSES,
        variant === 'blue' ? 'card-back-pattern-blue' : 'card-back-pattern-red',
        'rounded-xl border border-white/40 shadow-md',
        'flex items-center justify-center',
        className,
      ].join(' ')}
    >
      <span className="font-display text-lg text-white/80 drop-shadow-sm">B</span>
    </div>
  )
}
