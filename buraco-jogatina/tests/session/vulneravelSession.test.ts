import { GameSession } from '../../src/session/GameSession'
import type { SeatConfig } from '../../src/session/types'
import { Game, openingPoints } from '../../src/engine/game'
import { Card, Rank, Suit } from '../../src/engine/card'
import { Hand } from '../../src/engine/hand'
import { Canasta } from '../../src/engine/canasta'
import type { AIDifficulty } from '../../src/engine/ai'
import type { Team, TeamId } from '../../src/engine/gameState'

type Placar = Record<TeamId, number>

const c = (rank: Rank, suit: Suit) => new Card(suit, rank, false)
const coringa = () => new Card('hearts', '2', true)
const seq = (suit: Suit, ranks: Rank[]) => ranks.map(r => c(r, suit))

const MSG_VU_A = '⚠️ Time A está vulnerável (VU): a primeira descida da rodada precisa somar 75 pontos.'
const MSG_VU_B = '⚠️ Time B está vulnerável (VU): a primeira descida da rodada precisa somar 75 pontos.'

function humanos(): SeatConfig[] {
  return [
    { kind: 'human', name: 'P0' },
    { kind: 'human', name: 'P1' },
    { kind: 'human', name: 'P2' },
    { kind: 'human', name: 'P3' },
  ]
}

function jogoDe(session: GameSession): Game {
  return (session as any).game as Game
}

function time(session: GameSession, id: TeamId): Team {
  return jogoDe(session).state.teams.find(t => t.id === id)!
}

function logDe(session: GameSession): string[] {
  return (session as any).log as string[]
}

function sessaoComPlacar(placar: Placar, seats: SeatConfig[] = humanos()): GameSession {
  const session = new GameSession(seats)
  ;(session as any).matchScores = { ...placar }
  jogoDe(session).setOpeningMinimums(placar)
  return session
}

function comprarEDefinirMao(session: GameSession, seat: number, cartas: Card[]): void {
  expect(session.applyIntent(seat, { type: 'draw' }).ok).toBe(true)
  jogoDe(session).state.players[seat].hand = new Hand(cartas)
}

function maoAbertura(): Card[] {
  return [
    ...seq('spades', ['Q', 'K', 'A']),
    ...seq('diamonds', ['8', '9', '10']),
    ...seq('clubs', ['3', '4', '5']),
    ...seq('hearts', ['6', '7', '8']),
    c('9', 'clubs'),
    c('K', 'diamonds'),
  ]
}

function canastraLimpa7(): Canasta {
  return new Canasta(seq('hearts', ['4', '5', '6', '7', '8', '9', '10']))
}

