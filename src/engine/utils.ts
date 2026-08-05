import { Card, Rank, Suit } from './card'

/**
 * Card-value table per the official Buraco Aberto Jogatina rules:
 *  - Ace = 15
 *  - K, Q, J, 10, 9, 8 = 10 each
 *  - 7, 6, 5, 4, 3 = 5 each
 *  - 2 = 10 (curinga or natural, always 10)
 *
 * NOTE (retrocompatibility): this rank-only signature cannot distinguish a
 * joker from a '2' - both are represented with rank '2' in this engine (see
 * createDeck), differing only by `Card.isWild`. Since a joker is worth 20
 * (not 10), callers that need the correct joker value MUST use
 * `scoreCardValue(card)` instead, which looks at `isWild`. This function is
 * kept exactly as-is (rank-based, '2' -> 10) for backward compatibility with
 * existing callers (e.g. the store's AI discard-lowest-value heuristic) that
 * only ever pass a Rank.
 */
export function scoreCard(rank: Rank): number {
  if (rank === 'A') return 15
  if (rank === '2') return 10
  const num = parseInt(rank, 10)
  if (!isNaN(num)) {
    return num >= 8 ? 10 : 5 // 8,9,10 = 10; 3..7 = 5
  }
  return 10 // K, Q, J
}

/**
 * Correct point value of a specific card, distinguishing a joker
 * (`isWild === true`, worth 20) from every other card (looked up via
 * `scoreCard(rank)`, where a '2' - curinga or natural - is worth 10). This is
 * the value that MUST be used for canasta scoring and hand-penalty
 * calculations; `scoreCard(rank)` alone under-values jokers.
 */
export function scoreCardValue(card: Card): number {
  if (card.isWild) return 20
  return scoreCard(card.rank)
}

export function rankToNumber(rank: Rank): number {
  if (rank === 'A') return 14
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  const num = parseInt(rank, 10)
  return isNaN(num) ? 0 : num
}

export function isConsecutive(r1: Rank, r2: Rank): boolean {
  return Math.abs(rankToNumber(r1) - rankToNumber(r2)) === 1
}

type AceMode = 'low' | 'high'

/**
 * Numeric value of a rank for sequence purposes, given how the Ace is being
 * interpreted for this particular check. Non-ace ranks are unaffected by
 * aceMode. Ace-high: ...Q(12)-K(13)-A(14). Ace-low: A(1)-2(2)-3(3)...
 */
function sequenceRankValue(rank: Rank, aceMode: AceMode): number {
  if (rank === 'A') return aceMode === 'high' ? 14 : 1
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  const num = parseInt(rank, 10)
  return isNaN(num) ? 0 : num
}

/**
 * Curingas = os 4 jokers (isWild=true) e todas as cartas de rank '2'.
 * Um '2' é NATURAL (não curinga) somente quando está no naipe do jogo
 * (meldSuit) E ocupa a posição do rank 2 dentro da sequência (positionValue
 * === 2, ou seja, imediatamente após o Ás no modo ace-low: A,2,3...).
 * Em qualquer outra posição, ou de naipe diferente, o 2 conta como curinga.
 * Jokers são sempre curinga, independente de posição/naipe.
 */
export function isWildInMeld(card: Card, meldSuit: Suit, positionValue: number): boolean {
  if (card.isWild) return true
  if (card.rank !== '2') return false
  return !(card.suit === meldSuit && positionValue === 2)
}

function trySequenceWithAceMode(realCards: Card[], wildCount: number, aceMode: AceMode): boolean {
  const sorted = [...realCards].sort(
    (a, b) => sequenceRankValue(a.rank, aceMode) - sequenceRankValue(b.rank, aceMode)
  )

  let gaps = 0
  for (let i = 1; i < sorted.length; i++) {
    const diff = sequenceRankValue(sorted[i].rank, aceMode) - sequenceRankValue(sorted[i - 1].rank, aceMode)
    // diff <= 0 means two cards collapsed to the same numeric value under
    // this ace interpretation (e.g. a hand with both an Ace-as-1 and a
    // literal 1 doesn't exist, but guard anyway) - reject this branch.
    if (diff <= 0) return false
    gaps += diff - 1
  }

  return gaps <= wildCount
}

