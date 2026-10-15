import { useGameStore, MATCH_TARGET } from '../../src/store/gameStore'
import { Game, STALEMATE_RECYCLES, VU_OPENING_MINIMUM } from '../../src/engine/game'
import { Card, Rank, Suit } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'
import { Hand } from '../../src/engine/hand'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer } from '../../src/engine/ai'
import type { Team, TeamId } from '../../src/engine/gameState'

const STORAGE_KEY = 'buraco-jogatina:saved-game'

const carta = (suit: Suit, rank: Rank) => new Card(suit, rank, false)
const copas = (r: Rank) => carta('hearts', r)
const ouros = (r: Rank) => carta('diamonds', r)
const paus = (r: Rank) => carta('clubs', r)
const espadas = (r: Rank) => carta('spades', r)
const coringa = () => new Card('hearts', '2', true)

const sequencia = (suit: Suit, ranks: Rank[]) => ranks.map(r => carta(suit, r))

const canastraLimpa = () => new Canasta(sequencia('hearts', ['4', '5', '6', '7', '8', '9', '10']))
const canastraSuja = () => new Canasta([...sequencia('spades', ['4', '5', '6', '7', '8', '9']), coringa()])
const novoMorto = () => sequencia('clubs', ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])

const nome = (c: Card) => (c.isWild ? 'CORINGA' : c.toString())

function store() {
  return useGameStore.getState()
}

function iniciar(): Game {
  store().initGame('Alice', 'hard')
  return store().game!
}

function time(game: Game, id: TeamId): Team {
  return game.state.teams.find(t => t.id === id)!
}

function mao(game: Game, seat: number, cards: Card[]): void {
  game.state.players[seat].hand = new Hand(cards)
}

function cartasDe(game: Game, seat: number): Card[] {
  return game.state.players[seat].hand.getCards()
}

function prepararBatidaDeterministica(game: Game): void {
  const a = time(game, 'A')
  const b = time(game, 'B')
  a.melds = [canastraLimpa()]
  a.hasTakenMorto = true
  a.mortoTakenBySeat = 0
  a.mortoUsed = true
  b.melds = []
  b.hasTakenMorto = false
  game.state.mortos = []
  mao(game, 0, [ouros('3')])
  mao(game, 1, [ouros('5')])
  mao(game, 2, [ouros('4')])
  mao(game, 3, [ouros('6')])
  game.state.currentPlayerIndex = 0
}

function retrato(game: Game) {
  const s = game.state
  const maoAtual = s.players[s.currentPlayerIndex].hand.getCards()
  return {
    jogadores: s.players.map(p => ({
      nome: p.name,
      ia: p instanceof AIPlayer,
      dificuldade: p instanceof AIPlayer ? p.difficulty : null,
      mao: p.hand.getCards().map(nome),
    })),
    monte: s.deck.map(nome),
    lixo: s.discardPile.map(nome),
    mortos: s.mortos.map(m => m.map(nome)),
    times: s.teams.map(t => ({
      id: t.id,
      seats: [...t.seats],
      jogos: t.melds.map(m => m.cards.map(nome)),
      score: t.score,
      hasTakenMorto: t.hasTakenMorto,
      mortoTakenBySeat: t.mortoTakenBySeat,
      mortoUsed: t.mortoUsed,
      openingMinimum: t.openingMinimum,
    })),
    vez: s.currentPlayerIndex,
    status: s.status,
    rodada: s.round,
    reciclagens: s.discardRecycles,
    bloqueada: s.blockedDiscardCard ? maoAtual.findIndex(c => c === s.blockedDiscardCard) : -1,
  }
}

function simularRecarga(): void {
  const salvo = window.localStorage.getItem(STORAGE_KEY)
  expect(salvo).not.toBeNull()
  store().resetGame()
  expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  window.localStorage.setItem(STORAGE_KEY, salvo!)
  expect(store().resumeSavedGame()).toBe(true)
}

beforeEach(() => {
  window.localStorage.clear()
  store().resetGame()
})

