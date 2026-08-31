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

  describe('sequências altas com Ás (regra do usuário: Q-K-A pode descer)', () => {
    test('[Q,K,A] mesmo naipe -> válida, limpa, Ás alto (12-13-14)', () => {
      const cards = [real('Q', 'spades'), real('K', 'spades'), real('A', 'spades')]
      const canasta = new Canasta(cards)
      expect(canasta.isClean).toBe(true)
      expect(canasta.layout.map(l => l.representsValue)).toEqual([12, 13, 14])
    })

    test('[J,Q,K] estende com A (Ás alto no topo)', () => {
      const canasta = new Canasta([real('J', 'hearts'), real('Q', 'hearts'), real('K', 'hearts')])
      const extended = canasta.withExtraCards([real('A', 'hearts')])
      expect(extended.cards).toHaveLength(4)
      expect(extended.isClean).toBe(true)
    })

    test('[Q,K,A] estende com J (cresce pra baixo)', () => {
      const canasta = new Canasta([real('Q', 'clubs'), real('K', 'clubs'), real('A', 'clubs')])
      const extended = canasta.withExtraCards([real('J', 'clubs')])
      expect(extended.layout.map(l => l.representsValue)).toEqual([11, 12, 13, 14])
    })
  })

  describe('Part A/B: 2-mesmo-naipe curinga, regra do 9, e a volta pra limpa (regra oficial)', () => {
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

    test('extending further with 9♠ (2 ainda curinga fora de posicao) -> SUJA', () => {
      const cards = [real('6', 'spades'), two('spades'), real('7', 'spades'), real('8', 'spades')]
      const canasta = new Canasta(cards) // clean, 2 represents 5
      const extended = canasta.withExtraCards([real('9', 'spades')])
      expect(extended.isClean).toBe(false)
    })

    // Regra oficial do Jogatina: "No caso das canastras sujas que usam o 2
    // como curinga, caso este 2 seja do mesmo naipe da canastra, esta
    // poderá se tornar limpa, quando a carta que o 2 estiver substituindo
    // for comprada, e se formada uma sequência completa a partir do 2."
    // isClean é sempre recalculado do zero a partir da composição atual -
    // nunca gruda suja pra sempre - então completar a sequência que faltava
    // limpa a canastra de volta, mesmo depois de ter sujado pela regra do 9.
    test('suja pela regra do 9 volta a ficar limpa se a sequência se completa depois (2 desliza pro natural)', () => {
      const cards = [real('6', 'spades'), two('spades'), real('7', 'spades'), real('8', 'spades')]
      const canasta = new Canasta(cards)
      const dirtied = canasta.withExtraCards([real('9', 'spades')])
      expect(dirtied.isClean).toBe(false)

      // Completa a sequência até o Ás: agora o 2 cabe na própria posição
      // natural (A,2,3,4,5,6,7,8,9), sem sobrar buraco nenhum - limpa.
      const further = dirtied.withExtraCards([
        real('A', 'spades'),
        real('3', 'spades'),
        real('4', 'spades'),
        real('5', 'spades'),
      ])
      expect(further.isClean).toBe(true)
      expect(further.layout.map(l => l.representsValue)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    test('joker still dirties a canastra (unaffected by Part A) - e NUNCA reanalisa como limpa', () => {
      const cards = [real('5'), real('6'), joker(), real('8'), real('9'), real('10'), real('J')]
      const canasta = new Canasta(cards)
      expect(canasta.isClean).toBe(false)

      // Ao contrário do 2 do mesmo naipe, um joker nunca "vira" carta
      // natural de um naipe - completar a sequência ao redor dele não
      // limpa a canastra, porque ele continua sendo necessário ali.
      const extended = canasta.withExtraCards([real('7')])
      expect(extended.isClean).toBe(false)
    })

    test('2 de OUTRO naipe também nunca reanalisa como limpa, mesmo completando a sequência', () => {
      const cards = [real('5'), real('6'), two('clubs'), real('8'), real('9'), real('10'), real('J')]
      const canasta = new Canasta(cards)
      expect(canasta.isClean).toBe(false)

      const extended = canasta.withExtraCards([real('7')])
      expect(extended.isClean).toBe(false)
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

    test('clone preserva o resultado da reanálise das mesmas cartas', () => {
      const cards = [real('6', 'spades'), two('spades'), real('7', 'spades'), real('8', 'spades')]
      const canasta = new Canasta(cards)
      const dirtied = canasta.withExtraCards([real('9', 'spades')])
      const cloned = dirtied.clone()
      expect(cloned.isClean).toBe(false)
    })

    // Exemplo exato do usuário (2026-08-19), agora com o desfecho oficial:
    // 3-4-5-6-7-[2 no lugar do 8]-9 NASCE suja (o 9 entrou enquanto o 2
    // estava fora da posição natural). Quando o 8 real chega e o 2 desliza
    // pra posição natural (2-3-4-5-6-7-8-9), a canastra VOLTA a ficar limpa
    // - essa é a regra oficial que o usuário pediu pra corrigir em
    // 2026-08-31 (antes desta correção, ela ficava suja pra sempre).
    test('exemplo do usuario: [3,4,5,6,7,2(=8),9] nasce suja; 8 real chega, 2 desce pro natural -> fica LIMPA', () => {
      const cards = [
        real('3', 'spades'),
        real('4', 'spades'),
        real('5', 'spades'),
        real('6', 'spades'),
        real('7', 'spades'),
        two('spades'),
        real('9', 'spades'),
      ]
      const canasta = new Canasta(cards)
      expect(canasta.isClean).toBe(false) // 2 ocupa o slot do 8, 9 real presente
      expect(canasta.kind).toBe('suja') // 7 cartas: ja e canastra, suja
      expect(canasta.layout.map(l => l.representsValue)).toEqual([3, 4, 5, 6, 7, 8, 9])

      const extended = canasta.withExtraCards([real('8', 'spades')])
      expect(extended.isClean).toBe(true)
      expect(extended.kind).toBe('limpa')
      // O 2 desliza pra posição natural (valor 2), sequência completa 2..9.
      expect(extended.layout.map(l => l.representsValue)).toEqual([2, 3, 4, 5, 6, 7, 8, 9])
    })
  })
})
