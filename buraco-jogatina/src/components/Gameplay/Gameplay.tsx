import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useGameStore } from '../../store/gameStore'
import GameBoard from './GameBoard'
import PlayerHand from './PlayerHand'
import DiscardRow from './DiscardRow'
import Scoreboard from './Scoreboard'
import DrawAnimation, { type DrawAnimState } from './DrawAnimation'
import CardFlyAnimation, { type FlyAnimState } from './CardFlyAnimation'
import AiDrawAnimation, { type BackFlyState } from './AiDrawAnimation'
import { canTakeDiscardPile } from './discardRules'
import ExitButton from '../ExitButton'

export type TurnPhase = 'draw' | 'play'

interface GameplayProps {
  onGameEnd: () => void
  onExit: () => void
}

const AI_THINK_DELAY_MS = 2000
const AI_DRAW_ANIM_MS = 700
const AI_TAKE_ANIM_S = 1.1
const AI_TAKE_ANIM_MS = 1300
const FLY_ANIM_MS = 650

const GHOST_HAND_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-14 landscape:h-[4.25rem]'
const GHOST_TABLE_SIZE = 'w-20 h-28 landscape:w-12 landscape:h-16'
const GHOST_PILE_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-8 landscape:h-[2.9rem]'

function leftmostHandCardRect(cardIndices: number[]): DOMRect | undefined {
  const rects = cardIndices
    .map(i => document.querySelector(`[data-hand-index="${i}"]`)?.getBoundingClientRect())
    .filter((r): r is DOMRect => Boolean(r))
  if (rects.length === 0) {
    return document.getElementById('player-hand-anchor')?.getBoundingClientRect()
  }
  return rects.reduce((leftmost, r) => (r.left < leftmost.left ? r : leftmost))
}

function visibleDeckPileRect(): DOMRect | undefined {
  return Array.from(document.querySelectorAll('[data-deck-pile]'))
    .map(el => el.getBoundingClientRect())
    .find(r => r.width > 0 || r.height > 0)
}