function encerrarRodada(session: GameSession, closerSeat: number): void {
  const game = jogoDe(session)
  game.state.currentPlayerIndex = closerSeat
  expect(session.applyIntent(closerSeat, { type: 'draw' }).ok).toBe(true)
  const team = game.state.teams.find(t => t.seats.includes(closerSeat))!
  team.hasTakenMorto = true
  team.mortoUsed = true
  team.melds.push(canastraLimpa7())
  game.state.mortos = []
  for (let seat = 0; seat < 4; seat++) {
    game.state.players[seat].hand = new Hand(seat === closerSeat ? [c('4', 'diamonds')] : [c('3', 'clubs')])
  }
  expect(session.applyIntent(closerSeat, { type: 'discard', cardIndex: 0 }).ok).toBe(true)
  expect(session.status).toBe('finished')
}

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('VU online: início de rodada (nextRound) pelo placar da partida', () => {
  it('a primeira rodada da sessão nunca é vulnerável e não emite aviso', () => {
    const session = new GameSession(humanos())
    for (let seat = 0; seat < 4; seat++) {
      expect(session.getViewFor(seat).teams.map(t => t.openingMinimum)).toEqual([0, 0])
    }
    expect(logDe(session).some(l => l.includes('vulnerável (VU)'))).toBe(false)
  })

  it('o helper de fim de rodada produz placares conhecidos (+345 para quem bate, -10 para o outro)', () => {
    const session = new GameSession(humanos())
    encerrarRodada(session, 0)
    const view = session.getViewFor(0)
    expect(view.teams.find(t => t.id === 'A')!.score).toBe(345)
    expect(view.teams.find(t => t.id === 'B')!.score).toBe(-10)
    expect(view.matchScores).toEqual({ A: 345, B: -10 })
  })

  it('ao cruzar 1500 na soma da rodada as duas duplas ficam VU e os avisos aparecem depois de "Rodada 2 iniciada."', () => {
    const session = new GameSession(humanos())
    ;(session as any).matchScores = { A: 1200, B: 1600 }
    encerrarRodada(session, 0)
    expect(session.getViewFor(0).matchScores).toEqual({ A: 1545, B: 1590 })

    expect(session.applyIntent(0, { type: 'nextRound' })).toEqual({ ok: true })

    const view = session.getViewFor(0)
    expect(view.round).toBe(2)
    expect(view.teams.find(t => t.id === 'A')!.openingMinimum).toBe(75)
    expect(view.teams.find(t => t.id === 'B')!.openingMinimum).toBe(75)
    const log = view.log
    const inicio = log.lastIndexOf('Rodada 2 iniciada.')
    expect(inicio).toBeGreaterThanOrEqual(0)
    expect(log.slice(inicio + 1)).toEqual([MSG_VU_A, MSG_VU_B])
  })

  it('exatamente 1500 deixa VU; 1499 não deixa e não gera aviso para aquela dupla', () => {
    const vu = new GameSession(humanos())
    ;(vu as any).matchScores = { A: 1155, B: 0 }
    encerrarRodada(vu, 0)
    expect(vu.getViewFor(0).matchScores.A).toBe(1500)
    vu.applyIntent(0, { type: 'nextRound' })
    expect(vu.getViewFor(2).teams.find(t => t.id === 'A')!.openingMinimum).toBe(75)
    expect(vu.getViewFor(2).teams.find(t => t.id === 'B')!.openingMinimum).toBe(0)
    const logVu = logDe(vu)
    expect(logVu.slice(logVu.lastIndexOf('Rodada 2 iniciada.') + 1)).toEqual([MSG_VU_A])

    const naoVu = new GameSession(humanos())
    ;(naoVu as any).matchScores = { A: 1154, B: 0 }
    encerrarRodada(naoVu, 0)
    expect(naoVu.getViewFor(0).matchScores.A).toBe(1499)
    naoVu.applyIntent(0, { type: 'nextRound' })
    expect(naoVu.getViewFor(0).teams.map(t => t.openingMinimum)).toEqual([0, 0])
    const logNaoVu = logDe(naoVu)
    expect(logNaoVu[logNaoVu.length - 1]).toBe('Rodada 2 iniciada.')
    expect(logNaoVu.some(l => l.includes('vulnerável (VU)'))).toBe(false)
  })

  it('a condição é reavaliada a cada rodada: cair abaixo de 1500 tira o VU na rodada seguinte', () => {
    const session = new GameSession(humanos())
    ;(session as any).matchScores = { A: 1155, B: 0 }
    encerrarRodada(session, 0)
    session.applyIntent(0, { type: 'nextRound' })
    expect(time(session, 'A').openingMinimum).toBe(75)

    encerrarRodada(session, 1)
    expect(session.getViewFor(0).matchScores).toEqual({ A: 1490, B: 335 })
    session.applyIntent(0, { type: 'nextRound' })

    const view = session.getViewFor(3)
    expect(view.round).toBe(3)
    expect(view.teams.map(t => t.openingMinimum)).toEqual([0, 0])
    const log = view.log
    expect(log[log.length - 1]).toBe('Rodada 3 iniciada.')
  })

  it('VU de uma dupla não contamina a outra: só B vulnerável', () => {
    const session = new GameSession(humanos())
    ;(session as any).matchScores = { A: 0, B: 1510 }
    encerrarRodada(session, 0)
    session.applyIntent(0, { type: 'nextRound' })
    expect(time(session, 'A').openingMinimum).toBe(0)
    expect(time(session, 'B').openingMinimum).toBe(75)
    const log = logDe(session)
    expect(log.slice(log.lastIndexOf('Rodada 2 iniciada.') + 1)).toEqual([MSG_VU_B])
  })

  it('com a partida encerrada o nextRound é recusado e nenhum aviso de VU é emitido', () => {
    const session = new GameSession(humanos())
    ;(session as any).matchScores = { A: 2700, B: 1600 }
    encerrarRodada(session, 0)
    expect(session.getViewFor(0).matchWinner).toBe('A')
    const tamanho = logDe(session).length
    const result = session.applyIntent(0, { type: 'nextRound' })
    expect(result.ok).toBe(false)
    expect(logDe(session)).toHaveLength(tamanho)
  })
})

