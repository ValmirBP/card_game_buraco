import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { motion } from 'framer-motion'
import { SuitIcon } from '../Card'
import type { Card as CardType } from '../../engine/card'
import { computeMeldLayout, MELD_FRAME, MELD_SUBCOL_GAP, type MeldMetrics, type MeldPlacement } from './meldLayout'

export interface MeldAreaStrip {
  card: CardType
  /** Curinga ocupando a posição de outra carta (coringa, ou um 2 fora do
   * seu lugar natural). */
  wild: boolean
}

export interface MeldAreaMeld {
  /** Cartas já na ordem de exibição (a ordem da sequência). */
  strips: MeldAreaStrip[]
  closed: boolean
  clean: boolean
  kind: string
  points: number
  /** Realce enquanto o jogador escolhe onde estender: 'compatible' aceita as
   * cartas selecionadas, 'dim' não. */
  highlight: 'compatible' | 'dim' | null
  onClick: (event: MouseEvent<HTMLDivElement>) => void
}

interface MeldAreaProps {
  melds: MeldAreaMeld[]
  /** Slot tracejado "Baixar" no fim — só no quadro da dupla do jogador. */
  dock?: { active: boolean; onClick: () => void }
}

/** Naipe de um jogo: o da primeira carta natural (nem coringa, nem 2). */
export function meldSuitOf(cards: CardType[]): CardType['suit'] | undefined {
  return cards.find(c => !c.isWild && c.rank !== '2')?.suit
}

/** Mesma regra do engine (isWildInMeld, utils.ts): um '2' só é natural
 * quando é do MESMO naipe do jogo E ocupa a posição 2 da sequência; em
 * qualquer outro caso é curinga (o jogo é sujo). Coringas sempre. */
export function isWildStrip(
  card: CardType,
  representsValue: number | undefined,
  meldSuit?: CardType['suit']
): boolean {
  if (card.isWild) return true
  if (card.rank !== '2' || representsValue === undefined) return false
  return representsValue !== 2 || (meldSuit !== undefined && card.suit !== meldSuit)
}

const SUIT_TEXT: Record<CardType['suit'], string> = {
  hearts: 'text-suit-hearts',
  diamonds: 'text-suit-diamonds',
  clubs: 'text-suit-clubs',
  spades: 'text-suit-spades',
}

const SUIT_NAME: Record<CardType['suit'], string> = {
  hearts: 'copas',
  diamonds: 'ouros',
  clubs: 'paus',
  spades: 'espadas',
}

const KIND_LABEL: Record<string, string> = {
  real: 'Canastra real',
  quinhentos: 'Canastra de quinhentos',
  limpa: 'Canastra limpa',
  suja: 'Canastra suja',
}

function describeMeld(meld: MeldAreaMeld): string {
  const title = KIND_LABEL[meld.kind] ?? (meld.clean ? 'Jogo limpo' : 'Jogo sujo')
  const cards = meld.strips
    .map(s => (s.card.isWild ? 'coringa' : `${s.card.rank} de ${SUIT_NAME[s.card.suit]}${s.wild ? ' (curinga)' : ''}`))
    .join(', ')
  return `${title}, ${meld.points} pontos: ${cards}`
}

function useIsLandscape(): boolean {
  const query = '(orientation: landscape)'
  const read = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches
  const [landscape, setLandscape] = useState(read)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = () => setLandscape(mql.matches)
    mql.addEventListener?.('change', onChange)
    return () => mql.removeEventListener?.('change', onChange)
  }, [])
  return landscape
}

function Strip({ strip, m }: { strip: MeldAreaStrip; m: MeldMetrics }) {
  if (strip.card.isWild) {
    return (
      <div
        className="flex shrink-0 items-center justify-center border-b border-purple-950/40 bg-gradient-to-r from-fuchsia-600 to-indigo-700 font-bold leading-none text-white last:border-b-0"
        style={{ height: m.stripH, fontSize: m.fontPx }}
      >
        ★
      </div>
    )
  }
  return (
    <div
      className={`flex shrink-0 items-center justify-center gap-[0.1em] border-b border-black/20 bg-card-face font-bold leading-none tracking-tight last:border-b-0 ${
        SUIT_TEXT[strip.card.suit]
      } ${strip.wild ? 'shadow-[inset_0.22em_0_0_#9333ea]' : ''}`}
      style={{ height: m.stripH, fontSize: m.fontPx }}
    >
      <span>{strip.card.rank}</span>
      <SuitIcon suit={strip.card.suit} className="text-[0.9em]" />
    </div>
  )
}

/** A cor da moldura conta o ESTADO do jogo (aberto / canastra limpa /
 * canastra suja) e nunca muda com a seleção. O realce "compatível" (as
 * cartas selecionadas estendem este jogo) é um contorno azul por FORA da
 * moldura — se ele pintasse a moldura de dourado, uma sequência aberta
 * pareceria uma canastra fechada limpa (e uma suja pareceria limpa) justo
 * na hora em que o jogador escolhe onde baixar. */
