import { Card, Rank, Suit } from '../../src/engine/card'
import { isValidCanasta, canExtendMeld, isWildInMeld, analyzeMeld, resolveMeldLayout } from '../../src/engine/utils'

function real(rank: Rank, suit: Suit = 'hearts') {
  return new Card(suit, rank, false)
}

function joker() {
  return new Card('hearts', '2', true)
}

function two(suit: Suit) {
  return new Card(suit, '2', false)
}

describe('isWildInMeld', () => {
  test('a joker is always wild', () => {
    expect(isWildInMeld(joker(), 'hearts', 2)).toBe(true)
    expect(isWildInMeld(joker(), 'hearts', 5)).toBe(true)
  })

  test('a non-2 real card is never wild', () => {
    expect(isWildInMeld(real('5'), 'hearts', 5)).toBe(false)
  })

  test('a 2 of the meld suit at position 2 is natural (not wild)', () => {
    expect(isWildInMeld(two('hearts'), 'hearts', 2)).toBe(false)
  })

  test('a 2 of the meld suit NOT at position 2 is wild', () => {
    expect(isWildInMeld(two('hearts'), 'hearts', 5)).toBe(true)
  })

  test('a 2 of a different suit is always wild, even at position 2', () => {
    expect(isWildInMeld(two('spades'), 'hearts', 2)).toBe(true)
  })
})

