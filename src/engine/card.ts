export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export class Card {
  constructor(
    readonly suit: Suit,
    readonly rank: Rank,
    readonly isWild: boolean = false
  ) {}

  toString(): string {
    return `${this.rank}${this.suit[0].toUpperCase()}`
  }

  equals(other: Card): boolean {
    return this.suit === other.suit && this.rank === other.rank && this.isWild === other.isWild
  }
}

export function createDeck(): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const deck: Card[] = []

  // 2 decks padrão
  for (let d = 0; d < 2; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(new Card(suit, rank, false))
      }
    }
  }

  // 4 curingas
  for (let i = 0; i < 4; i++) {
    deck.push(new Card('hearts', '2', true)) // Representa curinga
  }

  // Embaralhar
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}
