interface ExitButtonProps {
  onClick: () => void
}

export default function ExitButton({ onClick }: ExitButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Sair da partida"
      className="shrink-0 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-gray-300 backdrop-blur-sm transition-colors hover:border-red-400/50 hover:text-red-300 landscape:px-1.5 landscape:py-0.5 landscape:text-[10px]"
    >
      ✕ <span className="hidden sm:inline">Sair</span>
    </button>
  )
}
