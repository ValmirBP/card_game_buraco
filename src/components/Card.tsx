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

/** Posição dos NAIPES REPETIDOS (pips) no corpo da carta, por rank, em
 * porcentagem [x, y] da face — o layout clássico de baralho impresso
 * (2 colunas + coluna central pros ímpares), como na foto de referência do
 * usuário. A/J/Q/K não usam pips (ver o JSX: naipe central único grande). */
const PIP_POSITIONS: Record<string, Array<[number, number]>> = {
  '2': [
    [50, 28],
    [50, 72],
  ],
  '3': [
    [50, 22],
    [50, 50],
    [50, 78],
  ],
  '4': [
    [32, 28],
    [68, 28],
    [32, 72],
    [68, 72],
  ],
  '5': [
    [32, 25],
    [68, 25],
    [50, 50],
    [32, 75],
    [68, 75],
  ],
  '6': [
    [32, 24],
    [68, 24],
    [32, 50],
    [68, 50],
    [32, 76],
    [68, 76],
  ],
  '7': [
    [32, 22],
    [68, 22],
    [50, 36],
    [32, 52],
    [68, 52],
    [32, 80],
    [68, 80],
  ],
  '8': [
    [32, 20],
    [68, 20],
    [50, 33],
    [32, 47],
    [68, 47],
    [50, 61],
    [32, 80],
    [68, 80],
  ],
  '9': [
    [32, 18],
    [68, 18],
    [32, 40],
    [68, 40],
    [50, 51],
    [32, 62],
    [68, 62],
    [32, 84],
    [68, 84],
  ],
  '10': [
    [32, 18],
    [68, 18],
    [50, 29],
    [32, 40],
    [68, 40],
    [32, 62],
    [68, 62],
    [50, 73],
    [32, 84],
    [68, 84],
  ],
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
  // Naipe central: em paisagem a carta é pequena (56x68 na mão) e mostrada
  // em "meia carta", então um glifo grande demais tomava conta dela toda -
  // o usuário reclamou de "naipes muito grandes". text-sm mantém o naipe
  // legível e proporcional ao rank do canto.
  const centerTextClass = compactOnLandscape
    ? 'text-2xl sm:text-3xl landscape:text-sm'
    : 'text-2xl sm:text-3xl'
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
        // rounded-md (não -xl): pontas menos arredondadas, pedido do usuário.
        'relative select-none rounded-md border shadow-md',
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
              espelhado no rodapé-direito.
              O tamanho da fonte vai no CONTAINER e o naipe usa 0.78em: assim
              ele fica sempre PROPORCIONALMENTE menor que o rank, em qualquer
              contexto (mão, mesa, descarte), como numa carta impressa - antes
              os dois tinham o mesmo tamanho e o naipe pesava demais. */}
          <div
            className={`absolute flex items-center leading-[0.85] ${cornerFlexClass} ${cornerGap} ${suitClass} ${cornerTextClass}`}
          >
            <span className="font-bold tracking-tight">{card.rank}</span>
            <span className={`${suitSpacingClass} text-[0.78em]`}>{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          <div
            className={`absolute flex rotate-180 items-center leading-[0.85] ${cornerFlexClass} ${cornerGapBottom} ${suitClass} ${cornerTextClass}`}
          >
            <span className="font-bold tracking-tight">{card.rank}</span>
            <span className={`${suitSpacingClass} text-[0.78em]`}>{SUIT_SYMBOLS[card.suit]}</span>
          </div>
          {/* Corpo da carta. Em PAISAGEM (o jogo de verdade, cartas
              pequenas): um ÚNICO naipe central — os naipes repetidos (pips)
              viravam poluição visual nesse tamanho ("tem muito desenho na
              carta", feedback do usuário). Em RETRATO (cartas grandes, ex.:
              leque do menu), as numéricas 2-10 mantêm os pips estilo baralho
              impresso, onde há espaço pra eles respirarem. */}
          {PIP_POSITIONS[card.rank] && (
            <div className="relative h-full w-full landscape:hidden" aria-hidden="true">
              {PIP_POSITIONS[card.rank].map(([x, y], pi) => (
                <span
                  key={pi}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 text-sm leading-none sm:text-base ${suitClass}`}
                  style={{ left: `${x}%`, top: `${y}%` }}
                >
                  {SUIT_SYMBOLS[card.suit]}
                </span>
              ))}
            </div>
          )}
          <div
            className={`h-full w-full items-center justify-center opacity-90 ${
              PIP_POSITIONS[card.rank] ? 'hidden landscape:flex' : 'flex'
            } ${centerTextClass} ${suitClass}`}
          >
            {SUIT_SYMBOLS[card.suit]}
          </div>
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
        'rounded-md border border-white/40 shadow-md',
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
