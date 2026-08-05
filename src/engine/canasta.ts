import { Card } from './card'
import { analyzeMeld, canExtendMeld, canastaPoints, scoreCard } from './utils'

export type CanastaType = 'sequence' | 'aces'

export class Canasta {
  readonly cards: Card[]
  readonly isClean: boolean
  readonly isCanastra: boolean
  readonly points: number
  readonly type: CanastaType

  constructor(cards: Card[]) {
    const analysis = analyzeMeld(cards)
    if (!analysis) {
      throw new Error(
        'Invalid canasta: must have 3+ cards, same suit consecutive sequence (ace high or low), or a trio of aces, with at most 1 curinga (joker or non-natural 2)'
      )
    }
    this.cards = [...cards]
    this.isClean = analysis.isClean
    this.type = analysis.type
    this.isCanastra = this.cards.length >= 7

    const cardSum = this.cards.reduce((sum, c) => sum + scoreCard(c.rank), 0)
    const bonus = canastaPoints(this.isClean, this.cards.length)
    this.points = cardSum + bonus
  }

  getScore(): number {
    // points já inclui o valor das cartas + bônus de canastra (200/100 a
    // partir de 7 cartas; 0 abaixo disso).
    return this.points
  }

  /**
   * Returns a new Canasta with `added` cards merged in, validating that the
   * combination is still a legal meld (extended sequence, or an ace trio
   * with more aces). Throws if the extension would be invalid. Does not
   * mutate this instance. A dirty (unclean) meld stays dirty when extended -
   * its curinga is never removed, only recomputed from the full card set.
   */
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
