import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

function real(rank: any, suit: any = 'hearts') {
  return new Card(suit, rank, false)
}

function joker() {
  return new Card('hearts', '2', true)
}

function two(suit: any) {
  return new Card(suit, '2', false)
}

describe('Canasta', () => {
  test('[5,6,7] -> valid meld, not a canastra, clean, points = card sum', () => {
    const cards = [real('5'), real('6'), real('7')]
    const canasta = new Canasta(cards)
    expect(canasta.isCanastra).toBe(false)
    expect(canasta.isClean).toBe(true)
    expect(canasta.points).toBe(5 + 6 + 7) // no bonus below 7 cards
    expect(canasta.getScore()).toBe(canasta.points)
  })

  test('[A,2,3,4,5,6,7] hearts -> clean canastra (natural 2), +200 bonus', () => {
    const cards = [real('A'), two('hearts'), real('3'), real('4'), real('5'), real('6'), real('7')]
    const canasta = new Canasta(cards)
    expect(canasta.isCanastra).toBe(true)
    expect(canasta.isClean).toBe(true)
    const cardSum = 15 + 20 + 3 + 4 + 5 + 6 + 7
    expect(canasta.points).toBe(cardSum + 200)
  })

  test('[5,6,7,8,9,10,J] hearts -> clean canastra, +200 bonus', () => {
    const cards = [real('5'), real('6'), real('7'), real('8'), real('9'), real('10'), real('J')]
    const canasta = new Canasta(cards)
    expect(canasta.isCanastra).toBe(true)
    expect(canasta.isClean).toBe(true)
    const cardSum = 5 + 6 + 7 + 8 + 9 + 10 + 10 // J=10
    expect(canasta.points).toBe(cardSum + 200)
  })

  test('[5,6,2♠,8,9,10,J] hearts -> dirty canastra (2♠ wild fills the 7 gap), +100 bonus', () => {
    const cards = [real('5'), real('6'), two('spades'), real('8'), real('9'), real('10'), real('J')]
    const canasta = new Canasta(cards)
    expect(canasta.isCanastra).toBe(true)
    expect(canasta.isClean).toBe(false)
    const cardSum = 5 + 6 + 20 + 8 + 9 + 10 + 10
    expect(canasta.points).toBe(cardSum + 100)
  })

  test('[5,6,JOKER,8,9,10,J] hearts -> dirty canastra, +100 bonus', () => {
    const cards = [real('5'), real('6'), joker(), real('8'), real('9'), real('10'), real('J')]
    const canasta = new Canasta(cards)
    expect(canasta.isCanastra).toBe(true)
    expect(canasta.isClean).toBe(false)
    const cardSum = 5 + 6 + 20 + 8 + 9 + 10 + 10
    expect(canasta.points).toBe(cardSum + 100)
  })

  test('[A♠,A♥,A♦] -> ace trio meld, not a canastra (<7 cards)', () => {
    const cards = [real('A', 'spades'), real('A', 'hearts'), real('A', 'diamonds')]
    const canasta = new Canasta(cards)
    expect(canasta.type).toBe('aces')
    expect(canasta.isCanastra).toBe(false)
    expect(canasta.isClean).toBe(true)
    expect(canasta.points).toBe(15 * 3)
  })

  test('throws error if less than 3 cards', () => {
    const cards = [real('5'), real('6')]
    expect(() => new Canasta(cards)).toThrow()
  })

  test('throws error if cards not consecutive', () => {
    const cards = [real('5'), real('7'), real('8')]
    expect(() => new Canasta(cards)).toThrow()
  })

  test('throws error if different suits', () => {
    const cards = [real('5'), real('6', 'diamonds'), real('7')]
    expect(() => new Canasta(cards)).toThrow()
  })

  test('throws for K,K,K trio (only aces allowed)', () => {
    const cards = [real('K', 'hearts'), real('K', 'diamonds'), real('K', 'clubs')]
    expect(() => new Canasta(cards)).toThrow()
  })

  test('throws for K,A,2 same-suit "dar a volta"', () => {
    const cards = [real('K'), real('A'), two('hearts')]
    expect(() => new Canasta(cards)).toThrow()
  })

  test('recognizes an ace-both-ends sequence (Q,K,A)', () => {
    const cards = [real('Q'), real('K'), real('A')]
    const canasta = new Canasta(cards)
    expect(canasta.type).toBe('sequence')
  })

  describe('withExtraCards', () => {
    test('extends a sequence meld (3 -> 4 cards), still not a canastra', () => {
      const cards = [real('5'), real('6'), real('7')]
      const canasta = new Canasta(cards)
      const extended = canasta.withExtraCards([real('8')])
      expect(extended.cards).toHaveLength(4)
      expect(extended.isCanastra).toBe(false)
      // original is untouched
      expect(canasta.cards).toHaveLength(3)
    })

    test('extending a meld up to 7 cards makes it a canastra', () => {
      const cards = [real('5'), real('6'), real('7'), real('8'), real('9'), real('10')]
      const canasta = new Canasta(cards)
      expect(canasta.isCanastra).toBe(false)
      const extended = canasta.withExtraCards([real('J')])
      expect(extended.isCanastra).toBe(true)
      expect(extended.isClean).toBe(true)
    })

    test('extending a dirty canastra with a normal card keeps it dirty', () => {
      const cards = [real('5'), real('6'), two('spades'), real('8'), real('9'), real('10'), real('J')]
      const canasta = new Canasta(cards)
      expect(canasta.isClean).toBe(false)
      const extended = canasta.withExtraCards([real('4')])
      expect(extended.isClean).toBe(false)
      expect(extended.isCanastra).toBe(true)
    })

    test('extends an ace trio with another ace', () => {
      const cards = [real('A', 'hearts'), real('A', 'diamonds'), real('A', 'clubs')]
      const canasta = new Canasta(cards)
      const extended = canasta.withExtraCards([real('A', 'spades')])
      expect(extended.cards).toHaveLength(4)
      expect(extended.type).toBe('aces')
    })

    test('throws when the extension would be invalid', () => {
      const cards = [real('5'), real('6'), real('7')]
      const canasta = new Canasta(cards)
      expect(() => canasta.withExtraCards([real('8', 'diamonds')])).toThrow()
    })
  })
})