export function frameClass(meld: MeldAreaMeld): string {
  const fill = !meld.closed ? 'bg-white/10' : meld.clean ? 'bg-card-gold' : 'bg-orange-400'
  return meld.highlight === 'compatible'
    ? `${fill} outline outline-2 outline-sky-300 shadow-[0_0_10px_rgba(125,211,252,0.8)]`
    : fill
}

export function footerClass(meld: MeldAreaMeld): string {
  if (meld.closed) return 'text-black'
  return meld.clean ? 'text-green-300' : 'text-orange-300'
}

function MeldColumn({ meld, place, m }: { meld: MeldAreaMeld; place: MeldPlacement; m: MeldMetrics }) {
  const chunks: MeldAreaStrip[][] = []
  for (let i = 0; i < meld.strips.length; i += place.rows) chunks.push(meld.strips.slice(i, i + place.rows))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: meld.highlight === 'dim' ? 0.55 : 1, scale: 1 }}
      onClick={meld.onClick}
      role="group"
      aria-label={describeMeld(meld)}
      title={describeMeld(meld)}
      data-meld-closed={meld.closed ? 'true' : undefined}
      className={`absolute flex flex-col rounded-[4px] transition-colors ${frameClass(meld)} ${
        meld.highlight ? 'cursor-pointer' : ''
      }`}
      style={{ left: place.x, top: place.y, width: place.width, height: place.height, padding: MELD_FRAME }}
    >
      <div className="flex items-start" style={{ columnGap: MELD_SUBCOL_GAP }}>
        {chunks.map((chunk, ci) => (
          <div key={ci} className="flex flex-col overflow-hidden rounded-[3px]" style={{ width: m.stripW }}>
            {chunk.map((strip, si) => (
              <Strip key={si} strip={strip} m={m} />
            ))}
          </div>
        ))}
      </div>
      {m.footerH > 0 && (
        <div
          className={`mt-auto flex items-end justify-center font-bold leading-none ${footerClass(meld)}`}
          style={{ height: m.footerH, fontSize: m.fontPx * 0.85 }}
        >
          +{meld.points}
        </div>
      )}
    </motion.div>
  )
}

/**
 * O "quadro de baixar carta" de uma dupla: mede o espaço que sobrou no
 * painel e distribui TODOS os jogos nele, sem rolagem — ver meldLayout.ts.
 * Em paisagem (o jogo de verdade) o quadro tem altura fixa e o tamanho das
 * cartas se ajusta pra caber; em retrato o quadro cresce com o conteúdo.
 */
export default function MeldArea({ melds, dock }: MeldAreaProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const landscape = useIsLandscape()

  useLayoutEffect(() => {
    const el = boxRef.current
    if (!el) return
    const read = () =>
      setSize(prev => {
        const w = el.clientWidth
        const h = el.clientHeight
        return prev.w === w && prev.h === h ? prev : { w, h }
      })
    read()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(read)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const lengthsKey = melds.map(m => m.strips.length).join(',')
  const hasDock = Boolean(dock)
  const layout = useMemo(
    () =>
      computeMeldLayout({
        width: size.w,
        height: landscape ? size.h : Infinity,
        lengths: lengthsKey ? lengthsKey.split(',').map(Number) : [],
        dockSlot: hasDock,
      }),
    [size.w, size.h, landscape, lengthsKey, hasDock]
  )
  const m = layout.metrics

  return (
    <div ref={boxRef} className="relative w-full landscape:min-h-0 landscape:flex-1 landscape:overflow-hidden">
      <div className="relative" style={{ height: layout.totalHeight }}>
        {layout.placements.map(place =>
          place.index < melds.length ? (
            <MeldColumn key={place.index} meld={melds[place.index]} place={place} m={m} />
          ) : (
            dock && (
              <button
                key="dock"
                type="button"
                onClick={event => {
                  event.stopPropagation()
                  dock.onClick()
                }}
                aria-label="Baixar jogo novo"
                className={`absolute flex flex-col items-center justify-center gap-[0.2em] rounded-[4px] border-2 border-dashed leading-none transition-colors ${
                  dock.active
                    ? 'border-card-gold bg-card-gold/10 text-card-gold shadow-[0_0_12px_rgba(212,175,55,0.45)]'
                    : 'border-white/25 text-gray-400'
                }`}
                style={{
                  left: place.x,
                  top: place.y,
                  width: place.width,
                  height: place.height,
                  fontSize: m.fontPx * 0.85,
                }}
              >
                <span style={{ fontSize: m.fontPx * 1.2 }}>⬇</span>
                {place.width >= 34 && <span>Baixar</span>}
              </button>
            )
          )
        )}
      </div>
    </div>
  )
}
