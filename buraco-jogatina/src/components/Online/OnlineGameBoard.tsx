import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useOnlineStore } from '../../online/onlineStore'
import { CardBack } from '../Card'
import { canExtendMeld, isValidCanasta } from '../../engine/utils'
import type { SeatView, PlainCard } from '../../session/types'
import { otherSeatsInOrder } from '../../online/seatLayout'
import { asCard, asCards } from '../../online/cardAdapter'
import Seat from '../Gameplay/Seat'
import MeldCardColumn from '../Gameplay/MeldCardColumn'
import MeldRow from '../Gameplay/MeldRow'

/** Footprint do MONTE — idêntico ao PILE_CARD_SIZE offline. */
const PILE_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-8 landscape:h-[2.9rem]'
/** Footprints dos fantasmas de animação — idênticos aos GHOST_*_SIZE de
 * Gameplay.tsx (offline). Repetidos aqui de propósito (não importados), pra
 * não acoplar este arquivo à estrutura interna de PlayerHand/MeldCardColumn
 * — só os valores literais precisam bater. */
const GHOST_HAND_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-14 landscape:h-[4.25rem]'
const GHOST_TABLE_SIZE = 'w-20 h-28 landscape:w-12 landscape:h-16'

/** Entre os índices de cartas selecionadas na mão, acha o elemento
 * `[data-hand-index]` MAIS À ESQUERDA na tela — ver a mesma função em
 * Gameplay.tsx (offline) para a explicação completa. */
function leftmostHandCardRect(cardIndices: number[]): DOMRect | undefined {
  const rects = cardIndices
    .map(i => document.querySelector(`[data-hand-index="${i}"]`)?.getBoundingClientRect())
    .filter((r): r is DOMRect => Boolean(r))
  if (rects.length === 0) {
    return document.getElementById('player-hand-anchor')?.getBoundingClientRect()
  }
  return rects.reduce((leftmost, r) => (r.left < leftmost.left ? r : leftmost))
}

interface OnlineGameBoardProps {
  view: SeatView
}

/** Online equivalent of GameBoard.tsx — MESMA mesa "estilo Jogatina"
 * (monte no canto, morto escondido, jogadores nas bordas, jogos em colunas
 * verticais dominando o centro, descarte em fileira acima da mão,
 * manipulação direta em vez de botões), mas alimentada pela SeatView
 * redigida que o servidor manda (sem acesso direto ao motor) e SEM assumir
 * que o jogador é sempre o Time A — "Nós"/"Eles" e a posição das colunas
 * são relativos ao próprio assento (myTeamId), não fixos.
 *
 * Diferença chave de validação: offline consulta o motor local
 * (wouldDiscardEmptyHandIllegally etc.) para recusar uma jogada ilegal
 * ANTES de mandar, com hint instantâneo. Online não tem o motor local — a
 * validação estrutural óbvia (isValidCanasta/canExtendMeld) ainda dá hint
 * instantâneo, mas a checagem de "esvaziaria a mão sem poder bater" só
 * existe no servidor (GameSession.ts, que roda o MESMO Game.wouldEmpty...
 * do motor) e chega via errorMsg do WebSocket - um pouco mais lenta, mas
 * correta e sempre a mesma regra dos dois lados.
 */
