import type { Card } from '../engine/card'
import type { PlainCard } from '../session/types'

export function asCard(card: PlainCard): Card {
  return card as unknown as Card
}

export function asCards(cards: PlainCard[]): Card[] {
  return cards as unknown as Card[]
}
