import { useGameStore, vulnerabilityLog, TEAM_DISPLAY_NAME } from '../../src/store/gameStore'
import { serializeGame, deserializeGame, type SavedGame } from '../../src/store/gamePersistence'
import { Game, VU_OPENING_MINIMUM, openingPoints } from '../../src/engine/game'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer, AIDifficulty } from '../../src/engine/ai'
import { Card, Rank, Suit } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'
import { Hand } from '../../src/engine/hand'
import type { TeamId } from '../../src/engine/gameState'

const STORAGE_KEY = 'buraco-jogatina:saved-game'

const c = (rank: Rank, suit: Suit = 'hearts') => new Card(suit, rank)
const joker = () => new Card('hearts', '2', true)
const run = (suit: Suit, ranks: Rank[]) => ranks.map(r => c(r, suit))

const st = () => useGameStore.getState()
const g = () => st().game!
const team = (id: TeamId, game: Game = g()) => game.state.teams.find(t => t.id === id)!

const VU_LINE = (id: TeamId) =>
  `⚠️ Time ${id} (${TEAM_DISPLAY_NAME[id]}) está vulnerável (VU): a primeira descida da rodada precisa somar 75 pontos.`

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function cleanCanastra(): Canasta {
  return new Canasta(run('hearts', ['4', '5', '6', '7', '8', '9', '10']))
}

function startRoundWithScores(scores: { A: number; B: number }, difficulty: AIDifficulty = 'hard') {
  st().initGame('Alice', difficulty)
  useGameStore.setState({ matchScores: scores })
  st().startNextRound()
}

function forceRoundEnd(closer: TeamId, hands: Partial<Record<number, Card[]>> = {}) {
  const game = g()
  const t = team(closer, game)
  t.hasTakenMorto = true
  t.melds.push(cleanCanastra())
  game.state.mortos = []
  const closerSeat = closer === 'A' ? 0 : 1
  game.state.currentPlayerIndex = closerSeat
  for (let seat = 0; seat < 4; seat++) {
    game.state.players[seat].hand = new Hand(seat === closerSeat ? [c('3', 'clubs')] : hands[seat] ?? [c('4', 'diamonds')])
  }
  st().discard(0)
}

function linesAfter(marker: string): string[] {
  const log = st().gameLog
  const idx = log.lastIndexOf(marker)
  return idx === -1 ? [] : log.slice(idx + 1)
}

function setHumanHand(cards: Card[]) {
  const game = g()
  game.state.currentPlayerIndex = 0
  game.state.players[0].hand = new Hand(cards)
}

const openingHand = () => [
  ...run('spades', ['Q', 'K', 'A']),
  ...run('hearts', ['Q', 'K', 'A']),
  c('A', 'clubs'),
  c('A', 'diamonds'),
  joker(),
  c('3', 'clubs'),
  c('4', 'clubs'),
  c('5', 'clubs'),
  c('9', 'diamonds'),
]

type Lay = { team: TeamId; points: number; opening: boolean; seat: number }

function recordLays(game: Game): Lay[] {
  const lays: Lay[] = []
  const original = game.playMelds.bind(game)
  game.playMelds = (groups: Card[][]) => {
    const t = game.getTeamOfCurrentPlayer()
    const opening = game.needsOpening(t)
    const seat = game.state.currentPlayerIndex
    const ok = original(groups)
    if (ok) lays.push({ team: t.id, points: openingPoints(groups.flat()), opening, seat })
    return ok
  }
  return lays
}