describe('compra do monte', () => {
  test('comprar do monte leva a carta do topo para a mão, encurta o monte e mantém a vez', () => {
    const game = iniciar()
    const topo = copas('Q')
    game.state.deck = [ouros('3'), ouros('4'), topo]
    const antes = cartasDe(game, 0).length

    store().drawFromDeck()

    const depois = cartasDe(game, 0)
    expect(depois).toHaveLength(antes + 1)
    expect(depois[depois.length - 1]).toBe(topo)
    expect(game.state.deck).toHaveLength(2)
    expect(game.state.currentPlayerIndex).toBe(0)
    expect(store().gameLog[store().gameLog.length - 1]).toBe('Alice comprou uma carta.')
  })

  test('monte vazio com dois mortos: um morto vira o monte e o outro segue disponível para quem esvaziar a mão', () => {
    const game = iniciar()
    const mortoQueFica = novoMorto()
    const mortoQueViraMonte = sequencia('spades', ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])
    game.state.deck = []
    game.state.mortos = [mortoQueFica, mortoQueViraMonte]

    store().drawFromDeck()

    expect(game.state.mortos).toHaveLength(1)
    expect(game.state.mortos[0]).toBe(mortoQueFica)
    expect(game.state.deck).toHaveLength(10)
    expect(game.state.deck.every(c => c.suit === 'spades')).toBe(true)
    expect(cartasDe(game, 0)[cartasDe(game, 0).length - 1].toString()).toBe('KS')
    expect(store().gameLog).toContain('O monte acabou — o morto virou o novo monte!')
    expect(game.state.status).toBe('playing')
  })

  test('comprar a última carta do monte com mortos esgotados reembaralha o lixo como novo monte na mesma hora', () => {
    const game = iniciar()
    const ultima = espadas('J')
    const lixo = [paus('4'), ouros('9')]
    game.state.mortos = []
    game.state.deck = [ultima]
    game.state.discardPile = [...lixo]

    store().drawFromDeck()

    expect(cartasDe(game, 0)).toContain(ultima)
    expect(game.state.discardPile).toHaveLength(0)
    expect(game.state.deck).toHaveLength(2)
    expect(new Set(game.state.deck)).toEqual(new Set(lixo))
    expect(game.state.discardRecycles).toBe(1)
    expect(store().gameLog).toContain('🔀 O lixo foi embaralhado e virou o novo monte!')
  })

  test('monte e mortos vazios: a compra reembaralha o lixo inteiro, compra dele e conta uma reciclagem', () => {
    const game = iniciar()
    const lixo = [paus('4'), ouros('9'), copas('K')]
    game.state.mortos = []
    game.state.deck = []
    game.state.discardPile = [...lixo]
    const antes = cartasDe(game, 0).length

    store().drawFromDeck()

    const comprada = cartasDe(game, 0)[antes]
    expect(cartasDe(game, 0)).toHaveLength(antes + 1)
    expect(lixo).toContain(comprada)
    expect(game.state.deck).toHaveLength(2)
    expect(game.state.deck).not.toContain(comprada)
    expect(game.state.discardPile).toHaveLength(0)
    expect(game.state.discardRecycles).toBe(1)
    expect(game.state.blockedDiscardCard ?? null).toBeNull()
  })

  test('monte, mortos e lixo vazios: nenhuma carta é comprada e o log avisa que o monte acabou', () => {
    const game = iniciar()
    game.state.mortos = []
    game.state.deck = []
    game.state.discardPile = []
    const antes = cartasDe(game, 0).length

    store().drawFromDeck()

    expect(cartasDe(game, 0)).toHaveLength(antes)
    expect(store().gameLog[store().gameLog.length - 1]).toBe('O monte acabou.')
    expect(game.state.discardRecycles).toBe(0)
  })

  test('tudo vazio após pegar o lixo: a próxima jogada encerra a rodada (caso extremo do README)', () => {
    const game = iniciar()
    game.state.mortos = []
    game.state.deck = []
    game.state.discardPile = [espadas('5')]
    mao(game, 0, [espadas('3'), espadas('4'), ouros('K'), ouros('Q')])

    store().takeDiscardPile()
    expect(game.state.status).toBe('playing')
    store().playCanasta([0, 1, 4])

    expect(time(game, 'A').melds).toHaveLength(1)
    expect(game.state.status).toBe('finished')
    expect(game.state.closerSeat).toBeUndefined()
    expect(store().roundFinalized).toBe(true)
  })
})

describe('pegar o lixo', () => {
  test('lixo com 1 carta: ela vai para a mão e não pode voltar ao lixo no mesmo turno', () => {
    const game = iniciar()
    const unica = ouros('K')
    mao(game, 0, [espadas('3'), paus('9'), copas('J')])
    game.state.discardPile = [unica]

    store().takeDiscardPile()

    expect(cartasDe(game, 0)).toHaveLength(4)
    expect(cartasDe(game, 0)[3]).toBe(unica)
    expect(game.state.discardPile).toHaveLength(0)
    expect(game.state.blockedDiscardCard).toBe(unica)
    expect(game.isDiscardBlockedCard(3)).toBe(true)
    expect(store().gameLog[store().gameLog.length - 1]).toBe('Alice pegou a pilha de descarte (1 cartas).')

    store().discard(3)

    expect(cartasDe(game, 0)).toContain(unica)
    expect(game.state.discardPile).toHaveLength(0)
    expect(game.state.currentPlayerIndex).toBe(0)

    store().discard(1)

    expect(game.state.discardPile.map(nome)).toEqual(['9C'])
    expect(game.state.currentPlayerIndex).toBe(1)
    expect(game.state.blockedDiscardCard ?? null).toBeNull()
  })

  test('lixo com 1 carta: a carta gêmea do outro baralho (mesmo naipe e valor) pode ser descartada', () => {
    const game = iniciar()
    const unica = ouros('K')
    const gemea = ouros('K')
    mao(game, 0, [gemea, espadas('3')])
    game.state.discardPile = [unica]

    store().takeDiscardPile()
    expect(game.isDiscardBlockedCard(0)).toBe(false)
    expect(game.isDiscardBlockedCard(2)).toBe(true)

    store().discard(0)

    expect(game.state.discardPile).toEqual([gemea])
    expect(game.state.discardPile[0]).not.toBe(unica)
    expect(cartasDe(game, 0)).toEqual([espadas('3'), unica])
    expect(game.state.currentPlayerIndex).toBe(1)
  })

  test('lixo com 1 carta usada num jogo: depois de baixá-la qualquer carta pode ser descartada', () => {
    const game = iniciar()
    const unica = paus('5')
    mao(game, 0, [paus('3'), paus('4'), copas('9'), ouros('2')])
    game.state.discardPile = [unica]

    store().takeDiscardPile()
    store().playCanasta([0, 1, 4])

    expect(time(game, 'A').melds[0].cards).toContain(unica)
    expect(cartasDe(game, 0).map(nome)).toEqual(['9H', '2D'])

    store().discard(1)

    expect(game.state.discardPile.map(nome)).toEqual(['2D'])
    expect(game.state.currentPlayerIndex).toBe(1)
  })

  test('lixo com várias cartas (com coringa e 2): tudo vai para a mão, nada fica bloqueado e o antigo topo pode voltar', () => {
    const game = iniciar()
    const pilha = [paus('7'), coringa(), espadas('2'), ouros('Q')]
    mao(game, 0, [copas('3'), copas('4')])
    game.state.discardPile = [...pilha]

    store().takeDiscardPile()

    expect(cartasDe(game, 0)).toHaveLength(6)
    expect(cartasDe(game, 0).slice(2)).toEqual(pilha)
    expect(cartasDe(game, 0).filter(c => c.isWild)).toHaveLength(1)
    expect(game.state.discardPile).toHaveLength(0)
    expect(game.state.blockedDiscardCard ?? null).toBeNull()
    expect(store().gameLog[store().gameLog.length - 1]).toBe('Alice pegou a pilha de descarte (4 cartas).')

    store().discard(5)

    expect(game.state.discardPile).toEqual([pilha[3]])
    expect(game.state.currentPlayerIndex).toBe(1)
  })

  test('lixo vazio: pegar o lixo não muda a mão e registra o aviso', () => {
    const game = iniciar()
    game.state.discardPile = []
    const antes = cartasDe(game, 0).map(nome)

    store().takeDiscardPile()

    expect(cartasDe(game, 0).map(nome)).toEqual(antes)
    expect(store().gameLog[store().gameLog.length - 1]).toBe('A pilha de descarte está vazia.')
  })

  test('IA que escolhe descartar a carta bloqueada cai no fallback e descarta a carta de menor valor', () => {
    const game = iniciar()
    const tres = paus('3')
    const quatro = paus('4')
    mao(game, 1, [quatro, coringa(), ouros('K'), espadas('Q')])
    game.state.discardPile = [tres]
    game.state.currentPlayerIndex = 1

    store().aiTurn()

    expect(cartasDe(game, 1)).toContain(tres)
    expect(cartasDe(game, 1)).not.toContain(quatro)
    expect(cartasDe(game, 1)).toHaveLength(4)
    expect(game.state.discardPile).toEqual([quatro])
    expect(time(game, 'B').melds).toHaveLength(0)
    expect(game.state.currentPlayerIndex).toBe(2)
    expect(game.state.blockedDiscardCard ?? null).toBeNull()
    const log = store().gameLog
    expect(log).toContain('Ana pegou a pilha de descarte.')
    expect(log[log.length - 1]).toBe('Ana descartou uma carta.')
  })
})

