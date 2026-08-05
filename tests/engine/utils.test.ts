import { Card, Rank, Suit } from '../../src/engine/card'
import { isValidCanasta, canExtendMeld } from '../../src/engine/utils'

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

  describe('Ace at both ends', () => {
    test('[Q,K,A] same suit -> true (ace high)', () => {
      const cards = [real('Q'), real('K'), real('A')]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[A,2,3] same suit -> true (ace low)', () => {
      const cards = [real('A'), real('2'), real('3')]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[A,K,Q] unordered -> true (ace high, order independent)', () => {
      const cards = [real('A'), real('K'), real('Q')]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[Q,A,3] same suit -> false (ace cannot bridge Q and 3)', () => {
      const cards = [real('Q'), real('A'), real('3')]
      expect(isValidCanasta(cards)).toBe(false)
    })

    test('[J,Q,K,W] -> true (ace-high branch not required, wild fills nothing needed but still valid seq)', () => {
      const cards = [real('J'), real('Q'), real('K'), wild()]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[K,A,W] -> true (wild extends ace-high sequence, e.g. J/Q gap filled from other side not needed; K-A adjacent with wild extending)', () => {
      // K,A adjacent (ace high) with an extra wild simply extending validity
      const cards = [real('K'), real('A'), wild()]
      expect(isValidCanasta(cards)).toBe(true)
    })
  })

  describe('Ace trio (trinca de ases)', () => {
    test('[A♥,A♦,A♣] -> true (3 aces, any suits)', () => {
      const cards = [real('A', 'hearts'), real('A', 'diamonds'), real('A', 'clubs')]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[A♥,A♦,W] -> true (2 aces + 1 wild)', () => {
      const cards = [real('A', 'hearts'), real('A', 'diamonds'), wild()]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[A♥,A♦,A♣,A♠] -> true (4 aces)', () => {
      const cards = [
        real('A', 'hearts'),
        real('A', 'diamonds'),
        real('A', 'clubs'),
        real('A', 'spades'),
      ]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[A♥,A♦,W,W] -> false (more than 1 wild never allowed)', () => {
      const cards = [real('A', 'hearts'), real('A', 'diamonds'), wild(), wild()]
      expect(isValidCanasta(cards)).toBe(false)
    })

    test('[K♥,K♦,K♣] -> false (trio exception only applies to aces)', () => {
      const cards = [real('K', 'hearts'), real('K', 'diamonds'), real('K', 'clubs')]
      expect(isValidCanasta(cards)).toBe(false)
    })
  })
})

describe('canExtendMeld', () => {
  test('extends a clean sequence with the next card', () => {
    const existing = [real('5'), real('6'), real('7')]
    expect(canExtendMeld(existing, [real('8')])).toBe(true)
  })

  test('extends ace-low sequence at the top with more cards', () => {
    const existing = [real('A'), real('2'), real('3')]
    expect(canExtendMeld(existing, [real('4')])).toBe(true)
  })

  test('extends ace-high sequence downward', () => {
    const existing = [real('Q'), real('K'), real('A')]
    expect(canExtendMeld(existing, [real('J')])).toBe(true)
  })

  test('rejects extension that breaks suit rule', () => {
    const existing = [real('5'), real('6'), real('7')]
    expect(canExtendMeld(existing, [real('8', 'diamonds')])).toBe(false)
  })

  test('rejects extension that would add a 2nd wild when meld already has one', () => {
    const existing = [real('5'), real('7'), wild()]
    expect(canExtendMeld(existing, [wild()])).toBe(false)
  })

  test('extends ace trio with another ace', () => {
    const existing = [real('A', 'hearts'), real('A', 'diamonds'), real('A', 'clubs')]
    expect(canExtendMeld(existing, [real('A', 'spades')])).toBe(true)
  })

  test('rejects non-consecutive extension', () => {
    const existing = [real('5'), real('6'), real('7')]
    expect(canExtendMeld(existing, [real('9')])).toBe(false)
  })
})