beforeEach(() => {
  st().resetGame()
  window.localStorage.clear()
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('VU na store offline: transição de rodadas', () => {
  test('partida nova não tem ninguém vulnerável e não registra aviso', () => {
    st().initGame('Alice', 'hard')
    expect(team('A').openingMinimum).toBe(0)
    expect(team('B').openingMinimum).toBe(0)
    expect(st().gameLog.some(l => l.includes('vulnerável (VU)'))).toBe(false)
  })

  test('cruzar 1500 exatos ao fim da rodada deixa a dupla vulnerável na próxima, com aviso no log', () => {
    st().initGame('Alice', 'hard')
    useGameStore.setState({ matchScores: { A: 1155, B: 0 } })
    forceRoundEnd('A')
    expect(st().roundFinalized).toBe(true)
    expect(st().matchScores).toEqual({ A: 1500, B: -10 })
    expect(team('A').openingMinimum).toBe(0)

    st().startNextRound()
    expect(st().round).toBe(2)
    expect(team('A').openingMinimum).toBe(VU_OPENING_MINIMUM)
    expect(team('B').openingMinimum).toBe(0)
    expect(g().needsOpening(team('A'))).toBe(true)
    expect(g().needsOpening(team('B'))).toBe(false)
    expect(linesAfter('Rodada 2 iniciada.')).toEqual([VU_LINE('A')])
  })

  test('terminar a rodada com 1499 não deixa vulnerável e não gera aviso', () => {
    st().initGame('Alice', 'hard')
    useGameStore.setState({ matchScores: { A: 1154, B: 0 } })
    forceRoundEnd('A')
    expect(st().matchScores.A).toBe(1499)

    st().startNextRound()
    expect(team('A').openingMinimum).toBe(0)
    expect(team('B').openingMinimum).toBe(0)
    expect(linesAfter('Rodada 2 iniciada.')).toEqual([])
  })

  test('as duas duplas podem ficar vulneráveis ao mesmo tempo, com um aviso para cada', () => {
    st().initGame('Alice', 'hard')
    useGameStore.setState({ matchScores: { A: 1500, B: 1510 } })
    forceRoundEnd('A')
    expect(st().matchScores).toEqual({ A: 1845, B: 1500 })

    st().startNextRound()
    expect(team('A').openingMinimum).toBe(75)
    expect(team('B').openingMinimum).toBe(75)
    expect(linesAfter('Rodada 2 iniciada.')).toEqual([VU_LINE('A'), VU_LINE('B')])
  })

  test('só a dupla adversária vulnerável: aviso apenas do Time B', () => {
    startRoundWithScores({ A: 300, B: 2000 })
    expect(team('A').openingMinimum).toBe(0)
    expect(team('B').openingMinimum).toBe(75)
    expect(linesAfter('Rodada 2 iniciada.')).toEqual([VU_LINE('B')])
  })

  test('cair abaixo de 1500 remove o VU na rodada seguinte (não é permanente)', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    expect(team('A').openingMinimum).toBe(75)

    forceRoundEnd('B', {
      0: [joker(), joker(), joker(), joker(), c('A', 'spades'), c('A', 'clubs')],
      2: [c('A', 'hearts'), c('A', 'diamonds'), c('A', 'spades'), c('A', 'clubs')],
    })
    expect(st().matchScores.A).toBe(1430)
    expect(st().matchScores.B).toBe(345)

    st().startNextRound()
    expect(st().round).toBe(3)
    expect(team('A').openingMinimum).toBe(0)
    expect(team('B').openingMinimum).toBe(0)
    expect(linesAfter('Rodada 3 iniciada.')).toEqual([])
  })

  test('a dupla continua vulnerável enquanto tiver 1500+, e cada rodada começa exigindo nova abertura', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    expect(st().playMelds([[0, 1, 2], [3, 4, 5], [6, 7, 8]])).toBe(true)
    expect(g().needsOpening(team('A'))).toBe(false)

    forceRoundEnd('A')
    st().startNextRound()
    expect(st().round).toBe(3)
    expect(team('A').melds).toHaveLength(0)
    expect(team('A').openingMinimum).toBe(75)
    expect(g().needsOpening(team('A'))).toBe(true)
    expect(linesAfter('Rodada 3 iniciada.')).toEqual([VU_LINE('A')])
  })

  test('partida encerrada em 3000 não abre nova rodada nem gera aviso de VU', () => {
    st().initGame('Alice', 'hard')
    useGameStore.setState({ matchScores: { A: 2900, B: 1600 } })
    forceRoundEnd('A')
    expect(st().matchWinner).toBe('A')
    const logLength = st().gameLog.length
    const gameBefore = st().game

    st().startNextRound()
    expect(st().game).toBe(gameBefore)
    expect(st().gameLog).toHaveLength(logLength)
  })

  test('nova partida (initGame) zera o VU mesmo vindo de uma rodada vulnerável', () => {
    startRoundWithScores({ A: 1700, B: 1700 })
    expect(team('A').openingMinimum).toBe(75)
    st().initGame('Alice', 'hard')
    expect(team('A').openingMinimum).toBe(0)
    expect(team('B').openingMinimum).toBe(0)
  })

  test('vulnerabilityLog lista só as duplas com mínimo de abertura', () => {
    startRoundWithScores({ A: 0, B: 0 })
    expect(vulnerabilityLog(g())).toEqual([])
    g().setOpeningMinimums({ A: 1500, B: 1499 })
    expect(vulnerabilityLog(g())).toEqual([VU_LINE('A')])
    g().setOpeningMinimums({ A: 2500, B: 1500 })
    expect(vulnerabilityLog(g())).toEqual([VU_LINE('A'), VU_LINE('B')])
  })
})

