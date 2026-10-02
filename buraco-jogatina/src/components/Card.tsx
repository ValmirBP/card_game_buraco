import { motion } from 'framer-motion'
import type { Card as CardType } from '../engine/card'

interface CardProps {
  card: CardType
  onClick?: () => void
  selected?: boolean
  index?: number
  sizeClassName?: string
  compactOnLandscape?: boolean
  cornerClassName?: string
  cornerLayout?: 'column' | 'row'
}

export function SuitIcon({ suit, className = '' }: { suit: CardType['suit']; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'currentColor',
    'aria-hidden': true as const,
    className: `inline-block h-[1em] w-[1em] shrink-0 align-[-0.12em] ${className}`,
  }
  switch (suit) {
    case 'hearts':
      return (
        <svg {...common}>
          <path d="M12 21.6 4.2 13.8a5 5 0 1 1 7.1-7.1l.7.7.7-.7a5 5 0 1 1 7.1 7.1L12 21.6z" />
        </svg>
      )
    case 'diamonds':
      return (
        <svg {...common}>
          <path d="M12 1.8 21.2 12 12 22.2 2.8 12z" />
        </svg>
      )
    case 'clubs':
      return (
        <svg {...common}>
          <circle cx="12" cy="6.6" r="4.1" />
          <circle cx="6.6" cy="13.6" r="4.1" />
          <circle cx="17.4" cy="13.6" r="4.1" />
          <path d="M10.4 13.4h3.2l1.7 8.4H8.7z" />
        </svg>
      )
    case 'spades':
      return (
        <svg {...common}>
          <path d="M12 2.2C12 2.2 3 9.2 3 14.1a4.6 4.6 0 0 0 7.9 3.2c-.2 2-.9 3.7-1.9 4.5h6c-1-.8-1.7-2.5-1.9-4.5A4.6 4.6 0 0 0 21 14.1c0-4.9-9-11.9-9-11.9z" />
        </svg>
      )
  }
}

const SUIT_COLOR_CLASS: Record<CardType['suit'], string> = {
  hearts: 'text-suit-hearts',
  diamonds: 'text-suit-diamonds',
  clubs: 'text-suit-clubs',
  spades: 'text-suit-spades',
}

export const CARD_SIZE_CLASSES = 'w-16 h-24 sm:w-20 sm:h-28'