describe('VU online: as views expõem openingMinimum para todos', () => {
  it('todos os assentos e a view pública enxergam o mínimo das duas duplas', () => {
    const session = sessaoComPlacar({ A: 1500, B: 900 })
    const views = [0, 1, 2, 3].map(s => session.getViewFor(s)).concat(session.getPublicView())
    for (const view of views) {
      expect(view.teams.find(t => t.id === 'A')!.openingMinimum).toBe(75)
      expect(view.teams.find(t => t.id === 'B')!.openingMinimum).toBe(0)
    }
  })

  it('o mínimo continua visível depois da abertura, mas a dupla já tem jogos na mesa', () => {
    const session = sessaoComPlacar({ A: 1600, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    expect(session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] }).ok).toBe(true)
    const teamA = session.getViewFor(1).teams.find(t => t.id === 'A')!
    expect(teamA.openingMinimum).toBe(75)
    expect(teamA.melds).toHaveLength(3)
  })
})

describe('VU online: intent playMelds', () => {
  it('abre com vários jogos somando 80, credita a dupla e registra o log de abertura', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())

    const result = session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] })

    expect(result).toEqual({ ok: true })
    const view = session.getViewFor(0)
    const teamA = view.teams.find(t => t.id === 'A')!
    expect(teamA.melds).toHaveLength(3)
    expect(teamA.score).toBe(80)
    expect(view.yourHand.map(x => `${x.rank}${x.suit}`)).toEqual(['6hearts', '7hearts', '8hearts', '9clubs', 'Kdiamonds'])
    expect(view.phase).toBe('play')
    expect(view.currentSeat).toBe(0)
    expect(view.log[view.log.length - 1]).toBe('P0 abriu o jogo da dupla com 80 pontos (vulnerável).')
    expect(jogoDe(session).needsOpening(time(session, 'A'))).toBe(false)
  })

  it('a ordem dos jogos na mesa segue a ordem dos grupos enviados', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    session.applyIntent(0, { type: 'playMelds', groups: [[6, 7, 8], [0, 1, 2], [3, 4, 5]] })
    const melds = session.getViewFor(0).teams.find(t => t.id === 'A')!.melds
    expect(melds.map(m => m.layout[0].card.suit)).toEqual(['clubs', 'spades', 'diamonds'])
  })

  it('soma abaixo de 75 é recusada com a mensagem "vulneravel" e sem efeito colateral', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    const logAntes = logDe(session).length

    const result = session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5]] })

    expect(result).toEqual({ ok: false, error: 'vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 65)' })
    const view = session.getViewFor(0)
    expect(view.yourHand).toHaveLength(14)
    expect(view.teams.find(t => t.id === 'A')!.melds).toHaveLength(0)
    expect(view.teams.find(t => t.id === 'A')!.score).toBe(0)
    expect(view.phase).toBe('play')
    expect(view.currentSeat).toBe(0)
    expect(logDe(session)).toHaveLength(logAntes)
  })

  it('depois do erro de VU o turno continua: o jogador descarta e a vez passa sem a dupla ter aberto', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    expect(session.applyIntent(0, { type: 'playCanasta', cardIndices: [6, 7, 8] }).ok).toBe(false)
    expect(session.applyIntent(0, { type: 'discard', cardIndex: 13 })).toEqual({ ok: true })
    expect(session.currentSeat).toBe(1)
    expect(session.phase).toBe('draw')
    expect(jogoDe(session).needsOpening(time(session, 'A'))).toBe(true)
  })

  it('curinga vale 20: 45 + 30 = 75 exatos passa; 45 + 25 = 70 não passa', () => {
    const mao = [
      c('K', 'clubs'), c('A', 'clubs'), coringa(),
      ...seq('diamonds', ['8', '9', '10']),
      ...seq('hearts', ['3', '4', '5', '6', '7']),
    ]
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, mao)

    const setenta = session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [6, 7, 8, 9, 10]] })
    expect(setenta.ok).toBe(false)
    expect(setenta.error).toBe('vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 70)')

    const setentaECinco = session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5]] })
    expect(setentaECinco).toEqual({ ok: true })
    expect(session.getViewFor(0).log.slice(-1)[0]).toBe('P0 abriu o jogo da dupla com 75 pontos (vulnerável).')
  })

  it('o 2 natural conta 10 na soma informada na mensagem de erro', () => {
    const mao = [...seq('hearts', ['A', '2', '3']), ...seq('spades', ['Q', 'K', 'A']), c('9', 'clubs'), c('5', 'diamonds')]
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, mao)
    const result = session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5]] })
    expect(result.error).toBe('vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 65)')
  })

  it('fase de compra: playMelds é recusado antes de comprar', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    jogoDe(session).state.players[0].hand = new Hand(maoAbertura())
    const result = session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] })
    expect(result).toEqual({ ok: false, error: 'fase invalida: e preciso comprar antes' })
    expect(time(session, 'A').melds).toHaveLength(0)
  })

  it('fora da vez: outro assento não consegue baixar, mesmo com abertura válida', () => {
    const session = sessaoComPlacar({ A: 1500, B: 1500 })
    comprarEDefinirMao(session, 0, maoAbertura())
    jogoDe(session).state.players[2].hand = new Hand(maoAbertura())
    jogoDe(session).state.players[1].hand = new Hand(maoAbertura())
    for (const seat of [1, 2, 3]) {
      const result = session.applyIntent(seat, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] })
      expect(result).toEqual({ ok: false, error: 'nao e a vez deste assento' })
    }
    expect(time(session, 'A').melds).toHaveLength(0)
    expect(time(session, 'B').melds).toHaveLength(0)
  })

  it('rodada encerrada: playMelds é recusado', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    encerrarRodada(session, 0)
    const result = session.applyIntent(session.currentSeat, { type: 'playMelds', groups: [[0, 1, 2]] })
    expect(result).toEqual({ ok: false, error: 'a partida nao esta em andamento' })
  })

  it.each([
    ['índice fora da mão', [[0, 1, 2], [3, 4, 99]]],
    ['índice negativo', [[-1, 0, 1], [3, 4, 5], [6, 7, 8]]],
    ['índice fracionário', [[0, 1, 1.5], [3, 4, 5], [6, 7, 8]]],
    ['índice repetido entre grupos', [[0, 1, 2], [2, 3, 4], [6, 7, 8]]],
    ['índice repetido no mesmo grupo', [[0, 0, 1], [3, 4, 5], [6, 7, 8]]],
  ])('%s: "indices de carta invalidos" sem mexer na mão', (_nome, groups) => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    const result = session.applyIntent(0, { type: 'playMelds', groups: groups as number[][] })
    expect(result).toEqual({ ok: false, error: 'indices de carta invalidos' })
    expect(session.getViewFor(0).yourHand).toHaveLength(14)
    expect(time(session, 'A').melds).toHaveLength(0)
  })

  it('lista de grupos vazia: "nenhuma carta selecionada"', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    expect(session.applyIntent(0, { type: 'playMelds', groups: [] })).toEqual({ ok: false, error: 'nenhuma carta selecionada' })
  })

  it.each([
    ['grupo vazio junto de jogos válidos', [[0, 1, 2], [3, 4, 5], [6, 7, 8], []]],
    ['grupo com 2 cartas', [[0, 1, 2], [3, 4, 5], [6, 7]]],
    ['grupo que não é sequência', [[0, 1, 2], [3, 4, 5], [6, 7, 12]]],
    ['naipes misturados', [[0, 1, 2], [3, 4, 9], [6, 7, 8]]],
  ])('%s: jogo inválido é recusado atomicamente (nada vai para a mesa)', (_nome, groups) => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    const result = session.applyIntent(0, { type: 'playMelds', groups: groups as number[][] })
    expect(result).toEqual({ ok: false, error: 'conjunto de cartas nao forma uma canastra valida' })
    expect(session.getViewFor(0).yourHand).toHaveLength(14)
    expect(time(session, 'A').melds).toHaveLength(0)
    expect(time(session, 'A').score).toBe(0)
  })

  it('jogo inválido tem prioridade sobre a mensagem de VU', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    const result = session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 9]] })
    expect(result.error).toBe('conjunto de cartas nao forma uma canastra valida')
  })

  it('abertura que deixaria 1 carta sem poder bater é recusada; deixando 2 cartas passa', () => {
    const recusada = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(recusada, 0, maoAbertura().slice(0, 10))
    const teamA = time(recusada, 'A')
    teamA.hasTakenMorto = true
    teamA.mortoTakenBySeat = 0
    teamA.mortoUsed = false
    const result = recusada.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] })
    expect(result).toEqual({ ok: false, error: 'essa jogada esvaziaria a mao sem poder bater' })
    expect(recusada.getViewFor(0).yourHand).toHaveLength(10)
    expect(teamA.melds).toHaveLength(0)

    const aceita = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(aceita, 0, maoAbertura().slice(0, 11))
    const teamA2 = time(aceita, 'A')
    teamA2.hasTakenMorto = true
    teamA2.mortoTakenBySeat = 0
    teamA2.mortoUsed = false
    expect(aceita.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] }).ok).toBe(true)
    expect(aceita.getViewFor(0).yourHand).toHaveLength(2)
    expect(teamA2.mortoUsed).toBe(true)
  })

  it('abertura que esvazia a mão com morto disponível pega o morto automaticamente', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura().slice(0, 9))
    const result = session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] })
    expect(result.ok).toBe(true)
    const view = session.getViewFor(0)
    expect(view.yourHand).toHaveLength(11)
    expect(view.teams.find(t => t.id === 'A')!.hasTakenMorto).toBe(true)
    expect(view.mortos).toEqual([{ count: 11 }])
    expect(view.log.slice(-2)).toEqual(['P0 abriu o jogo da dupla com 80 pontos (vulnerável).', 'P0 pegou o morto!'])
    expect(view.status).toBe('playing')
  })

  it('bater na própria abertura: canastra limpa + jogo extra somando 85 encerra a rodada com bônus', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    const mao = [...seq('hearts', ['4', '5', '6', '7', '8', '9', '10']), ...seq('spades', ['Q', 'K', 'A'])]
    comprarEDefinirMao(session, 0, mao)
    const teamA = time(session, 'A')
    teamA.hasTakenMorto = true
    teamA.mortoTakenBySeat = 0
    teamA.mortoUsed = false
    jogoDe(session).state.mortos = []

    const result = session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2, 3, 4, 5, 6], [7, 8, 9]] })

    expect(result).toEqual({ ok: true })
    const view = session.getViewFor(0)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBe(0)
    const breakdownA = view.scoreBreakdowns!.find(b => b.teamId === 'A')!
    expect(breakdownA.batidaBonus).toBe(100)
    expect(breakdownA.mortoPenalty).toBe(0)
    expect(breakdownA.meldPoints).toBe(250 + 35)
  })

  it('depois de abrir, playMelds e playCanasta pequenos funcionam sem mínimo', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, [...maoAbertura(), ...seq('spades', ['3', '4', '5'])])
    expect(session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] }).ok).toBe(true)
    const hand = session.getViewFor(0).yourHand
    const idx = (rank: string, suit: string) => hand.findIndex(x => x.rank === rank && x.suit === suit)

    const pequeno = session.applyIntent(0, { type: 'playCanasta', cardIndices: [idx('6', 'hearts'), idx('7', 'hearts'), idx('8', 'hearts')] })
    expect(pequeno).toEqual({ ok: true })

    const hand2 = session.getViewFor(0).yourHand
    const idx2 = (rank: string, suit: string) => hand2.findIndex(x => x.rank === rank && x.suit === suit)
    const multi = session.applyIntent(0, { type: 'playMelds', groups: [[idx2('3', 'spades'), idx2('4', 'spades'), idx2('5', 'spades')]] })
    expect(multi).toEqual({ ok: true })
    expect(session.getViewFor(0).log.slice(-1)[0]).toBe('P0 baixou 1 jogo(s)!')
    expect(time(session, 'A').melds).toHaveLength(5)
  })

  it('dupla não vulnerável baixa vários jogos pequenos com o log comum', () => {
    const session = sessaoComPlacar({ A: 1499, B: 1500 })
    comprarEDefinirMao(session, 0, maoAbertura())
    const result = session.applyIntent(0, { type: 'playMelds', groups: [[6, 7, 8], [9, 10, 11]] })
    expect(result).toEqual({ ok: true })
    expect(time(session, 'A').melds).toHaveLength(2)
    expect(session.getViewFor(0).log.slice(-1)[0]).toBe('P0 baixou 2 jogo(s)!')
  })
})

