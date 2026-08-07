import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import GameBoard from './GameBoard'
import PlayerHand from './PlayerHand'
import Scoreboard from './Scoreboard'
import DrawAnimation, { type DrawAnimState } from './DrawAnimation'
import CardFlyAnimation, { type FlyAnimState } from './CardFlyAnimation'
import { canTakeDiscardPile } from './discardRules'

export type TurnPhase = 'draw' | 'play'

interface GameplayProps {
  onGameEnd: () => void
}

const AI_THINK_DELAY_MS = 800
// Deve acompanhar DURATION_S do CardFlyAnimation (~0.5s) + pequena folga.
const FLY_ANIM_MS = 650

export default function Gameplay({ onGameEnd }: GameplayProps) {
  // `version` MUST be selected alongside `game`: `game` is a mutable engine
  // instance whose object reference never changes across actions, so
  // Zustand/React would otherwise never re-render this component (or any
  // child that reads game state) when the store mutates it. See the
  // "REACTIVITY CONTRACT" comment on GameStore.game in ../../store/gameStore.ts.
  const version = useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const gameLog = useGameStore(s => s.gameLog)

  // Turn-phase control lives here (local UI state), not in the store: the
  // engine/store don't enforce a "draw then play" phase within a human
  // turn, so Gameplay is the source of truth for it.
  const [phase, setPhase] = useState<TurnPhase>('draw')

  // Ghost-card overlays for movement animations. All local UI-only state —
  // never touch game state, purely decorative. `drawAnim` is the existing
  // monte -> hand flip animation; the other three are the generic
  // CardFlyAnimation used for discard, pick-up-discard and baixar/estender.
  const [drawAnim, setDrawAnim] = useState<DrawAnimState | null>(null)
  const [pickupAnim, setPickupAnim] = useState<FlyAnimState | null>(null)
  const [discardAnim, setDiscardAnim] = useState<FlyAnimState | null>(null)
  const [tableAnim, setTableAnim] = useState<FlyAnimState | null>(null)

  // Schedule one AI seat's turn whenever it becomes an AI's turn
  // (currentPlayerIndex !== 0) and the game is still playing. The effect
  // re-fires after every aiTurn() call (version bumps, currentPlayerIndex
  // advances 1 -> 2 -> 3 -> 0), running exactly one seat's turn per firing
  // until control returns to the human.
  //
  // No ref-based "already scheduled" guard here on purpose: under
  // React.StrictMode (or any remount that happens to land mid-AI-turn), a
  // ref survives the mount/unmount/remount cycle but the timeout it guarded
  // does not — the cleanup clears the pending setTimeout, the ref still
  // says "already scheduled for this version", and the effect never
  // reschedules, so the AI turn silently never runs. Depending only on
  // `[version, game?.state.currentPlayerIndex, game?.state.status]` sidesteps
  // that: the effect naturally fires once whenever those values settle into
  // "an AI's turn", schedules exactly one timeout, and cleans it up
  // correctly on every re-run.
  useEffect(() => {
    if (!game) return
    if (game.state.status !== 'playing') return
    if (game.state.currentPlayerIndex === 0) return

    const timeoutId = setTimeout(() => {
      useGameStore.getState().aiTurn()
    }, AI_THINK_DELAY_MS)

    return () => clearTimeout(timeoutId)
  }, [version, game?.state.currentPlayerIndex, game?.state.status])

  // Detect game over (the store already calls game.finish() internally when
  // a discard/aiTurn/playCanasta/extendMeld ends the game) and notify the
  // parent screen.
  useEffect(() => {
    if (!game) return
    if (game.state.status === 'finished') {
      onGameEnd()
    }
  }, [version, game, onGameEnd])

  const canTakeDiscard = useMemo(() => {
    if (!game) return false
    if (game.state.status !== 'playing' || game.state.currentPlayerIndex !== 0) return false
    return canTakeDiscardPile(game)
    // Re-derive whenever the game mutates (version) — hand/discard/melds can
    // all change what's takeable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, version])

  if (!game) return null

  const handleDraw = () => {
    const deckEl = document.getElementById('deck-pile')
    const handEl = document.getElementById('player-hand-anchor')
    const fromRect = deckEl?.getBoundingClientRect()

    useGameStore.getState().drawFromDeck()
    setPhase('play')

    const toRect = handEl?.getBoundingClientRect()
    const hand = useGameStore.getState().game?.state.players[0].hand.getCards()
    const drawnCard = hand && hand.length > 0 ? hand[hand.length - 1] : undefined

    if (fromRect && toRect && drawnCard) {
      const id = Date.now()
      setDrawAnim({ id, fromRect, toRect, card: drawnCard })
      // Deve acompanhar TOTAL_S do DrawAnimation (~2.15s) + pequena folga.
      window.setTimeout(() => {
        setDrawAnim(current => (current?.id === id ? null : current))
      }, 2250)
    }
  }

  const handleTakeDiscard = () => {
    const discardEl = document.getElementById('discard-pile')
    const handEl = document.getElementById('player-hand-anchor')
    const fromRect = discardEl?.getBoundingClientRect()
    const cardsBefore = [...game.state.discardPile]

    useGameStore.getState().takeDiscardPile()
    setPhase('play')

    const toRect = handEl?.getBoundingClientRect()
    if (fromRect && toRect && cardsBefore.length > 0) {
      const id = Date.now()
      // Only fly a handful of ghosts for legibility even if the pile is huge.
      setPickupAnim({ id, fromRect, toRect, cards: cardsBefore.slice(-3) })
      window.setTimeout(() => setPickupAnim(current => (current?.id === id ? null : current)), FLY_ANIM_MS)
    }
  }

  const handleDiscard = () => {
    const { selectedCardIndices } = useGameStore.getState()
    if (selectedCardIndices.length !== 1) return

    const idx = selectedCardIndices[0]
    // Origem: a própria carta selecionada na mão (não a mão inteira), pra a
    // carta-fantasma sair de onde a carta está. Fallback: a mão.
    const cardEl = document.querySelector(`[data-hand-index="${idx}"]`)
    const handEl = document.getElementById('player-hand-anchor')
    const fromRect = (cardEl ?? handEl)?.getBoundingClientRect()
    // Destino: a âncora do topo do descarte (tamanho de carta), no ponto exato
    // onde a carta pousa — não a caixa larga do #discard-pile (que inclui o leque).
    const discardEl = document.getElementById('discard-top') ?? document.getElementById('discard-pile')
    const card = game.state.players[0].hand.getCards()[idx]

    useGameStore.getState().discard(idx)
    // Turn moves on; reset phase so it's ready for the next human turn.
    setPhase('draw')

    const toRect = discardEl?.getBoundingClientRect()
    if (fromRect && toRect && card) {
      const id = Date.now()
      setDiscardAnim({ id, fromRect, toRect, cards: [card] })
      window.setTimeout(() => setDiscardAnim(current => (current?.id === id ? null : current)), FLY_ANIM_MS)
    }
  }

  const handlePlayCanasta = () => {
    const { selectedCardIndices } = useGameStore.getState()
    if (selectedCardIndices.length < 3) return

    const handEl = document.getElementById('player-hand-anchor')
    const zoneEl = document.getElementById('meld-drop-zone')
    const fromRect = handEl?.getBoundingClientRect()
    const toRect = zoneEl?.getBoundingClientRect()
    const hand = game.state.players[0].hand.getCards()
    const cards = selectedCardIndices.map(i => hand[i]).filter((c): c is NonNullable<typeof c> => Boolean(c))

    useGameStore.getState().playCanasta(selectedCardIndices)
    // Stays in 'play' phase: the human may play more canastas or discard.

    if (fromRect && toRect && cards.length > 0) {
      const id = Date.now()
      setTableAnim({ id, fromRect, toRect, cards: cards.slice(0, 4) })
      window.setTimeout(() => setTableAnim(current => (current?.id === id ? null : current)), FLY_ANIM_MS)
    }
  }

  const handleExtendMeld = (meldIndex: number, cardIndices: number[], targetRect: DOMRect) => {
    const handEl = document.getElementById('player-hand-anchor')
    const fromRect = handEl?.getBoundingClientRect()
    const hand = game.state.players[0].hand.getCards()
    const cards = cardIndices.map(i => hand[i]).filter((c): c is NonNullable<typeof c> => Boolean(c))

    useGameStore.getState().extendMeld(meldIndex, cardIndices)

    if (fromRect && cards.length > 0) {
      const id = Date.now()
      setTableAnim({ id, fromRect, toRect: targetRect, cards: cards.slice(0, 4) })
      window.setTimeout(() => setTableAnim(current => (current?.id === id ? null : current)), FLY_ANIM_MS)
    }
  }

  // Registro compacto: só a última ação (uma linha), pra não gastar altura.
  const lastLog = gameLog[gameLog.length - 1]

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Placar (topo, altura automática) */}
      <div className="shrink-0">
        <Scoreboard />
      </div>

      {/* Mesa — ocupa o espaço flexível do meio; rola internamente só se
          precisar, sem rolar a página. Manipulação direta: clicar no monte,
          no descarte ou na mesa substitui os antigos botões de ação. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <GameBoard
          phase={phase}
          canTakeDiscard={canTakeDiscard}
          onDraw={handleDraw}
          onTakeDiscardPile={handleTakeDiscard}
          onDiscardSelected={handleDiscard}
          onPlayCanastaSelected={handlePlayCanasta}
          onExtendMeld={handleExtendMeld}
        />
      </div>
      <DrawAnimation anim={drawAnim} />
      <CardFlyAnimation anim={pickupAnim} />
      <CardFlyAnimation anim={discardAnim} />
      <CardFlyAnimation anim={tableAnim} />

      {/* Registro em uma linha só */}
      <div className="shrink-0 truncate rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-center text-xs text-gray-300">
        <span className="text-card-gold">Registro:</span>{' '}
        {lastLog ?? 'Nenhuma ação ainda.'}
      </div>

      {/* Mão (fixa, embaixo) — sem painel de ações: a dica de contexto fica
          numa linha fina dentro do próprio card da mão (ver PlayerHand). */}
      <div className="shrink-0">
        <PlayerHand phase={phase} />
      </div>
    </div>
  )
}
