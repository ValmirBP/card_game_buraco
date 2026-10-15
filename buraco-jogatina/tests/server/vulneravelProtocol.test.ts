import { ProtocolServer, isClientMessage, ServerMessage } from '../../server/protocol'
import { Card, Rank, Suit } from '../../src/engine/card'
import { Hand } from '../../src/engine/hand'
import { Canasta } from '../../src/engine/canasta'

class FakeSocket {
  messages: any[] = []
  send(data: string): void {
    this.messages.push(JSON.parse(data))
  }
  ofType(type: ServerMessage['type']): any[] {
    return this.messages.filter(m => m.type === type)
  }
  lastView(): any {
    return this.ofType('state').at(-1)?.view
  }
  lastError(): string | undefined {
    return this.ofType('error').at(-1)?.message
  }
}

const c = (rank: Rank, suit: Suit = 'hearts') => new Card(suit, rank)
const joker = () => new Card('hearts', '2', true)
const run = (suit: Suit, ranks: Rank[]) => ranks.map(r => c(r, suit))
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms))

function connect(server: ProtocolServer, id: string): FakeSocket {
  const s = new FakeSocket()
  server.registerConnection(id, s)
  return s
}

function intent(i: unknown) {
  return { type: 'intent', intent: i }
}

function playMelds(groups: unknown) {
  return intent({ type: 'playMelds', groups })
}

function team(view: any, id: 'A' | 'B'): any {
  return view.teams.find((t: any) => t.id === id)
}

function pontosCarta(card: { rank: string; isWild: boolean }): number {
  if (card.isWild) return 20
  if (card.rank === 'A') return 15
  if (card.rank === '2') return 10
  if (['8', '9', '10', 'J', 'Q', 'K'].includes(card.rank)) return 10
  return 5
}

function pontosNaMesa(teamView: any): number {
  return teamView.melds.reduce(
    (sum: number, m: any) => sum + m.layout.reduce((s: number, e: any) => s + pontosCarta(e.card), 0),
    0
  )
}

interface Mesa {
  server: ProtocolServer
  host: FakeSocket
  guest?: FakeSocket
  code: string
  room: any
}

async function abrirSala(opts: { guestSeat?: number; delay?: number } = {}): Promise<Mesa> {
  const server = new ProtocolServer({ aiTurnDelayMs: opts.delay ?? 0 })
  const host = connect(server, 'h')
  await server.handleMessage('h', { type: 'create', name: 'Host', difficulty: 'hard' })
  const code = host.ofType('joined')[0].code
  let guest: FakeSocket | undefined
  if (opts.guestSeat !== undefined) {
    guest = connect(server, 'g')
    await server.handleMessage('g', { type: 'join', code, name: 'Bob' })
    if (opts.guestSeat !== 1) {
      await server.handleMessage('g', { type: 'chooseSeat', seatIndex: opts.guestSeat })
    }
  }
  await server.handleMessage('h', { type: 'start' })
  await tick()
  return { server, host, guest, code, room: (server as any).rooms.getRoom(code) }
}

function jogo(mesa: Mesa): any {
  return (mesa.room.session as any).game
}

function armarMao(mesa: Mesa, seat: number, cards: Card[]): void {
  jogo(mesa).state.players[seat].hand = new Hand(cards)
}

async function encerrarRodada(mesa: Mesa, placarAntes: { A: number; B: number }): Promise<void> {
  const session = mesa.room.session as any
  session.matchScores = { ...placarAntes }
  await mesa.server.handleMessage('h', intent({ type: 'draw' }))
  const game = jogo(mesa)
  const teamA = game.state.teams.find((t: any) => t.id === 'A')
  teamA.hasTakenMorto = true
  teamA.melds.push(new Canasta(run('hearts', ['4', '5', '6', '7', '8', '9', '10'])))
  game.state.mortos = []
  armarMao(mesa, 0, [c('3', 'clubs')])
  for (const seat of [1, 2, 3]) armarMao(mesa, seat, [c('4', 'diamonds')])
  await mesa.server.handleMessage('h', intent({ type: 'discard', cardIndex: 0 }))
  await tick()
}

async function proximaRodada(mesa: Mesa, placarAntes: { A: number; B: number }): Promise<void> {
  await encerrarRodada(mesa, placarAntes)
  await mesa.server.handleMessage('h', { type: 'nextRound' })
  await tick()
}

