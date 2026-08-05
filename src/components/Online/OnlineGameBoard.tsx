import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnlineStore } from '../../online/onlineStore'
import { CardComponent, CardBack } from '../Card'
import { canExtendMeld } from '../../engine/utils'
import type { SeatView, SeatTeamView } from '../../session/types'
import { relativePosition, otherSeatsInOrder } from '../../online/seatLayout'
import { asCard, asCards } from '../../online/cardAdapter'
import Seat from '../Gameplay/Seat'

const TEAM_LABEL: Record<'A' | 'B', string> = { A: 'Nós', B: 'Eles' }
const TEAM_PANEL_CLASS: Record<'A' | 'B', string> = {
  A: 'border-card-gold/40 bg-card-gold/5',
  B: 'border-fuchsia-400/30 bg-fuchsia-500/5',
}
const TEAM_TEXT_CLASS: Record<'A' | 'B', string> = {
  A: 'text-card-gold',
  B: 'text-fuchsia-300',
}

interface OnlineGameBoardProps {
  view: SeatView
}

/** Online equivalent of GameBoard.tsx: renders entirely from the redacted
 * `SeatView` sent by the server (no direct engine/store access) and always
 * places the viewer's own seat at the bottom, rotating the other 3 seats
 * around it (see seatLayout.ts). */
export default function OnlineGameBoard({ view }: OnlineGameBoardProps) {
  const selectedCardIndices = useOnlineStore((s) => s.selectedCardIndices)
  const sendIntent = useOnlineStore((s) => s.sendIntent)
  const [hint, setHint] = useState<string | null>(null)

  const { players, discardPile, deckCount, mortos, teams, currentSeat, status, phase, yourHand } = view
  const topDiscard = discardPile[discardPile.length - 1]
  const fanDiscard = discardPile.slice(0, -1)
  const isYourTurn = status === 'playing' && currentSeat === view.seat
  const currentTurnName = players[currentSeat]?.name

  const myTeamId = players[view.seat]?.teamId

  const handleMeldClick = (teamId: 'A' | 'B', meldIndex: number, meldCards: SeatView['discardPile']) => {
    if (teamId !== myTeamId) return
    if (!isYourTurn || phase !== 'play' || selectedCardIndices.length === 0) return

    const selectedCards = selectedCardIndices.map((i) => yourHand[i]).filter(Boolean)

    if (!canExtendMeld(asCards(meldCards), asCards(selectedCards))) {
      setHint('Essa seleção não estende esse jogo. Escolha cartas que continuem a sequência (ou mais Áses).')
      window.setTimeout(() => setHint(null), 2600)
      return
    }

    sendIntent({ type: 'extendMeld', meldIndex, cardIndices: selectedCardIndices })
  }

  const seatAt = (position: 'left' | 'top' | 'right') => {
    const seat = otherSeatsInOrder(view.seat).find((s) => relativePosition(s, view.seat) === position)
    if (seat === undefined) return null
    const player = players[seat]
    if (!player) return null
    return (
      <Seat
        name={player.name}
        cardCount={player.handCount}
        isCurrentTurn={status === 'playing' && currentSeat === seat}
        teamId={player.teamId}
      />
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/25 p-4 shadow-lg backdrop-blur-sm sm:p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-card-gold">Mesa</h3>
        <AnimatePresence>
          {!isYourTurn && status === 'playing' && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs text-gray-200"
            >
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>
                ⏳
              </motion.span>
              Vez de {currentTurnName}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] grid-rows-[auto_auto_auto] items-center gap-3 sm:gap-4">
        <div />
        <div className="col-start-2 row-start-1 flex justify-center">{seatAt('top')}</div>
        <div />

        <div className="col-start-1 row-start-2 flex justify-start">{seatAt('left')}</div>

        <div className="col-start-2 row-start-2 flex flex-col items-center gap-4 px-2 py-2">
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            <div className="flex flex-col items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 sm:text-xs">
                Monte
              </span>
              {deckCount > 0 ? (
                <div id="deck-pile" className="relative">
                  <div className="absolute left-1.5 top-1.5 -z-10">
                    <CardBack variant="red" />
                  </div>
                  <CardBack variant="blue" />
                  <span className="absolute -right-3 -top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-card-gold px-1.5 text-xs font-bold text-black shadow">
                    {deckCount}
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
                        <CardComponent card={asCard(card)} />
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
                      <CardComponent card={asCard(topDiscard)} />
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

          <div className="flex flex-col items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-300 sm:text-xs">
              Morto{mortos.length !== 1 ? 's' : ''}
            </span>
            {mortos.length > 0 ? (
              <div className="relative flex h-20 w-20 items-center justify-center sm:h-24 sm:w-24">
                <AnimatePresence>
                  {mortos.map((morto, i) => {
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
                            {morto.count}
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
                  Morto {i + 1}: {morto.count} cartas
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="col-start-3 row-start-2 flex justify-end">{seatAt('right')}</div>

        <div />
        <div className="col-start-2 row-start-3 flex justify-center">
          <Seat
            name={players[view.seat]?.name ?? 'Você'}
            cardCount={yourHand.length}
            isCurrentTurn={status === 'playing' && currentSeat === view.seat}
            teamId={myTeamId ?? 'A'}
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {teams.map((team: SeatTeamView) => {
          const canClickToExtend =
            team.id === myTeamId && isYourTurn && phase === 'play' && selectedCardIndices.length > 0

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
                      const meldCards = canasta.layout.map((entry) => entry.card)
                      const compatible =
                        canClickToExtend &&
                        canExtendMeld(
                          asCards(meldCards),
                          asCards(selectedCardIndices.map((i) => yourHand[i]).filter(Boolean))
                        )
                      const isClosed = canasta.isCanastra
                      const lastIdx = canasta.layout.length - 1
                      return (
                        <motion.div
                          key={ci}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => handleMeldClick(team.id, ci, meldCards)}
                          className={`space-y-1 rounded-lg p-1 transition-shadow ${
                            canClickToExtend
                              ? compatible
                                ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_14px_rgba(212,175,55,0.5)]'
                                : 'cursor-pointer opacity-70'
                              : ''
                          }`}
                        >
                          <div className="flex items-center -space-x-9 sm:-space-x-10">
                            {canasta.layout.map((slot, cii) => {
                              const deitada = isClosed && cii === lastIdx
                              return (
                                <div
                                  key={cii}
                                  style={{ zIndex: cii }}
                                  className={deitada ? 'ml-6 rotate-90 sm:ml-7' : ''}
                                >
                                  <CardComponent card={asCard(slot.card)} />
                                </div>
                              )
                            })}
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
