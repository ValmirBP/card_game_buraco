import { Card } from './card'

export class Hand {
  private cards: Card[] = []

  constructor(initialCards: Card[] = []) {
    this.cards = [...initialCards]
  }

  addCard(card: Card): void {
    this.cards.push(card)
  }

  removeCard(index: number): Card | null {
    if (index < 0 || index >= this.cards.length) return null
    return this.cards.splice(index, 1)[0]
  }

  getCards(): Card[] {
    return [...this.cards]
  }

  getSize(): number {
    return this.cards.length
  }

  isEmpty(): boolean {
    return this.cards.length === 0
  }

  clone(): Hand {
    return new Hand([...this.cards])
  }
}
