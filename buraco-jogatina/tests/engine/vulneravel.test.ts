import { Game, VU_OPENING_MINIMUM, VU_THRESHOLD, isVulnerableScore, openingPoints } from '../../src/engine/game'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer, planOpeningMelds, findOpeningCandidates } from '../../src/engine/ai'
import { Card, Rank, Suit } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'
import { Hand } from '../../src/engine/hand'
import { isValidCanasta } from '../../src/engine/utils'

const c = (rank: Rank, suit: Suit = 'hearts') => new Card(suit, rank)
const joker = () => new Card('hearts', '2', true)
const run = (suit: Suit, ranks: Rank[]) => ranks.map(r => c(r, suit))
const filler = () => run('clubs', ['3', '5', '7', '9', 'J', 'K']).concat([c('4', 'diamonds'), c('6', 'diamonds')])

function jogo(scores: { A: number; B: number }, hand: Card[]): Game {
  const g = new Game([new HumanPlayer('Você'), new AIPlayer('B1'), new AIPlayer('B2'), new AIPlayer('B3')])
  g.setup()
  g.setOpeningMinimums(scores)
  g.state.players[0].hand = new Hand(hand)
  g.state.currentPlayerIndex = 0
  return g
}

describe('VU: quem fica vulnerável', () => {
  it('1500 em diante é vulnerável; 1499 não', () => {
    expect(VU_THRESHOLD).toBe(1500)
    expect(VU_OPENING_MINIMUM).toBe(75)
    expect(isVulnerableScore(1499)).toBe(false)
    expect(isVulnerableScore(1500)).toBe(true)
    expect(isVulnerableScore(2999)).toBe(true)
    expect(isVulnerableScore(-200)).toBe(false)
  })

  it('setOpeningMinimums marca cada dupla de forma independente', () => {
    const g = jogo({ A: 1500, B: 1200 }, filler())
    expect(g.state.teams.find(t => t.id === 'A')!.openingMinimum).toBe(75)
    expect(g.state.teams.find(t => t.id === 'B')!.openingMinimum).toBe(0)
    g.setOpeningMinimums({ A: 100, B: 1800 })
    expect(g.state.teams.find(t => t.id === 'A')!.openingMinimum).toBe(0)
    expect(g.state.teams.find(t => t.id === 'B')!.openingMinimum).toBe(75)
  })

  it('uma partida nova começa sem ninguém vulnerável', () => {
    const g = new Game([new HumanPlayer('Você'), new AIPlayer('B1'), new AIPlayer('B2'), new AIPlayer('B3')])
    g.setup()
    expect(g.state.teams.every(t => t.openingMinimum === 0)).toBe(true)
  })
})

describe('VU: valor das cartas na abertura (mesma contagem do jogo)', () => {
  it('coringa 20, Ás 15, 2 10, 8 a K 10, 3 a 7 5', () => {
    expect(openingPoints([joker()])).toBe(20)
    expect(openingPoints([c('A')])).toBe(15)
    expect(openingPoints([c('2')])).toBe(10)
    expect(openingPoints(['8', '9', '10', 'J', 'Q', 'K'].map(r => c(r as Rank)))).toBe(60)
    expect(openingPoints(['3', '4', '5', '6', '7'].map(r => c(r as Rank)))).toBe(25)
  })
})