describe('VU online: intent playCanasta', () => {
  it('jogo único abaixo de 75 retorna o erro "vulneravel" com a soma das cartas', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    const result = session.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1, 2] })
    expect(result).toEqual({ ok: false, error: 'vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 35)' })
    expect(session.getViewFor(0).yourHand).toHaveLength(14)
    expect(time(session, 'A').melds).toHaveLength(0)
  })

  it('jogo único de 75+ abre normalmente pelo playCanasta', () => {
    const session = sessaoComPlacar({ A: 2000, B: 0 })
    comprarEDefinirMao(session, 0, [...seq('diamonds', ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']), c('3', 'clubs'), c('4', 'clubs')])
    const result = session.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8] })
    expect(result).toEqual({ ok: true })
    expect(time(session, 'A').melds).toHaveLength(1)
    expect(time(session, 'A').melds[0].isCanastra).toBe(true)
  })

  it('a dupla não vulnerável baixa 3-4-5 normalmente mesmo com o adversário VU', () => {
    const session = sessaoComPlacar({ A: 0, B: 1800 })
    comprarEDefinirMao(session, 0, maoAbertura())
    expect(session.applyIntent(0, { type: 'playCanasta', cardIndices: [6, 7, 8] })).toEqual({ ok: true })
  })

  it('o adversário VU recebe o erro na vez dele', () => {
    const session = sessaoComPlacar({ A: 0, B: 1800 })
    comprarEDefinirMao(session, 0, maoAbertura())
    expect(session.applyIntent(0, { type: 'discard', cardIndex: 13 }).ok).toBe(true)
    comprarEDefinirMao(session, 1, maoAbertura())
    const result = session.applyIntent(1, { type: 'playCanasta', cardIndices: [3, 4, 5] })
    expect(result).toEqual({ ok: false, error: 'vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 30)' })
  })

  it('o parceiro também fica preso ao mínimo enquanto a dupla não abriu', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    expect(session.applyIntent(0, { type: 'discard', cardIndex: 13 }).ok).toBe(true)
    comprarEDefinirMao(session, 1, maoAbertura())
    expect(session.applyIntent(1, { type: 'discard', cardIndex: 13 }).ok).toBe(true)
    comprarEDefinirMao(session, 2, maoAbertura())
    const result = session.applyIntent(2, { type: 'playCanasta', cardIndices: [6, 7, 8] })
    expect(result.error).toBe('vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 15)')
  })

  it('depois que um jogador abre, o parceiro baixa jogo pequeno sem mínimo', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, maoAbertura())
    expect(session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [9, 10, 11]] }).ok).toBe(true)
    expect(session.applyIntent(0, { type: 'discard', cardIndex: 0 }).ok).toBe(true)
    comprarEDefinirMao(session, 1, maoAbertura())
    expect(session.applyIntent(1, { type: 'discard', cardIndex: 13 }).ok).toBe(true)
    comprarEDefinirMao(session, 2, maoAbertura())
    expect(session.applyIntent(2, { type: 'playCanasta', cardIndices: [6, 7, 8] })).toEqual({ ok: true })
    expect(time(session, 'A').melds).toHaveLength(4)
  })

  it('extendMeld funciona normalmente depois da abertura', () => {
    const session = sessaoComPlacar({ A: 1500, B: 0 })
    comprarEDefinirMao(session, 0, [...maoAbertura(), c('J', 'diamonds')])
    expect(session.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5], [6, 7, 8]] }).ok).toBe(true)
    const hand = session.getViewFor(0).yourHand
    const valete = hand.findIndex(x => x.rank === 'J' && x.suit === 'diamonds')
    expect(session.applyIntent(0, { type: 'extendMeld', meldIndex: 1, cardIndices: [valete] })).toEqual({ ok: true })
    expect(time(session, 'A').melds[1].cards).toHaveLength(4)
  })
})

