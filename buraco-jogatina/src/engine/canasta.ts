import { Card } from './card'
import {
  analyzeMeld,
  canExtendMeld,
  canastaPoints,
  computeCanastaKind,
  scoreCardValue,
  CanastaKind,
  MeldLayoutEntry,
} from './utils'

export type CanastaType = 'sequence' | 'aces'

export class Canasta {
  readonly cards: Card[]
  readonly isClean: boolean
  readonly isCanastra: boolean
  readonly points: number
  readonly type: CanastaType
  readonly layout: MeldLayoutEntry[]
  readonly kind: CanastaKind

  constructor(cards: Card[]) {
    const analysis = analyzeMeld(cards)
    if (!analysis) {
      throw new Error(
        'Invalid canasta: must have 3+ cards, same suit consecutive sequence (ace high or low), or a trio of aces, with at most 1 curinga (joker or non-natural 2)'
      )
    }
    this.cards = [...cards]
    this.type = analysis.type
    this.layout = analysis.layout

    this.isClean = analysis.isClean

    this.isCanastra = this.cards.length >= 7
    this.kind = computeCanastaKind(this.cards.length, this.isClean, this.layout)

    const cardSum = this.cards.reduce((sum, c) => sum + scoreCardValue(c), 0)
    const bonus = canastaPoints(this.kind, this.cards.length)
    this.points = cardSum + bonus
  }

  getScore(): number {
    return this.points
  }

  withExtraCards(added: Card[]): Canasta {
    if (!canExtendMeld(this.cards, added)) {
      throw new Error('Invalid meld extension')
    }
    return new Canasta([...this.cards, ...added])
  }

  clone(): Canasta {
    return new Canasta([...this.cards])
  }
}