function maoAbertura(): Card[] {
  return [
    ...run('spades', ['Q', 'K', 'A']),
    ...run('hearts', ['Q', 'K', 'A']),
    c('A', 'clubs'),
    c('A', 'diamonds'),
    joker(),
    ...run('clubs', ['3', '4', '5']),
    c('9', 'diamonds'),
    c('10', 'clubs'),
    c('J', 'diamonds'),
  ]
}

const ABERTURA_120 = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
]

function maoFraca(): Card[] {
  return [
    ...run('spades', ['3', '4', '5']),
    ...run('hearts', ['3', '4', '5']),
    c('7', 'clubs'),
    c('J', 'clubs'),
    c('7', 'diamonds'),
    c('J', 'diamonds'),
    c('K', 'hearts'),
  ]
}

describe('isClientMessage: intent playMelds', () => {
  it.each([
    ['um grupo de 3', [[0, 1, 2]]],
    ['três grupos disjuntos', [[0, 1, 2], [3, 4, 5], [6, 7, 8]]],
    ['8 grupos de 3 (limite de grupos)', Array.from({ length: 8 }, (_, g) => [g * 3, g * 3 + 1, g * 3 + 2])],
    ['8 grupos de 5 somando exatamente 40 índices', Array.from({ length: 8 }, (_, g) => [0, 1, 2, 3, 4].map(i => g * 5 + i))],
    ['um único grupo de 40 índices', [Array.from({ length: 40 }, (_, i) => i)]],
    ['índices no topo da faixa (197..199)', [[197, 198, 199]]],
    ['grupos com tamanhos diferentes', [[10, 11, 12, 13, 14, 15, 16], [0, 1, 2]]],
  ])('aceita %s', (_label, groups) => {
    expect(isClientMessage(playMelds(groups))).toBe(true)
  })

  it.each([
    ['grupos vazios', []],
    ['grupo com 2 índices', [[0, 1]]],
    ['um grupo bom e um curto', [[0, 1, 2], [3, 4]]],
    ['grupo vazio junto de um grupo bom', [[0, 1, 2], []]],
    ['índice não inteiro', [[0, 1, 2.5]]],
    ['índice negativo', [[-1, 0, 1]]],
    ['índice NaN', [[NaN, 0, 1]]],
    ['índice Infinity', [[Infinity, 0, 1]]],
    ['índice como string', [[0, 1, '2']]],
    ['índice booleano', [[true, 1, 2]]],
    ['índice nulo', [[null, 1, 2]]],
    ['índice 200 (fora da faixa)', [[198, 199, 200]]],
    ['índice repetido dentro do grupo', [[0, 0, 1]]],
    ['índice repetido entre grupos', [[0, 1, 2], [2, 3, 4]]],
    ['9 grupos', Array.from({ length: 9 }, (_, g) => [g * 3, g * 3 + 1, g * 3 + 2])],
    ['mais de 40 índices somando os grupos', [Array.from({ length: 21 }, (_, i) => i), Array.from({ length: 21 }, (_, i) => i + 21)]],
    ['um grupo com 41 índices', [Array.from({ length: 41 }, (_, i) => i)]],
    ['groups como string', 'abc'],
    ['groups como número', 5],
    ['groups nulo', null],
    ['groups como objeto parecido com array', { length: 1, 0: [0, 1, 2] }],
    ['grupo que não é array', [[0, 1, 2], 'x']],
    ['grupo como objeto', [{ 0: 0, 1: 1, 2: 2 }]],
    ['arrays aninhados demais', [[[0], [1], [2]]]],
  ])('rejeita %s', (_label, groups) => {
    expect(isClientMessage(playMelds(groups))).toBe(false)
  })

  it('rejeita playMelds sem o campo groups ou com o campo de outra intent', () => {
    expect(isClientMessage(intent({ type: 'playMelds' }))).toBe(false)
    expect(isClientMessage(intent({ type: 'playMelds', cardIndices: [0, 1, 2] }))).toBe(false)
  })

  it('playMelds só existe dentro de uma intent, não como mensagem solta', () => {
    expect(isClientMessage({ type: 'playMelds', groups: [[0, 1, 2]] })).toBe(false)
  })

  it('as outras intents continuam validando como antes', () => {
    expect(isClientMessage(intent({ type: 'playCanasta', cardIndices: [0, 1, 2] }))).toBe(true)
    expect(isClientMessage(intent({ type: 'extendMeld', meldIndex: 0, cardIndices: [3] }))).toBe(true)
    expect(isClientMessage(intent({ type: 'playCanasta', groups: [[0, 1, 2]] }))).toBe(false)
  })
})

