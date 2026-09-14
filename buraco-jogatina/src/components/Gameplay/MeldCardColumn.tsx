import { CardComponent, SuitIcon } from '../Card'
import type { Card as CardType } from '../../engine/card'

const SUIT_COLOR_CLASS: Record<CardType['suit'], string> = {
  hearts: 'text-suit-hearts',
  diamonds: 'text-suit-diamonds',
  clubs: 'text-suit-clubs',
  spades: 'text-suit-spades',
}

/** Tamanho da carta INTEIRA no fim da coluna (a "carta de baixo" do leque,
 * como na foto de referência do usuário). Pedido do usuário: mesa bem
 * maior em paisagem — agora do MESMO tamanho do retrato, sem compressão
 * especial pra paisagem (a mesa rola em vez de espremer, ver GameBoard). */
const FULL_CARD_SIZE = 'w-20 h-28 landscape:w-20 landscape:h-28'
const FULL_CARD_CORNER = 'text-sm font-normal sm:text-base landscape:text-base landscape:leading-none'

/** Uma carta "espiada": só a faixa do topo com rank+naipe, altura FIXA —
 * sempre legível, não importa quantas cartas o jogo tenha. */
function CardStrip({ card }: { card: CardType }) {
  if (card.isWild) {
    return (
      <div className="flex h-6 w-20 shrink-0 items-center justify-center rounded-sm border border-purple-300/50 bg-gradient-to-r from-fuchsia-600 to-indigo-700 text-xs font-bold leading-none text-white landscape:h-8 landscape:w-20 landscape:text-base">
        ★
      </div>
    )
  }
  return (
    <div
      className={`flex h-6 w-20 shrink-0 items-center gap-1 rounded-sm border border-black/15 bg-card-face px-1.5 text-base font-bold leading-none landscape:h-8 landscape:w-20 landscape:gap-1 landscape:px-1.5 landscape:text-base ${SUIT_COLOR_CLASS[card.suit]}`}
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
 * carta aparece inteira no fim, como num leque real sobre a mesa. Uma
 * canastra real de 14 cartas (13 tiras + 1 carta inteira) pode passar da
 * altura visível do painel — de propósito: a mesa inteira agora rola
 * (vertical e horizontal, ver GameBoard.tsx), em vez de espremer tudo pra
 * caber numa tela de celular sem rolagem.
 */
export default function MeldCardColumn({ cards, isClosed }: MeldCardColumnProps) {
  const lastIdx = cards.length - 1
  return (
    <div className={`flex flex-col items-center rounded-md ${isClosed ? 'ring-2 ring-card-gold/70' : ''}`}>
      {cards.map((card, i) =>
        i === lastIdx ? (
          <div
            key={i}
            // Canastra fechada: a carta deitada tem que ficar POR CIMA da
            // pilha, cruzada, como numa mesa de verdade.
            // `rotate-90` é só visual - a CAIXA de layout continua em pé
            // (w-20 x h-28, igual em retrato e paisagem desde que a mesa
            // ficou maior - ver FULL_CARD_SIZE acima), então as MESMAS
            // margens negativas servem pras duas orientações agora (antes
            // paisagem tinha seu próprio ajuste pro tamanho menor que não
            // existe mais). Anulam o vão morto da rotação E puxam a carta
            // pra cima da última tira; z-10 garante que ela desenhe por
            // cima, não por baixo.
            // A sobreposição é pequena de propósito: encosta na pilha (parece
            // apoiada em cima) SEM cobrir o rank da carta de baixo - com uma
            // sobreposição maior que a altura de uma tira, a carta anterior
            // sumia inteira e não dava pra contar a canastra.
            className={isClosed ? 'relative z-10 origin-center rotate-90 -mt-6 -mb-4' : ''}
          >
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