describe('VU: a primeira descida precisa somar 75', () => {
  it('um jogo sozinho com menos de 75 é recusado e nada muda', () => {
    const meld = run('spades', ['Q', 'K', 'A'])
    const g = jogo({ A: 1500, B: 0 }, [...meld, ...filler()])
    expect(openingPoints(meld)).toBe(35)
    expect(g.playCanasta(meld)).toBe(false)
    expect(g.state.teams[0].melds).toHaveLength(0)
    expect(g.state.players[0].hand.getSize()).toBe(11)
    expect(g.openingShortfall(meld)).toBe(40)
  })

  it('74 pontos é recusado, 75 exatos é aceito', () => {
    const base = run('spades', ['8', '9', '10', 'J', 'Q', 'K'])
    const g74 = jogo({ A: 1500, B: 0 }, [...base, c('7', 'spades'), c('3', 'hearts'), c('4', 'hearts'), c('9', 'clubs'), c('5', 'diamonds')])
    const seventy = [c('7', 'spades'), ...base]
    expect(openingPoints(seventy)).toBe(65)
    const h = g74.state.players[0].hand.getCards()
    const meld74 = [h.find(x => x.rank === '7' && x.suit === 'spades')!, ...h.filter(x => x.suit === 'spades' && x.rank !== '7')]
    expect(openingPoints(meld74)).toBe(65)
    expect(g74.playCanasta(meld74)).toBe(false)

    const exact = run('spades', ['6', '7', '8', '9', '10', 'J', 'Q', 'K'])
    expect(openingPoints(exact)).toBe(70)
    const exact75 = [...run('diamonds', ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])]
    expect(openingPoints(exact75)).toBe(75)
    const g75 = jogo({ A: 1500, B: 0 }, [...exact75, c('3', 'clubs'), c('4', 'clubs')])
    expect(g75.playCanasta(g75.state.players[0].hand.getCards().slice(0, 9))).toBe(true)
    expect(g75.state.teams[0].melds).toHaveLength(1)
  })

  it('vários jogos juntos na mesma descida somam para chegar a 75 (atômico)', () => {
    const m1 = run('spades', ['Q', 'K', 'A'])
    const m2 = run('hearts', ['Q', 'K', 'A'])
    const m3 = [c('A', 'clubs'), c('A', 'diamonds'), joker()]
    const g = jogo({ A: 1500, B: 0 }, [...m1, ...m2, ...m3, c('3', 'clubs'), c('4', 'clubs')])
    expect(openingPoints([...m1, ...m2])).toBe(70)
    expect(g.playMelds([m1, m2])).toBe(false)
    expect(g.state.teams[0].melds).toHaveLength(0)
    expect(g.state.players[0].hand.getSize()).toBe(11)

    expect(openingPoints([...m1, ...m2, ...m3])).toBe(120)
    expect(g.playMelds([m1, m2, m3])).toBe(true)
    expect(g.state.teams[0].melds).toHaveLength(3)
    expect(g.state.players[0].hand.getSize()).toBe(2)
  })

  it('depois de abrir, a dupla baixa e estende normalmente (sem mínimo)', () => {
    const big = run('diamonds', ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])
    const small = run('clubs', ['3', '4', '5'])
    const g = jogo({ A: 1500, B: 0 }, [...big, ...small, c('6', 'clubs'), c('9', 'hearts')])
    expect(g.playCanasta(big)).toBe(true)
    expect(g.needsOpening()).toBe(false)
    expect(g.playCanasta(small)).toBe(true)
    expect(g.extendMeld(1, [g.state.players[0].hand.getCards().find(x => x.rank === '6' && x.suit === 'clubs')!])).toBe(true)
  })

  it('jogo do parceiro conta como abertura da dupla: depois dele o outro baixa sem mínimo', () => {
    const g = jogo({ A: 1500, B: 0 }, [...run('clubs', ['3', '4', '5']), ...filler()])
    g.state.teams[0].melds.push(new Canasta(run('hearts', ['8', '9', '10', 'J', 'Q', 'K', 'A'])))
    expect(g.needsOpening()).toBe(false)
    expect(g.playCanasta(g.state.players[0].hand.getCards().slice(0, 3))).toBe(true)
  })

  it('a dupla NÃO vulnerável baixa jogo pequeno normalmente', () => {
    const g = jogo({ A: 1499, B: 2000 }, [...run('clubs', ['3', '4', '5']), ...filler()])
    expect(g.needsOpening()).toBe(false)
    expect(g.playCanasta(g.state.players[0].hand.getCards().slice(0, 3))).toBe(true)
  })

  it('a regra vale por dupla: o adversário vulnerável também precisa de 75', () => {
    const g = jogo({ A: 0, B: 1500 }, filler())
    g.state.currentPlayerIndex = 1
    g.state.players[1].hand = new Hand([...run('spades', ['3', '4', '5']), ...filler()])
    expect(g.needsOpening()).toBe(true)
    expect(g.playCanasta(g.state.players[1].hand.getCards().slice(0, 3))).toBe(false)
  })

  it('cartas repetidas ou que não estão na mão são recusadas sem mexer em nada', () => {
    const m1 = run('spades', ['Q', 'K', 'A'])
    const g = jogo({ A: 1500, B: 0 }, [...m1, ...run('hearts', ['Q', 'K', 'A']), ...filler().slice(0, 5)])
    expect(g.playMelds([m1, m1, m1])).toBe(false)
    expect(g.playMelds([run('diamonds', ['Q', 'K', 'A'])])).toBe(false)
    expect(g.playMelds([])).toBe(false)
    expect(g.playMelds([[m1[0], m1[1]]])).toBe(false)
    expect(g.state.players[0].hand.getSize()).toBe(11)
  })

  it('a abertura respeita a regra de não esvaziar a mão sem poder bater', () => {
    const m1 = run('spades', ['10', 'J', 'Q', 'K', 'A'])
    const m2 = run('hearts', ['10', 'J', 'Q', 'K', 'A'])
    const g = jogo({ A: 1500, B: 0 }, [...m1, ...m2, c('3', 'clubs')])
    g.state.mortos = []
    expect(g.wouldPlayMeldsEmptyHandIllegally([m1, m2])).toBe(true)
    expect(g.playMelds([m1, m2])).toBe(false)
    expect(g.state.players[0].hand.getSize()).toBe(11)
  })

  it('quando a abertura esvazia a mão, o morto é pego normalmente', () => {
    const m1 = run('spades', ['10', 'J', 'Q', 'K', 'A'])
    const m2 = run('hearts', ['10', 'J', 'Q', 'K', 'A'])
    const g = jogo({ A: 1500, B: 0 }, [...m1, ...m2])
    expect(g.playMelds([m1, m2])).toBe(true)
    expect(g.state.teams[0].hasTakenMorto).toBe(true)
    expect(g.state.players[0].hand.getSize()).toBe(11)
  })

  it('o mínimo sobrevive ao clone', () => {
    const g = jogo({ A: 1500, B: 0 }, filler())
    expect(g.clone().state.teams[0].openingMinimum).toBe(75)
  })
})

