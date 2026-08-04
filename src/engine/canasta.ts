import { Card } from './card'
import { isValidCanasta, canastaPoints } from './utils'

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
      score += this.cardValue(card)
    }
    score += this.points
    return score
  }

  private cardValue(card: Card): number {
    if (card.rank === 'A') return 15
    if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 10
    if (card.rank === '2') return 20
    const num = parseInt(card.rank, 10)
    return isNaN(num) ? 0 : num
  }

  clone(): Canasta {
    return new Canasta([...this.cards])
  }
}
