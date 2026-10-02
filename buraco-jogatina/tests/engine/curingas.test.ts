import { Card, Rank, Suit } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'
import { isValidCanasta, canExtendMeld } from '../../src/engine/utils'
import { Game } from '../../src/engine/game'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer } from '../../src/engine/ai'

const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const C = (r: string, s: Suit = 'hearts') => new Card(s, r as Rank, false)
const two = (s: Suit) => new Card(s, '2', false)
const joker = () => new Card('hearts', '2', true)

function baixavel(cards: Card[]): boolean {
  let construiu = false
  try {
    new Canasta(cards)
    construiu = true
  } catch {
    construiu = false
  }
  expect(isValidCanasta(cards)).toBe(construiu)
  return construiu
}

function analisar(cards: Card[]): { clean: boolean; kind: string } {
  const c = new Canasta(cards)
  return { clean: c.isClean, kind: c.kind }
}

describe('trio de 3 cartas (2 reais + 1 curinga)', () => {
  const curingas: Array<[string, () => Card]> = [
    ['2 do mesmo naipe', () => two('hearts')],
    ['2 de outro naipe', () => two('spades')],
    ['joker', () => joker()],
  ]

  describe.each(curingas)('com %s', (_label, wild) => {
    it('baixa com duas cartas consecutivas (curinga na ponta): 5-6 + curinga', () => {
      expect(baixavel([C('5'), C('6'), wild()])).toBe(true)
    })

    it('baixa tapando um buraco de 1 (curinga no meio): 5-_-7 + curinga', () => {
      expect(baixavel([C('5'), C('7'), wild()])).toBe(true)
    })

    it('baixa no topo com Ás: Q-K + curinga e K-A + curinga', () => {
      expect(baixavel([C('Q'), C('K'), wild()])).toBe(true)
      expect(baixavel([C('K'), C('A'), wild()])).toBe(true)
    })

    it('baixa na base com Ás: A-3 + curinga (curinga = 2)', () => {
      expect(baixavel([C('A'), C('3'), wild()])).toBe(true)
    })

    it('NÃO baixa com um buraco de 2 (um curinga não tapa dois): 5 e 8 + curinga', () => {
      expect(baixavel([C('5'), C('8'), wild()])).toBe(false)
    })
  })

  it('trio de mesmo naipe com curinga fica limpo; com outro naipe / joker, sujo', () => {
    expect(analisar([C('5'), C('6'), two('hearts')]).clean).toBe(true)
    expect(analisar([C('5'), C('6'), two('spades')]).clean).toBe(false)
    expect(analisar([C('5'), C('6'), joker()]).clean).toBe(false)
  })
})

describe('baixar um trio com curinga pelo caminho do jogo (Game.playCanasta)', () => {
  function jogoComMao(cartasNaMao: Card[]): { game: Game; jogar: (cs: Card[]) => boolean; naMao: () => number } {
    const game = new Game([
      new HumanPlayer('Você'),
      new AIPlayer('B1', 'easy'),
      new AIPlayer('B2', 'easy'),
      new AIPlayer('B3', 'easy'),
    ])
    const p = game.state.players[0]
    while (p.hand.getCards().length) p.hand.removeCard(0)
    cartasNaMao.forEach(c => p.hand.addCard(c))
    game.state.currentPlayerIndex = 0
    return { game, jogar: cs => game.playCanasta(cs), naMao: () => p.hand.getCards().length }
  }

  const enchimento = (): Card[] => [
    new Card('clubs', 'K', false), new Card('spades', '9', false),
    new Card('diamonds', '4', false), new Card('clubs', 'J', false),
    new Card('spades', 'Q', false), new Card('diamonds', '7', false),
    new Card('clubs', '3', false), new Card('spades', 'K', false),
  ]

  const trios: Array<[string, () => Card]> = [
    ['2 do mesmo naipe', () => two('hearts')],
    ['2 de outro naipe', () => two('spades')],
    ['joker', () => joker()],
  ]

  it.each(trios)('baixa 5-6 + %s numa mão de 11 cartas', (_l, wild) => {
    const trio = [C('5'), C('6'), wild()]
    const { jogar, naMao } = jogoComMao([...trio, ...enchimento()])
    expect(jogar(trio)).toBe(true)
    expect(naMao()).toBe(8)
  })

  it('recusa quando baixar deixaria menos de 2 cartas na mão sem poder bater (regra, não bug do curinga)', () => {
    const trio = [C('5'), C('6'), two('hearts')]
    const { jogar, naMao } = jogoComMao([...trio])
    expect(jogar(trio)).toBe(false)
    expect(naMao()).toBe(3)
  })

  describe('caso relatado: 3, 5 e 2 do mesmo naipe', () => {
    it('forma um jogo válido: 3-4(2)-5, canastra limpa', () => {
      const trio = [C('3'), C('5'), two('hearts')]
      expect(isValidCanasta(trio)).toBe(true)
      const c = new Canasta(trio)
      expect(c.isClean).toBe(true)
      const slotDo2 = c.layout.find(e => e.card.rank === '2')!.representsValue
      expect(slotDo2).toBe(4)
    })

    it('baixa numa mão de 11 cartas (mão -> 8, jogo na mesa)', () => {
      const trio = [C('3'), C('5'), two('hearts')]
      const filler = ['K', '9', 'J', 'Q', '7', '4', '8', '10'].map(
        (r, i) => new Card((['clubs', 'spades', 'diamonds'] as Suit[])[i % 3], r as Rank, false)
      )
      const { jogar, naMao } = jogoComMao([...trio, ...filler])
      expect(jogar(trio)).toBe(true)
      expect(naMao()).toBe(8)
    })

    it('só é recusado com 4 cartas ou menos na mão (deixaria <2 sem poder bater)', () => {
      const trio = [C('3'), C('5'), two('hearts')]
      const quase = jogoComMao([...trio, new Card('clubs', 'K', false)])
      expect(quase.jogar(trio)).toBe(false)
      const ok = jogoComMao([...trio, new Card('clubs', 'K', false), new Card('spades', '9', false)])
      expect(ok.jogar(trio)).toBe(true)
    })
  })
})

