import type { Card } from '../engine/card'
import type { PlainCard } from '../session/types'

/**
 * The wire protocol's `PlainCard` (session/types.ts) intentionally types
 * `suit`/`rank` as plain `string` since it's JSON-serializable and has no
 * compile-time link to the engine's `Suit`/`Rank` unions. At runtime the
 * server only ever sends valid values (it serializes real engine `Card`s),
 * so this is a safe narrowing cast for handing a `PlainCard` to UI
 * components/engine helpers (CardComponent, canExtendMeld, ...) that expect
 * an engine `Card`-shaped object and only ever read its fields.
 */
export function asCard(card: PlainCard): Card {
  return card as unknown as Card
}

export function asCards(cards: PlainCard[]): Card[] {
  return cards as unknown as Card[]
}