describe('morto', () => {
  test('esvaziar a mão descartando pega o morto, a vez passa e o morto ainda não conta como usado', () => {
    const game = iniciar()
    const primeiro = novoMorto()
    game.state.mortos = [primeiro, sequencia('spades', ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'])]
    mao(game, 0, [ouros('8')])

    store().discard(0)

    const a = time(game, 'A')
    expect(cartasDe(game, 0)).toEqual(primeiro)
    expect(a.hasTakenMorto).toBe(true)
    expect(a.mortoTakenBySeat).toBe(0)
    expect(a.mortoUsed).toBe(false)
    expect(game.state.mortos).toHaveLength(1)
    expect(game.state.discardPile.map(nome)).toEqual(['8D'])
    expect(game.state.currentPlayerIndex).toBe(1)
    expect(game.state.status).toBe('playing')
    expect(store().gameLog).toContain('Alice pegou o morto!')
  })

  test('esvaziar a mão baixando um jogo pega o morto e o jogador continua na vez', () => {
    const game = iniciar()
    game.state.mortos = [novoMorto(), novoMorto()]
    mao(game, 0, [copas('J'), copas('Q'), copas('K')])

    store().playCanasta([0, 1, 2])

    const a = time(game, 'A')
    expect(a.melds).toHaveLength(1)
    expect(a.hasTakenMorto).toBe(true)
    expect(cartasDe(game, 0)).toHaveLength(11)
    expect(game.state.mortos).toHaveLength(1)
    expect(game.state.currentPlayerIndex).toBe(0)
    expect(store().gameLog.slice(-2)).toEqual(['Alice baixou uma canastra!', 'Alice pegou o morto!'])
  })

  test('esvaziar a mão estendendo um jogo pega o morto e o jogador continua na vez', () => {
    const game = iniciar()
    const a = time(game, 'A')
    a.melds = [new Canasta(sequencia('hearts', ['3', '4', '5']))]
    game.state.mortos = [novoMorto()]
    mao(game, 0, [copas('6'), copas('7')])

    store().extendMeld(0, [0, 1])

    expect(a.melds[0].cards.map(nome)).toEqual(['3H', '4H', '5H', '6H', '7H'])
    expect(a.hasTakenMorto).toBe(true)
    expect(cartasDe(game, 0)).toHaveLength(11)
    expect(game.state.mortos).toHaveLength(0)
    expect(game.state.currentPlayerIndex).toBe(0)
    expect(store().gameLog.slice(-2)).toEqual(['Alice estendeu um jogo do time!', 'Alice pegou o morto!'])
  })

  test('cada dupla pega um morto: com a dupla A já servida, a dupla B leva o último ao esvaziar a mão', () => {
    const game = iniciar()
    const ultimo = novoMorto()
    time(game, 'A').hasTakenMorto = true
    time(game, 'A').mortoTakenBySeat = 0
    game.state.mortos = [ultimo]
    game.state.currentPlayerIndex = 1
    mao(game, 1, [ouros('9')])

    store().discard(0)

    const b = time(game, 'B')
    expect(b.hasTakenMorto).toBe(true)
    expect(b.mortoTakenBySeat).toBe(1)
    expect(cartasDe(game, 1)).toEqual(ultimo)
    expect(game.state.mortos).toHaveLength(0)
    expect(game.state.currentPlayerIndex).toBe(2)
  })

  test('dupla que já pegou o morto não pega outro: esvaziar a mão sem canastra limpa é recusado', () => {
    const game = iniciar()
    const a = time(game, 'A')
    a.hasTakenMorto = true
    a.mortoTakenBySeat = 0
    a.melds = [canastraSuja()]
    game.state.mortos = [novoMorto()]
    game.state.currentPlayerIndex = 2
    mao(game, 2, [ouros('9')])

    store().discard(0)

    expect(cartasDe(game, 2).map(nome)).toEqual(['9D'])
    expect(game.state.mortos).toHaveLength(1)
    expect(game.state.currentPlayerIndex).toBe(2)
    expect(game.state.status).toBe('playing')
  })

  test('morto virou monte: a dupla que não pegou morto bate sem ele e não leva -100', () => {
    const game = iniciar()
    const a = time(game, 'A')
    const b = time(game, 'B')
    a.melds = [canastraLimpa()]
    a.hasTakenMorto = false
    b.hasTakenMorto = true
    b.mortoTakenBySeat = 1
    b.mortoUsed = true
    game.state.deck = []
    game.state.mortos = [novoMorto()]
    mao(game, 0, [ouros('3'), ouros('4'), ouros('5')])
    mao(game, 1, [espadas('6')])
    mao(game, 2, [espadas('7')])
    mao(game, 3, [espadas('8')])

    store().drawFromDeck()
    expect(game.state.mortos).toHaveLength(0)
    expect(cartasDe(game, 0).map(nome)).toEqual(['3D', '4D', '5D', 'KC'])

    store().playCanasta([0, 1, 2])
    expect(cartasDe(game, 0).map(nome)).toEqual(['KC'])
    store().discard(0)

    expect(game.state.status).toBe('finished')
    expect(game.state.closerSeat).toBe(0)
    const bdA = game.state.scoreBreakdowns!.find(x => x.teamId === 'A')!
    expect(bdA.mortoPenalty).toBe(0)
    expect(bdA.batidaBonus).toBe(100)
    expect(bdA.meldPoints).toBe(250 + 15)
    expect(bdA.total).toBe(250 + 15 + 100 - 5)
    expect(a.hasTakenMorto).toBe(false)
  })

  test('jogar com a mão do morto marca o morto como usado só quando é quem o pegou', () => {
    const game = iniciar()
    game.state.mortos = [novoMorto(), novoMorto()]
    mao(game, 0, [ouros('8')])
    store().discard(0)
    const a = time(game, 'A')
    expect(a.mortoUsed).toBe(false)

    game.state.currentPlayerIndex = 2
    mao(game, 2, [espadas('J'), espadas('Q'), espadas('K'), ouros('5'), ouros('6')])
    store().playCanasta([0, 1, 2])
    expect(a.melds).toHaveLength(1)
    expect(a.mortoUsed).toBe(false)

    game.state.currentPlayerIndex = 0
    store().discard(0)
    expect(a.mortoUsed).toBe(true)
    expect(a.mortoTakenBySeat).toBe(0)
  })
})

describe('batida', () => {
  test('batida pelo descarte: rodada termina com +100, closerSeat 0, a vez não passa e o placar acumula', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)

    store().discard(0)

    expect(game.state.status).toBe('finished')
    expect(game.state.closerSeat).toBe(0)
    expect(game.state.currentPlayerIndex).toBe(0)
    expect(game.state.winnerTeam).toBe('A')
    expect(time(game, 'A').score).toBe(345)
    expect(time(game, 'B').score).toBe(-10)
    expect(store().matchScores).toEqual({ A: 345, B: -10 })
    expect(store().roundFinalized).toBe(true)
    expect(store().gameLog.slice(-2)).toEqual(['Fim de jogo — Time A venceu!', 'Fim da rodada 1.'])
  })

  test('batida baixando o último jogo da mão', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    mao(game, 0, [espadas('3'), espadas('4'), espadas('5')])

    store().playCanasta([0, 1, 2])

    expect(game.state.status).toBe('finished')
    expect(game.state.closerSeat).toBe(0)
    const bdA = game.state.scoreBreakdowns!.find(x => x.teamId === 'A')!
    expect(bdA.meldPoints).toBe(250 + 15)
    expect(bdA.batidaBonus).toBe(100)
    expect(bdA.handPenalty).toBe(-5)
    expect(time(game, 'A').score).toBe(360)
  })

  test('batida estendendo a canastra limpa com as últimas cartas', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    mao(game, 0, [copas('J'), copas('Q')])

    store().extendMeld(0, [0, 1])

    expect(game.state.status).toBe('finished')
    expect(game.state.closerSeat).toBe(0)
    expect(time(game, 'A').melds[0].cards).toHaveLength(9)
    expect(time(game, 'A').score).toBe(270 + 100 - 5)
  })

  test('batida do parceiro (assento 2) jogando pela IA: compra, estende a canastra e descarta a última carta', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    const valete = copas('J')
    game.state.deck = [paus('3'), paus('4'), valete]
    game.state.discardPile = []
    mao(game, 2, [espadas('7')])
    game.state.currentPlayerIndex = 2

    store().aiTurn()

    expect(game.state.status).toBe('finished')
    expect(game.state.closerSeat).toBe(2)
    expect(time(game, 'A').melds[0].cards).toContain(valete)
    expect(game.state.discardPile.map(nome)).toEqual(['7S'])
    const bdA = game.state.scoreBreakdowns!.find(x => x.teamId === 'A')!
    expect(bdA.batidaBonus).toBe(100)
    expect(bdA.meldPoints).toBe(260)
    expect(bdA.handPenalty).toBe(-5)
    expect(time(game, 'A').score).toBe(355)
    expect(store().matchScores.A).toBe(355)
    expect(store().gameLog).toContain('Bruno estendeu um jogo do time!')
  })

  test('batida recusada só com canastra suja: o descarte da última carta não acontece', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    time(game, 'A').melds = [canastraSuja()]

    store().discard(0)

    expect(cartasDe(game, 0).map(nome)).toEqual(['3D'])
    expect(game.state.discardPile).toHaveLength(0)
    expect(game.state.status).toBe('playing')
    expect(game.state.currentPlayerIndex).toBe(0)
    expect(game.wouldDiscardEmptyHandIllegally(0)).toBe(true)
  })

  test('batida recusada com jogo limpo de 6 cartas (ainda não é canastra)', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    time(game, 'A').melds = [new Canasta(sequencia('hearts', ['4', '5', '6', '7', '8', '9']))]
    expect(time(game, 'A').melds[0].isClean).toBe(true)
    expect(time(game, 'A').melds[0].isCanastra).toBe(false)

    store().discard(0)
    expect(cartasDe(game, 0).map(nome)).toEqual(['3D'])

    mao(game, 0, [espadas('3'), espadas('4'), espadas('5')])
    store().playCanasta([0, 1, 2])

    expect(time(game, 'A').melds).toHaveLength(1)
    expect(cartasDe(game, 0)).toHaveLength(3)
    expect(game.state.status).toBe('playing')
    expect(game.state.currentPlayerIndex).toBe(0)
  })

  test('baixar deixando 1 carta na mão é recusado quando a dupla não pode bater depois', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    time(game, 'A').melds = [canastraSuja()]
    mao(game, 0, [espadas('J'), espadas('Q'), espadas('K'), ouros('3')])

    expect(game.wouldPlayCanastaEmptyHandIllegally(cartasDe(game, 0).slice(0, 3))).toBe(true)
    store().playCanasta([0, 1, 2])

    expect(time(game, 'A').melds).toHaveLength(1)
    expect(cartasDe(game, 0)).toHaveLength(4)
  })

  test('estender a única canastra limpa com coringa para bater é recusado (ela ficaria suja)', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    mao(game, 0, [coringa()])

    expect(game.wouldExtendMeldEmptyHandIllegally(0, cartasDe(game, 0))).toBe(true)
    store().extendMeld(0, [0])

    expect(time(game, 'A').melds[0].cards).toHaveLength(7)
    expect(time(game, 'A').melds[0].isClean).toBe(true)
    expect(cartasDe(game, 0)).toHaveLength(1)
    expect(game.state.status).toBe('playing')
  })

  test('com canastra limpa mas sem ter pegado o morto disponível: esvaziar a mão pega o morto em vez de bater', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    const a = time(game, 'A')
    a.hasTakenMorto = false
    a.mortoTakenBySeat = undefined
    a.mortoUsed = undefined
    const restante = novoMorto()
    game.state.mortos = [restante]

    store().discard(0)

    expect(game.state.status).toBe('playing')
    expect(game.state.closerSeat).toBeUndefined()
    expect(a.hasTakenMorto).toBe(true)
    expect(cartasDe(game, 0)).toEqual(restante)
    expect(game.state.currentPlayerIndex).toBe(1)
    expect(store().roundFinalized).toBe(false)
  })
})

