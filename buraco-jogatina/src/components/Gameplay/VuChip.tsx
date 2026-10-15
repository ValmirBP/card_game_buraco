interface VuChipProps {
  minimum: number
  opened?: boolean
  className?: string
}

export default function VuChip({ minimum, opened = false, className = '' }: VuChipProps) {
  if (minimum <= 0) return null
  const title = opened
    ? 'Vulnerável (VU): a dupla já abriu nesta rodada'
    : `Vulnerável (VU): a 1ª descida da rodada precisa somar ${minimum} pontos`
  return (
    <span
      title={title}
      aria-label={title}
      data-vu={opened ? 'opened' : 'pending'}
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-px font-sans text-[10px] font-black leading-none tracking-wide ${
        opened ? 'bg-white/15 text-gray-200' : 'bg-red-600 text-white shadow-[0_0_8px_rgba(220,38,38,0.7)]'
      } ${className}`}
    >
      {opened ? 'VU ✓' : `VU ${minimum}`}
    </span>
  )
}