export type MeldType = 'sequence' | 'aces'

/**
 * One card's slot in the canonical (ascending) display order of a meld.
 * `representsValue` is the sequence-rank-value the card occupies (for a
 * curinga, the value of the real card it stands in for; for an ace-trio
 * meld every entry is 14, since there's no notion of "position").
 */
export interface MeldLayoutEntry {
  card: Card
  representsValue: number
}

export interface MeldAnalysis {
  type: MeldType
  isClean: boolean
  layout: MeldLayoutEntry[]
}

/**
 * Trinca de ases: 2+ real Aces (of any suits) plus at most 1 wild (a joker,
 * or a '2' - which can never be a "natural ace", so any '2' present here
 * always counts against the 1-wild budget) form a valid meld. This is an
 * exception that applies only to the Ace rank; it doesn't care about suit.
 */
function analyzeAceTrio(others: Card[], twos: Card[], jokers: Card[]): MeldAnalysis | null {
  if (others.length === 0 || !others.every(c => c.rank === 'A')) return null
  if (others.length < 2) return null

  const totalWild = jokers.length + twos.length
  if (totalWild > 1) return null

  const wild = jokers[0] ?? twos[0]
  const layout: MeldLayoutEntry[] = others.map(c => ({ card: c, representsValue: 14 }))
  if (wild) layout.push({ card: wild, representsValue: 14 })

  return { type: 'aces', isClean: totalWild === 0, layout }
}

/**
 * Computes the numeric value a lone curinga represents within a sequence,
 * given the sorted values of the real cards. If there's exactly one
 * internal gap (a single missing rank between two real cards), the curinga
 * fills it. Otherwise (the real cards are already fully consecutive and the
 * curinga is "extra"/redundant) the curinga slides down to the smallest
 * available slot just below the lowest real card - unless that would fall
 * outside the valid range, in which case it goes just above the highest
 * real card instead. This implements the "desce" (slides down) behaviour:
 * re-running this after adding a real card that fills the curinga's old
 * slot naturally produces the next-lowest slot.
 */
function computeWildValue(sortedRealValues: number[], aceMode: AceMode): number {
  for (let i = 1; i < sortedRealValues.length; i++) {
    const diff = sortedRealValues[i] - sortedRealValues[i - 1]
    if (diff === 2) return sortedRealValues[i - 1] + 1
  }

  const min = sortedRealValues[0]
  const max = sortedRealValues[sortedRealValues.length - 1]
  const floor = aceMode === 'low' ? 1 : 2
  if (min - 1 >= floor) return min - 1
  return max + 1
}

function buildLayout(
  reals: Card[],
  wild: Card | undefined,
  aceMode: AceMode,
  wildValue: number | undefined
): MeldLayoutEntry[] {
  const entries: MeldLayoutEntry[] = reals.map(c => ({
    card: c,
    representsValue: sequenceRankValue(c.rank, aceMode),
  }))
  if (wild && wildValue !== undefined) {
    entries.push({ card: wild, representsValue: wildValue })
  }
  entries.sort((a, b) => a.representsValue - b.representsValue)
  return entries
}

function buildSequenceAnalysis(
  reals: Card[],
  wild: Card | undefined,
  aceMode: AceMode,
  isClean: boolean
): MeldAnalysis {
  const sortedReals = [...reals].sort(
    (a, b) => sequenceRankValue(a.rank, aceMode) - sequenceRankValue(b.rank, aceMode)
  )
  const values = sortedReals.map(c => sequenceRankValue(c.rank, aceMode))
  const wildValue = wild ? computeWildValue(values, aceMode) : undefined
  return {
    type: 'sequence',
    isClean,
    layout: buildLayout(sortedReals, wild, aceMode, wildValue),
  }
}