describe('impasse', () => {
  test(`após ${STALEMATE_RECYCLES} reembaralhadas sem carta nova na mesa a rodada termina sem batida`, () => {
    const game = iniciar()
    game.state.mortos = []
    game.state.deck = [copas('K')]
    game.state.discardPile = [espadas('9')]
    mao(game, 0, [ouros('3')])
    mao(game, 1, [ouros('5')])
    mao(game, 2, [ouros('4')])
    mao(game, 3, [ouros('K')])

    for (let ciclo = 1; ciclo <= STALEMATE_RECYCLES; ciclo++) {
      expect(game.state.status).toBe('playing')
      game.state.currentPlayerIndex = 0
      store().drawFromDeck()
      expect(game.state.discardRecycles).toBe(ciclo)
      store().discard(cartasDe(game, 0).length - 1)
    }

    expect(game.state.status).toBe('finished')
    expect(game.state.closerSeat).toBeUndefined()
    const bds = game.state.scoreBreakdowns!
    expect(bds.map(b => b.batidaBonus)).toEqual([0, 0])
    expect(bds.map(b => b.mortoPenalty)).toEqual([0, 0])
    expect(time(game, 'A').score).toBe(-10)
    expect(time(game, 'B').score).toBe(-15)
    expect(game.state.winnerTeam).toBe('A')
    expect(store().matchScores).toEqual({ A: -10, B: -15 })
    expect(store().roundFinalized).toBe(true)
  })
})