function JesterIllustration({ compactOnLandscape }: { compactOnLandscape?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 56"
      className={compactOnLandscape ? 'h-9 w-9 landscape:h-4 landscape:w-4 sm:h-11 sm:w-11' : 'h-9 w-9 sm:h-11 sm:w-11'}
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

const PIP_POSITIONS: Record<string, Array<[number, number]>> = {
  '2': [
    [50, 28],
    [50, 72],
  ],
  '3': [
    [50, 22],
    [50, 50],
    [50, 78],
  ],
  '4': [
    [32, 28],
    [68, 28],
    [32, 72],
    [68, 72],
  ],
  '5': [
    [32, 25],
    [68, 25],
    [50, 50],
    [32, 75],
    [68, 75],
  ],
  '6': [
    [32, 24],
    [68, 24],
    [32, 50],
    [68, 50],
    [32, 76],
    [68, 76],
  ],
  '7': [
    [32, 22],
    [68, 22],
    [50, 36],
    [32, 52],
    [68, 52],
    [32, 80],
    [68, 80],
  ],
  '8': [
    [32, 20],
    [68, 20],
    [50, 33],
    [32, 47],
    [68, 47],
    [50, 61],
    [32, 80],
    [68, 80],
  ],
  '9': [
    [32, 18],
    [68, 18],
    [32, 40],
    [68, 40],
    [50, 51],
    [32, 62],
    [68, 62],
    [32, 84],
    [68, 84],
  ],
  '10': [
    [32, 18],
    [68, 18],
    [50, 29],
    [32, 40],
    [68, 40],
    [32, 62],
    [68, 62],
    [50, 73],
    [32, 84],
    [68, 84],
  ],
}

export function CardComponent({
  card,
  onClick,
  selected,
  index,
  sizeClassName,
  compactOnLandscape,
  cornerClassName,
  cornerLayout = 'column',
}: CardProps) {
  const suitClass = SUIT_COLOR_CLASS[card.suit]
  const cornerTextClass = cornerClassName
    ? cornerClassName
    : compactOnLandscape
      ? 'text-sm sm:text-base landscape:text-[10px] landscape:leading-none'
      : 'text-sm sm:text-base'
  const centerTextClass = compactOnLandscape
    ? 'text-2xl sm:text-3xl landscape:text-sm'
    : 'text-2xl sm:text-3xl'
  const cornerGap = compactOnLandscape ? 'left-2 top-1.5 landscape:left-1 landscape:top-0.5' : 'left-2 top-1.5'
  const cornerGapBottom = compactOnLandscape
    ? 'bottom-1.5 right-2 landscape:bottom-0.5 landscape:right-1'
    : 'bottom-1.5 right-2'
  const cornerFlexClass = cornerLayout === 'row' ? 'flex-col landscape:flex-row landscape:gap-0.5' : 'flex-col'
  const suitSpacingClass = cornerLayout === 'row' ? '-mt-[0.1em] landscape:mt-0' : '-mt-[0.1em]'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: selected ? 1.06 : 1 }}
      whileHover={{ scale: 1.08, zIndex: 40 }}
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
        sizeClassName ?? CARD_SIZE_CLASSES,
        'relative select-none rounded-md border shadow-md',
        onClick ? 'cursor-pointer' : '',
        card.isWild
          ? 'border-purple-300/50 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-800 text-white'
          : 'border-black/10 bg-card-face',
        selected ? 'z-20 shadow-[0_0_18px_rgba(212,175,55,0.95)] ring-4 ring-card-gold' : '',
      ].join(' ')}
    >
      {card.isWild ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1">
          <JesterIllustration compactOnLandscape={compactOnLandscape} />
          <span
            className={
              compactOnLandscape
                ? 'text-[10px] font-black leading-none tracking-wide text-white drop-shadow sm:text-xs landscape:hidden'
                : 'text-[10px] font-black leading-none tracking-wide text-white drop-shadow sm:text-xs'
            }
          >
            CURINGA
          </span>
        </div>
      ) : (
        <>
          <div
            className={`absolute flex items-center leading-[0.85] ${cornerFlexClass} ${cornerGap} ${suitClass} ${cornerTextClass}`}
          >
            <span className="font-bold tracking-tight">{card.rank}</span>
            <SuitIcon suit={card.suit} className={`${suitSpacingClass} text-[0.78em]`} />
          </div>
          <div
            className={`absolute flex rotate-180 items-center leading-[0.85] ${cornerFlexClass} ${cornerGapBottom} ${suitClass} ${cornerTextClass}`}
          >
            <span className="font-bold tracking-tight">{card.rank}</span>
            <SuitIcon suit={card.suit} className={`${suitSpacingClass} text-[0.78em]`} />
          </div>
          {PIP_POSITIONS[card.rank] && (
            <div className="relative h-full w-full landscape:hidden" aria-hidden="true">
              {PIP_POSITIONS[card.rank].map(([x, y], pi) => (
                <span
                  key={pi}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 text-sm leading-none sm:text-base ${suitClass}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  <SuitIcon suit={card.suit} />
                </span>
              ))}
            </div>
          )}
          <div
            className={`h-full w-full items-center justify-center opacity-90 ${
              PIP_POSITIONS[card.rank] ? 'hidden landscape:flex' : 'flex'
            } ${centerTextClass} ${suitClass}`}
          >
            <SuitIcon suit={card.suit} />
          </div>
        </>
      )}
    </motion.div>
  )
}

export function CardBack({
  className = '',
  variant = 'blue',
  sizeClassName,
  compactOnLandscape,
}: {
  className?: string
  variant?: 'blue' | 'red'
  sizeClassName?: string
  compactOnLandscape?: boolean
}) {
  return (
    <div
      className={[
        sizeClassName ?? CARD_SIZE_CLASSES,
        variant === 'blue' ? 'card-back-pattern-blue' : 'card-back-pattern-red',
        'rounded-md border border-white/40 shadow-md',
        'flex items-center justify-center',
        className,
      ].join(' ')}
    >
      <span
        className={`font-display text-lg text-white/80 drop-shadow-sm ${compactOnLandscape ? 'landscape:text-xs' : ''}`}
      >
        B
      </span>
    </div>
  )
}
