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
    expect(canasta.type).toBe('sequence')
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

  test('recognizes an ace trio meld with type "aces"', () => {
    const cards = [
      new Card('hearts', 'A', false),
      new Card('diamonds', 'A', false),
      new Card('clubs', 'A', false),
    ]
    const canasta = new Canasta(cards)
    expect(canasta.type).toBe('aces')
    expect(canasta.isClean).toBe(true)
  })

  test('recognizes an ace-both-ends sequence (Q,K,A)', () => {
    const cards = [
      new Card('hearts', 'Q', false),
      new Card('hearts', 'K', false),
      new Card('hearts', 'A', false),
    ]
    const canasta = new Canasta(cards)
    expect(canasta.type).toBe('sequence')
  })

  describe('withExtraCards', () => {
    test('extends a sequence meld and returns a new valid Canasta', () => {
      const cards = [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
      ]
      const canasta = new Canasta(cards)
      const extended = canasta.withExtraCards([new Card('hearts', '8', false)])
      expect(extended.cards).toHaveLength(4)
      expect(extended.type).toBe('sequence')
      // original is untouched
      expect(canasta.cards).toHaveLength(3)
    })

    test('extends an ace trio with another ace', () => {
      const cards = [
        new Card('hearts', 'A', false),
        new Card('diamonds', 'A', false),
        new Card('clubs', 'A', false),
      ]
      const canasta = new Canasta(cards)
      const extended = canasta.withExtraCards([new Card('spades', 'A', false)])
      expect(extended.cards).toHaveLength(4)
      expect(extended.type).toBe('aces')
    })

    test('throws when the extension would be invalid', () => {
      const cards = [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
      ]
      const canasta = new Canasta(cards)
      expect(() => canasta.withExtraCards([new Card('diamonds', '8', false)])).toThrow()
    })
  })
})
