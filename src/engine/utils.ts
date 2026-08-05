import { Card, Rank } from './card'

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
 * Trinca de ases: 3+ Aces of any suits form a valid meld on their own,
 * independent of the normal same-suit/consecutive sequence rules. This is an
 * exception that applies only to the Ace rank.
 */
function isValidAceTrio(realCards: Card[]): boolean {
  if (realCards.length === 0) return false
  return realCards.every(c => c.rank === 'A')
}

/**
 * Same-suit consecutive sequence check, trying both Ace interpretations
 * (low: A-2-3..., high: ...Q-K-A) since a meld containing an Ace may be
 * valid under one interpretation and not the other.
 */
function isValidSequence(realCards: Card[], wildCount: number): boolean {
  const suit = realCards[0].suit
  if (!realCards.every(c => c.suit === suit)) return false

  // No duplicate ranks among real cards.
  const ranks = realCards.map(c => c.rank)
  if (new Set(ranks).size !== ranks.length) return false

  return (
    trySequenceWithAceMode(realCards, wildCount, 'low') ||
    trySequenceWithAceMode(realCards, wildCount, 'high')
  )
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

/**
 * Validates whether a set of cards forms a legal Buraco meld:
 *  - 3+ cards total
 *  - at most 1 wild card
 *  - at least 2 real (non-wild) cards
 *  - either: a same-suit consecutive sequence (Ace may be low A-2-3 or high
 *    ...Q-K-A, gaps filled by the wild), OR
 *  - a trio (3+) of Aces of any suit (exception: only Aces get this rule).
 */
export function isValidCanasta(cards: Card[]): boolean {
  if (cards.length < 3) return false

  const realCards = cards.filter(c => !c.isWild)
  const wilds = cards.filter(c => c.isWild)

  if (wilds.length > 1) return false
  if (realCards.length < 2) return false

  if (isValidAceTrio(realCards)) return true

  return isValidSequence(realCards, wilds.length)
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

export function canastaPoints(isClean: boolean): number {
  return isClean ? 500 : 300
}