/**
 * Same-suit consecutive sequence check. `others` are the non-2, non-wild
 * cards, which must all share one suit - that suit becomes the meld's suit.
 * A '2' of that same suit is tried under two interpretations, preferring
 * whichever validates first:
 *
 *  1. NATURAL - the 2 sits at its own rank-2 slot (ace-low). Never dirties
 *     the meld, regardless of any '9' present.
 *  2. CURINGA (Part A) - the 2 stands in for a missing card elsewhere in
 *     the sequence, exactly like a joker/cross-suit 2, EXCEPT it does not
 *     dirty the meld UNLESS a real '9' of that suit is also present ("regra
 *     do 9") - in which case the meld becomes dirty. This interpretation is
 *     only reachable when the 2 is the sole curinga (budget of 1 already
 *     spent on it), since a same-suit 2 can never be demoted to a generic
 *     wild alongside another joker/cross-suit 2.
 *
 * A same-suit 2 can only ever be used once (either as natural OR as
 * curinga) - a second same-suit 2 in the same meld is always invalid.
 * Cross-suit 2s are always curinga, same as a joker.
 */
/**
 * "Ás nas duas pontas": when a same-suit sequence has exactly 2 Aces, one
 * sits fixed as the LOW anchor (value 1, before the 2) and the other as the
 * HIGH anchor (value 14, after the K) - producing a run of up to 14 cards
 * (A,2,3...K,A). Unlike a normal sequence, there's no "which end" ambiguity
 * and no sliding room past either anchor, since both ends are already
 * occupied by a real Ace: a lone curinga can only fill an internal gap
 * between the anchors, never sit outside them. A natural same-suit 2 (at its
 * own position-2 slot, between the two anchors) never dirties, matching the
 * user's kept exception; a joker or cross-suit 2 (the meld's one allowed
 * curinga) dirties as usual. K-A-2 "dar a volta" style wrapping is still
 * impossible here since the low/high anchors are fixed at 1 and 14 - a 2
 * can never sit adjacent to the high-Ace anchor.
 */
function analyzeDoubleAceSequence(
  aces: Card[],
  rest: Card[],
  twos: Card[],
  jokers: Card[]
): MeldAnalysis | null {
  const restRanks = rest.map(c => c.rank)
  if (new Set(restRanks).size !== restRanks.length) return null

  const suit = aces[0].suit
  const sameSuitTwos = twos.filter(c => c.suit === suit)
  const crossSuitTwos = twos.filter(c => c.suit !== suit)
  if (sameSuitTwos.length > 1) return null

  const genericWild = jokers[0] ?? crossSuitTwos[0]
  const genericWildCount = jokers.length + crossSuitTwos.length
  if (genericWildCount > 1) return null

  const realRest = sameSuitTwos.length === 1 ? [...rest, sameSuitTwos[0]] : rest
  const sortedValues = realRest.map(c => sequenceRankValue(c.rank, 'high')).sort((a, b) => a - b)

  const fullValues = [1, ...sortedValues, 14]
  let gapCount = 0
  let wildValue: number | null = null
  for (let i = 1; i < fullValues.length; i++) {
    const diff = fullValues[i] - fullValues[i - 1]
    if (diff <= 0) return null // duplicate value - shouldn't happen given rank dedupe above
    if (diff > 1) {
      gapCount += diff - 1
      if (diff === 2) wildValue = fullValues[i - 1] + 1
    }
  }
  // No sliding room past the fixed Ace anchors: an unused wild can't be
  // placed anywhere, so the gap count must match the wild budget exactly.
  if (gapCount !== genericWildCount) return null

  const isClean = genericWildCount === 0

  const entries: MeldLayoutEntry[] = [
    { card: aces[0], representsValue: 1 },
    ...realRest.map(c => ({ card: c, representsValue: sequenceRankValue(c.rank, 'high') })),
    { card: aces[1], representsValue: 14 },
  ]
  if (genericWild && wildValue !== null) {
    entries.push({ card: genericWild, representsValue: wildValue })
  }
  entries.sort((a, b) => a.representsValue - b.representsValue)

  return { type: 'sequence', isClean, layout: entries }
}

