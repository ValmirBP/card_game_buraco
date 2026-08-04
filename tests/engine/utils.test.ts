import { Card, Rank, Suit } from '../../src/engine/card'
import { isValidCanasta } from '../../src/engine/utils'

function real(rank: Rank, suit: Suit = 'hearts') {
  return new Card(suit, rank, false)
}

function wild() {
  return new Card('hearts', '2', true)
}

describe('isValidCanasta', () => {
  test('[5,6,7] same suit -> true (clean sequence)', () => {
    const cards = [real('5'), real('6'), real('7')]
    expect(isValidCanasta(cards)).toBe(true)
  })

  test('[5,7,W] -> true (wild fills the 6 gap)', () => {
    const cards = [real('5'), real('7'), wild()]
    expect(isValidCanasta(cards)).toBe(true)
  })

  test('[5,6,W] -> true (wild extends to 4 or 7)', () => {
    const cards = [real('5'), real('6'), wild()]
    expect(isValidCanasta(cards)).toBe(true)
  })

  test('[5,6,7,9,W] -> true (wild fills the 8 gap)', () => {
    const cards = [real('5'), real('6'), real('7'), real('9'), wild()]
    expect(isValidCanasta(cards)).toBe(true)
  })

  test('[5,6] -> false (less than 3 cards)', () => {
    const cards = [real('5'), real('6')]
    expect(isValidCanasta(cards)).toBe(false)
  })

  test('[5,W,W] -> false (only 1 real card + 2 wilds is invalid)', () => {
    const cards = [real('5'), wild(), wild()]
    expect(isValidCanasta(cards)).toBe(false)
  })

  test('[5,8,W] -> false (gap of 2, only 1 wild available)', () => {
    const cards = [real('5'), real('8'), wild()]
    expect(isValidCanasta(cards)).toBe(false)
  })

  test('[5♥,6♦,7♥] -> false (different suits)', () => {
    const cards = [real('5', 'hearts'), real('6', 'diamonds'), real('7', 'hearts')]
    expect(isValidCanasta(cards)).toBe(false)
  })

  test('[5,5,6] -> false (duplicate rank among real cards)', () => {
    const cards = [real('5'), real('5'), real('6')]
    expect(isValidCanasta(cards)).toBe(false)
  })

  test('more than 1 wild card is always invalid, regardless of real card count', () => {
    const cards = [real('5'), real('6'), real('7'), wild(), wild()]
    expect(isValidCanasta(cards)).toBe(false)
  })
})
