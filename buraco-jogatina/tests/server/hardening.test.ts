import { ProtocolServer, isClientMessage, ServerMessage } from '../../server/protocol'

class FakeSocket {
  messages: ServerMessage[] = []
  send(data: string): void {
    this.messages.push(JSON.parse(data))
  }
  ofType(type: ServerMessage['type']): any[] {
    return this.messages.filter(m => m.type === type)
  }
}

function connect(server: ProtocolServer, id: string): FakeSocket {
  const s = new FakeSocket()
  server.registerConnection(id, s)
  return s
}

describe('isClientMessage', () => {
  it.each([null, undefined, 42, 'texto', [], {}, { type: 'nope' }, { type: 'create' }])(
    'rejeita %p',
    value => expect(isClientMessage(value)).toBe(false)
  )

  it('aceita as mensagens válidas', () => {
    const ok = [
      { type: 'create', name: 'A', difficulty: 'easy' },
      { type: 'join', code: 'ABCDE', name: 'B' },
      { type: 'start' },
      { type: 'nextRound' },
      { type: 'chooseSeat', seatIndex: 3 },
      { type: 'rename', name: 'C' },
      { type: 'intent', intent: { type: 'draw' } },
      { type: 'intent', intent: { type: 'discard', cardIndex: 4 } },
      { type: 'intent', intent: { type: 'playCanasta', cardIndices: [0, 1, 2] } },
      { type: 'intent', intent: { type: 'extendMeld', meldIndex: 1, cardIndices: [3] } },
    ]
    for (const m of ok) expect(isClientMessage(m)).toBe(true)
  })

  it('rejeita campos com tipo ou faixa errados', () => {
    const bad = [
      { type: 'create', name: 5, difficulty: 'easy' },
      { type: 'create', name: 'A', difficulty: 'impossivel' },
      { type: 'join', code: 'X'.repeat(500), name: 'B' },
      { type: 'chooseSeat', seatIndex: 4 },
      { type: 'chooseSeat', seatIndex: -1 },
      { type: 'chooseSeat', seatIndex: 1.5 },
      { type: 'rename', name: { toString: 1 } },
      { type: 'intent' },
      { type: 'intent', intent: null },
      { type: 'intent', intent: { type: 'playCanasta', cardIndices: 'abc' } },
      { type: 'intent', intent: { type: 'playCanasta', cardIndices: [0, 0, 1] } },
      { type: 'intent', intent: { type: 'playCanasta', cardIndices: Array(100).fill(0).map((_, i) => i) } },
      { type: 'intent', intent: { type: 'discard', cardIndex: '3' } },
      { type: 'intent', intent: { type: 'extendMeld', meldIndex: 1 } },
    ]
    for (const m of bad) expect(isClientMessage(m)).toBe(false)
  })
})