describe('VU: planejador de abertura da IA', () => {
  it('acha uma combinação de jogos disjuntos que soma 75+', () => {
    const hand = [...run('spades', ['Q', 'K', 'A']), ...run('hearts', ['Q', 'K', 'A']), c('A', 'clubs'), c('A', 'diamonds'), joker(), c('3', 'clubs')]
    const plans = planOpeningMelds(hand, 75)
    expect(plans.length).toBeGreaterThan(0)
    for (const plan of plans) {
      const cards = plan.flat()
      expect(new Set(cards).size).toBe(cards.length)
      expect(plan.every(g => isValidCanasta(g))).toBe(true)
      expect(openingPoints(cards)).toBeGreaterThanOrEqual(75)
    }
  })

  it('não inventa abertura quando a mão não chega a 75', () => {
    const hand = [...run('spades', ['3', '4', '5']), ...run('hearts', ['3', '4', '5']), c('9', 'clubs')]
    expect(planOpeningMelds(hand, 75)).toEqual([])
  })

  it('com 5+ Ases a IA propõe no máximo 4 (trinca de Ases válida)', () => {
    const ai = new AIPlayer('IA', 'hard', [c('A', 'hearts'), c('A', 'spades'), c('A', 'clubs'), c('A', 'diamonds'), c('A', 'hearts'), c('9', 'clubs')])
    const plans = ai.planOpening(1)
    expect(plans.length).toBeGreaterThan(0)
    for (const plan of plans) for (const g of plan) expect(isValidCanasta(g)).toBe(true)
  })
})

