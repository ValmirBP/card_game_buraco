import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import DifficultySelector from './DifficultySelector'
import RulesModal from './RulesModal'
import type { AIDifficulty } from '../../engine/ai'
import { Card as EngineCard } from '../../engine/card'
import { CardComponent } from '../Card'

interface MenuProps {
  onStart: (difficulty: AIDifficulty, playerName: string) => void
}

/** Purely decorative fan of cards shown behind the title. */
const FAN_CARDS: { card: EngineCard; rotate: number; x: number }[] = [
  { card: new EngineCard('spades', 'K'), rotate: -18, x: -78 },
  { card: new EngineCard('hearts', 'A'), rotate: -9, x: -39 },
  { card: new EngineCard('clubs', 'Q'), rotate: 0, x: 0 },
  { card: new EngineCard('diamonds', 'J'), rotate: 9, x: 39 },
  { card: new EngineCard('hearts', '10'), rotate: 18, x: 78 },
]

export default function Menu({ onStart }: MenuProps) {
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [playerName, setPlayerName] = useState('Você')

  const handleSelectDifficulty = (difficulty: AIDifficulty) => {
    const name = playerName.trim() || 'Você'
    useGameStore.getState().initGame(name, difficulty)
    setShowDifficulty(false)
    onStart(difficulty, name)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="relative flex flex-col items-center pt-8 text-center">
        <div className="pointer-events-none absolute -top-2 flex h-20 items-end justify-center sm:-top-4 sm:h-24">
          {FAN_CARDS.map((f, i) => (
            <div
              key={i}
              className="absolute"
              style={{ transform: `translateX(${f.x}px) rotate(${f.rotate}deg)` }}
            >
              <CardComponent card={f.card} index={i} />
            </div>
          ))}
        </div>
        <h1 className="relative z-10 mt-16 mb-2 font-display text-5xl tracking-wide text-card-gold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:mt-20 md:text-6xl">
          Buraco
        </h1>
        <p className="relative z-10 text-xl text-gray-200 md:text-2xl">Jogatina</p>
      </div>

      <div className="w-full max-w-sm px-4">
        <label htmlFor="player-name" className="sr-only">
          Nome do jogador
        </label>
        <input
          id="player-name"
          type="text"
          placeholder="Seu nome"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-white placeholder-gray-400 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70"
        />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4 px-4">
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowDifficulty(true)}
          className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark"
        >
          Jogar vs IA
        </motion.button>
        <motion.button
          type="button"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowRules(true)}
          className="min-h-[44px] w-full rounded-xl border-2 border-card-gold/70 bg-black/20 px-6 py-3 font-bold text-card-gold backdrop-blur-sm transition-colors hover:bg-card-gold/10"
        >
          Regras
        </motion.button>
      </div>

      {showDifficulty && (
        <DifficultySelector onSelect={handleSelectDifficulty} onCancel={() => setShowDifficulty(false)} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
