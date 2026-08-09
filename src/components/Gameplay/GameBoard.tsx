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
// Where each team's panel lives in the grid: side-by-side under the table in
// portrait (the existing "fallback decente"), left/right sidebars flanking
// the table in landscape (so the whole table fits without scrolling).
const TEAM_GRID_CLASS: Record<TeamId, string> = {
  A: 'col-start-1 row-start-2 landscape:col-start-1 landscape:row-start-1',
  B: 'col-start-2 row-start-2 landscape:col-start-3 landscape:row-start-1',
}

/** Shared footprint for the deck/discard/melds cards on the table — same
 * size as the default hand card in portrait, shrunk considerably only in
 * landscape (via the `landscape:` variant) so the whole table fits the
 * screen height without scrolling. Opt-in (passed explicitly to
 * CardComponent/CardBack), so it never affects Online or the player's hand. */
const TABLE_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-10 landscape:h-14'

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
  const topDiscard = discardPile[discardPile.length - 1]
  // Buraco ABERTO: o lixo é totalmente visível — todas as cartas abaixo do
  // topo aparecem em leque (com scroll horizontal quando a pilha cresce).
  const fanDiscard = discardPile.slice(0, -1)
  const isHumanTurn = status === 'playing' && currentPlayerIndex === 0
  const currentTurnName = players[currentPlayerIndex]?.name

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

  return (
    <div className="relative h-full min-h-0 rounded-2xl border border-white/10 bg-black/25 p-2 shadow-lg backdrop-blur-sm sm:p-4 landscape:overflow-hidden">
      {/* Grid: empilhado (mesa em cima, "Nós"/"Eles" lado a lado embaixo) em
          retrato — layout original preservado como fallback. Em paisagem,
          3 colunas lado a lado: "Nós" | mesa central | "Eles", tudo numa
          única linha que ocupa a altura toda, sem rolagem. */}
      <div className="grid grid-cols-2 grid-rows-[auto_auto] gap-3 sm:gap-4 landscape:h-full landscape:grid-cols-[minmax(84px,110px)_minmax(0,1fr)_minmax(84px,110px)] landscape:grid-rows-1 landscape:items-stretch landscape:gap-1.5">
        {/* ---- Centro: morto, cabeçalho, 4 assentos, monte/descarte ---- */}
        <div className="relative col-span-2 row-start-1 flex flex-col gap-2 landscape:col-span-1 landscape:col-start-2 landscape:row-start-1 landscape:h-full landscape:min-h-0 landscape:justify-center landscape:gap-1">
          {/* Morto(s): canto superior-esquerdo da mesa central, pequenos,
              em cruz (✚) com o badge de contagem. */}
          <div className="absolute left-0 top-0 z-10 flex origin-top-left scale-[0.65] flex-col items-center gap-0.5 sm:scale-75 landscape:scale-[0.42]">
            <span className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">
              Morto{mortos.length !== 1 ? 's' : ''}
            </span>
            {mortos.length > 0 ? (
              <div className="relative flex h-16 w-16 items-center justify-center">
                <AnimatePresence>
                  {mortos.map((morto, i) => {
                    // i === 0 -> morto 1, laid horizontally on top; i === 1 ->
                    // morto 2, upright underneath. If only one morto remains
                    // (the other already taken) it just sits upright, centered.
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
                        className="absolute flex flex-col items-center gap-1"
                      >
                        <div className="relative">
                          <CardBack variant={i === 0 ? 'blue' : 'red'} />
                          <span
                            className="absolute -right-3 -top-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-card-gold px-1 text-[9px] font-bold text-black shadow"
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
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] text-gray-300">Ambos pegos</span>
            )}
          </div>

          <div className="flex items-center justify-between pl-14 sm:pl-16 landscape:pl-9">
            <h3 className="font-display text-lg text-card-gold landscape:text-xs">Mesa</h3>
            <AnimatePresence>
              {status === 'playing' && !isHumanTurn && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200 landscape:gap-1 landscape:px-1.5 landscape:py-0.5 landscape:text-[9px]"
                >
                  <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    🤖
                  </motion.span>
                  <span className="landscape:hidden">{currentTurnName} jogando…</span>
                </motion.span>
              )}
              {/* Em paisagem o assento "Você" some (ver acima) — este selo
                  ocupa o lugar dele como indicação de turno, sem gastar
                  altura extra. */}
              {status === 'playing' && isHumanTurn && (
                <motion.span
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="hidden items-center gap-1 rounded-full bg-card-gold px-1.5 py-0.5 text-[9px] font-bold text-black landscape:flex"
                >
                  Sua vez
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          {/* 4-seat grid: Parceiro (top), Adversário 1 (left) / Adversário 2 (right), center table, Você (bottom, compact) */}
          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] grid-rows-[auto_auto_auto] items-center gap-3 sm:gap-4 landscape:gap-0.5">
            <div />
            <div className="col-start-2 row-start-1 flex justify-center">
              <Seat
                name={players[2].name}
                cardCount={players[2].hand.getCards().length}
                isCurrentTurn={status === 'playing' && currentPlayerIndex === 2}
                teamId={teamIdOfSeat(2)}
              />
            </div>
            <div />

            <div className="col-start-1 row-start-2 flex justify-start">
              <Seat
                name={players[1].name}
                cardCount={players[1].hand.getCards().length}
                isCurrentTurn={status === 'playing' && currentPlayerIndex === 1}
                teamId={teamIdOfSeat(1)}
              />
            </div>

            <div className="col-start-2 row-start-2 flex flex-col items-center gap-4 px-2 py-2 landscape:gap-1 landscape:px-0.5 landscape:py-0.5">
              {/* Draw pile / discard pile */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 landscape:gap-2">
                <div className="flex flex-col items-center gap-1.5 landscape:gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 sm:text-xs landscape:text-[8px]">
                    Monte
                  </span>
                  {deck.length > 0 ? (
                    <motion.div
                      id="deck-pile"
                      onClick={handleDeckClick}
                      animate={canClickDeck ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                      transition={canClickDeck ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : undefined}
                      className={`relative rounded-lg ${
                        canClickDeck
                          ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_16px_rgba(212,175,55,0.6)]'
                          : ''
                      }`}
                    >
                      <div className="absolute left-1.5 top-1.5 -z-10 landscape:left-1 landscape:top-1">
                        <CardBack variant="red" sizeClassName={TABLE_CARD_SIZE} compactOnLandscape />
                      </div>
                      <CardBack variant="blue" sizeClassName={TABLE_CARD_SIZE} compactOnLandscape />
                      <span className="absolute -right-3 -top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-card-gold px-1.5 text-xs font-bold text-black shadow landscape:-right-2 landscape:-top-2 landscape:h-4 landscape:min-w-4 landscape:px-1 landscape:text-[9px]">
                        {deck.length}
                      </span>
                    </motion.div>
                  ) : (
                    <div
                      id="deck-pile"
                      onClick={handleDeckClick}
                      className={`flex h-24 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 text-[10px] text-gray-400 sm:h-28 sm:w-20 landscape:h-14 landscape:w-10 landscape:text-[8px] ${
                        canClickDeck ? 'cursor-pointer ring-2 ring-card-gold' : ''
                      }`}
                    >
                      Vazio
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-1.5 landscape:gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 sm:text-xs landscape:text-[8px]">
                    Descarte
                  </span>
                  <div
                    id="discard-pile"
                    onClick={handleDiscardPileClick}
                    className={`relative flex items-center rounded-lg ${
                      canClickDiscardToDraw || canClickDiscardToDiscard
                        ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_16px_rgba(212,175,55,0.6)]'
                        : ''
                    }`}
                  >
                    {fanDiscard.length > 0 && (
                      <div className="scrollbar-gold mr-[-2.4rem] flex max-w-[40vw] -space-x-8 overflow-x-auto py-1 opacity-70 sm:mr-[-2.8rem] sm:max-w-[24rem] landscape:mr-[-1.2rem] landscape:max-w-[28vw] landscape:-space-x-5">
                        {fanDiscard.map((card, i) => (
                          <div key={i} style={{ zIndex: i }} className="flex-shrink-0 scale-90 landscape:scale-100">
                            <CardComponent card={card} sizeClassName={TABLE_CARD_SIZE} compactOnLandscape />
                          </div>
                        ))}
                      </div>
                    )}
                    <AnimatePresence mode="wait">
                      {topDiscard ? (
                        <motion.div
                          key={discardPile.length}
                          id="discard-top"
                          initial={{ opacity: 0, y: -12, rotate: -6 }}
                          animate={{ opacity: 1, y: 0, rotate: 0 }}
                          className="relative z-10"
                        >
                          <CardComponent card={topDiscard} sizeClassName={TABLE_CARD_SIZE} compactOnLandscape />
                        </motion.div>
                      ) : (
                        <div
                          id="discard-top"
                          className="flex h-24 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 text-[10px] text-gray-400 sm:h-28 sm:w-20 landscape:h-14 landscape:w-10 landscape:text-[8px]"
                        >
                          Vazio
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-start-3 row-start-2 flex justify-end">
              <Seat
                name={players[3].name}
                cardCount={players[3].hand.getCards().length}
                isCurrentTurn={status === 'playing' && currentPlayerIndex === 3}
                teamId={teamIdOfSeat(3)}
              />
            </div>

            <div />
            {/* O assento "Você" some em paisagem — a própria mão (embaixo,
                em tamanho legível) já ocupa esse papel, e a dica de turno
                aparece no cabeçalho da mesa (ver abaixo) e na própria
                PlayerHand, então essa linha extra só custava altura. */}
            <div className="col-start-2 row-start-3 flex justify-center landscape:hidden">
              <Seat
                name={players[0].name}
                cardCount={players[0].hand.getCards().length}
                isCurrentTurn={status === 'playing' && currentPlayerIndex === 0}
                teamId={teamIdOfSeat(0)}
                compact
              />
            </div>
            <div />
          </div>

          {/* Dica/erro: sobreposta (não reserva altura própria), pra caber
              em telas de paisagem bem baixas sem empurrar o resto da mesa. */}
          <div className="pointer-events-none absolute inset-x-0 -bottom-2 z-20 flex justify-center px-2 landscape:bottom-0">
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

        {/* ---- Jogos baixados por dupla ----
            O painel do SEU time ("Nós", Time A) é a zona de baixar: com 3+
            cartas selecionadas, clicar na área do painel (fora de um jogo
            existente) forma uma canastra NOVA; clicar num jogo já baixado
            estende aquele jogo. Em retrato ficam lado a lado, sob a mesa
            (fallback original); em paisagem viram colunas laterais à mesa,
            com os jogos numa fileira horizontal (rola no eixo X se ficar
            muito cheia — nunca no eixo Y). */}
        {teams.map(team => {
          const canClickToExtend =
            team.id === 'A' && isHumanTurn && phase === 'play' && selectedCardIndices.length > 0
          // O painel "Nós" vira alvo de baixar quando há 3+ cartas selecionadas.
          const isDropTarget = team.id === 'A' && canClickDropZone

          return (
            <div
              key={team.id}
              id={team.id === 'A' ? 'meld-drop-zone' : undefined}
              onClick={team.id === 'A' ? handleDropZoneClick : undefined}
              className={`space-y-2 overflow-hidden rounded-xl border p-3 transition-all landscape:flex landscape:h-full landscape:min-h-0 landscape:flex-col landscape:space-y-1 landscape:p-1.5 ${
                TEAM_GRID_CLASS[team.id]
              } ${TEAM_PANEL_CLASS[team.id]} ${
                isDropTarget
                  ? 'cursor-pointer border-card-gold shadow-[0_0_16px_rgba(212,175,55,0.5)]'
                  : ''
              }`}
            >
              <div className="flex items-center justify-between landscape:flex-col landscape:items-center landscape:gap-0">
                <h4 className={`font-display text-sm landscape:text-[10px] ${TEAM_TEXT_CLASS[team.id]}`}>
                  {TEAM_LABEL[team.id]}
                  {isDropTarget && (
                    <span className="ml-2 text-[10px] font-normal landscape:ml-0 landscape:block landscape:text-[8px]">
                      ⬇ baixar
                    </span>
                  )}
                </h4>
                <span className="text-xs text-gray-200 landscape:text-center landscape:text-[8px] landscape:leading-tight">
                  {team.score} pts · {team.melds.length}c
                  {team.hasTakenMorto ? ' · morto' : ''}
                </span>
              </div>
              {team.melds.length === 0 ? (
                <span className="text-sm text-gray-400 landscape:text-[9px]">
                  {isDropTarget ? 'Clique aqui para baixar as cartas selecionadas' : 'Nenhum jogo baixado ainda'}
                </span>
              ) : (
                <div className="scrollbar-gold flex flex-wrap gap-3 landscape:min-h-0 landscape:flex-1 landscape:flex-nowrap landscape:overflow-x-auto landscape:overflow-y-hidden landscape:gap-1.5 landscape:pb-1">
                  <AnimatePresence>
                    {team.melds.map((canasta, ci) => {
                      const compatible = canClickToExtend && canExtendMeld(
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
                          {/* Usa canasta.layout (ordem canônica): o curinga
                              aparece na posição da carta que ele representa
                              e "desliza" quando a carta real chega. Numa
                              canastra FECHADA (7+ cartas) a carta de maior
                              valor (última do layout) fica DEITADA (girada
                              90°), como numa mesa de verdade, sinalizando que
                              o jogo virou canastra. */}
                          {(() => {
                            const slots = canasta.layout ?? canasta.cards.map(card => ({ card }))
                            const isClosed =
                              (canasta as { isCanastra?: boolean }).isCanastra ??
                              canasta.cards.length >= 7
                            const lastIdx = slots.length - 1
                            return (
                              <div className="flex items-center -space-x-9 sm:-space-x-10 landscape:-space-x-6">
                                {slots.map((slot, cii) => {
                                  const deitada = isClosed && cii === lastIdx
                                  return (
                                    <div
                                      key={cii}
                                      style={{ zIndex: cii }}
                                      className={deitada ? 'ml-6 rotate-90 sm:ml-7 landscape:ml-4' : ''}
                                    >
                                      <CardComponent
                                        card={slot.card}
                                        sizeClassName={TABLE_CARD_SIZE}
                                        compactOnLandscape
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            )
                          })()}
                          <div
                            className={`text-center text-xs font-semibold landscape:text-[8px] landscape:leading-tight ${
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
      </div>
    </div>
  )
}