describe('ProtocolServer: playMelds malformado', () => {
  it('responde "mensagem invalida" só para quem mandou, sem mudar o estado nem transmitir', async () => {
    const mesa = await abrirSala({ guestSeat: 1 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    const handBefore = mesa.host.lastView().yourHand.length
    const hostStates = mesa.host.ofType('state').length
    const guestStates = mesa.guest!.ofType('state').length

    for (const groups of [[], [[0, 1]], [[0, 1, 2], [2, 3, 4]], 'x', [[-1, 0, 1]]]) {
      await expect(mesa.server.handleMessage('h', playMelds(groups))).resolves.toBeUndefined()
      expect(mesa.host.lastError()).toBe('mensagem invalida')
    }

    expect(mesa.host.ofType('error')).toHaveLength(5)
    expect(mesa.guest!.ofType('error')).toHaveLength(0)
    expect(mesa.host.ofType('state')).toHaveLength(hostStates)
    expect(mesa.guest!.ofType('state')).toHaveLength(guestStates)
    expect(jogo(mesa).state.players[0].hand.getSize()).toBe(handBefore)
    expect(jogo(mesa).state.teams[0].melds).toHaveLength(0)
  })

  it('depois de mensagens ruins, um playMelds válido ainda é aplicado', async () => {
    const mesa = await abrirSala()
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    await mesa.server.handleMessage('h', playMelds([[0, 1]]))
    await mesa.server.handleMessage('h', playMelds(ABERTURA_120))
    const view = mesa.host.lastView()
    expect(team(view, 'A').melds).toHaveLength(3)
    expect(view.yourHand).toHaveLength(6)
    expect(mesa.host.ofType('error')).toHaveLength(1)
  })
})

describe('ProtocolServer: openingMinimum nos estados', () => {
  it('na primeira rodada ninguém é vulnerável: openingMinimum 0 nas duas duplas e sem aviso', async () => {
    const mesa = await abrirSala({ guestSeat: 1 })
    for (const sock of [mesa.host, mesa.guest!]) {
      const view = sock.lastView()
      expect(team(view, 'A').openingMinimum).toBe(0)
      expect(team(view, 'B').openingMinimum).toBe(0)
      expect(view.log.some((l: string) => l.includes('vulnerável (VU)'))).toBe(false)
    }
  })

  it('placar da partida chega a 1500: na rodada seguinte o estado de todos traz openingMinimum 75 para a dupla', async () => {
    const mesa = await abrirSala({ guestSeat: 1 })
    await encerrarRodada(mesa, { A: 1499, B: 0 })
    const fim = mesa.host.lastView()
    expect(fim.status).toBe('finished')
    expect(fim.matchScores.A).toBeGreaterThanOrEqual(1500)
    expect(fim.matchScores.B).toBeLessThan(1500)
    expect(team(fim, 'A').openingMinimum).toBe(0)

    await mesa.server.handleMessage('h', { type: 'nextRound' })
    for (const sock of [mesa.host, mesa.guest!]) {
      const view = sock.lastView()
      expect(view.round).toBe(2)
      expect(view.status).toBe('playing')
      expect(team(view, 'A').openingMinimum).toBe(75)
      expect(team(view, 'B').openingMinimum).toBe(0)
      expect(team(view, 'A').melds).toHaveLength(0)
    }
  })

  it.each([
    [1155, 1500, 75],
    [1154, 1499, 0],
  ])('fronteira: placar %i + rodada de 345 = %i na partida -> openingMinimum %i', async (antes, depois, minimo) => {
    const mesa = await abrirSala()
    await encerrarRodada(mesa, { A: antes, B: 0 })
    expect(team(mesa.host.lastView(), 'A').score).toBe(345)
    expect(mesa.host.lastView().matchScores.A).toBe(depois)
    await mesa.server.handleMessage('h', { type: 'nextRound' })
    expect(team(mesa.host.lastView(), 'A').openingMinimum).toBe(minimo)
  })

  it('o aviso de VU vai no log do estado ao começar a rodada, só para a dupla vulnerável', async () => {
    const mesa = await abrirSala({ guestSeat: 1 })
    await proximaRodada(mesa, { A: 1499, B: 0 })
    const log: string[] = mesa.guest!.lastView().log
    const inicio = log.lastIndexOf('Rodada 2 iniciada.')
    expect(inicio).toBeGreaterThanOrEqual(0)
    const rodada = log.slice(inicio)
    expect(rodada).toContain(
      '⚠️ Time A está vulnerável (VU): a primeira descida da rodada precisa somar 75 pontos.'
    )
    expect(rodada.some(l => l.startsWith('⚠️ Time B'))).toBe(false)
  })

  it('as duas duplas acima de 1500 ficam vulneráveis juntas', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 1499, B: 2000 })
    const view = mesa.host.lastView()
    expect(team(view, 'A').openingMinimum).toBe(75)
    expect(team(view, 'B').openingMinimum).toBe(75)
    const rodada = view.log.slice(view.log.lastIndexOf('Rodada 2 iniciada.'))
    expect(rodada.filter((l: string) => l.includes('está vulnerável (VU)'))).toHaveLength(2)
  })

  it('a condição é reavaliada a cada rodada: quem cai abaixo de 1500 deixa de ser vulnerável', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 1499, B: 0 })
    expect(team(mesa.host.lastView(), 'A').openingMinimum).toBe(75)

    await proximaRodada(mesa, { A: 0, B: 1600 })
    const view = mesa.host.lastView()
    expect(view.round).toBe(3)
    expect(view.matchScores.A).toBeLessThan(1500)
    expect(view.matchScores.B).toBeGreaterThanOrEqual(1500)
    expect(team(view, 'A').openingMinimum).toBe(0)
    expect(team(view, 'B').openingMinimum).toBe(75)
    const rodada = view.log.slice(view.log.lastIndexOf('Rodada 3 iniciada.'))
    expect(rodada.some((l: string) => l.startsWith('⚠️ Time A'))).toBe(false)
    expect(rodada.some((l: string) => l.startsWith('⚠️ Time B'))).toBe(true)
  })
})