describe('pontuação da rodada', () => {
  test('detalhamento completo: jogos + batida + morto + mãos é exatamente o team.score', () => {
    const game = iniciar()
    const a = time(game, 'A')
    const b = time(game, 'B')
    a.melds = [canastraLimpa(), new Canasta(sequencia('clubs', ['J', 'Q', 'K']))]
    a.hasTakenMorto = true
    a.mortoTakenBySeat = 2
    a.mortoUsed = true
    b.melds = [canastraSuja()]
    b.hasTakenMorto = false
    game.state.mortos = [novoMorto()]
    mao(game, 0, [ouros('3')])
    mao(game, 1, [ouros('A'), paus('7')])
    mao(game, 2, [espadas('K'), coringa()])
    mao(game, 3, [ouros('Q'), paus('2')])
    game.state.currentPlayerIndex = 0

    store().discard(0)

    const bdA = game.state.scoreBreakdowns!.find(x => x.teamId === 'A')!
    const bdB = game.state.scoreBreakdowns!.find(x => x.teamId === 'B')!
    expect(bdA).toMatchObject({ meldPoints: 280, batidaBonus: 100, mortoPenalty: 0, handPenalty: -30, total: 350 })
    expect(bdB).toMatchObject({ meldPoints: 160, batidaBonus: 0, mortoPenalty: -100, handPenalty: -40, total: 20 })
    expect(bdA.handBySeat).toEqual([
      { seat: 0, playerName: 'Alice', points: 0, counted: true },
      { seat: 2, playerName: 'Bruno', points: 30, counted: true },
    ])
    expect(bdB.handBySeat).toEqual([
      { seat: 1, playerName: 'Ana', points: 20, counted: true },
      { seat: 3, playerName: 'Carlos', points: 20, counted: true },
    ])
    for (const bd of [bdA, bdB]) {
      expect(bd.meldPoints + bd.batidaBonus + bd.mortoPenalty + bd.handPenalty).toBe(bd.total)
      expect(time(game, bd.teamId).score).toBe(bd.total)
    }
    expect(store().matchScores).toEqual({ A: 350, B: 20 })
    expect(store().matchCanastras).toEqual({ A: { clean: 1, dirty: 0 }, B: { clean: 0, dirty: 1 } })
  })

  test('morto pego e nunca usado: -100 e a mão de quem pegou o morto não é descontada', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    const b = time(game, 'B')
    b.hasTakenMorto = true
    b.mortoTakenBySeat = 3
    b.mortoUsed = false
    mao(game, 3, novoMorto())

    store().discard(0)

    const bdB = game.state.scoreBreakdowns!.find(x => x.teamId === 'B')!
    expect(bdB.mortoPenalty).toBe(-100)
    expect(bdB.handPenalty).toBe(-5)
    expect(bdB.handBySeat.find(h => h.seat === 3)).toEqual({ seat: 3, playerName: 'Carlos', points: 85, counted: false })
    expect(bdB.total).toBe(-105)
    expect(b.score).toBe(-105)
    expect(time(game, 'A').score).toBe(345)
  })

  test('morto disponível que a dupla nunca pegou custa -100; sem morto na mesa não há penalidade', () => {
    const comMorto = iniciar()
    prepararBatidaDeterministica(comMorto)
    comMorto.state.mortos = [novoMorto()]
    store().discard(0)
    expect(comMorto.state.scoreBreakdowns!.find(x => x.teamId === 'B')!.mortoPenalty).toBe(-100)
    expect(time(comMorto, 'B').score).toBe(-110)

    store().resetGame()
    const semMorto = iniciar()
    prepararBatidaDeterministica(semMorto)
    store().discard(0)
    expect(semMorto.state.scoreBreakdowns!.find(x => x.teamId === 'B')!.mortoPenalty).toBe(0)
    expect(time(semMorto, 'B').score).toBe(-10)
  })

  test('empate de pontos na rodada: a dupla A é a vencedora', () => {
    const game = new Game([new HumanPlayer('Alice'), new AIPlayer('Ana', 'hard'), new AIPlayer('Bruno', 'hard'), new AIPlayer('Carlos', 'hard')])
    game.setup()
    game.state.mortos = []
    mao(game, 0, [ouros('5')])
    mao(game, 2, [paus('5')])
    mao(game, 1, [ouros('3')])
    mao(game, 3, [ouros('4')])

    game.finish()

    expect(time(game, 'A').score).toBe(-10)
    expect(time(game, 'B').score).toBe(-10)
    expect(game.state.winnerTeam).toBe('A')
  })

  test('dupla B com mais pontos na rodada é a vencedora', () => {
    const game = new Game([new HumanPlayer('Alice'), new AIPlayer('Ana', 'hard'), new AIPlayer('Bruno', 'hard'), new AIPlayer('Carlos', 'hard')])
    game.setup()
    game.state.mortos = []
    mao(game, 0, [ouros('5')])
    mao(game, 2, [paus('6')])
    mao(game, 1, [ouros('3')])
    mao(game, 3, [ouros('4')])
    time(game, 'B').melds = [new Canasta(sequencia('clubs', ['8', '9', '10']))]

    game.finish()

    expect(time(game, 'A').score).toBe(-10)
    expect(time(game, 'B').score).toBe(20)
    expect(game.state.winnerTeam).toBe('B')
  })
})

