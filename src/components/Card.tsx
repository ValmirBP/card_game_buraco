import { motion } from 'framer-motion'
import type { Card as CardType } from '../engine/card'

interface CardProps {
  card: CardType
  onClick?: () => void
  selected?: boolean
  index?: number
  /** Overrides the default footprint (see CARD_SIZE_CLASSES). Used by the
   * single-player landscape table layout to shrink table cards while
   * leaving every other caller (Online, the player's hand) untouched. */
  sizeClassName?: string
  /** Opt-in: shrinks the rank/suit glyphs and jester illustration ONLY in
   * landscape orientation (via a `landscape:` Tailwind variant baked into
   * the class strings below), to match a `sizeClassName` that also shrinks
   * only in landscape. Left `undefined`/false everywhere except the
   * single-player table/melds, so Online (which never passes this prop)
   * and the player's hand keep their normal glyph size in every
   * orientation. */
  compactOnLandscape?: boolean
  /** Overrides the corner rank/suit glyph size classes. Used pela mão do
   * humano em paisagem, que fica em "meia carta" (só o topo aparece) e por
   * isso quer o rank/naipe do canto BEM grandes/legíveis, sem depender do
   * símbolo central (que fica escondido abaixo da dobra). */
  cornerClassName?: string
  /** 'row' põe rank e naipe LADO A LADO (em vez de empilhados) no índice do
   * canto — usado nas colunas de jogos baixados em paisagem (GameBoard),
   * onde as cartas se sobrepõem tanto que só uma faixa fina do canto de cada
   * carta (abaixo da carta de cima) fica visível; empilhado, o naipe some
   * nessa faixa. Default 'column' (empilhado, como uma carta real) em todo
   * outro lugar (mão, monte, descarte). */
  cornerLayout?: 'column' | 'row'
}

const SUIT_SYMBOLS: Record<CardType['suit'], string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
}

const SUIT_COLOR_CLASS: Record<CardType['suit'], string> = {
  hearts: 'text-suit-hearts',
  diamonds: 'text-suit-diamonds',
  clubs: 'text-suit-clubs',
  spades: 'text-suit-spades',
}

/** Shared footprint for both the face card and the card back so hands, melds
 * and the draw pile all line up visually. Sized generously so rank + suit
 * stay legible even with a full hand (rows scroll horizontally). */
export const CARD_SIZE_CLASSES = 'w-16 h-24 sm:w-20 sm:h-28'

/** Small illustrated jester — cap with three bell-tipped points over a
 * simple masked face — used on wild cards instead of a plain star so the
 * card reads as an actual illustrated Joker. */