describe('ProtocolServer: abertura do vulnerável pelo humano', () => {
  it('um jogo sozinho abaixo de 75 é recusado com a mensagem de VU, só para quem tentou, sem novo estado', async () => {
    const mesa = await abrirSala({ guestSeat: 1 })
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    const hostStates = mesa.host.ofType('state').length
    const guestStates = mesa.guest!.ofType('state').length

    await mesa.server.handleMessage('h', playMelds([[0, 1, 2]]))

    expect(mesa.host.lastError()).toBe('vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 35)')
    expect(mesa.guest!.ofType('error')).toHaveLength(0)
    expect(mesa.host.ofType('state')).toHaveLength(hostStates)
    expect(mesa.guest!.ofType('state')).toHaveLength(guestStates)
    expect(jogo(mesa).state.players[0].hand.getSize()).toBe(15)
    expect(jogo(mesa).state.teams[0].melds).toHaveLength(0)
  })

  it('vários jogos juntos que somam 70 também são recusados e a mensagem traz a soma de todos', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    await mesa.server.handleMessage('h', playMelds([[0, 1, 2], [3, 4, 5]]))
    expect(mesa.host.lastError()).toBe('vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 70)')
    expect(jogo(mesa).state.teams[0].melds).toHaveLength(0)
    expect(jogo(mesa).state.players[0].hand.getSize()).toBe(15)
  })

  it('a intent antiga playCanasta também respeita o mínimo de 75', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    await mesa.server.handleMessage('h', intent({ type: 'playCanasta', cardIndices: [9, 10, 11] }))
    expect(mesa.host.lastError()).toBe('vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 15)')
    expect(jogo(mesa).state.teams[0].melds).toHaveLength(0)
  })

  it('depois do erro, uma abertura válida (120) é aceita e transmitida para todos', async () => {
    const mesa = await abrirSala({ guestSeat: 1 })
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    await mesa.server.handleMessage('h', playMelds([[0, 1, 2]]))
    const errors = mesa.host.ofType('error').length
    const guestStates = mesa.guest!.ofType('state').length

    await mesa.server.handleMessage('h', playMelds(ABERTURA_120))
    await tick()

    expect(mesa.host.ofType('error')).toHaveLength(errors)
    const hostView = mesa.host.lastView()
    expect(team(hostView, 'A').melds).toHaveLength(3)
    expect(pontosNaMesa(team(hostView, 'A'))).toBe(120)
    expect(hostView.yourHand.map((card: any) => card.rank)).toEqual(['3', '4', '5', '9', '10', 'J'])
    expect(hostView.currentSeat).toBe(0)
    expect(hostView.phase).toBe('play')
    expect(hostView.log).toContain('Host abriu o jogo da dupla com 120 pontos (vulnerável).')

    expect(mesa.guest!.ofType('state').length).toBeGreaterThan(guestStates)
    const guestView = mesa.guest!.lastView()
    expect(guestView.seat).toBe(1)
    expect(team(guestView, 'A').melds).toHaveLength(3)
    expect(guestView.players[0].handCount).toBe(6)
    expect(guestView.yourHand).toHaveLength(11)
    expect(guestView.log).toContain('Host abriu o jogo da dupla com 120 pontos (vulnerável).')
  })

  it('exatamente 75 pontos num jogo só abre o jogo da dupla', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, [...run('diamonds', ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']), c('3', 'clubs'), c('4', 'clubs')])
    await mesa.server.handleMessage('h', playMelds([[0, 1, 2, 3, 4, 5, 6, 7, 8]]))
    expect(mesa.host.ofType('error')).toHaveLength(0)
    const view = mesa.host.lastView()
    expect(team(view, 'A').melds).toHaveLength(1)
    expect(team(view, 'A').melds[0].isCanastra).toBe(true)
    expect(view.log).toContain('Host abriu o jogo da dupla com 75 pontos (vulnerável).')
  })

  it('playCanasta com 75 pontos também serve de abertura', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, [...run('diamonds', ['5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']), c('3', 'clubs'), c('4', 'clubs')])
    await mesa.server.handleMessage('h', intent({ type: 'playCanasta', cardIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8] }))
    expect(mesa.host.ofType('error')).toHaveLength(0)
    expect(team(mesa.host.lastView(), 'A').melds).toHaveLength(1)
  })

  it('cartas iguais do baralho duplo em grupos diferentes contam separadas', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, [
      ...run('spades', ['Q', 'K', 'A']),
      ...run('spades', ['Q', 'K', 'A']),
      c('A', 'clubs'),
      c('A', 'diamonds'),
      joker(),
      c('3', 'clubs'),
      c('4', 'clubs'),
    ])
    await mesa.server.handleMessage('h', playMelds(ABERTURA_120))
    expect(mesa.host.ofType('error')).toHaveLength(0)
    const view = mesa.host.lastView()
    expect(team(view, 'A').melds).toHaveLength(3)
    expect(view.yourHand).toHaveLength(2)
  })

  it('depois de aberto, a dupla baixa um jogo pequeno sem mínimo', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    await mesa.server.handleMessage('h', playMelds(ABERTURA_120))
    await mesa.server.handleMessage('h', playMelds([[0, 1, 2]]))
    expect(mesa.host.ofType('error')).toHaveLength(0)
    const view = mesa.host.lastView()
    expect(team(view, 'A').melds).toHaveLength(4)
    expect(team(view, 'A').openingMinimum).toBe(75)
    expect(view.log).toContain('Host baixou 1 jogo(s)!')
    expect(view.yourHand.map((card: any) => card.rank)).toEqual(['9', '10', 'J'])
  })

  it('o jogo do parceiro humano abre a dupla: depois dele o outro baixa jogo pequeno', async () => {
    const mesa = await abrirSala({ guestSeat: 2 })
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    await mesa.server.handleMessage('h', playMelds(ABERTURA_120))
    await mesa.server.handleMessage('h', intent({ type: 'discard', cardIndex: 5 }))
    await tick()
    expect(mesa.guest!.lastView().currentSeat).toBe(2)

    await mesa.server.handleMessage('g', intent({ type: 'draw' }))
    armarMao(mesa, 2, [...run('clubs', ['3', '4', '5']), c('9', 'diamonds'), c('K', 'spades')])
    await mesa.server.handleMessage('g', playMelds([[0, 1, 2]]))
    expect(mesa.guest!.ofType('error')).toHaveLength(0)
    const view = mesa.guest!.lastView()
    expect(team(view, 'A').melds.length).toBeGreaterThanOrEqual(4)
    expect(view.log).toContain('Bob baixou 1 jogo(s)!')
  })

  it('a dupla adversária vulnerável recebe o erro de VU, a não vulnerável baixa livre', async () => {
    const mesa = await abrirSala({ guestSeat: 1 })
    await proximaRodada(mesa, { A: 0, B: 2000 })
    const inicio = mesa.guest!.lastView()
    expect(team(inicio, 'A').openingMinimum).toBe(0)
    expect(team(inicio, 'B').openingMinimum).toBe(75)

    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, [...run('clubs', ['3', '4', '5']), c('9', 'diamonds'), c('K', 'spades'), c('J', 'hearts')])
    await mesa.server.handleMessage('h', playMelds([[0, 1, 2]]))
    expect(mesa.host.ofType('error')).toHaveLength(0)
    expect(mesa.host.lastView().log).toContain('Host baixou 1 jogo(s)!')
    await mesa.server.handleMessage('h', intent({ type: 'discard', cardIndex: 0 }))
    expect(mesa.guest!.lastView().currentSeat).toBe(1)

    await mesa.server.handleMessage('g', intent({ type: 'draw' }))
    armarMao(mesa, 1, maoAbertura())
    await mesa.server.handleMessage('g', playMelds([[0, 1, 2], [3, 4, 5]]))
    expect(mesa.guest!.lastError()).toBe('vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 70)')
    expect(mesa.host.ofType('error')).toHaveLength(0)

    await mesa.server.handleMessage('g', playMelds(ABERTURA_120))
    const hostView = mesa.host.lastView()
    expect(team(hostView, 'B').melds).toHaveLength(3)
    expect(hostView.players[1].handCount).toBe(6)
    expect(hostView.log).toContain('Bob abriu o jogo da dupla com 120 pontos (vulnerável).')
  })
})