export default function OnlineGameBoard({ view }: OnlineGameBoardProps) {
  const selectedCardIndices = useOnlineStore(s => s.selectedCardIndices)
  const sendIntent = useOnlineStore(s => s.sendIntent)
  const [hint, setHint] = useState<string | null>(null)

  const { players, discardPile, deckCount, mortos, teams, currentSeat, status, phase, yourHand } = view
  const isMyTurn = status === 'playing' && currentSeat === view.seat
  const myTeamId = players[view.seat]?.teamId ?? 'A'
  const otherTeamId = myTeamId === 'A' ? 'B' : 'A'
  const TEAM_LABEL: Record<'A' | 'B', string> = { [myTeamId]: 'Nós', [otherTeamId]: 'Eles' } as Record<
    'A' | 'B',
    string
  >
  const TEAM_PANEL_CLASS: Record<'A' | 'B', string> = {
    [myTeamId]: 'border-card-gold/40 bg-card-gold/5',
    [otherTeamId]: 'border-fuchsia-400/30 bg-fuchsia-500/5',
  } as Record<'A' | 'B', string>
  const TEAM_TEXT_CLASS: Record<'A' | 'B', string> = {
    [myTeamId]: 'text-card-gold',
    [otherTeamId]: 'text-fuchsia-300',
  } as Record<'A' | 'B', string>
  // "Nós" sempre na coluna central esquerda (col-start-2), "Eles" na direita
  // (col-start-3) — igual offline, mas relativo ao próprio time.
  const TEAM_GRID_CLASS: Record<'A' | 'B', string> = {
    [myTeamId]: 'order-4 landscape:col-start-2 landscape:row-start-2',
    [otherTeamId]: 'order-4 landscape:col-start-3 landscape:row-start-2',
  } as Record<'A' | 'B', string>

  // [esquerda, topo(parceiro), direita] — sempre nessa ordem relativa ao
  // próprio assento (ver seatLayout.ts).
  const [leftSeat, partnerSeat, rightSeat] = otherSeatsInOrder(view.seat)

  const flashHint = (message: string) => {
    setHint(message)
    window.setTimeout(() => setHint(current => (current === message ? null : current)), 2600)
  }

  // ---- Manipulação direta: monte / descarte / mesa (sem botões) ----------

  const canClickDeck = isMyTurn && phase === 'draw'
  const canClickDropZone = isMyTurn && phase === 'play' && selectedCardIndices.length >= 3

  // Fantasma da COMPRA: ao contrário do offline (que muta o estado local e
  // síncrono, lendo a carta comprada na hora), aqui a carta só é conhecida
  // depois que o servidor responde com o novo `state`. `pendingDrawRef`
  // marca "acabei de pedir pra comprar"; o efeito abaixo, disparado quando
  // a mão CRESCE, consome a marca e anima com a última carta da mão nova —
  // sem confundir com o crescimento da mão por pegar o descarte ou o morto,
  // que já têm (ou não precisam de) fantasma próprio.
  const pendingDrawRef = useRef(false)
  const prevHandLenRef = useRef(yourHand.length)
  useEffect(() => {
    const prevLen = prevHandLenRef.current
    prevHandLenRef.current = yourHand.length
    if (!pendingDrawRef.current) return
    pendingDrawRef.current = false
    if (yourHand.length <= prevLen) return // intent recusada (chegou um error, não um novo state)

    const fromRect = document.getElementById('deck-pile')?.getBoundingClientRect()
    const toRect = document.getElementById('player-hand-anchor')?.getBoundingClientRect()
    const drawnCard = yourHand[yourHand.length - 1]
    if (fromRect && toRect && drawnCard) {
      useOnlineStore
        .getState()
        .playDrawAnim({ fromRect, toRect, card: asCard(drawnCard), sizeClassName: GHOST_HAND_SIZE })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só reage ao TAMANHO da mão, não à identidade do array (novo a cada state)
  }, [yourHand.length])

  const handleDeckClick = () => {
    if (!isMyTurn) return
    if (phase !== 'draw') {
      flashHint('Descarte uma carta antes de comprar de novo.')
      return
    }
    pendingDrawRef.current = true
    sendIntent({ type: 'draw' })
  }

  const handleDropZoneClick = () => {
    if (!isMyTurn || phase !== 'play') return
    if (selectedCardIndices.length < 3) {
      flashHint('Selecione 3 ou mais cartas para baixar uma canastra.')
      return
    }
    const selectedCards = selectedCardIndices.map(i => yourHand[i]).filter(Boolean)
    if (!isValidCanasta(asCards(selectedCards))) {
      flashHint('Essa seleção não forma um jogo válido (sequência do mesmo naipe ou trinca de Áses).')
      return
    }

    const fromRect = leftmostHandCardRect(selectedCardIndices)
    const toRect = document.getElementById('meld-drop-zone')?.getBoundingClientRect()
    if (fromRect && toRect) {
      useOnlineStore.getState().playTableAnim({
        fromRect,
        toRect,
        cards: asCards(selectedCards.slice(0, 4)),
        sizeClassName: GHOST_TABLE_SIZE,
      })
    }
    sendIntent({ type: 'playCanasta', cardIndices: selectedCardIndices })
  }

  const handleMeldClick = (event: MouseEvent, teamId: 'A' | 'B', meldIndex: number, meldCards: PlainCard[]) => {
    // Clicar num jogo existente é "estender"; não deve borbulhar para o
    // painel "Nós" (que baixaria um jogo novo).
    event.stopPropagation()
    if (teamId !== myTeamId) return
    if (!isMyTurn || phase !== 'play' || selectedCardIndices.length === 0) return

    const selectedCards = selectedCardIndices.map(i => yourHand[i]).filter(Boolean)
    if (!canExtendMeld(asCards(meldCards), asCards(selectedCards))) {
      flashHint('Essa seleção não estende esse jogo. Escolha cartas que continuem a sequência (ou mais Áses).')
      return
    }

    const fromRect = leftmostHandCardRect(selectedCardIndices)
    const toRect = event.currentTarget.getBoundingClientRect()
    if (fromRect) {
      useOnlineStore.getState().playTableAnim({
        fromRect,
        toRect,
        cards: asCards(selectedCards.slice(0, 4)),
        sizeClassName: GHOST_TABLE_SIZE,
      })
    }
    sendIntent({ type: 'extendMeld', meldIndex, cardIndices: selectedCardIndices })
  }

  // ---------------------------------------------------------------------

  const deckPile =
    deckCount > 0 ? (
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
          {deckCount}
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
                      {morto.count}
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

  // O DESCARTE não mora mais aqui: virou o componente OnlineDiscardRow,
  // embutido no painel da mão (lado a lado) — ver OnlineGameplay.tsx.

  return (
    <div className="relative h-full min-h-0 rounded-2xl border border-white/10 bg-black/25 p-2 shadow-lg backdrop-blur-sm sm:p-4 landscape:rounded-xl landscape:border-0 landscape:p-1 landscape:overflow-hidden">
      <div className="flex flex-col gap-3 sm:gap-4 landscape:grid landscape:h-full landscape:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] landscape:grid-rows-[auto_minmax(0,1fr)] landscape:items-stretch landscape:gap-x-1 landscape:gap-y-0.5">
        {/* Monte — canto superior-esquerdo */}
        <div className="order-1 flex items-center justify-center landscape:col-start-1 landscape:row-start-1 landscape:justify-self-start">
          {deckPile}
        </div>

        {/* Parceiro — topo-centro, FORA dos painéis */}
        {partnerSeat !== undefined && players[partnerSeat] && (
          <div
            data-seat-index={partnerSeat}
            className="order-2 flex justify-center landscape:col-start-2 landscape:col-span-2 landscape:row-start-1 landscape:justify-self-center landscape:self-center"
          >
            <Seat
              name={players[partnerSeat].name}
              cardCount={players[partnerSeat].handCount}
              isCurrentTurn={status === 'playing' && currentSeat === partnerSeat}
              teamId={players[partnerSeat].teamId}
            />
          </div>
        )}

        {/* Adversário à esquerda */}
        {leftSeat !== undefined && players[leftSeat] && (
          <div
            data-seat-index={leftSeat}
            className="order-3 flex justify-start landscape:col-start-1 landscape:row-start-2 landscape:self-center landscape:justify-self-center"
          >
            <Seat
              name={players[leftSeat].name}
              cardCount={players[leftSeat].handCount}
              isCurrentTurn={status === 'playing' && currentSeat === leftSeat}
              teamId={players[leftSeat].teamId}
            />
          </div>
        )}

        {/* Adversário à direita */}
        {rightSeat !== undefined && players[rightSeat] && (
          <div
            data-seat-index={rightSeat}
            className="order-5 flex justify-end landscape:col-start-4 landscape:row-start-2 landscape:self-center landscape:justify-self-center"
          >
            <Seat
              name={players[rightSeat].name}
              cardCount={players[rightSeat].handCount}
              isCurrentTurn={status === 'playing' && currentSeat === rightSeat}
              teamId={players[rightSeat].teamId}
            />
          </div>
        )}

        {/* ---- Jogos baixados por dupla — colunas centrais ---- */}
        {teams.map(team => {
          const canClickToExtend = team.id === myTeamId && isMyTurn && phase === 'play' && selectedCardIndices.length > 0
          const isDropTarget = team.id === myTeamId && canClickDropZone

          return (
            <div
              key={team.id}
              id={team.id === myTeamId ? 'meld-drop-zone' : undefined}
              onClick={team.id === myTeamId ? handleDropZoneClick : undefined}
              className={`space-y-2 overflow-hidden rounded-xl border p-3 transition-all landscape:flex landscape:h-full landscape:min-h-0 landscape:flex-col landscape:space-y-0.5 landscape:p-1 ${
                TEAM_GRID_CLASS[team.id]
              } ${TEAM_PANEL_CLASS[team.id]} ${
                isDropTarget ? 'cursor-pointer border-card-gold shadow-[0_0_16px_rgba(212,175,55,0.5)]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 landscape:shrink-0">
                <h4 className={`flex items-center font-display text-sm landscape:text-xs ${TEAM_TEXT_CLASS[team.id]}`}>
                  {TEAM_LABEL[team.id]}
                  {/* Botão sempre visível no cabeçalho - mesa cheia não deixa
                      área vazia clicável no painel (ver GameBoard offline). */}
                  {isDropTarget && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        handleDropZoneClick()
                      }}
                      className="ml-2 animate-pulse rounded-full bg-card-gold px-2.5 py-0.5 font-sans text-[11px] font-bold text-black shadow-[0_0_10px_rgba(212,175,55,0.6)] landscape:px-2 landscape:text-[10px]"
                    >
                      ⬇ Baixar jogo
                    </button>
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
                <MeldRow count={team.melds.length}>
                  <AnimatePresence>
                    {team.melds.map((canasta, ci) => {
                      const meldCards = canasta.layout.map(entry => entry.card)
                      const compatible =
                        canClickToExtend &&
                        canExtendMeld(
                          asCards(meldCards),
                          asCards(selectedCardIndices.map(i => yourHand[i]).filter(Boolean))
                        )
                      const isClosed = canasta.isCanastra
                      return (
                        <motion.div
                          key={ci}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={event => handleMeldClick(event, team.id, ci, meldCards)}
                          className={`shrink-0 space-y-1 rounded-lg p-1 transition-shadow landscape:space-y-0.5 landscape:p-0.5 ${
                            canClickToExtend
                              ? compatible
                                ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_14px_rgba(212,175,55,0.5)]'
                                : 'cursor-pointer opacity-70'
                              : ''
                          }`}
                        >
                          {/* Coluna estilo foto de referência (tiras fixas +
                              última carta inteira) — ver MeldCardColumn. */}
                          <MeldCardColumn cards={canasta.layout.map(e => asCard(e.card))} isClosed={isClosed} />
                          <div
                            className={`text-center text-xs font-semibold landscape:shrink-0 landscape:text-[9px] landscape:leading-tight ${
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

                  {/* Slot de DOCK fixo pra baixar jogo novo com a mesa cheia
                      — ver GameBoard offline. */}
                  {team.id === myTeamId && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        handleDropZoneClick()
                      }}
                      className={`flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-1 self-start rounded-lg border-2 border-dashed text-xs transition-colors landscape:h-20 landscape:w-12 landscape:text-[9px] ${
                        isDropTarget
                          ? 'border-card-gold bg-card-gold/10 text-card-gold shadow-[0_0_12px_rgba(212,175,55,0.45)]'
                          : 'border-white/20 text-gray-400'
                      }`}
                    >
                      <span className="text-lg leading-none landscape:text-sm">⬇</span>
                      <span>Baixar</span>
                    </button>
                  )}
                </MeldRow>
              )}
            </div>
          )
        })}

        {/* Você — só em retrato */}
        <div className="order-7 flex justify-center landscape:hidden">
          <Seat
            name={players[view.seat]?.name ?? 'Você'}
            cardCount={yourHand.length}
            isCurrentTurn={status === 'playing' && currentSeat === view.seat}
            teamId={myTeamId}
            compact
          />
        </div>
      </div>

      {/* Morto — escondido num canto discreto */}
      <div className="pointer-events-none absolute right-1 top-6 z-20 origin-top-right scale-[0.62] landscape:scale-[0.5]">
        {mortoBlock}
      </div>

      {/* Selo de turno */}
      <div className="pointer-events-none absolute right-2 top-2 z-30">
        <AnimatePresence>
          {status === 'playing' && !isMyTurn && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-200 landscape:text-[9px]"
            >
              <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.2, repeat: Infinity }}>
                ⏳
              </motion.span>
              {players[currentSeat]?.name}
            </motion.span>
          )}
          {status === 'playing' && isMyTurn && (
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

      {/* Dica/erro local */}
      <div className="pointer-events-none absolute inset-x-0 bottom-1 z-20 flex justify-center px-2">
        <AnimatePresence>
          {hint && (
            <motion.p
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none rounded-lg bg-red-500/90 px-3 py-2 text-center text-xs text-red-50 shadow-lg landscape:px-2 landscape:py-1 landscape:text-[10px]"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
