import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import GameBoard from './GameBoard'
import PlayerHand from './PlayerHand'
import Scoreboard from './Scoreboard'
import DrawAnimation, { type DrawAnimState } from './DrawAnimation'
import CardFlyAnimation, { type FlyAnimState } from './CardFlyAnimation'
import AiDrawAnimation, { type BackFlyState } from './AiDrawAnimation'
import { canTakeDiscardPile } from './discardRules'

export type TurnPhase = 'draw' | 'play'

interface GameplayProps {
  onGameEnd: () => void
}

// Pausa antes de cada jogada da IA — 2s pra dar tempo de ver a "compra"
// (verso da carta indo pro assento do jogador) antes de ele baixar/descartar.
const AI_THINK_DELAY_MS = 2000
// Quando a carta-fantasma da compra da IA "chega" no assento (deve acompanhar
// DURATION_S do AiDrawAnimation), pra então rodar o turno de verdade.
const AI_DRAW_ANIM_MS = 700
// Voo do LIXO indo pro assento de quem pegou: mais lento e visível (a carta
// atravessa a mesa até um adversário na borda), com folga pra limpar depois.
const AI_TAKE_ANIM_S = 1.1
const AI_TAKE_ANIM_MS = 1300
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
  // Fantasma da "compra" de um jogador da IA (verso indo do monte pro assento).
  const [aiDrawAnim, setAiDrawAnim] = useState<BackFlyState | null>(null)
  // Quando a IA PEGA O LIXO: as cartas do descarte voam (face pra cima) pro
  // assento de quem pegou.
  const [aiTakeAnim, setAiTakeAnim] = useState<FlyAnimState | null>(null)

  // Banner de destaque para eventos do MORTO (pegou / virou monte), que antes
  // passavam despercebidos (o morto fica no canto e a pega é automática).
  const [mortoBanner, setMortoBanner] = useState<string | null>(null)

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
    const seat = game.state.currentPlayerIndex
    if (seat === 0) return

    // Depois da pausa (2s), roda o turno da IA e anima a "compra" conforme o
    // que ela fez: se PEGOU O LIXO, as cartas do descarte voam (face pra cima)
    // pro assento dela; se comprou do monte, um verso desliza do monte pro
    // assento. Decorativo — o estado já mudou; é só pro olho acompanhar.
    const timeoutId = setTimeout(() => {
      const store = useGameStore.getState()
      const g = store.game
      if (!g) return
      const discardBefore = [...g.state.discardPile]
      const logBefore = store.gameLog.length
      const seatEl = document.querySelector(`[data-seat-index="${seat}"]`)
      const toRect = seatEl?.getBoundingClientRect()
      // Origem do lixo capturada AGORA (antes do turno), com a pilha ainda
      // cheia — depois do aiTurn o descarte fica "Vazio" (elemento menor).
      const discardFromRect = document.getElementById('discard-pile')?.getBoundingClientRect()

      store.aiTurn()

      const newLog = useGameStore.getState().gameLog.slice(logBefore)
      const tookDiscard = newLog.some(e => /pegou a pilha de descarte/i.test(e))
      if (!toRect) return
      const id = Date.now()
      if (tookDiscard && discardBefore.length > 0) {
        const fromRect = discardFromRect
        if (fromRect) {
          setAiTakeAnim({ id, fromRect, toRect, cards: discardBefore.slice(-4), durationS: AI_TAKE_ANIM_S })
          window.setTimeout(() => setAiTakeAnim(current => (current?.id === id ? null : current)), AI_TAKE_ANIM_MS)
        }
      } else {
        const fromRect = document.getElementById('deck-pile')?.getBoundingClientRect()
        if (fromRect) {
          setAiDrawAnim({ id, fromRect, toRect })
          window.setTimeout(() => setAiDrawAnim(current => (current?.id === id ? null : current)), AI_DRAW_ANIM_MS)
        }
      }
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

  // Banner do morto: varre as linhas NOVAS do registro a cada mudança (o
  // turno da IA adiciona várias de uma vez) e, se alguma anunciar a pega do
  // morto / virar monte, mostra o banner. O timeout que limpa fica num ref —
  // não é cancelado quando chegam outras linhas de log — senão o aviso ficava
  // preso na tela (bug quando o parceiro/adversário pegava o morto).
  const bannerTimeoutRef = useRef<number | null>(null)
  // IMPORTANTE: inicia apontando pro FIM do log atual. Ao trocar de rodada o
  // Gameplay REMONTA (passa pela tela de Resultado e volta), e o gameLog é
  // acumulado — se começasse em 0, re-escanearia o log inteiro e mostraria de
  // novo o "pegou o morto" da rodada anterior. Começando no tamanho atual, só
  // avisos NOVOS (desta rodada, após a montagem) disparam o banner — um por
  // ocorrência, sem herdar o da rodada passada.
  const seenLogLenRef = useRef(gameLog.length)
  useEffect(() => {
    const newEntries = gameLog.slice(seenLogLenRef.current)
    seenLogLenRef.current = gameLog.length
    const mortoEntry = [...newEntries].reverse().find(e => /pegou o morto|virou o novo monte/i.test(e))
    if (!mortoEntry) return
    setMortoBanner(/virou o novo monte/i.test(mortoEntry) ? '🔄 O morto virou o novo monte!' : `🎴 ${mortoEntry}`)
    if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current)
    bannerTimeoutRef.current = window.setTimeout(() => setMortoBanner(null), 2600)
  }, [gameLog])

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
    <div className="flex h-full min-h-0 flex-col gap-2 landscape:gap-0.5">
      {/* Placar (topo, altura automática) */}
      <div className="shrink-0">
        <Scoreboard />
      </div>

      {/* Mesa — ocupa o espaço flexível do meio. Em retrato rola
          internamente só se precisar, sem rolar a página; em paisagem NÃO
          rola — o GameBoard se redimensiona (assentos/monte/descarte
          menores, painéis "Nós"/"Eles" nas laterais) pra caber inteiro na
          altura disponível. Manipulação direta: clicar no monte, no
          descarte ou na mesa substitui os antigos botões de ação. */}
      <div className="min-h-0 flex-1 overflow-y-auto landscape:overflow-hidden">
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
      <AiDrawAnimation anim={aiDrawAnim} />
      <CardFlyAnimation anim={aiTakeAnim} />
      <CardFlyAnimation anim={pickupAnim} />
      <CardFlyAnimation anim={discardAnim} />
      <CardFlyAnimation anim={tableAnim} />

      {/* Banner de destaque do morto (pega / virou monte) */}
      <AnimatePresence>
        {mortoBanner && (
          <motion.div
            key={mortoBanner}
            initial={{ opacity: 0, scale: 0.7, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            className="pointer-events-none fixed inset-x-0 top-1/3 z-[120] flex justify-center px-4"
          >
            <span className="rounded-2xl border-2 border-card-gold bg-black/80 px-6 py-3 text-center font-display text-lg text-card-gold shadow-[0_0_30px_rgba(212,175,55,0.7)] backdrop-blur-sm sm:text-2xl">
              {mortoBanner}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Registro em uma linha só — escondido em paisagem pra liberar altura
          pra mesa/mão (a mesa já mostra os eventos importantes via banner do
          morto e destaques na própria mesa). */}
      <div className="shrink-0 truncate rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-center text-xs text-gray-300 landscape:hidden">
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
