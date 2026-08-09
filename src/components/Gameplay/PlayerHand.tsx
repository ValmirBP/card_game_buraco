import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'
import { rankToNumber } from '../../engine/utils'
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

/** Ordena a mão para exibição — agrupa por naipe e, dentro do naipe, em ordem
 * decrescente A K Q J 10 9 8 7 6 5 4 3 2. Curingas ficam por último.
 * Preserva o índice original de cada carta (usado para seleção/descarte). */
function orderedHand(hand: Card[]): { card: Card; index: number }[] {
  return hand
    .map((card, index) => ({ card, index }))
    .sort((a, b) => {
      if (a.card.isWild !== b.card.isWild) return a.card.isWild ? 1 : -1
      if (a.card.isWild && b.card.isWild) return 0
      if (a.card.suit !== b.card.suit) return SUIT_ORDER[a.card.suit] - SUIT_ORDER[b.card.suit]
      return rankToNumber(b.card.rank) - rankToNumber(a.card.rank)
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
    <div className="space-y-1 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 shadow-lg backdrop-blur-sm landscape:px-2 landscape:py-1">
      <div className="flex flex-nowrap items-baseline justify-between gap-x-3">
        <h3 className="shrink-0 font-display text-sm text-card-gold landscape:text-xs">
          Sua Mão <span className="text-[10px] font-normal text-gray-400">({hand.length})</span>
        </h3>
        {hint && <span className="truncate text-[10px] text-gray-300 sm:text-xs landscape:text-[9px]">{hint}</span>}
      </div>
      {/* Seleção NÃO eleva o z-index — a carta selecionada sobe
          verticalmente mas mantém o empilhamento natural do leque, sem
          cobrir o canto (rank/naipe) da carta vizinha. Só o hover traz a
          carta pra frente, temporariamente, pra leitura. */}
      <div
        id="player-hand-anchor"
        className="scrollbar-gold flex -space-x-8 overflow-x-auto px-1 pb-3 pt-3 sm:-space-x-10 landscape:-space-x-6 landscape:pb-1 landscape:pt-2"
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
            />
          </div>
        ))}
      </div>
    </div>
  )
}