describe('partida', () => {
  test('duas rodadas acumulam placar e canastras; a nova rodada começa com mesa limpa', () => {
    const r1 = iniciar()
    prepararBatidaDeterministica(r1)
    store().discard(0)
    expect(store().matchScores).toEqual({ A: 345, B: -10 })

    store().startNextRound()
    const r2 = store().game!
    expect(r2).not.toBe(r1)
    expect(store().round).toBe(2)
    expect(store().roundFinalized).toBe(false)
    expect(r2.state.status).toBe('playing')
    expect(r2.state.teams.every(t => t.melds.length === 0 && t.score === 0 && !t.hasTakenMorto)).toBe(true)
    expect(r2.state.players.every(p => p.hand.getSize() === 11)).toBe(true)
    expect(r2.state.mortos).toHaveLength(2)
    expect(r2.state.discardPile).toHaveLength(0)
    expect(store().gameLog).toContain('Rodada 2 iniciada.')

    prepararBatidaDeterministica(r2)
    store().discard(0)

    expect(store().matchScores).toEqual({ A: 690, B: -20 })
    expect(store().matchCanastras).toEqual({ A: { clean: 2, dirty: 0 }, B: { clean: 0, dirty: 0 } })
    expect(store().matchWinner).toBeUndefined()
    expect(store().gameLog[store().gameLog.length - 1]).toBe('Fim da rodada 2.')
  })

  test(`a partida acaba exatamente ao atingir ${MATCH_TARGET} e não há próxima rodada`, () => {
    const game = iniciar()
    useGameStore.setState({ matchScores: { A: MATCH_TARGET - 345, B: 0 } })
    prepararBatidaDeterministica(game)

    store().discard(0)

    expect(store().matchScores.A).toBe(MATCH_TARGET)
    expect(store().matchWinner).toBe('A')
    expect(store().gameLog[store().gameLog.length - 1]).toBe('Fim da partida — Time A venceu!')

    store().startNextRound()
    expect(store().game).toBe(game)
    expect(store().round).toBe(1)
  })

  test('um ponto abaixo da meta a partida continua e a próxima rodada começa', () => {
    const game = iniciar()
    useGameStore.setState({ matchScores: { A: MATCH_TARGET - 346, B: 0 } })
    prepararBatidaDeterministica(game)

    store().discard(0)

    expect(store().matchScores.A).toBe(MATCH_TARGET - 1)
    expect(store().matchWinner).toBeUndefined()
    store().startNextRound()
    expect(store().round).toBe(2)
  })

  test('empate acima da meta vai para a dupla A', () => {
    const game = iniciar()
    useGameStore.setState({ matchScores: { A: 2700, B: 3055 } })
    prepararBatidaDeterministica(game)

    store().discard(0)

    expect(store().matchScores).toEqual({ A: 3045, B: 3045 })
    expect(store().matchWinner).toBe('A')
  })

  test('com as duas duplas acima da meta vence a de maior total, mesmo que tenha perdido a rodada', () => {
    const game = iniciar()
    useGameStore.setState({ matchScores: { A: 2700, B: 3200 } })
    prepararBatidaDeterministica(game)

    store().discard(0)

    expect(game.state.winnerTeam).toBe('A')
    expect(store().matchScores).toEqual({ A: 3045, B: 3190 })
    expect(store().matchWinner).toBe('B')
    expect(store().gameLog[store().gameLog.length - 1]).toBe('Fim da partida — Time B venceu!')
  })

  test('rodada com total negativo diminui o placar da partida, que pode ficar negativo', () => {
    const game = iniciar()
    useGameStore.setState({ matchScores: { A: 0, B: 50 } })
    prepararBatidaDeterministica(game)
    game.state.mortos = [novoMorto()]

    store().discard(0)

    expect(time(game, 'B').score).toBe(-110)
    expect(store().matchScores).toEqual({ A: 345, B: -60 })
    expect(store().matchWinner).toBeUndefined()
  })

  test('ações depois do fim da rodada não acumulam o placar de novo', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    store().discard(0)
    const placar = { ...store().matchScores }
    const versao = store().version

    store().drawFromDeck()
    store().takeDiscardPile()
    store().discard(0)
    store().aiTurn()

    expect(store().matchScores).toEqual(placar)
    expect(store().version).toBe(versao)
  })
})

