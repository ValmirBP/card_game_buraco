import { Card } from './card'
import { isValidCanasta, canExtendMeld, canastaPoints, scoreCard } from './utils'

export type CanastaType = 'sequence' | 'aces'

export class Canasta {
  readonly cards: Card[]
  readonly isClean: boolean
  readonly points: number
  readonly type: CanastaType

  constructor(cards: Card[]) {
    if (!isValidCanasta(cards)) {
      throw new Error('Invalid canasta: must have 3+ cards, same suit consecutive sequence (ace high or low), or a trio of aces')
    }
    this.cards = [...cards]
    this.isClean = !cards.some(c => c.isWild)
    this.points = canastaPoints(this.isClean)
    this.type = cards.filter(c => !c.isWild).every(c => c.rank === 'A') ? 'aces' : 'sequence'
  }

  getScore(): number {
    // Pontuação é: valor das cartas + bônus canasta
    let score = 0
    for (const card of this.cards) {
      score += scoreCard(card.rank)
    }
    score += this.points
    return score
  }

  /**
   * Returns a new Canasta with `added` cards merged in, validating that the
   * combination is still a legal meld (extended sequence, or an ace trio
   * with more aces). Throws if the extension would be invalid. Does not
   * mutate this instance.
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
