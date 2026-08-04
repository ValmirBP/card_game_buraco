import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import DifficultySelector from './DifficultySelector'
import RulesModal from './RulesModal'
import type { AIDifficulty } from '../../engine/ai'

interface MenuProps {
  onStart: () => void
}

export default function Menu({ onStart }: MenuProps) {
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [playerName, setPlayerName] = useState('Você')

  const handleSelectDifficulty = (difficulty: AIDifficulty) => {
    const name = playerName.trim() || 'Você'
    useGameStore.getState().initGame(name, difficulty)
    setShowDifficulty(false)
    onStart()
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <div className="text-center">
        <h1 className="mb-2 text-5xl font-bold text-card-gold md:text-6xl">Buraco</h1>
        <p className="text-xl text-gray-200 md:text-2xl">Jogatina</p>
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
          className="min-h-[44px] w-full rounded-lg px-4 py-3 text-center text-black"
        />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-4 px-4">
        <button
          type="button"
          onClick={() => setShowDifficulty(true)}
          className="min-h-[44px] w-full rounded-lg bg-card-gold px-6 py-3 font-bold text-black transition-colors hover:bg-yellow-400"
        >
          Jogar vs IA
        </button>
        <button
          type="button"
          onClick={() => setShowRules(true)}
          className="min-h-[44px] w-full rounded-lg bg-white px-6 py-3 font-bold text-card-green transition-colors hover:bg-gray-100"
        >
          Regras
        </button>
      </div>

      {showDifficulty && (
        <DifficultySelector onSelect={handleSelectDifficulty} onCancel={() => setShowDifficulty(false)} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