describe('salvar e retomar', () => {
  test('salvar no meio da rodada e retomar reproduz mãos, monte, lixo, mortos, jogos, vez e bloqueio', () => {
    const game = iniciar()
    mao(game, 0, [espadas('3'), espadas('4'), espadas('5'), ouros('K'), paus('7')])
    game.state.discardPile = [copas('9')]
    store().takeDiscardPile()
    store().playCanasta([0, 1, 2])

    const antes = retrato(game)
    expect(antes.bloqueada).toBe(2)
    expect(antes.times[0].jogos).toEqual([['3S', '4S', '5S']])
    const log = [...store().gameLog]

    simularRecarga()

    const retomado = store().game!
    expect(retomado).not.toBe(game)
    expect(retrato(retomado)).toEqual(antes)
    expect(store().gameLog).toEqual(log)
    expect(store().matchScores).toEqual({ A: 0, B: 0 })
    expect(store().round).toBe(1)
    expect(store().roundFinalized).toBe(false)
    expect(store().matchConfig).toEqual({ playerName: 'Alice', aiDifficulty: 'hard', names: undefined })

    store().discard(2)
    expect(retomado.state.discardPile).toHaveLength(0)
    expect(retomado.state.currentPlayerIndex).toBe(0)

    store().discard(0)
    expect(retomado.state.discardPile.map(nome)).toEqual(['KD'])
    expect(retomado.state.currentPlayerIndex).toBe(1)
  })

  test('depois de retomar, a próxima compra é a mesma carta que estava no topo do monte salvo', () => {
    const game = iniciar()
    store().drawFromDeck()
    const topoSalvo = nome(game.state.deck[game.state.deck.length - 1])
    const mortosSalvos = game.state.mortos.map(m => m.map(nome))

    simularRecarga()

    const retomado = store().game!
    store().drawFromDeck()
    const maoAtual = cartasDe(retomado, 0)
    expect(maoAtual).toHaveLength(13)
    expect(nome(maoAtual[12])).toBe(topoSalvo)
    expect(retomado.state.mortos.map(m => m.map(nome))).toEqual(mortosSalvos)
  })

  test('retomar uma rodada já finalizada mantém o resultado e permite iniciar a próxima', () => {
    const game = iniciar()
    prepararBatidaDeterministica(game)
    store().discard(0)
    const detalhes = JSON.parse(JSON.stringify(game.state.scoreBreakdowns))

    simularRecarga()

    const retomado = store().game!
    expect(retomado.state.status).toBe('finished')
    expect(retomado.state.closerSeat).toBe(0)
    expect(retomado.state.winnerTeam).toBe('A')
    expect(retomado.state.scoreBreakdowns).toEqual(detalhes)
    expect(store().roundFinalized).toBe(true)
    expect(store().matchScores).toEqual({ A: 345, B: -10 })

    store().discard(0)
    expect(store().matchScores).toEqual({ A: 345, B: -10 })

    store().startNextRound()
    expect(store().round).toBe(2)
    expect(store().game!.state.status).toBe('playing')
  })

  test('retomar uma rodada em que a dupla está vulnerável preserva o VU e o aviso no log', () => {
    iniciar()
    useGameStore.setState({ matchScores: { A: 1600, B: 400 } })
    store().startNextRound()
    const game = store().game!
    expect(time(game, 'A').openingMinimum).toBe(VU_OPENING_MINIMUM)
    store().drawFromDeck()
    const antes = retrato(game)

    simularRecarga()

    const retomado = store().game!
    expect(retrato(retomado)).toEqual(antes)
    expect(time(retomado, 'A').openingMinimum).toBe(VU_OPENING_MINIMUM)
    expect(time(retomado, 'B').openingMinimum).toBe(0)
    expect(retomado.needsOpening(time(retomado, 'A'))).toBe(true)
    expect(store().gameLog.some(l => l.startsWith('⚠️ Time A (Nós) está vulnerável (VU)'))).toBe(true)
  })
})

