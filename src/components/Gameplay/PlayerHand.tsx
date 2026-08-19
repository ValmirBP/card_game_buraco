import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'
import type { Card } from '../../engine/card'
import type { TurnPhase } from './Gameplay'

// A mão do jogador humano é a única fileira de cartas que precisa continuar
// bem legível em paisagem — só ligeiramente menor que o tamanho padrão
// (usado no modo Online), pra a fileira caber numa faixa fina embaixo da
// mesa. Opt-in (passado explicitamente), então o modo Online (que não passa
// `sizeClassName`) fica com CARD_SIZE_CLASSES normal, intocado.
const HAND_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-12 landscape:h-[4.25rem]'

interface PlayerHandProps {
  phase: TurnPhase
}

// Ordem de exibição dos naipes na mão (agrupa cartas do mesmo naipe).
const SUIT_ORDER: Record<Card['suit'], number> = {
  spades: 0,
  hearts: 1,
  clubs: 2,
  diamonds: 3,
}

/** Valor do rank pra ordenar a mão com o ÁS BAIXO (A=1), da esquerda pra
 * direita: A 2 3 4 5 6 7 8 9 10 J Q K. */
function handRankValue(rank: Card['rank']): number {
  if (rank === 'A') return 1
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  const n = parseInt(rank, 10)
  return isNaN(n) ? 0 : n
}

/** Ordena a mão para exibição — agrupa por naipe e, dentro do naipe, em ordem
 * CRESCENTE começando pelo Ás: A 2 3 4 5 6 7 8 9 10 J Q K. Curingas ficam por
 * último. Preserva o índice original de cada carta (seleção/descarte). */
function orderedHand(hand: Card[]): { card: Card; index: number }[] {
  return hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      if (a.card.isWild !== b.card.isWild) return a.card.isWild ? 1 : -1
      if (a.card.isWild && b.card.isWild) return 0
      if (a.card.suit !== b.card.suit) return SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit]
      return handRankValue(a.card.rank) - handRankValue(b.card.rank)
    })
}

export default function PlayerHand({ phase }: PlayerHandProps) {
  // Subscribed so the hand re-renders after draw/discard/playCanasta mutate
  // the human player's cards in place.
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const selectedCardIndices = useGameStore(s => s.selectedCardIndices)
  const toggleCardSelection = useGameStore(s => s.toggleCardSelection)

  if (!game) return null

  const hand = game.state.players[0].hand.getCards()
  const isHumanTurn = game.state.status === 'playing' && game.state.currentPlayerIndex === 0

  const hint = !isHumanTurn
    ? 'IA jogando…'
    : phase === 'draw'
      ? 'Clique no monte para comprar (ou no descarte, se houver).'
      : selectedCardIndices.length === 1
        ? 'Selecione 1 carta e clique no descarte para descartar.'
        : selectedCardIndices.length >= 3
          ? 'Selecione cartas e clique na mesa para baixar, ou num jogo do time para estender.'
          : 'Selecione cartas: 1 para descartar, 3+ para baixar um jogo.'

  return (
    // Sem painel próprio: o painel visual (borda/fundo) agora é o container
    // compartilhado em Gameplay.tsx, que abriga mão E descarte lado a lado.
    <div className="flex h-full min-w-0 flex-col space-y-1 landscape:space-y-0">
      <div className="flex flex-nowrap items-baseline justify-between gap-x-3">
        <h3 className="shrink-0 font-display text-sm text-card-gold landscape:text-[10px]">
          Sua Mão <span className="text-[10px] font-normal text-gray-400 landscape:text-[8px]">({hand.length})</span>
        </h3>
        {hint && <span className="truncate text-[10px] text-gray-300 sm:text-xs landscape:text-[8px]">{hint}</span>}
      </div>
      {/* "Meia carta" em paisagem: a faixa da mão fica baixa e corta a
          metade inferior das cartas (overflow-y-hidden + max-height fixo) —
          só a metade de cima "espia" (rank/naipe do canto, grandes,
          continuam legíveis). A mão NÃO cresce ao selecionar (o jogador não
          precisa ver a carta inteira) — a seleção só REALÇA a carta com o
          anel dourado (ver Card.tsx), sem subir nada. O eixo X continua
          rolável se a mão não couber. */}
      <div
        id="player-hand-anchor"
        className="scrollbar-gold flex -space-x-6 overflow-x-auto px-1 pb-3 pt-3 sm:-space-x-7 landscape:max-h-[2.7rem] landscape:-space-x-2.5 landscape:overflow-y-hidden landscape:pb-0.5 landscape:pt-1"
      >
        {orderedHand(hand).map(({ card, index }, position) => (
          <div
            key={`${card.suit}-${card.rank}-${index}`}
            data-hand-index={index}
            className="relative flex-shrink-0 hover:z-30"
          >
            <CardComponent
              card={card}
              index={position}
              selected={selectedCardIndices.includes(index)}
              onClick={isHumanTurn ? () => toggleCardSelection(index) : undefined}
              sizeClassName={HAND_CARD_SIZE}
              compactOnLandscape
              // Naipes GRANDES no canto: em paisagem a mão fica em "meia carta"
              // (só o topo aparece), então o rank/naipe do canto precisa ser
              // bem legível por si só.
              cornerClassName="text-sm font-normal sm:text-base landscape:text-lg landscape:leading-none"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
