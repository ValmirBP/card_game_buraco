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

export function CardComponent({ card, onClick, selected, index }: CardProps) {
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
  const color = card.isWild ? 'text-purple-600' : isRed ? 'text-red-600' : 'text-black'

  return (
    <motion.div
      whileHover={{ translateY: -4, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index ?? 0) * 0.05 }}
      onClick={onClick}
      className={`
        w-20 h-28 bg-white rounded-lg shadow-lg cursor-pointer border-2
        flex flex-col items-center justify-center gap-1
        transition-all duration-200
        ${selected ? 'border-card-gold shadow-2xl -translate-y-2' : 'border-gray-300'}
        ${card.isWild ? 'bg-purple-50' : ''}
      `}
    >
      {card.isWild ? (
        <>
          <span className="text-xl text-purple-600">★</span>
          <span className="text-xs font-bold tracking-wide text-purple-600">JOKER</span>
          <span className="text-xl text-purple-600">★</span>
        </>
      ) : (
        <>
          <span className={`text-xs font-bold ${color}`}>{card.rank}</span>
          <span className={`text-2xl ${color}`}>{SUIT_SYMBOLS[card.suit]}</span>
          <span className={`text-xs font-bold ${color}`}>{card.rank}</span>
        </>
      )}
    </motion.div>
  )
}
