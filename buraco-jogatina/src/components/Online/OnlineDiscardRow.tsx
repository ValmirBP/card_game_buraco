import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useOnlineStore } from '../../online/onlineStore'
import { CardComponent } from '../Card'
import { asCard, asCards } from '../../online/cardAdapter'
import type { SeatView } from '../../session/types'

// Idêntico ao DiscardRow offline: mesmo footprint da mão, pras duas fileiras
// ficarem paralelas dentro do mesmo painel.
const HAND_CARD_SIZE = 'w-16 h-24 sm:w-20 sm:h-28 landscape:w-14 landscape:h-[4.25rem]'
const BIG_CORNER = 'text-sm font-normal sm:text-base landscape:text-lg landscape:leading-none'

interface OnlineDiscardRowProps {
  view: SeatView
}

/**
 * Online equivalent do DiscardRow (offline): fileira do descarte embutida no
 * painel da mão, lado a lado. Validações profundas (carta bloqueada do lixo
 * unitário, esvaziar a mão sem bater) moram no SERVIDOR (GameSession) e
 * chegam via errorMsg — aqui só as checagens estruturais instantâneas.
 */
export default function OnlineDiscardRow({ view }: OnlineDiscardRowProps) {
  const selectedCardIndices = useOnlineStore(s => s.selectedCardIndices)
  const sendIntent = useOnlineStore(s => s.sendIntent)
  const [hint, setHint] = useState<string | null>(null)

  const { discardPile, status, currentSeat, phase, yourHand } = view
  const isMyTurn = status === 'playing' && currentSeat === view.seat
  const canClickToDraw = isMyTurn && phase === 'draw' && discardPile.length > 0
  const canClickToDiscard = isMyTurn && phase === 'play' && selectedCardIndices.length === 1

  const flashHint = (message: string) => {
    setHint(message)
    window.setTimeout(() => setHint(current => (current === message ? null : current)), 2600)
  }

  const handleClick = () => {
    if (!isMyTurn) return
    if (phase === 'draw') {
      if (discardPile.length === 0) {
        flashHint('O descarte está vazio.')
        return
      }
      // Ao contrário da COMPRA (draw), aqui as cartas que vão pra mão já são
      // conhecidas ANTES de mandar a intent (é a pilha inteira, visível no
      // cliente) — dá pra animar na hora do clique, como o offline faz.
      const fromRect = (document.getElementById('discard-top') ?? document.getElementById('discard-pile'))
        ?.getBoundingClientRect()
      const toRect = document.getElementById('player-hand-anchor')?.getBoundingClientRect()
      if (fromRect && toRect && discardPile.length > 0) {
        useOnlineStore.getState().playPickupAnim({
          fromRect,
          toRect,
          cards: asCards(discardPile.slice(-3)),
          sizeClassName: HAND_CARD_SIZE,
        })
      }
      sendIntent({ type: 'takeDiscard' })
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
    const idx = selectedCardIndices[0]
    const cardEl = document.querySelector(`[data-hand-index="${idx}"]`)
    const fromRect = (cardEl ?? document.getElementById('player-hand-anchor'))?.getBoundingClientRect()
    const toRect = (document.getElementById('discard-top') ?? document.getElementById('discard-pile'))
      ?.getBoundingClientRect()
    const card = yourHand[idx]
    if (fromRect && toRect && card) {
      useOnlineStore.getState().playDiscardAnim({
        fromRect,
        toRect,
        cards: [asCard(card)],
        sizeClassName: HAND_CARD_SIZE,
      })
    }
    sendIntent({ type: 'discard', cardIndex: idx })
  }

  return (
    <div className="relative flex h-full min-w-0 flex-col">
      <div className="flex flex-nowrap items-baseline justify-between gap-x-2">
        <h3 className="shrink-0 font-display text-sm text-card-gold landscape:text-[10px]">
          Descarte{' '}
          <span className="text-[10px] font-normal text-gray-400 landscape:text-[8px]">({discardPile.length})</span>
        </h3>
      </div>
      <div
        id="discard-pile"
        onClick={handleClick}
        className={`scrollbar-gold flex min-w-0 flex-1 items-start overflow-x-auto overflow-y-hidden rounded-lg px-1 pb-3 pt-3 -space-x-5 sm:-space-x-6 landscape:max-h-[2.7rem] landscape:-space-x-4 landscape:pb-0.5 landscape:pt-1 ${
          canClickToDraw || canClickToDiscard
            ? 'cursor-pointer ring-2 ring-card-gold shadow-[0_0_16px_rgba(212,175,55,0.5)]'
            : ''
        }`}
      >
        {discardPile.length === 0 ? (
          <div
            id="discard-top"
            className="flex h-6 w-16 items-center justify-center self-center rounded-lg border border-dashed border-white/20 text-[10px] text-gray-400 sm:w-20 landscape:w-12 landscape:text-[8px]"
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
                <CardComponent card={asCard(card)} sizeClassName={HAND_CARD_SIZE} compactOnLandscape cornerClassName={BIG_CORNER} />
              </div>
            )
          })
        )}
      </div>

      <AnimatePresence>
        {hint && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-x-0 bottom-full z-40 mb-1 flex justify-center"
          >
            <span className="rounded-full border border-card-gold/50 bg-black/85 px-3 py-1 text-center text-[11px] text-card-gold shadow-lg backdrop-blur-sm landscape:text-[10px]">
              {hint}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