function analyzeSequence(others: Card[], twos: Card[], jokers: Card[]): MeldAnalysis | null {
  if (others.length === 0) return null

  const suit = others[0].suit
  if (!others.every(c => c.suit === suit)) return null

  const aceCards = others.filter(c => c.rank === 'A')
  if (aceCards.length === 2) {
    const rest = others.filter(c => c.rank !== 'A')
    return analyzeDoubleAceSequence(aceCards, rest, twos, jokers)
  }
  if (aceCards.length > 2) return null

  const otherRanks = others.map(c => c.rank)
  if (new Set(otherRanks).size !== otherRanks.length) return null

  const sameSuitTwos = twos.filter(c => c.suit === suit)
  const crossSuitTwos = twos.filter(c => c.suit !== suit)
  if (sameSuitTwos.length > 1) return null

  const genericWild = jokers[0] ?? crossSuitTwos[0]
  const genericWildCount = jokers.length + crossSuitTwos.length

  if (sameSuitTwos.length === 1) {
    const natural2 = sameSuitTwos[0]

    // Interpretation 1 (preferred): natural 2 at its own rank-2 slot.
    if (genericWildCount <= 1) {
      const realCards = [...others, natural2]
      if (trySequenceWithAceMode(realCards, genericWildCount, 'low')) {
        return buildSequenceAnalysis(
          realCards,
          genericWildCount === 1 ? genericWild : undefined,
          'low',
          genericWildCount === 0
        )
      }
    }

    // Interpretation 2 (Part A): the 2 acts as the sequence's sole curinga.
    // Only reachable when it's the ONLY wild in the meld (budget = 1).
    // Restricted to ace-LOW numbering only: allowing this under ace-HIGH
    // would reintroduce "dar a volta" (e.g. K,A,2 wrapping the 2 around
    // from the top of the sequence back past the Ace), which is illegal.
    if (genericWildCount === 0 && trySequenceWithAceMode(others, 1, 'low')) {
      const hasReal9 = others.some(c => c.rank === '9')
      return buildSequenceAnalysis(others, natural2, 'low', !hasReal9)
    }

    return null
  }

  // No same-suit 2 present: only cross-suit 2s / jokers can be the curinga.
  if (genericWildCount > 1) return null

  for (const aceMode of ['low', 'high'] as AceMode[]) {
    if (trySequenceWithAceMode(others, genericWildCount, aceMode)) {
      return buildSequenceAnalysis(
        others,
        genericWildCount === 1 ? genericWild : undefined,
        aceMode,
        genericWildCount === 0
      )
    }
  }
  return null
}

/**
 * Full analysis of whether `cards` form a legal Buraco meld, and if so
 * whether it's clean (no wild cards at all - a natural 2 in its own
 * position doesn't count as wild) and which type (sequence or ace trio).
 * Returns null when invalid.
 *
 * Curingas = the 4 jokers (isWild=true) AND every '2' - except a '2' that
 * sits in its own suit at the rank-2 slot of a sequence, which is natural.
 * At most 1 curinga total (joker or wild-2) is ever allowed in one meld.
 */
export function analyzeMeld(cards: Card[]): MeldAnalysis | null {
  if (cards.length < 3) return null

  const jokers = cards.filter(c => c.isWild)
  if (jokers.length > 1) return null

  const twos = cards.filter(c => c.rank === '2' && !c.isWild)
  const others = cards.filter(c => c.rank !== '2' && !c.isWild)

  return analyzeAceTrio(others, twos, jokers) ?? analyzeSequence(others, twos, jokers)
}