describe('ProtocolServer: outras recusas do playMelds', () => {
  async function vezDoHost(): Promise<Mesa> {
    const mesa = await abrirSala({ guestSeat: 1 })
    await proximaRodada(mesa, { A: 1499, B: 0 })
    return mesa
  }

  it('antes de comprar: fase inválida', async () => {
    const mesa = await vezDoHost()
    await mesa.server.handleMessage('h', playMelds(ABERTURA_120))
    expect(mesa.host.lastError()).toBe('fase invalida: e preciso comprar antes')
  })

  it('fora da vez: o convidado não consegue baixar no turno do anfitrião', async () => {
    const mesa = await vezDoHost()
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    await mesa.server.handleMessage('g', playMelds(ABERTURA_120))
    expect(mesa.guest!.lastError()).toBe('nao e a vez deste assento')
    expect(mesa.host.ofType('error')).toHaveLength(0)
  })

  it('índice dentro da faixa do protocolo mas além da mão: índices inválidos', async () => {
    const mesa = await vezDoHost()
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    await mesa.server.handleMessage('h', playMelds([[0, 1, 2], [3, 4, 150]]))
    expect(mesa.host.lastError()).toBe('indices de carta invalidos')
    expect(jogo(mesa).state.players[0].hand.getSize()).toBe(15)
  })

  it('um grupo que não forma jogo derruba a descida inteira (atômico)', async () => {
    const mesa = await vezDoHost()
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    await mesa.server.handleMessage('h', playMelds([[3, 4, 5], [6, 7, 8], [0, 1, 9]]))
    expect(mesa.host.lastError()).toBe('conjunto de cartas nao forma uma canastra valida')
    expect(jogo(mesa).state.teams[0].melds).toHaveLength(0)
    expect(jogo(mesa).state.players[0].hand.getSize()).toBe(15)
  })

  it('abertura com pontos suficientes que esvaziaria a mão sem poder bater é recusada', async () => {
    const mesa = await vezDoHost()
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, [...run('spades', ['10', 'J', 'Q', 'K', 'A']), ...run('hearts', ['10', 'J', 'Q', 'K', 'A'])])
    jogo(mesa).state.mortos = []
    await mesa.server.handleMessage('h', playMelds([[0, 1, 2, 3, 4], [5, 6, 7, 8, 9]]))
    expect(mesa.host.lastError()).toBe('essa jogada esvaziaria a mao sem poder bater')
    expect(jogo(mesa).state.teams[0].melds).toHaveLength(0)
    expect(jogo(mesa).state.players[0].hand.getSize()).toBe(10)
  })

  it('conexão fora de sala e sala ainda no lobby recebem os erros de sempre', async () => {
    const server = new ProtocolServer({ aiTurnDelayMs: 0 })
    const solto = connect(server, 's')
    await server.handleMessage('s', playMelds(ABERTURA_120))
    expect(solto.lastError()).toBe('voce nao esta em nenhuma sala')

    const host = connect(server, 'h')
    await server.handleMessage('h', { type: 'create', name: 'Host', difficulty: 'easy' })
    await server.handleMessage('h', playMelds(ABERTURA_120))
    expect(host.lastError()).toBe('sala nao encontrada ou partida nao iniciada')
    expect(host.ofType('state')).toHaveLength(0)
  })
})

