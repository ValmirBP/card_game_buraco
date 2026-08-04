import { motion } from 'framer-motion'
import type { AIDifficulty } from '../../engine/ai'

interface DifficultySelectorProps {
  onSelect: (difficulty: AIDifficulty) => void
  onCancel: () => void
}

const DIFFICULTIES: { level: AIDifficulty; label: string; desc: string }[] = [
  { level: 'easy', label: 'Fácil', desc: 'A IA joga de forma aleatória. Ideal para aprender as regras.' },
  { level: 'medium', label: 'Médio', desc: 'A IA prioriza formar canastras e descarta com mais cuidado.' },
  { level: 'hard', label: 'Difícil', desc: 'A IA joga estrategicamente e memoriza cartas descartadas.' },
]

export default function DifficultySelector({ onSelect, onCancel }: DifficultySelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="difficulty-selector-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-lg bg-card-green p-8 shadow-2xl"
      >
        <h2 id="difficulty-selector-title" className="mb-6 text-2xl font-bold text-card-gold">
          Escolha a dificuldade
        </h2>
        <div className="mb-6 space-y-4">
          {DIFFICULTIES.map(d => (
            <button
              key={d.level}
              type="button"
              onClick={() => onSelect(d.level)}
              className="min-h-[44px] w-full rounded-lg bg-white/10 p-4 text-left transition-colors hover:bg-white/20"
            >
              <div className="text-lg font-bold text-white">{d.label}</div>
              <div className="text-sm text-gray-300">{d.desc}</div>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] w-full rounded-lg bg-gray-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-gray-700"
        >
          Cancelar
        </button>
      </motion.div>
    </motion.div>
  )
}
