import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import DifficultySelector from './DifficultySelector'
import RulesModal from './RulesModal'
import type { AIDifficulty } from '../../engine/ai'
import { Card as EngineCard } from '../../engine/card'
import { CardComponent } from '../Card'

export interface BotNames {
  partner: string
  opponent1: string
  opponent2: string
}

interface MenuProps {
  onStart: (difficulty: AIDifficulty, playerName: string, names: BotNames) => void
  onPlayOnline: () => void
}

const DEFAULT_BOT_NAMES: BotNames = {
  partner: 'Bruno',
  opponent1: 'Ana',
  opponent2: 'Carlos',
}

/** Purely decorative fan of cards shown behind the title. */
const FAN_CARDS: { card: EngineCard; rotate: number; x: number }[] = [
  { card: new EngineCard('spades', 'K'), rotate: -18, x: -78 },
  { card: new EngineCard('hearts', 'A'), rotate: -9, x: -39 },
  { card: new EngineCard('clubs', 'Q'), rotate: 0, x: 0 },
  { card: new EngineCard('diamonds', 'J'), rotate: 9, x: 39 },
  { card: new EngineCard('hearts', '10'), rotate: 18, x: 78 },
]

export default function Menu({ onStart, onPlayOnline }: MenuProps) {
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [playerName, setPlayerName] = useState('Você')
  const [showNameEditor, setShowNameEditor] = useState(false)
  const [botNames, setBotNames] = useState<BotNames>(DEFAULT_BOT_NAMES)

  const handleSelectDifficulty = (difficulty: AIDifficulty) => {
    const name = playerName.trim() || 'Você'
    const names: BotNames = {
      partner: botNames.partner.trim() || DEFAULT_BOT_NAMES.partner,
      opponent1: botNames.opponent1.trim() || DEFAULT_BOT_NAMES.opponent1,
      opponent2: botNames.opponent2.trim() || DEFAULT_BOT_NAMES.opponent2,
    }
    useGameStore.getState().initGame(name, difficulty, names)
    setShowDifficulty(false)
    onStart(difficulty, name, names)
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col items-center justify-center gap-4 overflow-y-auto px-3 py-2 landscape:justify-center landscape:gap-1.5 landscape:overflow-hidden">
      <div className="relative flex flex-col items-center pt-4 text-center landscape:pt-0">
        <div className="pointer-events-none absolute -top-2 flex h-20 items-end justify-center sm:-top-4 sm:h-24 landscape:hidden">
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
        <h1 className="relative z-10 mt-16 mb-1 font-display text-4xl tracking-wide text-card-gold drop-shadow-[0_2px_6px_rgba(0,0,0,0.5)] sm:mt-20 md:text-6xl landscape:mt-0 landscape:text-xl">
          Buraco
        </h1>
        <p className="relative z-10 text-lg text-gray-200 md:text-2xl landscape:text-xs">Jogatina</p>
      </div>

      <div className="grid w-full max-w-3xl grid-cols-1 gap-4 px-2 landscape:grid-cols-2 landscape:items-start landscape:gap-4 landscape:px-4">
        {/* Coluna esquerda (paisagem): nome + edição de nomes */}
        <div className="flex flex-col gap-2 landscape:gap-1">
          <div className="w-full">
            <label htmlFor="player-name" className="sr-only">
              Nome do jogador
            </label>
            <input
              id="player-name"
              type="text"
              placeholder="Seu nome"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-center text-white placeholder-gray-400 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70 landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
            />
          </div>

          <div className="w-full">
            <button
              type="button"
              onClick={() => setShowNameEditor(v => !v)}
              className="w-full text-center text-sm text-gray-300 underline decoration-dotted underline-offset-4 transition-colors hover:text-card-gold landscape:text-[11px]"
            >
              {showNameEditor ? 'Ocultar edição de nomes' : 'Editar nomes'}
            </button>
            {showNameEditor && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 flex flex-col gap-2 overflow-hidden landscape:mt-1 landscape:gap-1"
              >
                <div>
                  <label htmlFor="partner-name" className="mb-0.5 block text-xs text-gray-300 landscape:text-[10px]">
                    Parceiro
                  </label>
                  <input
                    id="partner-name"
                    type="text"
                    placeholder={DEFAULT_BOT_NAMES.partner}
                    value={botNames.partner}
                    onChange={e => setBotNames(n => ({ ...n, partner: e.target.value }))}
                    className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-center text-white placeholder-gray-400 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70 landscape:min-h-0 landscape:py-1 landscape:text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="opponent1-name" className="mb-0.5 block text-xs text-gray-300 landscape:text-[10px]">
                    Adversário 1
                  </label>
                  <input
                    id="opponent1-name"
                    type="text"
                    placeholder={DEFAULT_BOT_NAMES.opponent1}
                    value={botNames.opponent1}
                    onChange={e => setBotNames(n => ({ ...n, opponent1: e.target.value }))}
                    className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-center text-white placeholder-gray-400 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70 landscape:min-h-0 landscape:py-1 landscape:text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="opponent2-name" className="mb-0.5 block text-xs text-gray-300 landscape:text-[10px]">
                    Adversário 2
                  </label>
                  <input
                    id="opponent2-name"
                    type="text"
                    placeholder={DEFAULT_BOT_NAMES.opponent2}
                    value={botNames.opponent2}
                    onChange={e => setBotNames(n => ({ ...n, opponent2: e.target.value }))}
                    className="min-h-[44px] w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-center text-white placeholder-gray-400 shadow-inner outline-none backdrop-blur-sm transition focus:ring-4 focus:ring-card-gold/70 landscape:min-h-0 landscape:py-1 landscape:text-xs"
                  />
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Coluna direita (paisagem): ações principais */}
        <div className="flex w-full flex-col gap-3 landscape:gap-1.5">
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowDifficulty(true)}
            className="min-h-[44px] w-full rounded-xl bg-gradient-to-b from-card-gold-light to-card-gold px-6 py-3 font-bold text-black shadow-lg shadow-black/30 transition-colors hover:from-card-gold hover:to-card-gold-dark landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
          >
            Jogar vs IA
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={onPlayOnline}
            className="min-h-[44px] w-full rounded-xl border-2 border-card-gold/70 bg-black/20 px-6 py-3 font-bold text-card-gold backdrop-blur-sm transition-colors hover:bg-card-gold/10 landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
          >
            Jogar Online
          </motion.button>
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowRules(true)}
            className="min-h-[44px] w-full rounded-xl border-2 border-card-gold/70 bg-black/20 px-6 py-3 font-bold text-card-gold backdrop-blur-sm transition-colors hover:bg-card-gold/10 landscape:min-h-0 landscape:py-1.5 landscape:text-sm"
          >
            Regras
          </motion.button>
        </div>
      </div>

      {showDifficulty && (
        <DifficultySelector onSelect={handleSelectDifficulty} onCancel={() => setShowDifficulty(false)} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
