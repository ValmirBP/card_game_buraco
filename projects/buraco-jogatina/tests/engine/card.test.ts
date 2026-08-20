import { Card, createDeck } from '../../src/engine/card'

describe('Card', () => {
  test('creates card with suit and rank', () => {
    const card = new Card('hearts', '5', false)
    expect(card.suit).toBe('hearts')
    expect(card.rank).toBe('5')
    expect(card.isWild).toBe(false)
  })

  test('toString returns formatted card', () => {
    const card = new Card('hearts', 'K', false)
    expect(card.toString()).toBe('KH')
  })

  test('equals checks all properties', () => {
    const c1 = new Card('hearts', '5', false)
    const c2 = new Card('hearts', '5', false)
    const c3 = new Card('hearts', '5', true)
    expect(c1.equals(c2)).toBe(true)
    expect(c1.equals(c3)).toBe(false)
  })
})

describe('createDeck', () => {
  test('creates 108 cards (2 decks + 4 wilds)', () => {
    const deck = createDeck()
    expect(deck.length).toBe(108)
  })

  test('has 104 non-wild cards (2 decks of 52)', () => {
    const deck = createDeck()
    const nonWilds = deck.filter(c => !c.isWild)
    expect(nonWilds.length).toBe(104)
    // Each card value appears twice (2 decks)
    const set = new Set(nonWilds.map(c => c.toString()))
    expect(set.size).toBe(52)
  })
})
