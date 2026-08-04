import { Card } from './card'
import { isValidCanasta, canastaPoints, scoreCard } from './utils'

export class Canasta {
  readonly cards: Card[]
  readonly isClean: boolean
  readonly points: number

  constructor(cards: Card[]) {
    if (!isValidCanasta(cards)) {
      throw new Error('Invalid canasta: must have 3+ cards, same suit, consecutive')
    }
    this.cards = [...cards]
    this.isClean = !cards.some(c => c.isWild)
    this.points = canastaPoints(this.isClean)
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

  clone(): Canasta {
    return new Canasta([...this.cards])
  }
}