/**
 * Convenience wrapper over analyzeMeld exposing just the canonical display
 * order (ascending) and, for each card, the sequence value it represents -
 * for a curinga, the value of the real card it's standing in for. Returns
 * null for an invalid meld. Consumers (UI) use this to draw the curinga in
 * the correct visual slot.
 */
export function resolveMeldLayout(cards: Card[]): MeldLayoutEntry[] | null {
  return analyzeMeld(cards)?.layout ?? null
}

/**
 * Validates whether a set of cards forms a legal Buraco meld:
 *  - 3+ cards total
 *  - at most 1 curinga (joker, or a '2' not in its natural own-suit
 *    position-2 slot)
 *  - at least 2 real (non-curinga) cards
 *  - either: a same-suit consecutive sequence (Ace may be low A-2-3 or high
 *    ...Q-K-A, gaps filled by the curinga), OR
 *  - a trio (2+) of Aces of any suit (exception: only Aces get this rule).
 */
export function isValidCanasta(cards: Card[]): boolean {
  return analyzeMeld(cards) !== null
}

/**
 * Validates whether adding `added` cards to an `existing` valid meld keeps it
 * a valid meld (extended sequence, or an ace trio with more aces added).
 * Used by Game.extendMeld to let a player add cards from their hand to an
 * already-played meld belonging to their team.
 */
export function canExtendMeld(existing: Card[], added: Card[]): boolean {
  if (added.length === 0) return false
  return isValidCanasta([...existing, ...added])
}

/**
 * Canastra "kind" for bonus/UI purposes:
 *  - 'simples': fewer than 7 cards - not a canastra yet, no bonus.
 *  - 'quinhentos': clean 13-card run from 2 to Ace (ace-high end), no
 *    curinga at all - e.g. 2,3,4...K,A of one suit.
 *  - 'real': clean 14-card run from Ace to Ace (one Ace at each end,
 *    "duplicated" - see the ace-both-ends sequence support in
 *    analyzeSequence), no curinga at all.
 *  - 'limpa': any other clean 7+ card canastra.
 *  - 'suja': any dirty (1 curinga) 7+ card canastra.
 */
export type CanastaKind = 'simples' | 'limpa' | 'suja' | 'quinhentos' | 'real'

/**
 * `layout` isn't actually needed to tell quinhentos/real apart from a plain
 * "limpa" canastra: a single suit only has 13 distinct ranks, so a clean
 * (wild-free), gapless, same-suit sequence can only reach 13 cards by using
 * every rank of that suit exactly once (a "quinhentos", 2..K..A regardless
 * of whether the Ace displays low or high - same 13-card set either way),
 * and can only reach 14 cards via the double-ace path (a "real", the only
 * way to fit a 14th same-suit card is a duplicated Ace anchoring both
 * ends). It's kept as a parameter for API stability / future use (e.g. if
 * ace-trio melds ever needed a distinct large-count kind).
 */
export function computeCanastaKind(
  cardCount: number,
  isClean: boolean,
  _layout: MeldLayoutEntry[]
): CanastaKind {
  if (cardCount < 7) return 'simples'
  if (!isClean) return 'suja'
  if (cardCount === 14) return 'real'
  if (cardCount === 13) return 'quinhentos'
  return 'limpa'
}

/**
 * Canastra bonus: a meld only becomes a "canastra" at 7+ cards. Below that
 * there is no bonus (only the card values themselves count). Otherwise:
 *  - 'real' (Ace-to-Ace, 14 cards, clean): +1000
 *  - 'quinhentos' (2-to-Ace, 13 cards, clean): +500
 *  - 'limpa' / 'simples' fallback at 7+ cards (clean, no special pattern): +200
 *  - 'suja' (1 curinga): +100
 */
export function canastaPoints(kind: CanastaKind, cardCount: number): number {
  if (cardCount < 7) return 0
  switch (kind) {
    case 'real':
      return 1000
    case 'quinhentos':
      return 500
    case 'suja':
      return 100
    default:
      return 200
  }
}