describe('VU online: turnos da IA', () => {
  function mesaIA(difficulty: AIDifficulty, placar: Placar, maoIA: Card[], topoDoMonte: Card): GameSession {
    const seats: SeatConfig[] = [
      { kind: 'human', name: 'Humano' },
      { kind: 'ai', name: 'IA1', difficulty },
      { kind: 'human', name: 'Parceiro' },
      { kind: 'ai', name: 'IA3', difficulty },
    ]
    const session = sessaoComPlacar(placar, seats)
    const game = jogoDe(session)
    game.state.currentPlayerIndex = 1
    game.state.discardPile = []
    game.state.deck.push(topoDoMonte)
    game.state.players[1].hand = new Hand(maoIA)
    return session
  }

  const maoPequena = () => [...seq('diamonds', ['3', '4', '5']), ...seq('clubs', ['3', '4', '5']), c('6', 'hearts'), c('7', 'spades')]
  const maoDe75 = () => [...seq('spades', ['8', '9', '10', 'J', 'Q', 'K', 'A']), ...seq('diamonds', ['3', '4', '5']), c('7', 'clubs')]

  function registrarAberturas(): { aberturas: { team: TeamId; pontos: number; minimo: number }[] } {
    const original = Game.prototype.playMelds
    const registro = { aberturas: [] as { team: TeamId; pontos: number; minimo: number }[] }
    jest.spyOn(Game.prototype, 'playMelds').mockImplementation(function (this: Game, groups: Card[][]) {
      const team = this.getTeamOfCurrentPlayer()
      const abrindo = team.melds.length === 0
      const ok = original.call(this, groups)
      if (ok && abrindo) {
        registro.aberturas.push({ team: team.id, pontos: openingPoints(groups.flat()), minimo: team.openingMinimum })
      }
      return ok
    })
    return registro
  }

  it.each(['easy', 'medium', 'hard'] as AIDifficulty[])(
    'IA %s vulnerável com mão que não chega a 75 não baixa nada e descarta',
    difficulty => {
      const session = mesaIA(difficulty, { A: 0, B: 1500 }, maoPequena(), c('3', 'spades'))
      session.runNextAiTurn()
      expect(time(session, 'B').melds).toHaveLength(0)
      expect(jogoDe(session).state.players[1].hand.getSize()).toBe(8)
      expect(jogoDe(session).state.discardPile).toHaveLength(1)
      expect(session.currentSeat).toBe(2)
      expect(session.phase).toBe('draw')
    }
  )

  it.each(['easy', 'medium', 'hard'] as AIDifficulty[])(
    'IA %s não vulnerável com a mesma mão baixa jogo pequeno (regra não afeta quem não é VU)',
    difficulty => {
      const registro = registrarAberturas()
      const session = mesaIA(difficulty, { A: 1500, B: 1499 }, maoPequena(), c('3', 'spades'))
      session.runNextAiTurn()
      expect(time(session, 'B').melds.length).toBeGreaterThan(0)
      expect(registro.aberturas).toHaveLength(1)
      expect(registro.aberturas[0].team).toBe('B')
      expect(registro.aberturas[0].pontos).toBeLessThan(75)
    }
  )

  it.each(['easy', 'medium', 'hard'] as AIDifficulty[])(
    'IA %s vulnerável com 75 em mãos abre o jogo e registra o log de abertura',
    difficulty => {
      const registro = registrarAberturas()
      const session = mesaIA(difficulty, { A: 0, B: 1700 }, maoDe75(), c('3', 'spades'))
      const eventos = session.runNextAiTurn()
      expect(time(session, 'B').melds.length).toBeGreaterThan(0)
      expect(eventos).toContain('IA1 abriu o jogo da dupla com 75 pontos (vulnerável).')
      expect(registro.aberturas).toEqual([{ team: 'B', pontos: 75, minimo: 75 }])
      expect(session.currentSeat).toBe(2)
    }
  )

  it('IA vulnerável com curinga monta abertura de 75+ e nunca abre abaixo do mínimo', () => {
    const registro = registrarAberturas()
    const mao = [c('K', 'clubs'), c('A', 'clubs'), coringa(), ...seq('diamonds', ['8', '9', '10']), c('3', 'hearts'), c('6', 'spades')]
    const session = mesaIA('hard', { A: 0, B: 1500 }, mao, c('3', 'spades'))
    session.runNextAiTurn()
    expect(registro.aberturas).toHaveLength(1)
    expect(registro.aberturas[0].pontos).toBeGreaterThanOrEqual(75)
    expect(time(session, 'B').melds.length).toBeGreaterThanOrEqual(2)
  })

  it('soak com semente: IAs vulneráveis nunca fazem a primeira descida com menos de 75 em várias rodadas e dificuldades', () => {
    const rand = lcg(20261015)
    jest.spyOn(Math, 'random').mockImplementation(rand)
    const registro = registrarAberturas()
    const difficulties: AIDifficulty[] = ['easy', 'medium', 'hard']
    const configs: Placar[] = [
      { A: 1500, B: 0 },
      { A: 0, B: 1500 },
      { A: 2200, B: 1800 },
      { A: 1499, B: 1499 },
    ]
    const MAX_TURNOS = 4000
    let aberturasVu = 0
    let aberturasLivresPequenas = 0
    let checagensDeTurno = 0

    for (let partida = 0; partida < 4; partida++) {
      const seats: SeatConfig[] = [0, 1, 2, 3].map(i => ({
        kind: 'ai',
        name: `IA${i}`,
        difficulty: difficulties[Math.floor(rand() * 3)],
      }))
      const session = new GameSession(seats, 1_000_000)

      for (let rodada = 0; rodada < 6; rodada++) {
        if (rodada > 0) {
          const config = configs[Math.floor(rand() * configs.length)]
          ;(session as any).matchScores = { ...config }
          expect(session.applyIntent(0, { type: 'nextRound' }).ok).toBe(true)
          const view = session.getPublicView()
          expect(view.teams.find(t => t.id === 'A')!.openingMinimum).toBe(config.A >= 1500 ? 75 : 0)
          expect(view.teams.find(t => t.id === 'B')!.openingMinimum).toBe(config.B >= 1500 ? 75 : 0)
        }

        let turnos = 0
        while (session.status === 'playing') {
          if (++turnos > MAX_TURNOS) throw new Error('rodada de IA não terminou')
          const team = jogoDe(session).getTeamOfCurrentPlayer()
          const antes = team.melds.length
          const minimo = team.openingMinimum
          session.runNextAiTurn()
          if (minimo > 0 && antes === 0 && team.melds.length > 0) {
            checagensDeTurno++
            const naMesa = openingPoints(team.melds.flatMap(m => m.cards))
            expect(naMesa).toBeGreaterThanOrEqual(75)
          }
        }
        expect(session.status).toBe('finished')
      }
    }

    for (const abertura of registro.aberturas) {
      if (abertura.minimo > 0) {
        aberturasVu++
        expect(abertura.pontos).toBeGreaterThanOrEqual(abertura.minimo)
      } else if (abertura.pontos < 75) {
        aberturasLivresPequenas++
      }
    }
    expect(aberturasVu).toBeGreaterThan(0)
    expect(checagensDeTurno).toBe(aberturasVu)
    expect(aberturasLivresPequenas).toBeGreaterThan(0)
  })

  it('runAiTurns com humano na mesa: as IAs da dupla VU só abrem com 75+ e param na vez do humano', () => {
    const rand = lcg(4242)
    jest.spyOn(Math, 'random').mockImplementation(rand)
    const registro = registrarAberturas()
    const seats: SeatConfig[] = [
      { kind: 'human', name: 'Humano' },
      { kind: 'ai', name: 'IA1', difficulty: 'easy' },
      { kind: 'ai', name: 'IA2', difficulty: 'medium' },
      { kind: 'ai', name: 'IA3', difficulty: 'hard' },
    ]
    let aberturasVu = 0
    for (let rodada = 0; rodada < 8; rodada++) {
      const placar: Placar = rodada % 2 === 0 ? { A: 1600, B: 2100 } : { A: 0, B: 1500 }
      const session = sessaoComPlacar(placar, seats)
      let ciclos = 0
      while (session.status === 'playing') {
        if (++ciclos > 3000) throw new Error('rodada não terminou')
        expect(session.currentSeat).toBe(0)
        expect(session.applyIntent(0, { type: 'draw' }).ok).toBe(true)
        const tamanho = session.getViewFor(0).yourHand.length
        let descartou = false
        for (let i = 0; i < tamanho && !descartou; i++) {
          descartou = session.applyIntent(0, { type: 'discard', cardIndex: i }).ok
        }
        expect(descartou).toBe(true)
        session.runAiTurns()
        if (session.status === 'playing') {
          expect(session.currentSeat).toBe(0)
          expect(session.phase).toBe('draw')
        }
      }
    }
    for (const abertura of registro.aberturas) {
      if (abertura.minimo === 0) {
        expect(abertura.team).toBe('A')
        continue
      }
      expect(abertura.minimo).toBe(75)
      expect(abertura.pontos).toBeGreaterThanOrEqual(75)
      aberturasVu++
    }
    expect(aberturasVu).toBeGreaterThan(0)
    expect(registro.aberturas.some(a => a.team === 'B')).toBe(true)
  })
})