describe('VU na store offline: playMelds do humano', () => {
  test('um jogo sozinho abaixo de 75 é recusado sem alterar mão, mesa, log nem versão', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    const logBefore = [...st().gameLog]
    const versionBefore = st().version

    expect(st().playMelds([[0, 1, 2]])).toBe(false)
    expect(g().state.players[0].hand.getSize()).toBe(13)
    expect(team('A').melds).toHaveLength(0)
    expect(st().gameLog).toEqual(logBefore)
    expect(st().version).toBe(versionBefore)
  })

  test('dois jogos somando 70 ainda são recusados', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    expect(st().playMelds([[0, 1, 2], [3, 4, 5]])).toBe(false)
    expect(team('A').melds).toHaveLength(0)
    expect(g().state.players[0].hand.getSize()).toBe(13)
  })

  test('três jogos somando 120 abrem a dupla de uma vez e o log registra a abertura vulnerável', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    const versionBefore = st().version

    expect(st().playMelds([[0, 1, 2], [3, 4, 5], [6, 7, 8]])).toBe(true)
    expect(team('A').melds).toHaveLength(3)
    expect(g().state.players[0].hand.getCards().map(x => x.toString())).toEqual(['3C', '4C', '5C', '9D'])
    expect(st().gameLog[st().gameLog.length - 1]).toBe('Alice abriu o jogo da dupla com 120 pontos (vulnerável).')
    expect(g().needsOpening(team('A'))).toBe(false)
    expect(st().version).toBe(versionBefore + 1)
    expect(st().selectedCardIndices).toEqual([])
    expect(st().stagedOpening).toEqual([])
  })

  test('depois de aberta, a dupla vulnerável baixa jogo pequeno normalmente pela store', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    st().playMelds([[0, 1, 2], [3, 4, 5], [6, 7, 8]])

    st().playCanasta([0, 1, 2])
    expect(team('A').melds).toHaveLength(4)
    expect(team('A').melds[3].cards.map(x => x.rank)).toEqual(['3', '4', '5'])
    expect(st().gameLog[st().gameLog.length - 1]).toBe('Alice baixou uma canastra!')
  })

  test('abertura com exatamente 75 pontos é aceita; 70 não', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand([...run('spades', ['6', '7', '8', '9', '10', 'J', 'Q', 'K']), c('3', 'clubs'), c('5', 'diamonds')])
    expect(openingPoints(g().state.players[0].hand.getCards().slice(0, 8))).toBe(70)
    expect(st().playMelds([[0, 1, 2, 3, 4, 5, 6, 7]])).toBe(false)

    setHumanHand([...run('diamonds', ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']), c('3', 'clubs'), c('4', 'clubs')])
    expect(st().playMelds([[0, 1, 2, 3, 4, 5, 6, 7, 8]])).toBe(true)
    expect(st().gameLog[st().gameLog.length - 1]).toBe('Alice abriu o jogo da dupla com 75 pontos (vulnerável).')
  })

  test('índices repetidos dentro ou entre grupos são recusados', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    expect(st().playMelds([[0, 1, 2], [0, 1, 2], [6, 7, 8]])).toBe(false)
    expect(st().playMelds([[0, 1, 2], [2, 4, 5], [6, 7, 8]])).toBe(false)
    expect(st().playMelds([[0, 0, 1, 2], [3, 4, 5], [6, 7, 8]])).toBe(false)
    expect(team('A').melds).toHaveLength(0)
    expect(g().state.players[0].hand.getSize()).toBe(13)
  })

  test('índices fora da mão, negativos, grupos vazios ou lista vazia são recusados', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    expect(st().playMelds([[0, 1, 2], [3, 4, 5], [6, 7, 99]])).toBe(false)
    expect(st().playMelds([[-1, 0, 1], [3, 4, 5], [6, 7, 8]])).toBe(false)
    expect(st().playMelds([[13, 14, 15]])).toBe(false)
    expect(st().playMelds([])).toBe(false)
    expect(st().playMelds([[]])).toBe(false)
    expect(st().playMelds([[0, 1, 2], [], [3, 4, 5], [6, 7, 8]])).toBe(false)
    expect(team('A').melds).toHaveLength(0)
    expect(g().state.players[0].hand.getSize()).toBe(13)
  })

  test('grupo que não forma jogo válido derruba a descida inteira (atômico)', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    expect(st().playMelds([[0, 1, 2], [3, 4, 5], [6, 7, 12]])).toBe(false)
    expect(team('A').melds).toHaveLength(0)
    expect(g().state.players[0].hand.getSize()).toBe(13)
  })

  test('abertura que esvaziaria a mão sem morto nem canastra limpa é recusada', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand([...run('spades', ['10', 'J', 'Q', 'K', 'A']), ...run('hearts', ['10', 'J', 'Q', 'K', 'A']), c('3', 'clubs')])
    g().state.mortos = []
    expect(st().playMelds([[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]])).toBe(false)
    expect(team('A').melds).toHaveLength(0)
    expect(g().state.players[0].hand.getSize()).toBe(11)
  })

  test('abertura que esvazia a mão com morto disponível pega o morto e registra os dois eventos', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand([...run('spades', ['10', 'J', 'Q', 'K', 'A']), ...run('hearts', ['10', 'J', 'Q', 'K', 'A'])])
    const mortos = g().state.mortos.length

    expect(st().playMelds([[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]])).toBe(true)
    expect(team('A').hasTakenMorto).toBe(true)
    expect(g().state.mortos).toHaveLength(mortos - 1)
    expect(g().state.players[0].hand.getSize()).toBe(11)
    const tail = st().gameLog.slice(-2)
    expect(tail).toEqual(['Alice abriu o jogo da dupla com 110 pontos (vulnerável).', 'Alice pegou o morto!'])
  })

  test('abertura de 75 com canastra limpa que esvazia a mão após o morto encerra a rodada e soma no placar', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(run('hearts', ['8', '9', '10', 'J', 'Q', 'K', 'A']))
    team('A').hasTakenMorto = true
    g().state.mortos = []
    g().state.players[2].hand = new Hand([c('3', 'spades')])
    g().state.players[1].hand = new Hand([c('K', 'spades')])
    g().state.players[3].hand = new Hand([c('A', 'spades')])

    expect(st().playMelds([[0, 1, 2, 3, 4, 5, 6]])).toBe(true)
    expect(g().state.status).toBe('finished')
    expect(st().roundFinalized).toBe(true)
    expect(st().gameLog).toContain('Alice abriu o jogo da dupla com 75 pontos (vulnerável).')
    expect(st().gameLog[st().gameLog.length - 1]).toBe('Fim da rodada 2.')
    expect(st().matchScores).toEqual({ A: 1600 + 275 + 100 - 5, B: -25 })
  })

  test('dupla não vulnerável baixa jogo pequeno via playMelds com log comum', () => {
    startRoundWithScores({ A: 1499, B: 2000 })
    setHumanHand(openingHand())
    expect(st().playMelds([[9, 10, 11]])).toBe(true)
    expect(st().gameLog[st().gameLog.length - 1]).toBe('Alice baixou 1 jogo(s)!')
    expect(team('A').melds).toHaveLength(1)
  })

  test('playCanasta da store também respeita o mínimo de 75 enquanto a dupla não abriu', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    const logBefore = [...st().gameLog]
    st().playCanasta([9, 10, 11])
    st().playCanasta([6, 7, 8])
    expect(team('A').melds).toHaveLength(0)
    expect(st().gameLog).toEqual(logBefore)
    expect(g().state.players[0].hand.getSize()).toBe(13)
  })

  test('jogo já baixado pelo parceiro libera o humano da exigência de 75', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    team('A').melds.push(new Canasta(run('diamonds', ['8', '9', '10'])))
    st().playCanasta([9, 10, 11])
    expect(team('A').melds).toHaveLength(2)
  })

  test('playMelds não faz nada sem jogo ou com a rodada encerrada', () => {
    expect(st().playMelds([[0, 1, 2]])).toBe(false)

    startRoundWithScores({ A: 1600, B: 0 })
    forceRoundEnd('A')
    expect(g().state.status).toBe('finished')
    setHumanHand(openingHand())
    expect(st().playMelds([[0, 1, 2], [3, 4, 5], [6, 7, 8]])).toBe(false)
    expect(g().state.players[0].hand.getSize()).toBe(13)
  })
})

