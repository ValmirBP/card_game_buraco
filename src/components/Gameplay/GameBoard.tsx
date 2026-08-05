import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { CardComponent, CardBack } from '../Card'
import { teamIdOfSeat, type TeamId } from '../../engine/gameState'
import { canExtendMeld } from '../../engine/utils'
import Seat from './Seat'
import type { TurnPhase } from './Gameplay'

interface GameBoardProps {
  phase: TurnPhase
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

/** The 4-seat table: opponents/partner around a center that shows the draw
 * pile, discard pile (with a small fan of the last few cards), the two
 * mortos (crossed face-down cards until taken), and the two teams' melds. */
export default function GameBoard({ phase }: GameBoardProps) {
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

  const handleMeldClick = (teamId: TeamId, meldIndex: number, meldCards: import('../../engine/card').Card[]) => {
    if (teamId !== 'A') return // only the human (seat 0) acts; only Team A melds are extendable by them
    if (!isHumanTurn || phase !== 'play' || selectedCardIndices.length === 0) return

    const handCards = players[0].hand.getCards()
    const selectedCards = selectedCardIndices.map(i => handCards[i]).filter(Boolean)

    if (!canExtendMeld(meldCards, selectedCards)) {
      setHint('Essa seleção não estende esse jogo. Escolha cartas que continuem a sequência (ou mais Áses).')
      window.setTimeout(() => setHint(null), 2600)
      return
    }

    useGameStore.getState().extendMeld(meldIndex, selectedCardIndices)
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-card-gold">Mesa</h3>
        <AnimatePresence>
          {!isHumanTurn && status === 'playing' && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200"
            >
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>
                🤖
              </motion.span>
              {currentTurnName} jogando…
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* 4-seat grid: Parceiro (top), Adversário 1 (left) / Adversário 2 (right), center table, Você (bottom, compact) */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] grid-rows-[auto_auto_auto] items-center gap-3 sm:gap-4">
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

        <div className="col-start-2 row-start-2 flex flex-col items-center gap-4 px-2 py-2">
          {/* Draw pile / discard pile */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 sm:text-xs">
                Monte
              </span>
              {deck.length > 0 ? (
                <div id="deck-pile" className="relative">
                  <div className="absolute left-1.5 top-1.5 -z-10">
                    <CardBack variant="red" />
                  </div>
                  <CardBack variant="blue" />
                  <span className="absolute -right-3 -top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-card-gold px-1.5 text-xs font-bold text-black shadow">
                    {deck.length}
                  </span>
                </div>
              ) : (
                <div className="flex h-24 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 text-[10px] text-gray-400 sm:h-28 sm:w-20">
                  Vazio
                </div>
              )}
            </div>

            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 sm:text-xs">
                Descarte
              </span>
              <div className="relative flex items-center">
                {fanDiscard.length > 0 && (
                  <div className="scrollbar-gold mr-[-2.4rem] flex max-w-[40vw] -space-x-8 overflow-x-auto py-1 opacity-70 sm:mr-[-2.8rem] sm:max-w-[24rem]">
                    {fanDiscard.map((card, i) => (
                      <div key={i} style={{ zIndex: i }} className="flex-shrink-0 scale-90">
                        <CardComponent card={card} />
                      </div>
                    ))}
                  </div>
                )}
                <AnimatePresence mode="wait">
                  {topDiscard ? (
                    <motion.div
                      key={discardPile.length}
                      initial={{ opacity: 0, y: -12, rotate: -6 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      className="relative z-10"
                    >
                      <CardComponent card={topDiscard} />
                    </motion.div>
                  ) : (
                    <div className="flex h-24 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 text-[10px] text-gray-400 sm:h-28 sm:w-20">
                      Vazio
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Mortos: the two mortos overlap in a cross (✚) — morto 1 laid
              horizontally (rotated 90°) on top of morto 2 standing upright,
              crossed at the center — each with its own "N cartas" badge. Once
              a team picks one up it's removed from `mortos` and the cross
              resolves back to a single upright card (or "ambos pegos"). */}
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 sm:text-xs">
              Morto{mortos.length !== 1 ? 's' : ''}
            </span>
            {mortos.length > 0 ? (
              <div className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
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
                        <div className="relative scale-75 sm:scale-90">
                          <CardBack variant={i === 0 ? 'blue' : 'red'} />
                          <span
                            className="absolute -right-3 -top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-card-gold px-1.5 text-[10px] font-bold text-black shadow"
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
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-gray-300">
                Ambos os mortos já foram pegos
              </span>
            )}
            <div className="flex gap-3 text-[10px] text-gray-400">
              {mortos.map((morto, i) => (
                <span key={i}>
                  Morto {i + 1}: {morto.length} cartas
                </span>
              ))}
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
        <div className="col-start-2 row-start-3 flex justify-center">
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

      <AnimatePresence>
        {hint && (
          <motion.p
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-lg bg-red-500/15 px-3 py-2 text-center text-xs text-red-200"
          >
            {hint}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Jogos baixados por dupla */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {teams.map(team => {
          const canClickToExtend =
            team.id === 'A' && isHumanTurn && phase === 'play' && selectedCardIndices.length > 0

          return (
            <div key={team.id} className={`space-y-2 rounded-xl border p-3 ${TEAM_PANEL_CLASS[team.id]}`}>
              <div className="flex items-center justify-between">
                <h4 className={`font-display text-sm ${TEAM_TEXT_CLASS[team.id]}`}>{TEAM_LABEL[team.id]}</h4>
                <span className="text-xs text-gray-200">
                  {team.score} pts · {team.melds.length} canastra{team.melds.length === 1 ? '' : 's'}
                  {team.hasTakenMorto ? ' · morto pego' : ''}
                </span>
              </div>
              {team.melds.length === 0 ? (
                <span className="text-sm text-gray-400">Nenhum jogo baixado ainda</span>
              ) : (
                <div className="flex flex-wrap gap-3">
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
                          onClick={() => handleMeldClick(team.id, ci, canasta.cards)}
                          className={`space-y-1 rounded-lg p-1 transition-shadow ${
                            canClickToExtend
                              ? compatible
                                ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_14px_rgba(212,175,55,0.5)]'
                                : 'cursor-pointer opacity-70'
                              : ''
                          }`}
                        >
                          {/* Usa canasta.layout (ordem canônica): o curinga
                              aparece na posição da carta que ele representa
                              e "desliza" quando a carta real chega. */}
                          <div className="flex -space-x-9 sm:-space-x-10">
                            {(canasta.layout ?? canasta.cards.map(card => ({ card }))).map(
                              (slot, cii) => (
                                <div key={cii} style={{ zIndex: cii }}>
                                  <CardComponent card={slot.card} />
                                </div>
                              )
                            )}
                          </div>
                          <div
                            className={`text-center text-xs font-semibold ${
                              canasta.kind === 'real'
                                ? 'text-card-gold'
                                : canasta.kind === 'quinhentos'
                                  ? 'text-yellow-200'
                                  : canasta.isClean
                                    ? 'text-green-300'
                                    : 'text-orange-300'
                            }`}
                          >
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