describe('curinga = 2 do MESMO naipe', () => {
  it.each(SUITS)('completa a ponta de uma sequência baixa em %s (fica limpo)', suit => {
    const cards = [C('5', suit), C('6', suit), two(suit)]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards).clean).toBe(true)
  })

  it.each(SUITS)('tapa um buraco interno (5-_-7 -> 6) em %s (fica limpo)', suit => {
    const cards = [C('5', suit), C('7', suit), two(suit)]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards).clean).toBe(true)
  })

  it('o 2 do mesmo naipe também pode ser usado como carta NATURAL (posição 2)', () => {
    const cards = [two('hearts'), C('3'), C('4')]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards).clean).toBe(true)
  })

  it('sequência natural 2..8 (7 cartas, 2 na posição própria) é canastra LIMPA', () => {
    const cards = [two('hearts'), C('3'), C('4'), C('5'), C('6'), C('7'), C('8')]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards)).toEqual({ clean: true, kind: 'limpa' })
  })

  it('regra do 9: 2 do mesmo naipe como curinga numa sequência ALTA suja o jogo', () => {
    const cards = [C('9'), C('10'), two('hearts')]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards).clean).toBe(false)
  })

  it('canastra de 7 com 2 do mesmo naipe como curinga (tem 9) é SUJA', () => {
    const cards = [C('3'), C('4'), C('5'), C('6'), C('7'), C('9'), two('hearts')]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards)).toEqual({ clean: false, kind: 'suja' })
  })
})

describe('curinga = 2 de OUTRO naipe (sempre suja)', () => {
  it.each(SUITS)('completa a ponta de uma sequência em %s (fica sujo)', suit => {
    const outro = SUITS.find(s => s !== suit)!
    const cards = [C('5', suit), C('6', suit), two(outro)]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards).clean).toBe(false)
  })

  it('canastra de 7 com 2 de outro naipe é SUJA', () => {
    const cards = [C('3'), C('4'), C('5'), C('6'), C('7'), C('8'), two('spades')]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards)).toEqual({ clean: false, kind: 'suja' })
  })
})

describe('curinga = joker (carta sem naipe)', () => {
  it.each(SUITS)('funciona numa sequência de %s, mesmo o joker sendo guardado como 2 de copas', suit => {
    const cards = [C('5', suit), C('6', suit), C('8', suit), joker()]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards).clean).toBe(false)
  })

  it('canastra de 7 com joker é SUJA e conta o joker (20 no motor)', () => {
    const cards = [C('3'), C('4'), C('5'), C('6'), C('7'), C('8'), joker()]
    expect(baixavel(cards)).toBe(true)
    expect(analisar(cards)).toEqual({ clean: false, kind: 'suja' })
  })
})

describe('limite de 1 curinga por jogo', () => {
  it('dois curingas (joker + 2 de outro naipe) são recusados', () => {
    expect(baixavel([C('5'), C('6'), joker(), two('spades')])).toBe(false)
  })

  it('joker + 2 do mesmo naipe, quando exigiriam dois curingas, é recusado', () => {
    expect(baixavel([C('5'), C('6'), C('9'), two('hearts'), joker()])).toBe(false)
  })

  it('dois 2 do mesmo naipe no mesmo jogo é sempre inválido', () => {
    expect(baixavel([C('5'), C('6'), C('7'), two('hearts'), two('hearts')])).toBe(false)
  })
})

describe('estender um jogo já baixado com um curinga', () => {
  it('estende uma sequência com 2 do mesmo naipe como curinga na ponta', () => {
    expect(canExtendMeld([C('5'), C('6'), C('7')], [two('hearts')])).toBe(true)
  })

  it('estende uma sequência com joker', () => {
    expect(canExtendMeld([C('5'), C('6'), C('7')], [joker()])).toBe(true)
  })

  it('não estende se isso exigiria um segundo curinga', () => {
    expect(canExtendMeld([C('5'), C('6'), C('8'), joker()], [two('spades')])).toBe(false)
  })
})

describe('curinga de mesmo naipe nunca é mais restrito que os outros', () => {
  const RANKS: Rank[] = ['A', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

  function* subconjuntos(min: number, max: number): Generator<Rank[]> {
    const n = RANKS.length
    for (let mask = 1; mask < 1 << n; mask++) {
      const pick: Rank[] = []
      for (let i = 0; i < n; i++) if (mask & (1 << i)) pick.push(RANKS[i])
      if (pick.length >= min && pick.length <= max) yield pick
    }
  }

  it('em nenhuma combinação de 2 a 5 cartas o 2 do mesmo naipe é rejeitado onde o joker/2-de-outro-naipe é aceito', () => {
    let assimetrias = 0
    for (const combo of subconjuntos(2, 5)) {
      const reais = combo.map(r => C(r))
      const generico = isValidCanasta([...reais, joker()]) || isValidCanasta([...reais, two('spades')])
      const mesmo = isValidCanasta([...reais, two('hearts')])
      if (generico && !mesmo) assimetrias++
    }
    expect(assimetrias).toBe(0)
  })
})
