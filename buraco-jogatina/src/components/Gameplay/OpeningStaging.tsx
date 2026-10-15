import type { MouseEvent } from 'react'
import MeldArea, { isWildStrip, meldSuitOf, type MeldAreaMeld } from './MeldArea'
import { openingPoints } from '../../engine/game'
import { Canasta } from '../../engine/canasta'
import type { Card } from '../../engine/card'
import { openingProgressText, stagedPoints } from './vulnerability'

interface OpeningStagingProps {
  hand: Card[]
  groups: number[][]
  minimum: number
  isDropTarget: boolean
  pendingPoints?: number
  onCancel: () => void
  onGroupClick: (groupIndex: number, event: MouseEvent<HTMLDivElement>) => void
}

function stagedMeld(cards: Card[], onClick: MeldAreaMeld['onClick']): MeldAreaMeld {
  let canasta: Canasta | null = null
  try {
    canasta = new Canasta(cards)
  } catch {
    canasta = null
  }
  const suit = meldSuitOf(cards)
  return {
    strips: canasta
      ? canasta.layout.map(s => ({ card: s.card, wild: isWildStrip(s.card, s.representsValue, suit) }))
      : cards.map(card => ({ card, wild: card.isWild })),
    closed: canasta?.isCanastra ?? false,
    clean: canasta?.isClean ?? true,
    kind: canasta?.kind ?? 'simples',
    points: openingPoints(cards),
    highlight: null,
    onClick,
  }
}

export default function OpeningStaging({
  hand,
  groups,
  minimum,
  isDropTarget,
  pendingPoints,
  onCancel,
  onGroupClick,
}: OpeningStagingProps) {
  const points = pendingPoints ?? stagedPoints(hand, groups)
  return (
    <div data-opening-staging className="flex min-h-0 flex-col gap-1 landscape:flex-1 landscape:px-1">
      <div className="flex items-center justify-between gap-2">
        <span
          className={`whitespace-nowrap text-xs font-bold landscape:text-[11px] ${
            points >= minimum ? 'text-green-300' : 'text-amber-200'
          }`}
        >
          {openingProgressText(points, minimum)}
        </span>
        {groups.length > 0 && (
          <button
            type="button"
            onClick={event => {
              event.stopPropagation()
              onCancel()
            }}
            className="shrink-0 whitespace-nowrap rounded-full border border-white/30 px-2 py-0.5 text-[10px] leading-none text-gray-200 hover:bg-white/10"
          >
            Desfazer
          </button>
        )}
      </div>
      <span className="text-[11px] leading-tight text-gray-300 landscape:text-[10px]">
        {groups.length === 0
          ? isDropTarget
            ? `Toque aqui para usar estas cartas na abertura (mínimo ${minimum} pontos).`
            : `Vulneráveis: junte jogos que somem ${minimum} pontos na 1ª descida.`
          : `Reservados ${groups.length} jogo(s). Selecione mais cartas e toque aqui (ou num jogo reservado para aumentá-lo); ao chegar a ${minimum}, tudo desce junto.`}
      </span>
      {groups.length > 0 && (
        <MeldArea
          melds={groups.map((g, gi) =>
            stagedMeld(
              g.map(i => hand[i]).filter((c): c is Card => Boolean(c)),
              event => onGroupClick(gi, event)
            )
          )}
        />
      )}
    </div>
  )
}