describe('VU: planejador encontra aberturas que usam curingas e cópias do 2º baralho', () => {
  function validPlans(plans: Card[][][], minimum = 75) {
    expect(plans.length).toBeGreaterThan(0)
    for (const plan of plans) {
      const cards = plan.flat()
      expect(new Set(cards).size).toBe(cards.length)
      expect(plan.every(g => isValidCanasta(g))).toBe(true)
      expect(openingPoints(cards)).toBeGreaterThanOrEqual(minimum)
    }
  }

  it('usa um 2 de outro naipe como curinga', () => {
    const hand = [...run('spades', ['J', 'Q', 'K', 'A']), ...run('hearts', ['Q', 'K']), c('2', 'clubs'), c('A', 'diamonds'), c('A', 'clubs')]
    validPlans(planOpeningMelds(hand, 75))
    expect(planOpeningMelds(hand, 75).flat().flat().some(x => x.rank === '2')).toBe(true)
  })

  it('usa mais de um coringa em jogos diferentes', () => {
    const hand = [...run('spades', ['Q', 'K']), ...run('hearts', ['Q', 'K']), joker(), joker(), c('A', 'diamonds'), c('A', 'clubs'), joker()]
    validPlans(planOpeningMelds(hand, 75))
  })

  it('monta duas sequências iguais com as cópias dos dois baralhos', () => {
    const hand = [...run('spades', ['Q', 'K', 'A']), ...run('spades', ['Q', 'K', 'A']), c('3', 'hearts'), c('5', 'clubs'), c('8', 'diamonds')]
    const plans = planOpeningMelds(hand, 70)
    validPlans(plans, 70)
    expect(plans[0]).toHaveLength(2)
  })

  it('separa 6 Ases em duas trincas', () => {
    const aces = [c('A', 'spades'), c('A', 'hearts'), c('A', 'clubs'), c('A', 'diamonds'), c('A', 'spades'), c('A', 'hearts')]
    const plans = planOpeningMelds([...aces, c('4', 'clubs')], 90)
    validPlans(plans, 90)
    expect(plans[0]).toHaveLength(2)
  })

  it('aceita aberturas que precisam de 5 jogos', () => {
    const hand = [
      ...run('spades', ['3', '4', '5']),
      ...run('hearts', ['3', '4', '5']),
      ...run('clubs', ['3', '4', '5']),
      ...run('diamonds', ['3', '4', '5']),
      ...run('spades', ['3', '4', '5']),
    ]
    const plans = planOpeningMelds(hand, 75)
    validPlans(plans)
    expect(plans[0]).toHaveLength(5)
  })

  it('candidatos nunca repetem a mesma carta dentro de um jogo', () => {
    const hand = [...run('spades', ['9', '10', 'J', 'Q', 'K', 'A']), joker(), c('2', 'hearts'), c('A', 'hearts'), c('A', 'clubs')]
    for (const g of findOpeningCandidates(hand)) {
      expect(new Set(g).size).toBe(g.length)
      expect(isValidCanasta(g)).toBe(true)
    }
  })

  it('é rápido mesmo com uma mão enorme (22 cartas, sem abertura possível)', () => {
    const hand: Card[] = []
    for (const suit of ['spades', 'hearts', 'clubs', 'diamonds'] as Suit[]) {
      hand.push(...run(suit, ['3', '4', '6', '7']))
      hand.push(c('9', suit))
    }
    hand.push(c('5', 'spades'), c('10', 'hearts'))
    expect(hand).toHaveLength(22)
    const t0 = Date.now()
    planOpeningMelds(hand, 75)
    expect(Date.now() - t0).toBeLessThan(500)
  })
})