describe('isValidCanasta', () => {
  test('[5,6,7] same suit -> true (clean sequence)', () => {
    const cards = [real('5'), real('6'), real('7')]
    expect(isValidCanasta(cards)).toBe(true)
  })

  test('[5,7,JOKER] -> true (joker fills the 6 gap)', () => {
    const cards = [real('5'), real('7'), joker()]
    expect(isValidCanasta(cards)).toBe(true)
  })

  test('[5,6,JOKER] -> true (joker extends to 4 or 7)', () => {
    const cards = [real('5'), real('6'), joker()]
    expect(isValidCanasta(cards)).toBe(true)
  })

  test('[5,6,7,9,JOKER] -> true (joker fills the 8 gap)', () => {
    const cards = [real('5'), real('6'), real('7'), real('9'), joker()]
    expect(isValidCanasta(cards)).toBe(true)
  })

  test('[5,6] -> false (less than 3 cards)', () => {
    const cards = [real('5'), real('6')]
    expect(isValidCanasta(cards)).toBe(false)
  })

  test('[5,JOKER,JOKER] -> false (only 1 real card + 2 wilds is invalid)', () => {
    const cards = [real('5'), joker(), joker()]
    expect(isValidCanasta(cards)).toBe(false)
  })

  test('[5,8,JOKER] -> false (gap of 2, only 1 wild available)', () => {
    const cards = [real('5'), real('8'), joker()]
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

  test('more than 1 joker is always invalid', () => {
    const cards = [real('5'), real('6'), real('7'), joker(), joker()]
    expect(isValidCanasta(cards)).toBe(false)
  })

  describe('Ace at both ends', () => {
    test('[Q,K,A] same suit -> true (ace high)', () => {
      const cards = [real('Q'), real('K'), real('A')]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[A,3,4] same suit -> true (ace low, no 2 involved)', () => {
      const cards = [real('A'), real('3'), real('4'), joker()]
      // needs the joker to fill the "2" gap since no natural 2 present
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

    test('[J,Q,K,JOKER] -> true (extra wild not required but still valid)', () => {
      const cards = [real('J'), real('Q'), real('K'), joker()]
      expect(isValidCanasta(cards)).toBe(true)
    })
  })

  describe('Ace trio (trinca de ases)', () => {
    test('[A♥,A♦,A♣] -> true (3 aces, any suits)', () => {
      const cards = [real('A', 'hearts'), real('A', 'diamonds'), real('A', 'clubs')]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[A♥,A♦,JOKER] -> true (2 aces + 1 joker)', () => {
      const cards = [real('A', 'hearts'), real('A', 'diamonds'), joker()]
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

    test('[A♥,A♦,JOKER,JOKER] -> false (more than 1 wild never allowed)', () => {
      const cards = [real('A', 'hearts'), real('A', 'diamonds'), joker(), joker()]
      expect(isValidCanasta(cards)).toBe(false)
    })

    test('[K♥,K♦,K♣] -> false (trio exception only applies to aces)', () => {
      const cards = [real('K', 'hearts'), real('K', 'diamonds'), real('K', 'clubs')]
      expect(isValidCanasta(cards)).toBe(false)
    })
  })

  describe('2 as wild (curinga)', () => {
    test('[A♥,2♥,3♥] -> true, natural 2 (own suit, position 2)', () => {
      const cards = [real('A'), two('hearts'), real('3')]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[5♥,6♥,2♠] -> true, 2♠ is wild (different suit) filling the 7 gap', () => {
      const cards = [real('5'), real('6'), two('spades')]
      expect(isValidCanasta(cards)).toBe(true)
    })

    test('[K♥,A♥,2♥] "dar a volta" -> false, same-suit 2 out of natural position cannot act as wild', () => {
      const cards = [real('K'), real('A'), two('hearts')]
      expect(isValidCanasta(cards)).toBe(false)
    })

    test('[5♥,2♠,JOKER,8♥,9♥,10♥,J♥] -> false, two wilds (2♠ + joker) in the same meld', () => {
      const cards = [real('5'), two('spades'), joker(), real('8'), real('9'), real('10'), real('J')]
      expect(isValidCanasta(cards)).toBe(false)
    })

    test('two same-suit 2s in one meld -> false (only 1 can be natural, extra cannot be wild)', () => {
      const cards = [real('A'), two('hearts'), two('hearts'), real('3'), real('4')]
      expect(isValidCanasta(cards)).toBe(false)
    })

    test('ace trio with a 2 as wild support: [A,A,2any] -> true', () => {
      const cards = [real('A', 'hearts'), real('A', 'diamonds'), two('clubs')]
      expect(isValidCanasta(cards)).toBe(true)
    })
  })
})

describe('Part A: 2-do-mesmo-naipe como curinga nao suja', () => {
  test('[6♠,2♠,8♠] -> valid, isClean true (2♠ tapando o 7, mesmo naipe)', () => {
    const cards = [real('6', 'spades'), two('spades'), real('8', 'spades')]
    const analysis = analyzeMeld(cards)
    expect(analysis).not.toBeNull()
    expect(analysis!.isClean).toBe(true)
  })

  test('joker still dirties a sequence (Part A.2)', () => {
    const cards = [real('6', 'spades'), joker(), real('8', 'spades')]
    const analysis = analyzeMeld(cards)
    expect(analysis).not.toBeNull()
    expect(analysis!.isClean).toBe(false)
  })

  test('2 of a DIFFERENT suit still dirties (Part A.2)', () => {
    const cards = [real('6', 'spades'), real('7', 'spades'), two('hearts'), real('9', 'spades')]
    const analysis = analyzeMeld(cards)
    expect(analysis).not.toBeNull()
    expect(analysis!.isClean).toBe(false)
  })

  test('Regra do 9: 2-mesmo-naipe curinga + 9 real presente -> suja', () => {
    const cards = [two('spades'), real('6', 'spades'), real('7', 'spades'), real('8', 'spades'), real('9', 'spades')]
    const analysis = analyzeMeld(cards)
    expect(analysis).not.toBeNull()
    expect(analysis!.isClean).toBe(false)
  })

  test('Regra do 9 NAO se aplica quando o 2 esta na posicao natural', () => {
    const cards = [
      real('A', 'spades'),
      two('spades'),
      real('3', 'spades'),
      real('4', 'spades'),
      real('5', 'spades'),
      real('6', 'spades'),
      real('7', 'spades'),
      real('8', 'spades'),
      real('9', 'spades'),
    ]
    const analysis = analyzeMeld(cards)
    expect(analysis).not.toBeNull()
    expect(analysis!.isClean).toBe(true)
  })
})

describe('Part B: layout / resolveMeldLayout - curinga desliza para a menor posicao', () => {
  test('[6♠,2♠,8♠] -> 2♠ representa o 7 (unico gap)', () => {
    const cards = [real('6', 'spades'), two('spades'), real('8', 'spades')]
    const layout = resolveMeldLayout(cards)!
    expect(layout.map(l => l.representsValue)).toEqual([6, 7, 8])
    const wildEntry = layout.find(l => l.card.rank === '2')!
    expect(wildEntry.representsValue).toBe(7)
  })

  test('[6♠,2♠,7♠,8♠] -> 2♠ desliza para representar o 5 (sem gap interno)', () => {
    const cards = [real('6', 'spades'), two('spades'), real('7', 'spades'), real('8', 'spades')]
    const layout = resolveMeldLayout(cards)!
    expect(layout.map(l => l.representsValue)).toEqual([5, 6, 7, 8])
    const wildEntry = layout.find(l => l.card.rank === '2')!
    expect(wildEntry.representsValue).toBe(5)
  })

  test('natural 2 (own position) has representsValue 2', () => {
    const cards = [real('A', 'spades'), two('spades'), real('3', 'spades')]
    const layout = resolveMeldLayout(cards)!
    expect(layout.map(l => l.representsValue)).toEqual([1, 2, 3])
  })
})

describe('canExtendMeld', () => {
  test('extends a clean sequence with the next card', () => {
    const existing = [real('5'), real('6'), real('7')]
    expect(canExtendMeld(existing, [real('8')])).toBe(true)
  })

  test('extends ace-low sequence at the top with more cards', () => {
    const existing = [real('A'), two('hearts'), real('3')]
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
    const existing = [real('5'), real('7'), joker()]
    expect(canExtendMeld(existing, [joker()])).toBe(false)
  })

  test('extends ace trio with another ace', () => {
    const existing = [real('A', 'hearts'), real('A', 'diamonds'), real('A', 'clubs')]
    expect(canExtendMeld(existing, [real('A', 'spades')])).toBe(true)
  })

  test('rejects non-consecutive extension', () => {
    const existing = [real('5'), real('6'), real('7')]
    expect(canExtendMeld(existing, [real('9')])).toBe(false)
  })

  test('extending a dirty meld with a normal card keeps it dirty (wild card never removed)', () => {
    const existing = [real('5'), real('6'), two('spades'), real('8'), real('9'), real('10'), real('J')]
    expect(canExtendMeld(existing, [real('4')])).toBe(true)
  })
})