function JesterIllustration({ compactOnLandscape }: { compactOnLandscape?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 56"
      className={compactOnLandscape ? 'h-9 w-9 landscape:h-4 landscape:w-4 sm:h-11 sm:w-11' : 'h-9 w-9 sm:h-11 sm:w-11'}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M6 30 L6 14 Q6 4 14 10 L20 20 L24 6 L28 20 L34 10 Q42 4 42 14 L42 30 Z"
        fill="#f5d576"
        stroke="#ffffff"
        strokeWidth="1.2"
      />
      <circle cx="6" cy="11" r="3" fill="#ffffff" />
      <circle cx="24" cy="4" r="3" fill="#ffffff" />
      <circle cx="42" cy="11" r="3" fill="#ffffff" />
      <path d="M4 30 Q24 42 44 30 L44 38 Q24 50 4 38 Z" fill="#fdfaf2" />
      <circle cx="15" cy="33" r="2.3" fill="#6d28d9" />
      <circle cx="33" cy="33" r="2.3" fill="#6d28d9" />
      <path d="M15 41 Q24 46 33 41" stroke="#6d28d9" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** Cores de detalhe das figuras J/Q/K, por cor do naipe: naipes vermelhos
 * ganham figura em tons de vermelho/dourado, pretos em tons de preto/dourado
 * - como num baralho impresso de verdade. */
const FACE_TONES: Record<'red' | 'black', { main: string; skin: string; accent: string }> = {
  red: { main: '#b3123a', skin: '#f7dcc0', accent: '#d4af37' },
  black: { main: '#2b2b31', skin: '#f7dcc0', accent: '#d4af37' },
}

/** Figura central estilizada das cartas de corte (J/Q/K), no lugar do naipe
 * central gigante - pedido do usuário com foto de referência de baralho
 * tradicional. Busto simples: coroa/chapéu + rosto + ombros. */
function FaceCardIllustration({
  rank,
  suit,
  compactOnLandscape,
}: {
  rank: 'J' | 'Q' | 'K'
  suit: CardType['suit']
  compactOnLandscape?: boolean
}) {
  const tone = suit === 'hearts' || suit === 'diamonds' ? FACE_TONES.red : FACE_TONES.black
  const sizeClass = compactOnLandscape
    ? 'h-12 w-12 sm:h-16 sm:w-16 landscape:h-9 landscape:w-9'
    : 'h-12 w-12 sm:h-16 sm:w-16'
  return (
    <svg viewBox="0 0 48 60" className={sizeClass} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* Ombros/túnica */}
      <path d="M8 60 Q8 44 24 44 Q40 44 40 60 Z" fill={tone.main} />
      <path d="M20 46 L24 52 L28 46 Z" fill={tone.accent} />
      {/* Rosto */}
      <circle cx="24" cy="30" r="10" fill={tone.skin} stroke={tone.main} strokeWidth="1.2" />
      {/* Olhos e boca */}
      <circle cx="20.5" cy="29" r="1.2" fill={tone.main} />
      <circle cx="27.5" cy="29" r="1.2" fill={tone.main} />
      {rank === 'K' ? (
        // Barba do rei
        <path d="M17 33 Q24 42 31 33 Q31 38 24 39 Q17 38 17 33 Z" fill={tone.main} opacity="0.85" />
      ) : (
        <path d="M21 34.5 Q24 36.5 27 34.5" stroke={tone.main} strokeWidth="1.3" fill="none" strokeLinecap="round" />
      )}
      {rank === 'Q' && (
        <>
          {/* Cabelo da dama */}
          <path d="M14 30 Q13 20 24 19 Q35 20 34 30 L34 36 Q32 32 31 28 L17 28 Q16 32 14 36 Z" fill={tone.main} />
        </>
      )}
      {rank === 'K' && (
        // Coroa do rei: 3 pontas + cruz
        <g>
          <path d="M14 21 L16 12 L20 17 L24 10 L28 17 L32 12 L34 21 Z" fill={tone.accent} stroke={tone.main} strokeWidth="1" />
          <rect x="23" y="4" width="2" height="5" fill={tone.accent} />
          <rect x="21.5" y="5.5" width="5" height="2" fill={tone.accent} />
        </g>
      )}
      {rank === 'Q' && (
        // Coroa da dama: tiara com pérolas
        <g>
          <path d="M15 20 L17 13 L24 16 L31 13 L33 20 Z" fill={tone.accent} stroke={tone.main} strokeWidth="1" />
          <circle cx="17" cy="12" r="1.6" fill={tone.accent} />
          <circle cx="24" cy="15" r="1.6" fill={tone.accent} />
          <circle cx="31" cy="12" r="1.6" fill={tone.accent} />
        </g>
      )}
      {rank === 'J' && (
        // Chapéu do valete: boina com pena
        <g>
          <path d="M13 22 Q14 13 24 13 Q34 13 35 22 L33 20 Q24 16 15 20 Z" fill={tone.main} />
          <path d="M32 14 Q37 6 42 8 Q38 12 34 16 Z" fill={tone.accent} />
          <circle cx="14" cy="21" r="1.8" fill={tone.accent} />
        </g>
      )}
    </svg>
  )
}

export function CardComponent({
  card,
  onClick,
  selected,
  index,
  sizeClassName,
  compactOnLandscape,
  cornerClassName,
  cornerLayout = 'column',
}: CardProps) {
  const suitClass = SUIT_COLOR_CLASS[card.suit]
  const cornerTextClass = cornerClassName
    ? cornerClassName
    : compactOnLandscape
      ? 'text-sm sm:text-base landscape:text-[10px] landscape:leading-none'
      : 'text-sm sm:text-base'
  const centerTextClass = compactOnLandscape
    ? 'text-4xl sm:text-5xl landscape:text-xl'
    : 'text-4xl sm:text-5xl'
  const cornerGap = compactOnLandscape ? 'left-2 top-1.5 landscape:left-1 landscape:top-0.5' : 'left-2 top-1.5'
  const cornerGapBottom = compactOnLandscape
    ? 'bottom-1.5 right-2 landscape:bottom-0.5 landscape:right-1'
    : 'bottom-1.5 right-2'
  // 'row': rank e naipe lado a lado, cabe numa faixa mais baixa (ver
  // CardProps.cornerLayout) — só em PAISAGEM (landscape:), onde a carta é
  // pequena e a sobreposição das colunas deixa pouca altura por carta. Em
  // retrato a carta é grande (sobra altura de sobra) e continua empilhada
  // (o layout tradicional de carta real), mesmo quando cornerLayout='row'.
  const cornerFlexClass = cornerLayout === 'row' ? 'flex-col landscape:flex-row landscape:gap-0.5' : 'flex-col'
  const suitSpacingClass = cornerLayout === 'row' ? '-mt-[0.1em] landscape:mt-0' : '-mt-[0.1em]'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.9 }}
      // A carta NÃO sobe ao ser selecionada — a seleção só a REALÇA (anel
      // dourado + leve zoom), sem mudar a altura da fileira (a mão fica em
      // "meia carta" fixa). Sem lift no hover também.
      animate={{ opacity: 1, y: 0, scale: selected ? 1.06 : 1 }}
      whileHover={{ scale: 1.08, zIndex: 40 }}
      whileTap={{ scale: 0.94 }}
      transition={{
        delay: (index ?? 0) * 0.04,
        type: 'spring',
        stiffness: 340,
        damping: 24,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-pressed={onClick ? Boolean(selected) : undefined}
      className={[
        sizeClassName ?? CARD_SIZE_CLASSES,
        'relative select-none rounded-xl border shadow-md',
        onClick ? 'cursor-pointer' : '',
        card.isWild
          ? 'border-purple-300/50 bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-800 text-white'
          : 'border-black/10 bg-card-face',
        selected ? 'z-20 shadow-[0_0_18px_rgba(212,175,55,0.95)] ring-4 ring-card-gold' : '',
      ].join(' ')}
    >
      {card.isWild ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-1">
          <JesterIllustration compactOnLandscape={compactOnLandscape} />
          <span
            className={
              compactOnLandscape
                ? 'text-[10px] font-black leading-none tracking-wide text-white drop-shadow sm:text-xs landscape:hidden'
                : 'text-[10px] font-black leading-none tracking-wide text-white drop-shadow sm:text-xs'
            }
          >
            CURINGA
          </span>
        </div>
      ) : (
        <>
          {/* Índice do canto (estilo carta real): rank em cima, naipe logo
              abaixo bem juntinho (leading tight + tucking), no topo-esquerdo e
              espelhado no rodapé-direito. */}
          <div className={`absolute flex items-center leading-[0.85] ${cornerFlexClass} ${cornerGap} ${suitClass}`}>
            <span className={`font-bold tracking-tight ${cornerTextClass}`}>{card.rank}</span>
            <span className={`${suitSpacingClass} ${cornerTextClass}`}>{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          <div
            className={`absolute flex rotate-180 items-center leading-[0.85] ${cornerFlexClass} ${cornerGapBottom} ${suitClass}`}
          >
            <span className={`font-bold tracking-tight ${cornerTextClass}`}>{card.rank}</span>
            <span className={`${suitSpacingClass} ${cornerTextClass}`}>{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          {/* Centro: figura ilustrada nas cartas de corte (J/Q/K, como num
              baralho impresso), naipe grande nas numéricas. */}
          {card.rank === 'J' || card.rank === 'Q' || card.rank === 'K' ? (
            <div className="flex h-full w-full items-center justify-center">
              <FaceCardIllustration
                rank={card.rank}
                suit={card.suit}
                compactOnLandscape={compactOnLandscape}
              />
            </div>
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center opacity-90 ${centerTextClass} ${suitClass}`}
            >
              {SUIT_SYMBOLS[card.suit]}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

/** Face-down card used for the draw pile / opponent's hand. Purely
 * decorative — same footprint as CardComponent so it lines up in rows.
 * `variant` gives the two physical decks (Buraco is played with 2 merged
 * 52-card decks + wilds) distinct back colors, blue and red, as on a real
 * casino table. */
export function CardBack({
  className = '',
  variant = 'blue',
  sizeClassName,
  compactOnLandscape,
}: {
  className?: string
  variant?: 'blue' | 'red'
  /** See CardComponent's `sizeClassName` — overrides the default footprint. */
  sizeClassName?: string
  /** See CardComponent's `compactOnLandscape` — shrinks the "B" glyph to
   * match, only in landscape orientation. */
  compactOnLandscape?: boolean
}) {
  return (
    <div
      className={[
        sizeClassName ?? CARD_SIZE_CLASSES,
        variant === 'blue' ? 'card-back-pattern-blue' : 'card-back-pattern-red',
        'rounded-xl border border-white/40 shadow-md',
        'flex items-center justify-center',
        className,
      ].join(' ')}
    >
      <span
        className={`font-display text-lg text-white/80 drop-shadow-sm ${compactOnLandscape ? 'landscape:text-xs' : ''}`}
      >
        B
      </span>
    </div>
  )
}