describe('ProtocolServer: lobby e token continuam funcionando com a nova intent', () => {
  it('um playMelds no lobby não atrapalha entrar, trocar de assento e começar', async () => {
    const server = new ProtocolServer({ aiTurnDelayMs: 0 })
    const host = connect(server, 'h')
    const guest = connect(server, 'g')
    await server.handleMessage('h', { type: 'create', name: 'Host', difficulty: 'easy' })
    const code = host.ofType('joined')[0].code
    await server.handleMessage('h', playMelds([[0, 1, 2]]))
    await server.handleMessage('g', { type: 'join', code, name: 'Bob' })
    await server.handleMessage('g', playMelds([[0, 1, 2]]))
    await server.handleMessage('g', { type: 'chooseSeat', seatIndex: 3 })

    expect(guest.ofType('joined')).toHaveLength(1)
    expect(guest.ofType('lobby').at(-1).seat).toBe(3)
    expect(host.ofType('lobby').at(-1).seats[3]).toMatchObject({ kind: 'human', name: 'Bob', connected: true })

    await server.handleMessage('h', { type: 'start' })
    expect(host.lastView().yourHand).toHaveLength(11)
    expect(guest.lastView().seat).toBe(3)
    expect(team(guest.lastView(), 'B').openingMinimum).toBe(0)
  })

  it('pausada por queda do convidado, a abertura é recusada; ao reconectar com token tudo segue', async () => {
    const mesa = await abrirSala({ guestSeat: 1 })
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    const guestToken = mesa.guest!.ofType('joined')[0].token
    const hostToken = mesa.host.ofType('joined')[0].token

    mesa.server.handleClose('g')
    expect(mesa.host.lastView().paused).toBe(true)
    const states = mesa.host.ofType('state').length
    await mesa.server.handleMessage('h', playMelds(ABERTURA_120))
    expect(mesa.host.lastError()).toBe('partida pausada - aguardando alguem reconectar')
    expect(mesa.host.ofType('state')).toHaveLength(states)
    expect(jogo(mesa).state.teams[0].melds).toHaveLength(0)

    const intruso = connect(mesa.server, 'evil')
    await mesa.server.handleMessage('evil', { type: 'join', code: mesa.code, name: 'Bob' })
    expect(intruso.ofType('joined')).toHaveLength(0)
    expect(intruso.ofType('state')).toHaveLength(0)

    const volta = connect(mesa.server, 'g2')
    await mesa.server.handleMessage('g2', { type: 'join', code: mesa.code, name: 'Bob', token: guestToken })
    await tick()
    expect(volta.ofType('joined')[0].seat).toBe(1)
    const reconView = volta.lastView()
    expect(reconView.round).toBe(2)
    expect(team(reconView, 'A').openingMinimum).toBe(75)
    expect(team(reconView, 'A').melds).toHaveLength(0)
    expect(mesa.host.lastView().paused).toBe(false)

    await mesa.server.handleMessage('h', playMelds(ABERTURA_120))
    expect(team(volta.lastView(), 'A').melds).toHaveLength(3)
    expect(team(mesa.host.lastView(), 'A').melds).toHaveLength(3)

    for (const sock of [mesa.host, mesa.guest!, volta]) {
      for (const m of sock.messages.filter(m => m.type !== 'joined')) {
        expect(JSON.stringify(m)).not.toContain(guestToken)
        expect(JSON.stringify(m)).not.toContain(hostToken)
      }
    }
  })
})

