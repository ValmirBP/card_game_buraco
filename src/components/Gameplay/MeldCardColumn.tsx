import { CardComponent, SuitIcon } from '../Card'
import type { Card as CardType } from '../../engine/card'

const SUIT_COLOR_CLASS: Record<CardType['suit'], string> = {
  hearts: 'text-suit-hearts',
  diamonds: 'text-suit-diamonds',
  clubs: 'text-suit-clubs',
  spades: 'text-suit-spades',
}

/** Tamanho da carta INTEIRA no fim da coluna (a "carta de baixo" do leque,
 * como na foto de referência do usuário). Menor que a antiga carta de mesa
 * ("as cartas da mesa estão muito grandes"). */
const FULL_CARD_SIZE = 'w-20 h-28 landscape:w-12 landscape:h-16'
const FULL_CARD_CORNER = 'text-sm font-normal sm:text-base landscape:text-sm landscape:leading-none'

/** Uma carta "espiada": só a faixa do topo com rank+naipe, altura FIXA —
 * sempre legível, não importa quantas cartas o jogo tenha. */
function CardStrip({ card }: { card: CardType }) {
  if (card.isWild) {
    return (
      <div className="flex h-6 w-20 shrink-0 items-center justify-center rounded-sm border border-purple-300/50 bg-gradient-to-r from-fuchsia-600 to-indigo-700 text-xs font-bold leading-none text-white landscape:h-[1.15rem] landscape:w-12 landscape:text-[10px]">
        ★
      </div>
    )
  }
  return (
    <div
      className={`flex h-6 w-20 shrink-0 items-center gap-1 rounded-sm border border-black/15 bg-card-face px-1.5 text-base font-bold leading-none landscape:h-[1.15rem] landscape:w-12 landscape:gap-0.5 landscape:px-1 landscape:text-[11px] ${SUIT_COLOR_CLASS[card.suit]}`}
    >
      <span>{card.rank}</span>
      <SuitIcon suit={card.suit} />
    </div>
  )
}

interface MeldCardColumnProps {
  /** Cartas na ordem canônica do jogo (crescente, ver Canasta.layout). */
  cards: CardType[]
  /** Canastra fechada (7+): anel dourado e a última carta DEITADA. */
  isClosed: boolean
}

/**
 * Coluna de um jogo baixado, estilo da foto de referência do usuário: cada
 * carta aparece como uma TIRA fina de altura fixa (rank+naipe, sempre
 * legível — nada de comprimir cartas até ficarem invisíveis), e a ÚLTIMA
 * carta aparece inteira no fim, como num leque real sobre a mesa. Altura
 * máxima (canastra real de 14 cartas): 13 tiras + 1 carta ≈ 300px em
 * paisagem — cabe no painel SEM rolagem, por construção. Largura fixa
 * estreita (48px em paisagem): vários jogos lado a lado.
 */
export default function MeldCardColumn({ cards, isClosed }: MeldCardColumnProps) {
  const lastIdx = cards.length - 1
  return (
    <div className={`flex flex-col items-center rounded-md ${isClosed ? 'ring-2 ring-card-gold/70' : ''}`}>
      {cards.map((card, i) =>
        i === lastIdx ? (
          <div key={i} className={isClosed ? 'my-2 origin-center rotate-90' : ''}>
            <CardComponent
              card={card}
              sizeClassName={FULL_CARD_SIZE}
              compactOnLandscape
              cornerLayout="row"
              cornerClassName={FULL_CARD_CORNER}
            />
          </div>
        ) : (
          <CardStrip key={i} card={card} />
        )
      )}
    </div>
  )
}