describe('VU na store offline: preparação da abertura (stagedOpening)', () => {
  test('stageOpeningGroup reserva o grupo e limpa a seleção atual', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    st().toggleCardSelection(0)
    st().toggleCardSelection(1)
    st().toggleCardSelection(2)
    expect(st().selectedCardIndices).toEqual([0, 1, 2])

    st().stageOpeningGroup([0, 1, 2])
    expect(st().stagedOpening).toEqual([[0, 1, 2]])
    expect(st().selectedCardIndices).toEqual([])

    st().stageOpeningGroup([3, 4, 5])
    expect(st().stagedOpening).toEqual([[0, 1, 2], [3, 4, 5]])
  })

  test('stageOpeningGroup copia o array recebido (mutação externa não altera a reserva)', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    const group = [0, 1, 2]
    st().stageOpeningGroup(group)
    group.push(7)
    expect(st().stagedOpening).toEqual([[0, 1, 2]])
  })

  test('stageOpeningGroup ignora grupo vazio e grupo que reaproveita carta já reservada', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    st().stageOpeningGroup([0, 1, 2])
    st().toggleCardSelection(5)

    st().stageOpeningGroup([])
    st().stageOpeningGroup([2, 3, 4])
    expect(st().stagedOpening).toEqual([[0, 1, 2]])
    expect(st().selectedCardIndices).toEqual([5])
  })

  test('toggleCardSelection ignora cartas reservadas e segue funcionando para as livres', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    st().stageOpeningGroup([0, 1, 2])

    st().toggleCardSelection(1)
    expect(st().selectedCardIndices).toEqual([])
    st().toggleCardSelection(3)
    st().toggleCardSelection(4)
    expect(st().selectedCardIndices).toEqual([3, 4])
    st().toggleCardSelection(3)
    expect(st().selectedCardIndices).toEqual([4])
  })

  test('cancelOpening devolve as cartas reservadas e limpa a seleção', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    st().stageOpeningGroup([0, 1, 2])
    st().toggleCardSelection(6)

    st().cancelOpening()
    expect(st().stagedOpening).toEqual([])
    expect(st().selectedCardIndices).toEqual([])

    st().toggleCardSelection(1)
    expect(st().selectedCardIndices).toEqual([1])
  })

  test('fluxo completo: reserva 70, completa com o terceiro jogo e abre com tudo junto', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    st().stageOpeningGroup([0, 1, 2])
    st().stageOpeningGroup([3, 4, 5])
    ;[6, 7, 8].forEach(i => st().toggleCardSelection(i))

    const groups = [...st().stagedOpening, st().selectedCardIndices]
    expect(st().playMelds(groups)).toBe(true)
    expect(team('A').melds).toHaveLength(3)
    expect(st().stagedOpening).toEqual([])
    expect(st().selectedCardIndices).toEqual([])
  })

  test('playMelds recusado mantém a reserva para o jogador completar ou cancelar', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    st().stageOpeningGroup([0, 1, 2])
    expect(st().playMelds([[0, 1, 2], [3, 4, 5]])).toBe(false)
    expect(st().stagedOpening).toEqual([[0, 1, 2]])
  })

  test('descartar limpa a reserva', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    st().stageOpeningGroup([0, 1, 2])
    st().toggleCardSelection(12)
    st().discard(12)
    expect(st().stagedOpening).toEqual([])
    expect(st().selectedCardIndices).toEqual([])
    expect(g().state.currentPlayerIndex).toBe(1)
  })

  test('playCanasta bem-sucedido limpa a reserva', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    team('A').melds.push(new Canasta(run('diamonds', ['8', '9', '10'])))
    st().stageOpeningGroup([0, 1, 2])
    st().playCanasta([9, 10, 11])
    expect(team('A').melds).toHaveLength(2)
    expect(st().stagedOpening).toEqual([])
  })

  test('playCanasta recusado (abaixo de 75) não mexe na reserva', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    st().stageOpeningGroup([0, 1, 2])
    st().playCanasta([9, 10, 11])
    expect(st().stagedOpening).toEqual([[0, 1, 2]])
  })

  test('extendMeld bem-sucedido limpa a reserva', () => {
    startRoundWithScores({ A: 0, B: 0 })
    setHumanHand(openingHand())
    team('A').melds.push(new Canasta(run('clubs', ['6', '7', '8'])))
    st().stageOpeningGroup([0, 1, 2])
    st().extendMeld(0, [11])
    expect(team('A').melds[0].cards).toHaveLength(4)
    expect(st().stagedOpening).toEqual([])
  })

  test('nova rodada, resetGame e initGame limpam a reserva', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    st().stageOpeningGroup([0, 1, 2])
    st().startNextRound()
    expect(st().stagedOpening).toEqual([])

    st().stageOpeningGroup([0, 1, 2])
    st().resetGame()
    expect(st().stagedOpening).toEqual([])

    st().initGame('Alice', 'hard')
    st().stageOpeningGroup([3, 4, 5])
    st().initGame('Alice', 'hard')
    expect(st().stagedOpening).toEqual([])
  })

  test('retomar a partida salva limpa a reserva', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    st().stageOpeningGroup([0, 1, 2])
    expect(st().resumeSavedGame()).toBe(true)
    expect(st().stagedOpening).toEqual([])
  })
})

