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
    expect(canasta.points).toBe(5 + 5 + 5) // 3..7 = 5 each; no bonus below 7 cards
    expect(canasta.getScore()).toBe(canasta.points)
  })

  test('[A,2,3,4,5,6,7] hearts -> clean canastra (natural 2), +200 bonus', () => {
    const cards = [real('A'), two('hearts'), real('3'), real('4'), real('5'), real('6'), real('7')]
    const canasta = new Canasta(cards)
    expect(canasta.isCanastra).toBe(true)
    expect(canasta.isClean).toBe(true)
    // A=15, natural 2=10 ("2 = 10, curinga ou natural, sempre 10"), 3..7=5 each
    const cardSum = 15 + 10 + 5 + 5 + 5 + 5 + 5
    expect(canasta.points).toBe(cardSum + 200)
    expect(canasta.kind).toBe('limpa')
  })

  test('[5,6,7,8,9,10,J] hearts -> clean canastra, +200 bonus', () => {
    const cards = [real('5'), real('6'), real('7'), real('8'), real('9'), real('10'), real('J')]
    const canasta = new Canasta(cards)
    expect(canasta.isCanastra).toBe(true)
    expect(canasta.isClean).toBe(true)
    const cardSum = 5 + 5 + 5 + 10 + 10 + 10 + 10 // 5,6,7=5 each; 8,9,10,J=10 each
    expect(canasta.points).toBe(cardSum + 200)
    expect(canasta.kind).toBe('limpa')
  })

  test('[5,6,2♠,8,9,10,J] hearts -> dirty canastra (2♠ wild fills the 7 gap), +100 bonus', () => {
    const cards = [real('5'), real('6'), two('spades'), real('8'), real('9'), real('10'), real('J')]
    const canasta = new Canasta(cards)
    expect(canasta.isCanastra).toBe(true)
    expect(canasta.isClean).toBe(false)
    const cardSum = 5 + 5 + 10 + 10 + 10 + 10 + 10 // wild 2 = 10 (not a joker)
    expect(canasta.points).toBe(cardSum + 100)
    expect(canasta.kind).toBe('suja')
  })

  test('[5,6,JOKER,8,9,10,J] hearts -> dirty canastra, +100 bonus', () => {
    const cards = [real('5'), real('6'), joker(), real('8'), real('9'), real('10'), real('J')]
    const canasta = new Canasta(cards)
    expect(canasta.isCanastra).toBe(true)
    expect(canasta.isClean).toBe(false)
    const cardSum = 5 + 5 + 20 + 10 + 10 + 10 + 10 // joker = 20
    expect(canasta.points).toBe(cardSum + 100)
    expect(canasta.kind).toBe('suja')
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

  test('aceita K,A,2 same-suit como Q-K-A (2 vira a Q, suja) — não é wrap', () => {
    const cards = [real('K'), real('A'), two('hearts')]
    const canasta = new Canasta(cards)
    expect(canasta.isClean).toBe(false)
    expect(canasta.layout.find(e => e.card.rank === '2')!.representsValue).toBe(12)
  })

  test('recognizes an ace-both-ends sequence (Q,K,A)', () => {
    const cards = [real('Q'), real('K'), real('A')]
    const canasta = new Canasta(cards)
    expect(canasta.type).toBe('sequence')
  })

  describe('special canastras: quinhentos (+500) and real (+1000)', () => {
    test('13-card clean run 2..A (ace-high end) -> kind "quinhentos", +500 bonus', () => {
      const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
      const cards = ranks.map(r => real(r))
      const canasta = new Canasta(cards)
      expect(canasta.cards).toHaveLength(13)
      expect(canasta.isClean).toBe(true)
      expect(canasta.kind).toBe('quinhentos')
      // 2=10, 3-7=5 each (25), 8/9/10/J/Q/K=10 each (60), A=15
      const cardSum = 10 + 25 + 60 + 15
      expect(canasta.points).toBe(cardSum + 500)
    })

    test('14-card clean run A..K..A (ace at both ends) -> kind "real", +1000 bonus', () => {
      const middle = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const
      const cards = [real('A'), ...middle.map(r => real(r)), real('A')]
      const canasta = new Canasta(cards)
      expect(canasta.cards).toHaveLength(14)
      expect(canasta.isClean).toBe(true)
      expect(canasta.kind).toBe('real')
      // 2 aces = 30, 2=10, 3-7=25, 8/9/10/J/Q/K=60
      const cardSum = 30 + 10 + 25 + 60
      expect(canasta.points).toBe(cardSum + 1000)
    })

    test('a dirty double-ace canastra never qualifies as quinhentos/real -> falls back to "suja"', () => {
      const middle = ['2', '3', '4', '5', '6', '8', '9', '10', 'J', 'Q', 'K'] as const // missing 7
      const cards = [real('A'), ...middle.map(r => real(r)), real('A'), joker()]
      const canasta = new Canasta(cards)
      expect(canasta.cards).toHaveLength(14)
      expect(canasta.isClean).toBe(false)
      expect(canasta.kind).toBe('suja')
    })
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

  describe('Part A/B: 2-mesmo-naipe curinga, regra do 9, sujeira permanente', () => {
    test('[6♠,2♠,8♠] -> valid, clean, layout represents 7', () => {
      const cards = [real('6', 'spades'), two('spades'), real('8', 'spades')]
      const canasta = new Canasta(cards)
      expect(canasta.isClean).toBe(true)
      expect(canasta.layout.map(l => l.representsValue)).toEqual([6, 7, 8])
    })

    test('extending [6♠,2♠,8♠] with 7♠ -> curinga desliza para representar 5, continua limpa', () => {
      const cards = [real('6', 'spades'), two('spades'), real('8', 'spades')]
      const canasta = new Canasta(cards)
      const extended = canasta.withExtraCards([real('7', 'spades')])
      expect(extended.isClean).toBe(true)
      expect(extended.layout.map(l => l.representsValue)).toEqual([5, 6, 7, 8])
    })

    test('extending further with 9♠ (2 ainda curinga fora de posicao) -> SUJA permanentemente', () => {
      const cards = [real('6', 'spades'), two('spades'), real('7', 'spades'), real('8', 'spades')]
      const canasta = new Canasta(cards) // clean, 2 represents 5
      const extended = canasta.withExtraCards([real('9', 'spades')])
      expect(extended.isClean).toBe(false)
    })

    test('once dirtied by the 9-rule, stays dirty even if later cards would let the 2 look natural', () => {
      const cards = [real('6', 'spades'), two('spades'), real('7', 'spades'), real('8', 'spades')]
      const canasta = new Canasta(cards)
      const dirtied = canasta.withExtraCards([real('9', 'spades')])
      expect(dirtied.isClean).toBe(false)

      // Now add A,3,4,5 - a fresh analysis of the full card set (A,2,3,4,5,6,7,8,9)
      // would say the 2 is natural (clean), but the meld must stay dirty forever.
      const further = dirtied.withExtraCards([
        real('A', 'spades'),
        real('3', 'spades'),
        real('4', 'spades'),
        real('5', 'spades'),
      ])
      expect(further.isClean).toBe(false)
    })

    test('joker still dirties a canastra (unaffected by Part A)', () => {
      const cards = [real('5'), real('6'), joker(), real('8'), real('9'), real('10'), real('J')]
      const canasta = new Canasta(cards)
      expect(canasta.isClean).toBe(false)
    })

    test('a 2 already at its natural position never dirties even when a 9 is added', () => {
      const cards = [
        real('A', 'spades'),
        two('spades'),
        real('3', 'spades'),
        real('4', 'spades'),
        real('5', 'spades'),
        real('6', 'spades'),
        real('7', 'spades'),
        real('8', 'spades'),
      ]
      const canasta = new Canasta(cards)
      expect(canasta.isClean).toBe(true)
      const extended = canasta.withExtraCards([real('9', 'spades')])
      expect(extended.isClean).toBe(true)
    })

    test('clone preserves permanent dirty state', () => {
      const cards = [real('6', 'spades'), two('spades'), real('7', 'spades'), real('8', 'spades')]
      const canasta = new Canasta(cards)
      const dirtied = canasta.withExtraCards([real('9', 'spades')])
      const cloned = dirtied.clone()
      expect(cloned.isClean).toBe(false)
    })
  })
})
