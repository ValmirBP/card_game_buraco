import { Card, Rank, Suit } from './card'

export function scoreCard(rank: Rank): number {
  if (rank === 'A') return 15
  if (rank === '2') return 10
  const num = parseInt(rank, 10)
  if (!isNaN(num)) {
    return num >= 8 ? 10 : 5
  }
  return 10
}

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

type AceMode = 'low' | 'high'

function sequenceRankValue(rank: Rank, aceMode: AceMode): number {
  if (rank === 'A') return aceMode === 'high' ? 14 : 1
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  const num = parseInt(rank, 10)
  return isNaN(num) ? 0 : num
}

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
    if (diff <= 0) return false
    gaps += diff - 1
  }

  return gaps <= wildCount
}

export type MeldType = 'sequence' | 'aces'

export interface MeldLayoutEntry {
  card: Card
  representsValue: number
}

export interface MeldAnalysis {
  type: MeldType
  isClean: boolean
  layout: MeldLayoutEntry[]
}

function analyzeAceTrio(others: Card[], twos: Card[], jokers: Card[]): MeldAnalysis | null {
  if (others.length === 0 || !others.every(c => c.rank === 'A')) return null
  if (others.length < 2 || others.length > 4) return null

  const totalWild = jokers.length + twos.length
  if (totalWild > 1) return null

  const wild = jokers[0] ?? twos[0]
  const layout: MeldLayoutEntry[] = others.map(c => ({ card: c, representsValue: 14 }))
  if (wild) layout.push({ card: wild, representsValue: 14 })

  return { type: 'aces', isClean: totalWild === 0, layout }
}

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
    if (diff <= 0) return null
    if (diff > 1) {
      gapCount += diff - 1
      if (diff === 2) wildValue = fullValues[i - 1] + 1
    }
  }
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

    if (genericWildCount === 0) {
      for (const aceMode of ['low', 'high'] as AceMode[]) {
        if (!trySequenceWithAceMode(others, 1, aceMode)) continue
        const realValues = others
          .map(c => sequenceRankValue(c.rank, aceMode))
          .sort((a, b) => a - b)
        const wildValue = computeWildValue(realValues, aceMode)
        const maxValue = Math.max(...realValues, wildValue)
        return buildSequenceAnalysis(others, natural2, aceMode, maxValue < 9)
      }
    }

    return null
  }

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

export function analyzeMeld(cards: Card[]): MeldAnalysis | null {
  if (cards.length < 3) return null

  const jokers = cards.filter(c => c.isWild)
  if (jokers.length > 1) return null

  const twos = cards.filter(c => c.rank === '2' && !c.isWild)
  const others = cards.filter(c => c.rank !== '2' && !c.isWild)

  return analyzeAceTrio(others, twos, jokers) ?? analyzeSequence(others, twos, jokers)
}

export function resolveMeldLayout(cards: Card[]): MeldLayoutEntry[] | null {
  return analyzeMeld(cards)?.layout ?? null
}

export function isValidCanasta(cards: Card[]): boolean {
  return analyzeMeld(cards) !== null
}

export function canExtendMeld(existing: Card[], added: Card[]): boolean {
  if (added.length === 0) return false
  return isValidCanasta([...existing, ...added])
}

export type CanastaKind = 'simples' | 'limpa' | 'suja' | 'quinhentos' | 'real'

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