describe('VU na store offline: persistência', () => {
  test('serializeGame/deserializeGame preservam openingMinimum por dupla, inclusive via JSON', () => {
    startRoundWithScores({ A: 1600, B: 100 })
    const saved = serializeGame(g(), {
      matchScores: st().matchScores,
      matchCanastras: st().matchCanastras,
      round: st().round,
      matchConfig: st().matchConfig,
      gameLog: st().gameLog,
      roundFinalized: false,
    })
    expect(saved.gameState.teams.map(t => t.openingMinimum)).toEqual([75, 0])

    const { game } = deserializeGame(JSON.parse(JSON.stringify(saved)) as SavedGame)
    expect(team('A', game).openingMinimum).toBe(75)
    expect(team('B', game).openingMinimum).toBe(0)
    expect(game.needsOpening(team('A', game))).toBe(true)
  })

  test('save antigo sem openingMinimum é lido como 0', () => {
    startRoundWithScores({ A: 1600, B: 1600 })
    const saved = serializeGame(g(), {
      matchScores: st().matchScores,
      matchCanastras: st().matchCanastras,
      round: st().round,
      gameLog: [],
      roundFinalized: false,
    })
    for (const t of saved.gameState.teams) delete (t as { openingMinimum?: number }).openingMinimum
    const { game } = deserializeGame(saved)
    expect(game.state.teams.map(t => t.openingMinimum)).toEqual([0, 0])
  })

  test('o salvamento automático grava openingMinimum e resumeSavedGame restaura o VU e o aviso', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as SavedGame
    expect(raw.gameState.teams.find(t => t.id === 'A')!.openingMinimum).toBe(75)
    expect(raw.store.roundFinalized).toBe(false)

    st().resetGame()
    useGameStore.setState({ matchScores: { A: 0, B: 0 } })
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))

    expect(st().resumeSavedGame()).toBe(true)
    expect(st().matchScores).toEqual({ A: 1600, B: 0 })
    expect(team('A').openingMinimum).toBe(75)
    expect(team('B').openingMinimum).toBe(0)
    expect(g().needsOpening(team('A'))).toBe(true)
    expect(st().gameLog.filter(l => l === VU_LINE('A'))).toHaveLength(1)
  })

  test('retomar rodada em andamento recalcula o VU pelo placar salvo (save antigo ou inconsistente)', () => {
    startRoundWithScores({ A: 0, B: 0 })
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as SavedGame
    raw.store.matchScores = { A: 200, B: 1700 }
    raw.gameState.teams.find(t => t.id === 'A')!.openingMinimum = 75
    delete (raw.gameState.teams.find(t => t.id === 'B') as { openingMinimum?: number }).openingMinimum
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(raw))

    expect(st().resumeSavedGame()).toBe(true)
    expect(team('A').openingMinimum).toBe(0)
    expect(team('B').openingMinimum).toBe(75)
  })

  test('retomar rodada já encerrada mantém o VU daquela rodada mesmo se o placar caiu abaixo de 1500', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    forceRoundEnd('B', {
      0: [joker(), joker(), joker(), joker(), c('A', 'spades'), c('A', 'clubs')],
      2: [c('A', 'hearts'), c('A', 'diamonds'), c('A', 'spades'), c('A', 'clubs')],
    })
    expect(st().matchScores.A).toBe(1430)
    expect(st().roundFinalized).toBe(true)

    expect(st().resumeSavedGame()).toBe(true)
    expect(st().roundFinalized).toBe(true)
    expect(g().state.status).toBe('finished')
    expect(team('A').openingMinimum).toBe(75)

    st().startNextRound()
    expect(team('A').openingMinimum).toBe(0)
  })

  test('retomar rodada encerrada não liga VU de quem só cruzou 1500 naquela rodada', () => {
    st().initGame('Alice', 'hard')
    useGameStore.setState({ matchScores: { A: 1300, B: 0 } })
    forceRoundEnd('A')
    expect(st().matchScores.A).toBe(1645)

    expect(st().resumeSavedGame()).toBe(true)
    expect(team('A').openingMinimum).toBe(0)

    st().startNextRound()
    expect(team('A').openingMinimum).toBe(75)
  })

  test('retomar depois de a dupla vulnerável já ter aberto mantém os jogos e não exige nova abertura', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    setHumanHand(openingHand())
    expect(st().playMelds([[0, 1, 2], [3, 4, 5], [6, 7, 8]])).toBe(true)

    expect(st().resumeSavedGame()).toBe(true)
    expect(team('A').openingMinimum).toBe(75)
    expect(team('A').melds).toHaveLength(3)
    expect(g().needsOpening(team('A'))).toBe(false)
    st().playCanasta([0, 1, 2])
    expect(team('A').melds).toHaveLength(4)
  })
})