describe('ProtocolServer sobrevive a mensagens ruins', () => {
  it('responde "mensagem invalida" em vez de lançar, e continua funcionando depois', async () => {
    const server = new ProtocolServer({ aiTurnDelayMs: 0 })
    const a = connect(server, 'a')
    for (const bad of [null, 7, 'x', { type: 'intent', intent: { type: 'playCanasta', cardIndices: 'abc' } }]) {
      await expect(server.handleMessage('a', bad)).resolves.toBeUndefined()
    }
    expect(a.ofType('error')).toHaveLength(4)
    await server.handleMessage('a', { type: 'create', name: 'Ok', difficulty: 'easy' })
    expect(a.ofType('joined')).toHaveLength(1)
  })

  it('não deixa a mesma conexão criar duas salas nem entrar em outra', async () => {
    const server = new ProtocolServer({ aiTurnDelayMs: 0 })
    const a = connect(server, 'a')
    const b = connect(server, 'b')
    await server.handleMessage('a', { type: 'create', name: 'A', difficulty: 'easy' })
    await server.handleMessage('a', { type: 'create', name: 'A2', difficulty: 'easy' })
    expect(a.ofType('joined')).toHaveLength(1)
    expect(a.ofType('error').at(-1).message).toMatch(/ja esta em uma sala/)

    await server.handleMessage('b', { type: 'create', name: 'B', difficulty: 'easy' })
    const codeA = a.ofType('joined')[0].code
    await server.handleMessage('b', { type: 'join', code: codeA, name: 'B' })
    expect(b.ofType('error').at(-1).message).toMatch(/ja esta em uma sala/)
  })

  it('nome gigante é cortado em 24 caracteres e vazio vira "Jogador"', async () => {
    const server = new ProtocolServer({ aiTurnDelayMs: 0 })
    const a = connect(server, 'a')
    await server.handleMessage('a', { type: 'create', name: 'N'.repeat(500), difficulty: 'easy' })
    expect(a.ofType('lobby').at(-1).seats[0].name).toBe('N'.repeat(24))
    const b = connect(server, 'b')
    const code = a.ofType('joined')[0].code
    await server.handleMessage('b', { type: 'join', code, name: '   ' })
    expect(b.ofType('lobby').at(-1).seats[1].name).toBe('Jogador')
  })
})

describe('turnos da IA no online', () => {
  async function startRoom(delay: number) {
    const server = new ProtocolServer({ aiTurnDelayMs: delay })
    const host = connect(server, 'h')
    await server.handleMessage('h', { type: 'create', name: 'Host', difficulty: 'hard' })
    await server.handleMessage('h', { type: 'start' })
    return { server, host }
  }

  it('o convidado que sai do lobby antes de começar não pausa a partida', async () => {
    const server = new ProtocolServer({ aiTurnDelayMs: 0 })
    const host = connect(server, 'h')
    const guest = connect(server, 'g')
    await server.handleMessage('h', { type: 'create', name: 'Host', difficulty: 'easy' })
    const code = host.ofType('joined')[0].code
    await server.handleMessage('g', { type: 'join', code, name: 'Bob' })
    server.handleClose('g')
    await server.handleMessage('h', { type: 'start' })
    const state = host.ofType('state').at(-1)
    expect(state.view.paused).toBe(false)
    expect(guest.ofType('state')).toHaveLength(0)
  })

  it('cada turno de IA é transmitido separadamente (um estado por jogada)', async () => {
    const { host, server } = await startRoom(0)
    await new Promise(r => setTimeout(r, 50))
    const humanFirst = host.ofType('state').at(-1)
    expect(humanFirst.view.currentSeat).toBe(0)
    host.messages.length = 0
    const view = humanFirst.view
    await server.handleMessage('h', { type: 'intent', intent: { type: 'draw' } })
    await server.handleMessage('h', { type: 'intent', intent: { type: 'discard', cardIndex: view.yourHand.length } })
    await new Promise(r => setTimeout(r, 100))
    const states = host.ofType('state')
    const seatsSeen = states.map(s => s.view.currentSeat)
    expect(new Set(seatsSeen).size).toBeGreaterThanOrEqual(3)
    expect(seatsSeen.at(-1)).toBe(0)
  })

  it('uma exceção dentro de um turno de IA não derruba o servidor: registra e segue', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    const server = new ProtocolServer({ aiTurnDelayMs: 0 })
    const host = connect(server, 'h')
    await server.handleMessage('h', { type: 'create', name: 'Host', difficulty: 'easy' })
    await server.handleMessage('h', { type: 'start' })
    const room = (server as any).rooms.getRoom((host.ofType('joined')[0] as any).code)
    jest.spyOn(room.session, 'runNextAiTurn').mockImplementation(() => {
      throw new Error('boom')
    })
    room.session.game.state.currentPlayerIndex = 1
    ;(server as any).launchAiTurns(room)
    await new Promise(r => setTimeout(r, 20))
    expect(errors).toHaveBeenCalled()
    errors.mockRestore()
  })
})
