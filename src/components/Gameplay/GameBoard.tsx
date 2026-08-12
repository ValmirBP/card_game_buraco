import { useState, type MouseEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { CardComponent, CardBack } from '../Card'
import { teamIdOfSeat, type TeamId } from '../../engine/gameState'
import { canExtendMeld, isValidCanasta } from '../../engine/utils'
import Seat from './Seat'
import type { TurnPhase } from './Gameplay'

interface GameBoardProps {
  phase: TurnPhase
  /** Whether "pegar o descarte" is currently a legal move (pile non-empty
   * and it's the human's turn to draw) — drives the discard-pile glow. */
  canTakeDiscard: boolean
  onDraw: () => void
  onTakeDiscardPile: () => void
  onDiscardSelected: () => void
  onPlayCanastaSelected: () => void
  onExtendMeld: (meldIndex: number, cardIndices: number[], targetRect: DOMRect) => void
}

const TEAM_LABEL: Record<TeamId, string> = { A: 'Nós', B: 'Eles' }
const TEAM_PANEL_CLASS: Record<TeamId, string> = {
  A: 'border-card-gold/40 bg-card-gold/5',
  B: 'border-fuchsia-400/30 bg-fuchsia-500/5',
}
const TEAM_TEXT_CLASS: Record<TeamId, string> = {
  A: 'text-card-gold',
  B: 'text-fuchsia-300',
}
// Onde cada painel de dupla fica na grade. Retrato: empilhado (fallback).
// Paisagem ("estilo Jogatina"): Nós na coluna 2, Eles na coluna 3 — as duas
// colunas centrais (1fr cada) que ocupam a MAIOR parte do feltro; os
// jogadores ficam nas colunas-borda (1 e 4), FORA da área dos jogos.
const TEAM_GRID_CLASS: Record<TeamId, string> = {
  A: 'order-4 landscape:col-start-2 landscape:row-start-2',
  B: 'order-4 landscape:col-start-3 landscape:row-start-2',
}

/** Footprint das cartas dos JOGOS baixados (colunas verticais). Em paisagem
 * ficam num tamanho legível (naipes visíveis), já que os jogos são a vista
 * principal. Opt-in, então nunca afeta Online nem a mão. */
const TABLE_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-9 landscape:h-[3.35rem]'
/** Footprint do MONTE — pequeno no canto, só pra ficar visível/clicável. */
const PILE_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-8 landscape:h-[2.9rem]'
/** Footprint das cartas do DESCARTE — MESMO tamanho das cartas da mão, pra a
 * fileira do descarte ficar paralela à mão e visualmente consistente. Deve
 * acompanhar HAND_CARD_SIZE em PlayerHand.tsx. */
const HAND_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-12 landscape:h-[4.25rem]'
/** Naipes/rank do canto grandes e legíveis (usado na mão e no descarte). */
const BIG_CORNER = 'text-sm font-normal sm:text-base landscape:text-lg landscape:leading-none'

/** Sobreposição vertical das cartas de um jogo (coluna). Quanto MAIS cartas,
 * mais elas se JUNTAM (margem negativa maior) pra a coluna não crescer sem
 * limite e caber no painel. Classes literais pra o Tailwind gerá-las. */
function meldStackSpacing(n: number): string {
  if (n >= 9) return 'space-y-[-4.9rem] sm:space-y-[-5.7rem] landscape:space-y-[-2.6rem]'
  if (n >= 7) return 'space-y-[-4.6rem] sm:space-y-[-5.4rem] landscape:space-y-[-2.25rem]'
  if (n >= 5) return 'space-y-[-4.4rem] sm:space-y-[-5.2rem] landscape:space-y-[-2rem]'
  return 'space-y-[-4.2rem] sm:space-y-[-5rem] landscape:space-y-[-1.8rem]'
}

/** The 4-seat table: opponents/partner around a center that shows the draw
 * pile, discard pile (with a small fan of the last few cards), the two
 * mortos (crossed face-down cards until taken), and the two teams' melds. */
export default function GameBoard({
  phase,
  canTakeDiscard,
  onDraw,
  onTakeDiscardPile,
  onDiscardSelected,
  onPlayCanastaSelected,
  onExtendMeld,
}: GameBoardProps) {
  // Subscribed so the board re-renders whenever any part of `game` mutates
  // (see the REACTIVITY CONTRACT comment on GameStore.game).
  useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const selectedCardIndices = useGameStore(s => s.selectedCardIndices)

  const [hint, setHint] = useState<string | null>(null)

  if (!game) return null

  const { players, discardPile, deck, mortos, teams, currentPlayerIndex, status } = game.state
  const isHumanTurn = status === 'playing' && currentPlayerIndex === 0

  const flashHint = (message: string) => {
    setHint(message)
    window.setTimeout(() => setHint(current => (current === message ? null : current)), 2600)
  }

  // ---- Manipulação direta: monte / descarte / mesa (sem botões) ----------

  const canClickDeck = isHumanTurn && phase === 'draw'
  const canClickDiscardToDraw = isHumanTurn && phase === 'draw' && canTakeDiscard
  const canClickDiscardToDiscard = isHumanTurn && phase === 'play' && selectedCardIndices.length === 1
  const canClickDropZone = isHumanTurn && phase === 'play' && selectedCardIndices.length >= 3

  const handleDeckClick = () => {
    if (!isHumanTurn) return
    if (phase !== 'draw') {
      flashHint('Descarte uma carta antes de comprar de novo.')
      return
    }
    onDraw()
  }

  const handleDiscardPileClick = () => {
    if (!isHumanTurn) return
    if (phase === 'draw') {
      if (!canTakeDiscard) {
        flashHint('O descarte está vazio.')
        return
      }
      onTakeDiscardPile()
      return
    }
    // phase === 'play'
    if (selectedCardIndices.length === 0) {
      flashHint('Selecione 1 carta para descartar.')
      return
    }
    if (selectedCardIndices.length > 1) {
      flashHint('Selecione apenas 1 carta para descartar.')
      return
    }
    onDiscardSelected()
  }

  const handleDropZoneClick = () => {
    if (!isHumanTurn || phase !== 'play') return
    if (selectedCardIndices.length < 3) {
      flashHint('Selecione 3 ou mais cartas para baixar uma canastra.')
      return
    }

    const handCards = players[0].hand.getCards()
    const selectedCards = selectedCardIndices.map(i => handCards[i]).filter(Boolean)

    if (!isValidCanasta(selectedCards)) {
      flashHint('Essa seleção não forma um jogo válido (sequência do mesmo naipe ou trinca de Áses).')
      return
    }

    if (game.wouldPlayCanastaEmptyHandIllegally(selectedCards)) {
      flashHint('Você não pode baixar todas as cartas sem poder bater.')
      return
    }

    onPlayCanastaSelected()
  }

  const handleMeldClick = (
    event: MouseEvent,
    teamId: TeamId,
    meldIndex: number,
    meldCards: import('../../engine/card').Card[]
  ) => {
    // Clicar num jogo existente é "estender"; não deve borbulhar para o
    // painel "Nós" (que baixaria um jogo novo).
    event.stopPropagation()
    if (teamId !== 'A') return // only the human (seat 0) acts; only Team A melds are extendable by them
    if (!isHumanTurn || phase !== 'play' || selectedCardIndices.length === 0) return

    const handCards = players[0].hand.getCards()
    const selectedCards = selectedCardIndices.map(i => handCards[i]).filter(Boolean)

    if (!canExtendMeld(meldCards, selectedCards)) {
      flashHint('Essa seleção não estende esse jogo. Escolha cartas que continuem a sequência (ou mais Áses).')
      return
    }

    if (game.wouldExtendMeldEmptyHandIllegally(meldIndex, selectedCards)) {
      flashHint('Você não pode baixar todas as cartas sem poder bater.')
      return
    }

    const targetRect = event.currentTarget.getBoundingClientRect()
    onExtendMeld(meldIndex, selectedCardIndices, targetRect)
  }

  // ---------------------------------------------------------------------
  // Blocos reutilizados na grade (definidos como JSX pra a grade em si ficar
  // legível). Monte (canto sup-esq), mortos (ao lado do monte), descarte
  // (embaixo, logo acima da mão).
  // ---------------------------------------------------------------------

  const deckPile =
    deck.length > 0 ? (
      <motion.div
        id="deck-pile"
        onClick={handleDeckClick}
        animate={canClickDeck ? { scale: [1, 1.05, 1] } : { scale: 1 }}
        transition={canClickDeck ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
        className={`relative rounded-lg ${
          canClickDeck ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_16px_rgba(212,175,55,0.6)]' : ''
        }`}
      >
        <div className="absolute left-1 top-1 -z-10">
          <CardBack variant="red" sizeClassName={PILE_CARD_SIZE} compactOnLandscape />
        </div>
        <CardBack variant="blue" sizeClassName={PILE_CARD_SIZE} compactOnLandscape />
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-card-gold px-1 text-[10px] font-bold text-black shadow landscape:-right-1.5 landscape:-top-1.5 landscape:h-4 landscape:min-w-4 landscape:text-[9px]">
          {deck.length}
        </span>
      </motion.div>
    ) : (
      <div
        id="deck-pile"
        onClick={handleDeckClick}
        className={`flex h-24 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 text-[10px] text-gray-400 sm:h-28 sm:w-20 landscape:h-[2.9rem] landscape:w-8 landscape:text-[6px] ${
          canClickDeck ? 'cursor-pointer ring-2 ring-card-gold' : ''
        }`}
      >
        Vazio
      </div>
    )

  const mortoBlock = (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-semibold uppercase tracking-wide text-gray-400 landscape:text-[7px]">
        Morto{mortos.length !== 1 ? 's' : ''}
      </span>
      {mortos.length > 0 ? (
        <div className="relative flex h-12 w-12 items-center justify-center landscape:h-10 landscape:w-10">
          <AnimatePresence>
            {mortos.map((morto, i) => {
              // i === 0 -> morto 1 deitado por cima; i === 1 -> morto 2 em pé
              // por baixo (cruz). Se só resta um, fica em pé, centralizado.
              const isCrossed = mortos.length === 2
              const rotate = isCrossed && i === 0 ? 90 : 0
              return (
                <motion.div
                  key={i}
                  layout
                  initial={{ opacity: 0, scale: 0.85, rotate }}
                  animate={{ opacity: 1, scale: 1, rotate }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  style={{ zIndex: i === 0 ? 2 : 1 }}
                  className="absolute"
                >
                  <div className="relative">
                    <CardBack variant={i === 0 ? 'blue' : 'red'} sizeClassName={PILE_CARD_SIZE} compactOnLandscape />
                    <span
                      className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-card-gold px-1 text-[9px] font-bold text-black shadow"
                      style={{ transform: rotate ? `rotate(-${rotate}deg)` : undefined }}
                    >
                      {morto.length}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      ) : (
        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[8px] text-gray-300">Ambos pegos</span>
      )}
    </div>
  )

  // Descarte como uma SEGUNDA FILEIRA acima da mão: as cartas do lixo em
  // leque horizontal, mostradas "pela metade" (só o topo, rank+naipe grandes
  // e legíveis) — espelhando a mão. A última carta (topo do lixo) fica
  // destacada e é a âncora #discard-top das animações. Buraco é aberto:
  // todo o lixo aparece (rola no eixo X se crescer muito).
  const discardPileBlock = (
    <div className="flex w-full flex-col items-center gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 sm:text-xs landscape:text-[8px] landscape:leading-none">
        Descarte
      </span>
      <div
        id="discard-pile"
        onClick={handleDiscardPileClick}
        className={`scrollbar-gold flex w-full max-w-full items-start justify-center overflow-x-auto overflow-y-hidden rounded-lg px-2 py-0.5 -space-x-7 sm:-space-x-8 landscape:-space-x-6 ${
          canClickDiscardToDraw || canClickDiscardToDiscard
            ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_16px_rgba(212,175,55,0.5)]'
            : ''
        } max-h-[3.5rem] landscape:max-h-[2.7rem]`}
      >
        {discardPile.length === 0 ? (
          <div
            id="discard-top"
            className="flex h-6 w-16 items-center justify-center rounded-lg border border-dashed border-white/20 text-[10px] text-gray-400 sm:w-20 landscape:w-12 landscape:text-[8px]"
          >
            Vazio
          </div>
        ) : (
          discardPile.map((card, i) => {
            const isTop = i === discardPile.length - 1
            return (
              <div
                key={i}
                id={isTop ? 'discard-top' : undefined}
                style={{ zIndex: i }}
                className={`flex-shrink-0 rounded-lg ${isTop ? 'ring-2 ring-card-gold/80' : 'opacity-90'}`}
              >
                <CardComponent
                  card={card}
                  sizeClassName={HAND_CARD_SIZE}
                  compactOnLandscape
                  cornerClassName={BIG_CORNER}
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <div className="relative h-full min-h-0 rounded-2xl border border-white/10 bg-black/25 p-2 shadow-lg backdrop-blur-sm sm:p-4 landscape:rounded-xl landscape:border-0 landscape:p-1 landscape:overflow-hidden">
      {/* Retrato: empilha (fallback decente). Paisagem ("estilo Jogatina"):
          grade com os JOGADORES nas colunas-borda (fora do feltro de jogo),
          o MONTE no canto sup-esquerdo, o DESCARTE embaixo (logo acima da
          mão) e os painéis "Nós"/"Eles" ocupando as duas colunas centrais —
          a MAIOR parte da mesa. Nada rola na vertical. */}
      <div className="flex flex-col gap-3 sm:gap-4 landscape:grid landscape:h-full landscape:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] landscape:grid-rows-[auto_minmax(0,1fr)_auto] landscape:items-stretch landscape:gap-x-1 landscape:gap-y-0.5">
        {/* Monte — canto superior-esquerdo (row1/col1), visível e clicável.
            (O morto fica escondido num canto discreto, ver overlay abaixo.) */}
        <div className="order-1 flex items-center justify-center landscape:col-start-1 landscape:row-start-1 landscape:justify-self-start">
          {deckPile}
        </div>

        {/* Parceiro (topo-centro), FORA dos painéis (row1/col2-3) */}
        <div className="order-2 flex justify-center landscape:col-start-2 landscape:col-span-2 landscape:row-start-1 landscape:justify-self-center landscape:self-center">
          <Seat
            name={players[2].name}
            cardCount={players[2].hand.getCards().length}
            isCurrentTurn={status === 'playing' && currentPlayerIndex === 2}
            teamId={teamIdOfSeat(2)}
          />
        </div>

        {/* Adversário 1 (Ana) — borda esquerda (row2/col1) */}
        <div className="order-3 flex justify-start landscape:col-start-1 landscape:row-start-2 landscape:self-center landscape:justify-self-center">
          <Seat
            name={players[1].name}
            cardCount={players[1].hand.getCards().length}
            isCurrentTurn={status === 'playing' && currentPlayerIndex === 1}
            teamId={teamIdOfSeat(1)}
          />
        </div>

        {/* Adversário 2 (Carlos) — borda direita (row2/col4) */}
        <div className="order-5 flex justify-end landscape:col-start-4 landscape:row-start-2 landscape:self-center landscape:justify-self-center">
          <Seat
            name={players[3].name}
            cardCount={players[3].hand.getCards().length}
            isCurrentTurn={status === 'playing' && currentPlayerIndex === 3}
            teamId={teamIdOfSeat(3)}
          />
        </div>

        {/* ---- Jogos baixados por dupla (Nós/Eles) — colunas centrais,
            ocupam a maior parte do feltro. Cada jogo é uma COLUNA VERTICAL
            de cartas sobrepostas (rank+naipe de cada uma visível no topo). O
            painel "Nós" (Time A) é a zona de baixar: com 3+ cartas
            selecionadas, clicar nele forma uma canastra nova; clicar num
            jogo já baixado estende aquele jogo. ---- */}
        {teams.map(team => {
          const canClickToExtend =
            team.id === 'A' && isHumanTurn && phase === 'play' && selectedCardIndices.length > 0
          const isDropTarget = team.id === 'A' && canClickDropZone

          return (
            <div
              key={team.id}
              id={team.id === 'A' ? 'meld-drop-zone' : undefined}
              onClick={team.id === 'A' ? handleDropZoneClick : undefined}
              className={`space-y-2 overflow-hidden rounded-xl border p-3 transition-all landscape:flex landscape:h-full landscape:min-h-0 landscape:flex-col landscape:space-y-0.5 landscape:p-1 ${
                TEAM_GRID_CLASS[team.id]
              } ${TEAM_PANEL_CLASS[team.id]} ${
                isDropTarget ? 'cursor-pointer border-card-gold shadow-[0_0_16px_rgba(212,175,55,0.5)]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 landscape:shrink-0">
                <h4 className={`font-display text-sm landscape:text-xs ${TEAM_TEXT_CLASS[team.id]}`}>
                  {TEAM_LABEL[team.id]}
                  {isDropTarget && (
                    <span className="ml-2 text-[10px] font-normal landscape:text-[9px]">⬇ baixar</span>
                  )}
                </h4>
                <span className="text-xs text-gray-200 landscape:text-[9px] landscape:leading-tight">
                  {team.score} pts · {team.melds.filter(m => m.isCanastra).length} can.
                  {team.hasTakenMorto ? ' · morto' : ''}
                </span>
              </div>
              {team.melds.length === 0 ? (
                <span className="text-sm text-gray-400 landscape:text-[10px]">
                  {isDropTarget ? 'Clique aqui para baixar as cartas selecionadas' : 'Nenhum jogo baixado ainda'}
                </span>
              ) : (
                <div className="scrollbar-gold flex flex-wrap items-start gap-3 landscape:min-h-0 landscape:flex-1 landscape:flex-nowrap landscape:items-start landscape:gap-2 landscape:overflow-x-auto landscape:overflow-y-auto landscape:pb-1">
                  <AnimatePresence>
                    {team.melds.map((canasta, ci) => {
                      const compatible =
                        canClickToExtend &&
                        canExtendMeld(
                          canasta.cards,
                          selectedCardIndices.map(i => players[0].hand.getCards()[i]).filter(Boolean)
                        )
                      return (
                        <motion.div
                          key={ci}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={event => handleMeldClick(event, team.id, ci, canasta.cards)}
                          className={`space-y-1 rounded-lg p-1 transition-shadow landscape:flex-shrink-0 ${
                            canClickToExtend
                              ? compatible
                                ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_14px_rgba(212,175,55,0.5)]'
                                : 'cursor-pointer opacity-70'
                              : ''
                          }`}
                        >
                          {/* Coluna vertical: cartas sobrepostas de cima pra
                              baixo, rank+naipe de todas visível no topo. Quanto
                              mais cartas, mais elas se JUNTAM (ver
                              meldStackSpacing). Quando a canastra FECHA (7+,
                              limpa ou suja), a carta de MAIOR valor (última do
                              layout) fica DEITADA (na horizontal) embaixo,
                              sinalizando canastra fechada, e a coluna ganha
                              anel dourado. */}
                          {(() => {
                            const slots = canasta.layout ?? canasta.cards.map(card => ({ card }))
                            const isClosed =
                              (canasta as { isCanastra?: boolean }).isCanastra ?? canasta.cards.length >= 7
                            const topIdx = slots.length - 1
                            const stackSlots = isClosed ? slots.slice(0, topIdx) : slots
                            const horizontalSlot = isClosed ? slots[topIdx] : null
                            return (
                              <div
                                className={`flex flex-col items-start rounded-lg ${
                                  isClosed ? 'ring-2 ring-card-gold/70' : ''
                                }`}
                              >
                                <div className={`flex flex-col items-start ${meldStackSpacing(slots.length)}`}>
                                  {stackSlots.map((slot, cii) => (
                                    <div key={cii} style={{ zIndex: cii }}>
                                      <CardComponent
                                        card={slot.card}
                                        sizeClassName={TABLE_CARD_SIZE}
                                        compactOnLandscape
                                      />
                                    </div>
                                  ))}
                                </div>
                                {horizontalSlot && (
                                  <div
                                    style={{ zIndex: 60 }}
                                    className="relative mt-0.5 flex h-16 w-24 items-center justify-center sm:h-20 sm:w-28 landscape:h-10 landscape:w-[3.6rem]"
                                  >
                                    <div className="rotate-90">
                                      <CardComponent
                                        card={horizontalSlot.card}
                                        sizeClassName={TABLE_CARD_SIZE}
                                        compactOnLandscape
                                      />
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })()}
                          <div
                            className={`text-center text-xs font-semibold landscape:text-[9px] landscape:leading-tight ${
                              canasta.kind === 'real'
                                ? 'text-card-gold'
                                : canasta.kind === 'quinhentos'
                                  ? 'text-yellow-200'
                                  : canasta.isClean
                                    ? 'text-green-300'
                                    : 'text-orange-300'
                            }`}
                          >
                            <span className="landscape:hidden">
                              {canasta.kind === 'real'
                                ? '👑 Canastra Real'
                                : canasta.kind === 'quinhentos'
                                  ? '⭐ Canastra de Quinhentos'
                                  : canasta.kind === 'limpa'
                                    ? 'Canastra Limpa'
                                    : canasta.kind === 'suja'
                                      ? 'Canastra Suja'
                                      : canasta.isClean
                                        ? 'Jogo limpo'
                                        : 'Jogo sujo'}
                              {canasta.type === 'aces' ? ' · Trinca de Áses' : ''} (+{canasta.points})
                            </span>
                            <span className="hidden landscape:inline">+{canasta.points}</span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )
        })}

        {/* Descarte — SEGUNDA FILEIRA logo acima da mão, largura toda
            (row3/col1-4), cartas em meia-carta */}
        <div className="order-6 flex w-full justify-center landscape:col-start-1 landscape:col-span-4 landscape:row-start-3 landscape:justify-self-stretch landscape:self-end">
          {discardPileBlock}
        </div>

        {/* Você — só em retrato (a própria mão faz esse papel em paisagem) */}
        <div className="order-7 flex justify-center landscape:hidden">
          <Seat
            name={players[0].name}
            cardCount={players[0].hand.getCards().length}
            isCurrentTurn={status === 'playing' && currentPlayerIndex === 0}
            teamId={teamIdOfSeat(0)}
            compact
          />
        </div>
      </div>

      {/* Morto — escondido num canto discreto (topo-direito), pequeno. */}
      <div className="pointer-events-none absolute right-1 top-6 z-20 origin-top-right scale-[0.62] landscape:scale-[0.5]">
        {mortoBlock}
      </div>

      {/* Selo de turno (sobreposto, canto sup-direito) */}
      <div className="pointer-events-none absolute right-2 top-2 z-30">
        <AnimatePresence>
          {status === 'playing' && !isHumanTurn && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-200 landscape:text-[9px]"
            >
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>
                🤖
              </motion.span>
              {players[currentPlayerIndex]?.name}
            </motion.span>
          )}
          {status === 'playing' && isHumanTurn && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 rounded-full bg-card-gold px-2 py-0.5 text-[10px] font-bold text-black landscape:text-[9px]"
            >
              Sua vez
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Dica/erro — sobreposta embaixo, não reserva altura */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 z-20 flex justify-center px-2">
        <AnimatePresence>
          {hint && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-auto rounded-lg bg-red-500/90 px-3 py-2 text-center text-xs text-red-50 shadow-lg landscape:px-2 landscape:py-1 landscape:text-[10px]"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
