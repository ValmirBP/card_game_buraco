import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

describe('Canasta', () => {
  test('creates valid canasta with 3 consecutive cards', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '7', false),
    ]
    const canasta = new Canasta(cards)
    expect(canasta.isClean).toBe(true)
    expect(canasta.points).toBe(500)
  })

  test('marks canasta as dirty if has wild cards', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '2', true), // wild
    ]
    const canasta = new Canasta(cards)
    expect(canasta.isClean).toBe(false)
    expect(canasta.points).toBe(300)
  })

  test('throws error if less than 3 cards', () => {
    const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false)]
    expect(() => new Canasta(cards)).toThrow()
  })

  test('throws error if cards not consecutive', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '7', false), // gap
      new Card('hearts', '8', false),
    ]
    expect(() => new Canasta(cards)).toThrow()
  })

  test('throws error if different suits', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('diamonds', '6', false),
      new Card('hearts', '7', false),
    ]
    expect(() => new Canasta(cards)).toThrow()
  })
})