describe('ProtocolServer: IA vulnerável e ritmo dos turnos', () => {
  function armarIAsFracas(mesa: Mesa): void {
    armarMao(mesa, 1, maoFraca())
    armarMao(mesa, 2, [
      ...run('clubs', ['8', '9', '10']),
      c('Q', 'diamonds'),
      c('Q', 'spades'),
      c('6', 'diamonds'),
      c('9', 'spades'),
      c('10', 'diamonds'),
      c('K', 'clubs'),
      c('K', 'spades'),
      c('7', 'spades'),
    ])
    armarMao(mesa, 3, maoFraca())
    jogo(mesa).state.deck.push(c('K', 'diamonds'), c('9', 'hearts'), c('J', 'spades'), c('8', 'diamonds'), c('6', 'clubs'), c('Q', 'hearts'))
  }

  it('IA vulnerável sem 75 pontos não baixa nada e os turnos voltam ao humano', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 0, B: 2000 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, [c('9', 'diamonds'), c('10', 'clubs'), c('J', 'diamonds'), c('K', 'hearts')])
    armarIAsFracas(mesa)
    const from = mesa.host.messages.length

    await mesa.server.handleMessage('h', intent({ type: 'discard', cardIndex: 3 }))
    await tick(10)

    const states = mesa.host.messages.slice(from).filter(m => m.type === 'state').map(m => m.view)
    expect(states.map(v => v.currentSeat)).toEqual([1, 2, 3, 0, 0])
    for (const view of states) expect(team(view, 'B').melds).toHaveLength(0)
    const aiLines = mesa.host.messages.slice(from).filter(m => m.type === 'log').flatMap(m => m.lines)
    expect(aiLines.some((l: string) => l.includes('abriu o jogo da dupla'))).toBe(false)
    expect(aiLines.filter((l: string) => l.endsWith('descartou uma carta.'))).toHaveLength(3)
    expect(jogo(mesa).state.players[1].hand.getSize()).toBe(11)
    expect(jogo(mesa).state.players[3].hand.getSize()).toBe(11)
  })

  it('IA vulnerável com mão boa abre com 75+ e o log da IA é transmitido', async () => {
    const mesa = await abrirSala()
    await proximaRodada(mesa, { A: 0, B: 2000 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, [c('9', 'diamonds'), c('10', 'clubs'), c('J', 'diamonds'), c('7', 'clubs')])
    armarMao(mesa, 1, [
      ...run('spades', ['Q', 'K', 'A']),
      ...run('hearts', ['Q', 'K', 'A']),
      c('A', 'clubs'),
      c('A', 'diamonds'),
      joker(),
      c('3', 'clubs'),
      c('4', 'clubs'),
    ])
    const from = mesa.host.messages.length

    await mesa.server.handleMessage('h', intent({ type: 'discard', cardIndex: 3 }))
    await tick(10)

    const aiLines: string[] = mesa.host.messages.slice(from).filter(m => m.type === 'log').flatMap(m => m.lines)
    const abertura = aiLines.map(l => /^IA 2 abriu o jogo da dupla com (\d+) pontos \(vulnerável\)\.$/.exec(l)).find(Boolean)
    expect(abertura).toBeTruthy()
    expect(Number(abertura![1])).toBeGreaterThanOrEqual(75)

    const states = mesa.host.messages.slice(from).filter(m => m.type === 'state').map(m => m.view)
    const primeira = states.find(v => team(v, 'B').melds.length > 0)
    expect(primeira).toBeDefined()
    expect(pontosNaMesa(team(primeira, 'B'))).toBeGreaterThanOrEqual(75)
    expect(states.at(-1).currentSeat).toBe(0)
  })

  it('com atraso entre turnos de IA, um playMelds no meio é recusado e não quebra o ritmo', async () => {
    const mesa = await abrirSala({ delay: 15 })
    await proximaRodada(mesa, { A: 1499, B: 0 })
    await mesa.server.handleMessage('h', intent({ type: 'draw' }))
    armarMao(mesa, 0, maoAbertura())
    await mesa.server.handleMessage('h', playMelds(ABERTURA_120))
    expect(team(mesa.host.lastView(), 'A').melds).toHaveLength(3)
    const from = mesa.host.messages.length

    await mesa.server.handleMessage('h', intent({ type: 'discard', cardIndex: 5 }))
    expect(mesa.host.lastView().currentSeat).toBe(2)
    await mesa.server.handleMessage('h', playMelds([[0, 1, 2]]))
    expect(mesa.host.lastError()).toBe('nao e a vez deste assento')
    const statesMid = mesa.host.messages.slice(from).filter(m => m.type === 'state').length

    await tick(150)

    const after = mesa.host.messages.slice(from)
    const seats = after.filter(m => m.type === 'state').map(m => m.view.currentSeat)
    expect(statesMid).toBe(2)
    expect(seats).toEqual([1, 2, 3, 0, 0])
    expect(after.filter(m => m.type === 'log')).toHaveLength(3)
    expect(after.filter(m => m.type === 'error')).toHaveLength(1)
    expect(mesa.host.lastView().phase).toBe('draw')
  })
})