export default function Gameplay({ onGameEnd, onExit }: GameplayProps) {
  const version = useGameStore(s => s.version)
  const game = useGameStore(s => s.game)
  const gameLog = useGameStore(s => s.gameLog)

  const [phase, setPhase] = useState<TurnPhase>('draw')

  const [drawAnim, setDrawAnim] = useState<DrawAnimState | null>(null)
  const [pickupAnim, setPickupAnim] = useState<FlyAnimState | null>(null)
  const [discardAnim, setDiscardAnim] = useState<FlyAnimState | null>(null)
  const [tableAnim, setTableAnim] = useState<FlyAnimState | null>(null)
  const [aiDrawAnim, setAiDrawAnim] = useState<BackFlyState | null>(null)
  const [aiTakeAnim, setAiTakeAnim] = useState<FlyAnimState | null>(null)

  const [mortoBanner, setMortoBanner] = useState<string | null>(null)

  useEffect(() => {
    if (!game) return
    if (game.state.status !== 'playing') return
    const seat = game.state.currentPlayerIndex
    if (seat === 0) return

    const timeoutId = setTimeout(() => {
      const store = useGameStore.getState()
      const g = store.game
      if (!g) return
      const discardBefore = [...g.state.discardPile]
      const logBefore = store.gameLog.length
      const toRect = Array.from(document.querySelectorAll(`[data-seat-index="${seat}"]`))
        .map(el => el.getBoundingClientRect())
        .find(r => r.width > 0 || r.height > 0)
      const discardFromRect = (
        document.getElementById('discard-top') ?? document.getElementById('discard-pile')
      )?.getBoundingClientRect()

      store.aiTurn()

      const newLog = useGameStore.getState().gameLog.slice(logBefore)
      const tookDiscard = newLog.some(e => /pegou a pilha de descarte/i.test(e))
      if (!toRect) return
      const id = Date.now()
      if (tookDiscard && discardBefore.length > 0) {
        const fromRect = discardFromRect
        if (fromRect) {
          setAiTakeAnim({
            id,
            fromRect,
            toRect,
            cards: discardBefore.slice(-4),
            durationS: AI_TAKE_ANIM_S,
            sizeClassName: GHOST_PILE_SIZE,
          })
          window.setTimeout(() => setAiTakeAnim(current => (current?.id === id ? null : current)), AI_TAKE_ANIM_MS)
        }
      } else {
        const fromRect = visibleDeckPileRect()
        if (fromRect) {
          setAiDrawAnim({ id, fromRect, toRect })
          window.setTimeout(() => setAiDrawAnim(current => (current?.id === id ? null : current)), AI_DRAW_ANIM_MS)
        }
      }
    }, AI_THINK_DELAY_MS)

    return () => clearTimeout(timeoutId)
  }, [version, game?.state.currentPlayerIndex, game?.state.status])

  const [batidaBanner, setBatidaBanner] = useState<string | null>(null)
  const gameEndScheduledRef = useRef(false)
  const onGameEndRef = useRef(onGameEnd)
  onGameEndRef.current = onGameEnd
  useEffect(() => {
    if (!game) return
    if (game.state.status !== 'finished') return
    if (gameEndScheduledRef.current) return
    gameEndScheduledRef.current = true

    const closerSeat = game.state.closerSeat
    const closerName = closerSeat !== undefined ? game.state.players[closerSeat]?.name : undefined
    setBatidaBanner(closerName ? `🏆 ${closerName} bateu!` : '🏁 Fim da rodada!')
    window.setTimeout(() => onGameEndRef.current(), 2000)
  }, [version, game])

  const bannerTimeoutRef = useRef<number | null>(null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, version])

  if (!game) return null

  const handleDraw = () => {
    const handEl = document.getElementById('player-hand-anchor')
    const fromRect = visibleDeckPileRect()

    useGameStore.getState().drawFromDeck()
    setPhase('play')

    const toRect = handEl?.getBoundingClientRect()
    const hand = useGameStore.getState().game?.state.players[0].hand.getCards()
    const drawnCard = hand && hand.length > 0 ? hand[hand.length - 1] : undefined

    if (fromRect && toRect && drawnCard) {
      const id = Date.now()
      setDrawAnim({ id, fromRect, toRect, card: drawnCard, sizeClassName: GHOST_HAND_SIZE })
      window.setTimeout(() => {
        setDrawAnim(current => (current?.id === id ? null : current))
      }, 2250)
    }
  }

  const handleTakeDiscard = () => {
    const discardEl = document.getElementById('discard-top') ?? document.getElementById('discard-pile')
    const handEl = document.getElementById('player-hand-anchor')
    const fromRect = discardEl?.getBoundingClientRect()
    const cardsBefore = [...game.state.discardPile]

    useGameStore.getState().takeDiscardPile()
    setPhase('play')

    const toRect = handEl?.getBoundingClientRect()
    if (fromRect && toRect && cardsBefore.length > 0) {
      const id = Date.now()
      setPickupAnim({ id, fromRect, toRect, cards: cardsBefore.slice(-3), sizeClassName: GHOST_HAND_SIZE })
      window.setTimeout(() => setPickupAnim(current => (current?.id === id ? null : current)), FLY_ANIM_MS)
    }
  }

  const handleDiscard = () => {
    const { selectedCardIndices } = useGameStore.getState()
    if (selectedCardIndices.length !== 1) return

    const idx = selectedCardIndices[0]
    const cardEl = document.querySelector(`[data-hand-index="${idx}"]`)
    const handEl = document.getElementById('player-hand-anchor')
    const fromRect = (cardEl ?? handEl)?.getBoundingClientRect()
    const discardEl = document.getElementById('discard-top') ?? document.getElementById('discard-pile')
    const card = game.state.players[0].hand.getCards()[idx]

    useGameStore.getState().discard(idx)
    setPhase('draw')

    const toRect = discardEl?.getBoundingClientRect()
    if (fromRect && toRect && card) {
      const id = Date.now()
      setDiscardAnim({ id, fromRect, toRect, cards: [card], sizeClassName: GHOST_HAND_SIZE })
      window.setTimeout(() => setDiscardAnim(current => (current?.id === id ? null : current)), FLY_ANIM_MS)
    }
  }

  const handlePlayCanasta = () => {
    const { selectedCardIndices } = useGameStore.getState()
    if (selectedCardIndices.length < 3) return

    const fromRect = leftmostHandCardRect(selectedCardIndices)
    const zoneEl = document.getElementById('meld-drop-zone')
    const toRect = zoneEl?.getBoundingClientRect()
    const hand = game.state.players[0].hand.getCards()
    const cards = selectedCardIndices.map(i => hand[i]).filter((c): c is NonNullable<typeof c> => Boolean(c))

    useGameStore.getState().playCanasta(selectedCardIndices)

    if (fromRect && toRect && cards.length > 0) {
      const id = Date.now()
      setTableAnim({ id, fromRect, toRect, cards: cards.slice(0, 4), sizeClassName: GHOST_TABLE_SIZE })
      window.setTimeout(() => setTableAnim(current => (current?.id === id ? null : current)), FLY_ANIM_MS)
    }
  }

  const handleExtendMeld = (meldIndex: number, cardIndices: number[], targetRect: DOMRect) => {
    const fromRect = leftmostHandCardRect(cardIndices)
    const hand = game.state.players[0].hand.getCards()
    const cards = cardIndices.map(i => hand[i]).filter((c): c is NonNullable<typeof c> => Boolean(c))

    useGameStore.getState().extendMeld(meldIndex, cardIndices)

    if (fromRect && cards.length > 0) {
      const id = Date.now()
      setTableAnim({ id, fromRect, toRect: targetRect, cards: cards.slice(0, 4), sizeClassName: GHOST_TABLE_SIZE })
      window.setTimeout(() => setTableAnim(current => (current?.id === id ? null : current)), FLY_ANIM_MS)
    }
  }

  const lastLog = gameLog[gameLog.length - 1]

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 landscape:gap-0.5">
      <div className="flex shrink-0 items-start gap-2 landscape:gap-1.5">
        <ExitButton onClick={onExit} />
        <div className="min-w-0 flex-1">
          <Scoreboard />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto landscape:overflow-hidden">
        <GameBoard
          phase={phase}
          onDraw={handleDraw}
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

      <AnimatePresence>
        {batidaBanner && (
          <motion.div
            key={batidaBanner}
            initial={{ opacity: 0, scale: 0.6, y: -14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
            className="pointer-events-none fixed inset-x-0 top-1/3 z-[130] flex justify-center px-4"
          >
            <span className="rounded-2xl border-2 border-card-gold bg-black/85 px-8 py-4 text-center font-display text-2xl text-card-gold shadow-[0_0_40px_rgba(212,175,55,0.8)] backdrop-blur-sm sm:text-3xl">
              {batidaBanner}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

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

      <div className="shrink-0 truncate rounded-lg border border-white/10 bg-black/25 px-3 py-1.5 text-center text-xs text-gray-300 landscape:hidden">
        <span className="text-card-gold">Registro:</span>{' '}
        {lastLog ?? 'Nenhuma ação ainda.'}
      </div>

      <div className="flex shrink-0 items-stretch gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-1.5 shadow-lg backdrop-blur-sm landscape:gap-1.5 landscape:px-2 landscape:py-0.5">
        <div className="min-w-0 flex-[3]">
          <PlayerHand phase={phase} />
        </div>
        <div className="w-px shrink-0 self-stretch bg-white/15" />
        <div className="min-w-0 flex-[2]">
          <DiscardRow
            phase={phase}
            canTakeDiscard={canTakeDiscard}
            onTakeDiscardPile={handleTakeDiscard}
            onDiscardSelected={handleDiscard}
          />
        </div>
      </div>
    </div>
  )
}
