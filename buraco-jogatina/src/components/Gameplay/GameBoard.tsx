import { useState, type MouseEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import { CardComponent, CardBack } from '../Card'
import { teamIdOfSeat, type TeamId } from '../../engine/gameState'
import { canExtendMeld, isValidCanasta } from '../../engine/utils'
import Seat from './Seat'
import MeldCardColumn from './MeldCardColumn'
import MeldRow from './MeldRow'
import type { TurnPhase } from './Gameplay'

interface GameBoardProps {
  phase: TurnPhase
  onDraw: () => void
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
  A: 'order-4 landscape:col-start-2 landscape:row-start-1',
  B: 'order-4 landscape:col-start-3 landscape:row-start-1',
}

/** Footprint do MONTE — grande em retrato (legibilidade), mas compacto em
 * paisagem: o monte é só um botão de comprar, não precisa do mesmo tamanho
 * das cartas da mão — pedido do usuário pra sobrar mais espaço horizontal
 * pros quadros de baixar carta. */
const PILE_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-12 landscape:h-16'
/** Footprint do MORTO — menor que o monte de propósito (pedido do usuário:
 * "o morto pode ficar menor"). Ele é só um indicador discreto no canto
 * (ver o overlay com scale abaixo), não precisa do mesmo destaque do
 * monte, que é clicável e onde a ação de fato acontece. */
const MORTO_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-10 landscape:h-14'
/** Footprint das cartas do DESCARTE — MESMO tamanho das cartas da mão, pra a
 * fileira do descarte ficar paralela à mão e visualmente consistente. Deve
 * acompanhar HAND_CARD_SIZE em PlayerHand.tsx. */
const HAND_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-14 landscape:h-[4.25rem]'
/** Naipes/rank do canto grandes e legíveis (usado na mão e no descarte). */
const BIG_CORNER = 'text-sm font-normal sm:text-base landscape:text-lg landscape:leading-none'

/** The 4-seat table: opponents/partner around a center that shows the draw
 * pile, discard pile (with a small fan of the last few cards), the two
 * mortos (crossed face-down cards until taken), and the two teams' melds. */
export default function GameBoard({ phase, onDraw, onPlayCanastaSelected, onExtendMeld }: GameBoardProps) {
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
  const canClickDropZone = isHumanTurn && phase === 'play' && selectedCardIndices.length >= 3

  const handleDeckClick = () => {
    if (!isHumanTurn) return
    if (phase !== 'draw') {
      flashHint('Descarte uma carta antes de comprar de novo.')
      return
    }
    onDraw()
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
        data-deck-pile="true"
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
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-card-gold px-1 text-[10px] font-bold text-black shadow landscape:-right-2 landscape:-top-2 landscape:h-6 landscape:min-w-6 landscape:text-xs">
          {deck.length}
        </span>
      </motion.div>
    ) : (
      <div
        data-deck-pile="true"
        onClick={handleDeckClick}
        className={`flex h-24 w-16 items-center justify-center rounded-xl border border-dashed border-white/20 text-[10px] text-gray-400 sm:h-28 sm:w-20 landscape:h-16 landscape:w-12 landscape:text-xs ${
          canClickDeck ? 'cursor-pointer ring-2 ring-card-gold' : ''
        }`}
      >
        Vazio
      </div>
    )

  const mortoBlock = (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[8px] font-semibold uppercase tracking-wide text-gray-400 landscape:text-[8px]">
        Morto{mortos.length !== 1 ? 's' : ''}
      </span>
      {mortos.length > 0 ? (
        <div className="relative flex h-12 w-12 items-center justify-center landscape:h-12 landscape:w-12">
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
                    <CardBack variant={i === 0 ? 'blue' : 'red'} sizeClassName={MORTO_CARD_SIZE} compactOnLandscape />
                    <span
                      className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-card-gold px-1 text-[9px] font-bold text-black shadow landscape:h-3.5 landscape:min-w-3.5 landscape:text-[8px]"
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

  // O DESCARTE não mora mais aqui: virou o componente DiscardRow, embutido
  // no painel da mão (lado a lado) — ver Gameplay.tsx.

  return (
    <div className="relative h-full min-h-0 rounded-2xl border border-white/10 bg-black/25 p-2 shadow-lg backdrop-blur-sm sm:p-4 landscape:rounded-xl landscape:border-0 landscape:p-2 landscape:overflow-hidden">
      {/* Retrato: empilha (fallback decente). Paisagem ("estilo Jogatina"):
          grade com os JOGADORES nas colunas-borda (fora do feltro de jogo),
          o MONTE no canto sup-esquerdo, o DESCARTE embaixo (logo acima da
          mão) e os painéis "Nós"/"Eles" ocupando as duas colunas centrais —
          a MAIOR parte da mesa. Pedido do usuário: cartas/textos maiores,
          mas SEM rolar a mesa/tela inteira — a grade volta a encolher pra
          caber (minmax(0,1fr), como antes) e nada aqui rola. A rolagem fica
          só DENTRO do "quadro de baixar carta" de cada dupla, quando os
          jogos baixados não cabem no espaço que sobrou (ver MeldRow.tsx:
          overflow-x-auto E overflow-y-auto ali dentro). */}
      <div className="flex flex-col gap-3 sm:gap-4 landscape:grid landscape:h-full landscape:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto] landscape:grid-rows-1 landscape:items-stretch landscape:gap-x-2 landscape:gap-y-1">
        {/* Monte — em retrato ocupa seu próprio lugar no topo, como sempre.
            Em paisagem vira um selo flutuante SOBRE o quadro "Nós" (ver bloco
            landscape:col-start-2 logo abaixo, dentro da MESMA célula da
            grade que o painel) — pedido do usuário: sem linha própria
            reservada no topo, o quadro de baixar carta cresce até o topo da
            tela. */}
        <div className="order-1 flex items-center justify-center landscape:hidden">
          {deckPile}
        </div>

        {/* Parceiro: em paisagem mora no placar (Scoreboard.tsx), entre os
            dois placares - pedido do usuário, libera essa linha inteira do
            tabuleiro pro quadro de baixar carta. Em retrato continua aqui,
            como sempre. */}
        <div data-seat-index={2} className="order-2 flex justify-center landscape:hidden">
          <Seat
            name={players[2].name}
            cardCount={players[2].hand.getCards().length}
            isCurrentTurn={status === 'playing' && currentPlayerIndex === 2}
            teamId={teamIdOfSeat(2)}
          />
        </div>

        {/* Adversário 1 (Ana) — borda esquerda, ocupa a única linha da grade
            (row1/col1), centralizado verticalmente nela. */}
        <div data-seat-index={1} className="order-3 flex justify-start landscape:col-start-1 landscape:row-start-1 landscape:self-center landscape:justify-self-center">
          <Seat
            name={players[1].name}
            cardCount={players[1].hand.getCards().length}
            isCurrentTurn={status === 'playing' && currentPlayerIndex === 1}
            teamId={teamIdOfSeat(1)}
          />
        </div>

        {/* Adversário 2 (Carlos) — borda direita (row1/col4) */}
        <div data-seat-index={3} className="order-5 flex justify-end landscape:col-start-4 landscape:row-start-1 landscape:self-center landscape:justify-self-center">
          <Seat
            name={players[3].name}
            cardCount={players[3].hand.getCards().length}
            isCurrentTurn={status === 'playing' && currentPlayerIndex === 3}
            teamId={teamIdOfSeat(3)}
          />
        </div>

        {/* Monte, versão paisagem: fica no canto sup-esquerdo, mesma coluna
            de Ana (col1/row1) — como ela agora fica centralizada na altura
            toda da linha, sobra espaço vazio acima dela, onde o monte
            flutua sem empurrar nenhum painel nem cobrir o rótulo/placar
            "Nós"/"Eles" (pedido do usuário: "deixa o monte no canto mesmo").
            Só um dos dois `data-deck-pile` (este ou o de retrato acima) tem
            tamanho de verdade a cada vez — mesmo cuidado do
            parceiro/Scoreboard: ver o querySelectorAll + filtro de
            visibilidade em Gameplay.tsx. */}
        <div className="hidden landscape:block landscape:col-start-1 landscape:row-start-1 landscape:z-20 landscape:self-start landscape:justify-self-center landscape:ml-[env(safe-area-inset-left)]">
          {deckPile}
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
              className={`space-y-2 overflow-hidden rounded-xl border p-3 transition-all landscape:flex landscape:h-full landscape:min-h-0 landscape:flex-col landscape:space-y-2 landscape:p-3 ${
                TEAM_GRID_CLASS[team.id]
              } ${TEAM_PANEL_CLASS[team.id]} ${
                isDropTarget ? 'cursor-pointer border-card-gold shadow-[0_0_16px_rgba(212,175,55,0.5)]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2 landscape:shrink-0">
                <h4 className={`flex items-center font-display text-sm landscape:text-base ${TEAM_TEXT_CLASS[team.id]}`}>
                  {TEAM_LABEL[team.id]}
                  {/* Botão SEMPRE visível no cabeçalho (que nunca é coberto
                      pelas colunas de cartas): com a mesa cheia, o fundo do
                      painel some atrás dos jogos e não sobra área vazia pra
                      clicar - o botão garante que "baixar" nunca fica
                      inalcançável (pedido do usuário). stopPropagation pra
                      não disparar o clique do painel de novo. */}
                  {isDropTarget && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        handleDropZoneClick()
                      }}
                      className="ml-2 animate-pulse rounded-full bg-card-gold px-2.5 py-0.5 font-sans text-[11px] font-bold text-black shadow-[0_0_10px_rgba(212,175,55,0.6)] landscape:px-3 landscape:py-1 landscape:text-sm"
                    >
                      ⬇ Baixar jogo
                    </button>
                  )}
                </h4>
                <span className="text-xs text-gray-200 landscape:text-sm landscape:leading-tight">
                  {team.score} pts · {team.melds.filter(m => m.isCanastra).length} can.
                  {team.hasTakenMorto ? ' · morto' : ''}
                </span>
              </div>
              {team.melds.length === 0 ? (
                <span className="text-sm text-gray-400 landscape:text-sm">
                  {isDropTarget ? 'Clique aqui para baixar as cartas selecionadas' : 'Nenhum jogo baixado ainda'}
                </span>
              ) : (
                <MeldRow count={team.melds.length}>
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
                          className={`shrink-0 space-y-1 rounded-lg p-1 transition-shadow landscape:space-y-1.5 landscape:p-1.5 ${
                            canClickToExtend
                              ? compatible
                                ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_14px_rgba(212,175,55,0.5)]'
                                : 'cursor-pointer opacity-70'
                              : ''
                          }`}
                        >
                          {/* Coluna estilo foto de referência: cada carta é
                              uma TIRA fixa (rank+naipe, sempre legível) e a
                              última aparece INTEIRA — ver MeldCardColumn. */}
                          {(() => {
                            const slots = canasta.layout ?? canasta.cards.map(card => ({ card }))
                            const isClosed =
                              (canasta as { isCanastra?: boolean }).isCanastra ?? canasta.cards.length >= 7
                            return <MeldCardColumn cards={slots.map(s => s.card)} isClosed={isClosed} />
                          })()}
                          <div
                            className={`text-center text-xs font-semibold landscape:shrink-0 landscape:text-sm landscape:leading-tight ${
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

                  {/* Slot de DOCK: espaço fixo tracejado no fim da fileira
                      pra baixar um jogo NOVO — sempre presente no painel do
                      time do jogador, mesmo com a mesa cheia (pedido do
                      usuário). Acende dourado quando há 3+ cartas
                      selecionadas. stopPropagation pra não disparar o clique
                      do painel em dobro. */}
                  {team.id === 'A' && (
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation()
                        handleDropZoneClick()
                      }}
                      className={`flex h-24 w-20 shrink-0 flex-col items-center justify-center gap-1 self-start rounded-lg border-2 border-dashed text-xs transition-colors landscape:h-28 landscape:w-20 landscape:text-sm ${
                        isDropTarget
                          ? 'border-card-gold bg-card-gold/10 text-card-gold shadow-[0_0_12px_rgba(212,175,55,0.45)]'
                          : 'border-white/20 text-gray-400'
                      }`}
                    >
                      <span className="text-lg leading-none landscape:text-xl">⬇</span>
                      <span>Baixar</span>
                    </button>
                  )}
                </MeldRow>
              )}
            </div>
          )
        })}

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

      {/* Morto — escondido num canto discreto (topo-direito), pequeno.
          landscape:mr-[env(...)]: única proteção contra o recorte de câmera
          que sobrou aqui (ver comentário em Layout.tsx) — se o recorte cair
          do lado direito nessa rotação, empurra só este badge, não o
          tabuleiro inteiro. */}
      <div className="pointer-events-none absolute right-1 top-6 z-20 origin-top-right scale-[0.62] landscape:scale-[0.6] landscape:mr-[env(safe-area-inset-right)]">
        {mortoBlock}
      </div>

      {/* Selo de turno (sobreposto, canto sup-direito) */}
      <div className="pointer-events-none absolute right-2 top-2 z-30 landscape:mr-[env(safe-area-inset-right)]">
        <AnimatePresence>
          {status === 'playing' && !isHumanTurn && (
            <motion.span
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-gray-200 landscape:px-3 landscape:py-1 landscape:text-sm"
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
              className="flex items-center gap-1 rounded-full bg-card-gold px-2 py-0.5 text-[10px] font-bold text-black landscape:px-3 landscape:py-1 landscape:text-sm"
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
              className="pointer-events-none rounded-lg bg-red-500/90 px-3 py-2 text-center text-xs text-red-50 shadow-lg landscape:px-3 landscape:py-1.5 landscape:text-sm"
            >
              {hint}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