describe('VU nas situações de jogo offline', () => {
  function rodadaComPlacar(placar: Record<TeamId, number>): Game {
    iniciar()
    useGameStore.setState({ matchScores: placar })
    store().startNextRound()
    return store().game!
  }

  test('a rodada seguinte marca só a dupla com 1500+ e registra o aviso', () => {
    const game = rodadaComPlacar({ A: 1500, B: 1499 })

    expect(time(game, 'A').openingMinimum).toBe(75)
    expect(time(game, 'B').openingMinimum).toBe(0)
    const log = store().gameLog
    expect(log).toContain('⚠️ Time A (Nós) está vulnerável (VU): a primeira descida da rodada precisa somar 75 pontos.')
    expect(log.some(l => l.includes('Time B (Eles) está vulnerável'))).toBe(false)
  })

  test('VU é reavaliado a cada rodada: placar que caiu abaixo de 1500 tira o VU', () => {
    const game = rodadaComPlacar({ A: 1600, B: 1600 })
    expect(game.state.teams.map(t => t.openingMinimum)).toEqual([75, 75])

    useGameStore.setState({ matchScores: { A: 1440, B: 1600 } })
    store().startNextRound()
    const seguinte = store().game!

    expect(time(seguinte, 'A').openingMinimum).toBe(0)
    expect(time(seguinte, 'B').openingMinimum).toBe(75)
  })

  test('dupla vulnerável compra, pega o lixo e descarta normalmente; só a descida abaixo de 75 é recusada', () => {
    const game = rodadaComPlacar({ A: 1500, B: 0 })
    mao(game, 0, [
      espadas('3'), espadas('4'), espadas('5'),
      ouros('J'), ouros('Q'), ouros('K'),
      paus('A'), copas('A'), espadas('A'),
      paus('9'),
    ])
    game.state.discardPile = [copas('7'), ouros('8')]

    store().takeDiscardPile()
    expect(cartasDe(game, 0)).toHaveLength(12)

    store().playCanasta([0, 1, 2])
    store().playCanasta([6, 7, 8])
    expect(time(game, 'A').melds).toHaveLength(0)
    expect(game.openingShortfall(cartasDe(game, 0).slice(6, 9))).toBe(30)

    expect(store().playMelds([[3, 4, 5], [6, 7, 8]])).toBe(true)
    expect(time(game, 'A').melds).toHaveLength(2)
    expect(store().gameLog[store().gameLog.length - 1]).toBe('Alice abriu o jogo da dupla com 75 pontos (vulnerável).')
    expect(game.needsOpening()).toBe(false)

    store().playCanasta([0, 1, 2])
    expect(time(game, 'A').melds).toHaveLength(3)

    store().discard(0)
    expect(game.state.discardPile.map(nome)).toEqual(['9C'])
    expect(game.state.currentPlayerIndex).toBe(1)
  })

  test('abertura vulnerável que esvazia a mão pega o morto; abertura curta que esvaziaria a mão é recusada', () => {
    const game = rodadaComPlacar({ A: 2000, B: 0 })
    mao(game, 0, [espadas('3'), espadas('4'), espadas('5')])

    store().playCanasta([0, 1, 2])
    expect(cartasDe(game, 0)).toHaveLength(3)
    expect(time(game, 'A').hasTakenMorto).toBe(false)

    mao(game, 0, [ouros('J'), ouros('Q'), ouros('K'), paus('A'), copas('A'), espadas('A')])
    expect(store().playMelds([[0, 1, 2], [3, 4, 5]])).toBe(true)

    expect(time(game, 'A').hasTakenMorto).toBe(true)
    expect(cartasDe(game, 0)).toHaveLength(11)
    expect(game.state.currentPlayerIndex).toBe(0)
    expect(store().gameLog).toContain('Alice pegou o morto!')
  })

  test('a abertura do parceiro libera a dupla: depois dela qualquer jogo pode ser baixado', () => {
    const game = rodadaComPlacar({ A: 1500, B: 0 })
    game.state.currentPlayerIndex = 2
    mao(game, 2, [ouros('8'), ouros('9'), ouros('10'), ouros('J'), ouros('Q'), ouros('K'), ouros('A'), paus('4'), paus('5')])

    expect(store().playMelds([[0, 1, 2, 3, 4, 5]])).toBe(false)
    expect(store().playMelds([[0, 1, 2, 3, 4, 5, 6]])).toBe(true)
    expect(time(game, 'A').melds[0].cards).toHaveLength(7)
    expect(store().gameLog[store().gameLog.length - 1]).toBe('Bruno abriu o jogo da dupla com 75 pontos (vulnerável).')

    game.state.currentPlayerIndex = 0
    mao(game, 0, [espadas('3'), espadas('4'), espadas('5'), copas('K')])
    store().playCanasta([0, 1, 2])

    expect(time(game, 'A').melds).toHaveLength(2)
    expect(cartasDe(game, 0).map(nome)).toEqual(['KH'])
  })
})
