import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import type { AIDifficulty } from '../../engine/ai'

interface DifficultySelectorProps {
  onSelect: (difficulty: AIDifficulty) => void
  onCancel: () => void
}

const DIFFICULTIES: { level: AIDifficulty; label: string; desc: string; icon: string }[] = [
  { level: 'easy', label: 'Fácil', desc: 'A IA joga de forma aleatória. Ideal para aprender as regras.', icon: '🐣' },
  { level: 'medium', label: 'Médio', desc: 'A IA prioriza formar canastras e descarta com mais cuidado.', icon: '⚖️' },
  { level: 'hard', label: 'Difícil', desc: 'A IA joga estrategicamente e memoriza cartas descartadas.', icon: '🔥' },
]

export default function DifficultySelector({ onSelect, onCancel }: DifficultySelectorProps) {
  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="difficulty-selector-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-card-green-dark/90 p-8 shadow-2xl backdrop-blur-xl"
      >
        <h2 id="difficulty-selector-title" className="mb-6 font-display text-2xl text-card-gold">
          Escolha a dificuldade
        </h2>
        <div className="mb-6 space-y-4">
          {DIFFICULTIES.map(d => (
            <motion.button
              key={d.level}
              type="button"
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSelect(d.level)}
              className="flex min-h-[44px] w-full items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 text-left shadow transition-colors hover:border-card-gold/60 hover:bg-white/10"
            >
              <span className="text-3xl leading-none">{d.icon}</span>
              <span>
                <span className="block text-lg font-bold text-white">{d.label}</span>
                <span className="block text-sm text-gray-300">{d.desc}</span>
              </span>
            </motion.button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] w-full rounded-xl bg-white/10 px-4 py-2 font-semibold text-white transition-colors hover:bg-white/20"
        >
          Cancelar
        </button>
      </motion.div>
    </motion.div>,
    document.body
  )
}