describe('VU na store offline: IA (aiTurn)', () => {
  function prepareAiSeat(seat: number, hand: Card[]) {
    const game = g()
    game.state.currentPlayerIndex = seat
    game.state.players[seat].hand = new Hand(hand)
    game.state.discardPile = []
    game.state.deck = [c('4', 'diamonds'), c('6', 'clubs'), c('9', 'spades'), c('3', 'diamonds'), c('7', 'clubs')]
  }

  test('IA adversária vulnerável abre com 75+ numa descida só e o log registra a abertura', () => {
    startRoundWithScores({ A: 0, B: 1600 })
    prepareAiSeat(1, [
      ...run('spades', ['Q', 'K', 'A']),
      ...run('hearts', ['Q', 'K', 'A']),
      c('A', 'clubs'),
      c('A', 'diamonds'),
      joker(),
      c('3', 'clubs'),
      c('5', 'diamonds'),
    ])
    const lays = recordLays(g())

    st().aiTurn()

    expect(lays.length).toBeGreaterThan(0)
    expect(lays[0].team).toBe('B')
    expect(lays[0].opening).toBe(true)
    expect(lays[0].points).toBeGreaterThanOrEqual(75)
    const line = st().gameLog.find(l => l.startsWith('Ana abriu o jogo da dupla com'))
    expect(line).toBe(`Ana abriu o jogo da dupla com ${lays[0].points} pontos (vulnerável).`)
    expect(team('B').melds.length).toBeGreaterThan(0)
    expect(g().state.currentPlayerIndex).toBe(2)
  })

  test('IA vulnerável sem 75 possíveis não baixa nada e apenas descarta', () => {
    startRoundWithScores({ A: 0, B: 1600 })
    prepareAiSeat(1, [
      ...run('hearts', ['3', '4', '5', '6', '7']),
      ...run('clubs', ['3', '4', '5']),
      c('9', 'diamonds'),
      c('J', 'spades'),
      c('3', 'spades'),
    ])
    const lays = recordLays(g())
    const logLength = st().gameLog.length

    st().aiTurn()

    expect(lays).toEqual([])
    expect(team('B').melds).toHaveLength(0)
    expect(g().state.players[1].hand.getSize()).toBe(11)
    expect(g().state.discardPile).toHaveLength(1)
    expect(g().state.currentPlayerIndex).toBe(2)
    const newLines = st().gameLog.slice(logLength)
    expect(newLines).toEqual(['Ana comprou uma carta.', 'Ana descartou uma carta.'])
  })

  test('a mesma mão pequena é baixada normalmente quando a dupla não está vulnerável', () => {
    startRoundWithScores({ A: 0, B: 1499 })
    prepareAiSeat(1, [
      ...run('hearts', ['3', '4', '5', '6', '7']),
      ...run('clubs', ['3', '4', '5']),
      c('9', 'diamonds'),
      c('J', 'spades'),
      c('3', 'spades'),
    ])
    const lays = recordLays(g())

    st().aiTurn()

    expect(lays.length).toBeGreaterThan(0)
    expect(lays[0].points).toBeLessThan(75)
    expect(team('B').melds.length).toBeGreaterThan(0)
    expect(st().gameLog.some(l => l.includes('abriu o jogo da dupla'))).toBe(false)
  })

  test('parceiro IA vulnerável abre a dupla e libera o humano para baixar jogo pequeno', () => {
    startRoundWithScores({ A: 1600, B: 0 })
    prepareAiSeat(2, [
      ...run('spades', ['10', 'J', 'Q', 'K', 'A']),
      ...run('diamonds', ['10', 'J', 'Q', 'K', 'A']),
      c('3', 'clubs'),
    ])
    const lays = recordLays(g())

    st().aiTurn()

    expect(lays[0]).toEqual(expect.objectContaining({ team: 'A', seat: 2, opening: true }))
    expect(lays[0].points).toBeGreaterThanOrEqual(75)
    expect(st().gameLog).toContain(`Bruno abriu o jogo da dupla com ${lays[0].points} pontos (vulnerável).`)
    expect(g().needsOpening(team('A'))).toBe(false)

    g().state.currentPlayerIndex = 0
    g().state.players[0].hand = new Hand([...run('clubs', ['5', '6', '7']), c('9', 'hearts'), c('K', 'clubs')])
    const before = team('A').melds.length
    st().playCanasta([0, 1, 2])
    expect(team('A').melds).toHaveLength(before + 1)
  })

  test('IA de dupla vulnerável com só jogos pequenos (55) não os baixa antes de abrir, mesmo ao longo de vários turnos', () => {
    jest.spyOn(Math, 'random').mockImplementation(lcg(7))
    startRoundWithScores({ A: 0, B: 1600 })
    const game = g()
    game.state.players[1].hand = new Hand([
      ...run('hearts', ['3', '4', '5']),
      ...run('clubs', ['3', '4', '5']),
      ...run('spades', ['6', '7', '8']),
      c('9', 'diamonds'),
      c('J', 'diamonds'),
    ])
    const lays = recordLays(game)

    game.state.deck.push(c('4', 'diamonds'))
    st().drawFromDeck()
    st().discard(game.state.players[0].hand.getSize() - 1)
    game.state.deck.push(c('9', 'clubs'))
    st().aiTurn()
    expect(lays).toEqual([])
    expect(team('B').melds).toHaveLength(0)
    expect(game.state.players[1].hand.getSize()).toBe(11)
    expect(game.state.currentPlayerIndex).toBe(2)

    for (let turn = 0; turn < 40 && game.state.status === 'playing'; turn++) {
      if (game.state.currentPlayerIndex === 0) {
        st().drawFromDeck()
        st().discard(game.state.players[0].hand.getSize() - 1)
      } else {
        st().aiTurn()
      }
    }

    const bLays = lays.filter(l => l.team === 'B')
    expect(bLays.filter(l => l.opening).every(l => l.points >= 75)).toBe(true)
    expect(bLays.filter(l => l.opening).length).toBeLessThanOrEqual(1)
    for (const line of st().gameLog) {
      const m = /abriu o jogo da dupla com (\d+) pontos \(vulnerável\)/.exec(line)
      if (m) expect(Number(m[1])).toBeGreaterThanOrEqual(75)
    }
  })

  test('rodadas completas só de IA com as duas duplas vulneráveis: toda primeira descida soma 75+', () => {
    const difficulties: AIDifficulty[] = ['easy', 'medium', 'hard']
    let openings = 0
    let smallAfterOpening = 0
    for (let seed = 1; seed <= 9; seed++) {
      jest.spyOn(Math, 'random').mockImplementation(lcg(seed * 7919))
      startRoundWithScores({ A: 1700, B: 1600 }, difficulties[seed % 3])
      const game = g()
      game.state.players[0] = new AIPlayer('Alice', difficulties[seed % 3], game.state.players[0].hand.getCards())
      const lays = recordLays(game)

      for (let turn = 0; turn < 3000 && game.state.status === 'playing'; turn++) st().aiTurn()
      expect(game.state.status).toBe('finished')

      for (const id of ['A', 'B'] as TeamId[]) {
        const teamLays = lays.filter(l => l.team === id)
        if (teamLays.length === 0) continue
        expect(teamLays[0].opening).toBe(true)
        expect(teamLays[0].points).toBeGreaterThanOrEqual(75)
        expect(teamLays.slice(1).every(l => !l.opening)).toBe(true)
        openings++
        smallAfterOpening += teamLays.slice(1).filter(l => l.points < 75).length
      }
      const logged = st()
        .gameLog.map(line => /abriu o jogo da dupla com (\d+) pontos \(vulnerável\)/.exec(line))
        .filter((m): m is RegExpExecArray => m !== null)
        .map(m => Number(m[1]))
      expect(logged).toEqual(lays.filter(l => l.opening).map(l => l.points))
      expect(logged.every(points => points >= 75)).toBe(true)
      jest.restoreAllMocks()
    }
    expect(openings).toBeGreaterThan(0)
    expect(smallAfterOpening).toBeGreaterThan(0)
  })
})

describe('VU na store offline: humano jogando com HumanPlayer intacto', () => {
  test('o lugar 0 continua humano e a IA não joga por ele numa rodada vulnerável', () => {
    startRoundWithScores({ A: 1600, B: 1600 })
    expect(g().state.players[0]).toBeInstanceOf(HumanPlayer)
    const logLength = st().gameLog.length
    st().aiTurn()
    expect(st().gameLog).toHaveLength(logLength)
    expect(g().state.currentPlayerIndex).toBe(0)
  })
})
