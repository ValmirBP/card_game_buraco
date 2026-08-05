import { Card, Rank, Suit } from './card'

export function scoreCard(rank: Rank): number {
  if (rank === 'A') return 15
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10
  if (rank === '2') return 20 // Curinga
  const num = parseInt(rank, 10)
  return isNaN(num) ? 0 : num
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

export interface MeldAnalysis {
  type: MeldType
  isClean: boolean
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

  return { type: 'aces', isClean: totalWild === 0 }
}

/**
 * Same-suit consecutive sequence check. `others` are the non-2, non-wild
 * cards, which must all share one suit - that suit becomes the meld's suit
 * for isWildInMeld purposes. Any '2' of that same suit is a *candidate* to
 * be the natural rank-2 card (only one such candidate may actually be used
 * as natural - a duplicate can't be demoted to wild, since a same-suit 2
 * out of position isn't allowed to stand in as a generic wild, only
 * cross-suit 2s and jokers can). Tries both Ace interpretations (low:
 * A-2-3..., high: ...Q-K-A) when no natural 2 is involved; a natural 2
 * only makes sense under the ace-low interpretation.
 */
function analyzeSequence(others: Card[], twos: Card[], jokers: Card[]): MeldAnalysis | null {
  if (others.length === 0) return null

  const suit = others[0].suit
  if (!others.every(c => c.suit === suit)) return null

  const otherRanks = others.map(c => c.rank)
  if (new Set(otherRanks).size !== otherRanks.length) return null

  const naturalCandidates = twos.filter(c => !isWildInMeld(c, suit, 2))
  const wildTwos = twos.filter(c => isWildInMeld(c, suit, 2))
  if (naturalCandidates.length > 1) return null

  const totalWild = jokers.length + wildTwos.length
  if (totalWild > 1) return null

  if (naturalCandidates.length === 1) {
    const realCards = [...others, naturalCandidates[0]]
    if (trySequenceWithAceMode(realCards, totalWild, 'low')) {
      return { type: 'sequence', isClean: totalWild === 0 }
    }
    return null
  }

  if (
    trySequenceWithAceMode(others, totalWild, 'low') ||
    trySequenceWithAceMode(others, totalWild, 'high')
  ) {
    return { type: 'sequence', isClean: totalWild === 0 }
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
 * Canastra bonus: a meld only becomes a "canastra" at 7+ cards. Below that
 * there is no bonus (only the card values themselves count). A 7+ card
 * canastra scores 200 if clean (no curinga at all) or 100 if dirty (exactly
 * 1 curinga - joker or wild-2).
 */
export function canastaPoints(isClean: boolean, cardCount: number): number {
  if (cardCount < 7) return 0
  return isClean ? 200 : 100
}
