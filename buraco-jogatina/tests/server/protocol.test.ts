import { ProtocolServer, ServerMessage } from '../../server/protocol'

class FakeSocket {
  messages: ServerMessage[] = []
  send(data: string): void {
    this.messages.push(JSON.parse(data))
  }
  last(): ServerMessage {
    return this.messages[this.messages.length - 1]
  }
  ofType(type: ServerMessage['type']): ServerMessage[] {
    return this.messages.filter((m) => m.type === type)
  }
}

function makeServer(): ProtocolServer {
  return new ProtocolServer({ aiTurnDelayMs: 0 })
}

describe('ProtocolServer', () => {
  it('create -> joined + lobby broadcast to the host', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    server.registerConnection('c1', host)

    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })

    const joined = host.ofType('joined')[0]
    expect(joined).toMatchObject({ type: 'joined', seat: 0, isHost: true })
    const lobby = host.ofType('lobby')[0] as any
    expect(lobby.seats).toHaveLength(4)
    expect(lobby.seats[0]).toMatchObject({ index: 0, kind: 'human', name: 'Host', connected: true })
    expect(lobby.isHost).toBe(true)
  })

  it('join assigns a seat and rebroadcasts lobby to everyone in the room', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    const guest = new FakeSocket()
    server.registerConnection('c1', host)
    server.registerConnection('c2', guest)

    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    const code = (host.ofType('joined')[0] as any).code

    await server.handleMessage('c2', { type: 'join', code, name: 'Bob' })
    expect((guest.ofType('joined')[0] as any)).toMatchObject({ seat: 1, isHost: false })

    // Both host and guest should have received a lobby update after the join.
    expect(host.ofType('lobby').length).toBeGreaterThanOrEqual(2)
    expect(guest.ofType('lobby').length).toBeGreaterThanOrEqual(1)
  })

  it('join with an invalid code sends error only to that client', async () => {
    const server = makeServer()
    const guest = new FakeSocket()
    server.registerConnection('c2', guest)
    await server.handleMessage('c2', { type: 'join', code: 'ZZZZZ', name: 'Bob' })
    expect(guest.ofType('error')).toHaveLength(1)
  })

  it('only the host can start; non-host attempt yields an error', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    const guest = new FakeSocket()
    server.registerConnection('c1', host)
    server.registerConnection('c2', guest)
    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    const code = (host.ofType('joined')[0] as any).code
    await server.handleMessage('c2', { type: 'join', code, name: 'Bob' })

    await server.handleMessage('c2', { type: 'start' })
    expect(guest.ofType('error').length).toBeGreaterThanOrEqual(1)
  })

  it('start deals the game and sends a redacted state view to each human seat', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    const guest = new FakeSocket()
    server.registerConnection('c1', host)
    server.registerConnection('c2', guest)
    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    const code = (host.ofType('joined')[0] as any).code
    await server.handleMessage('c2', { type: 'join', code, name: 'Bob' })

    await server.handleMessage('c1', { type: 'start' })

    const hostStates = host.ofType('state')
    const guestStates = guest.ofType('state')
    expect(hostStates.length).toBeGreaterThanOrEqual(1)
    expect(guestStates.length).toBeGreaterThanOrEqual(1)

    const hostView = hostStates[0] as any
    const guestView = guestStates[0] as any
    // Each client only ever sees its own hand.
    expect(hostView.view.yourHand.length).toBe(11)
    expect(guestView.view.yourHand.length).toBe(11)
    expect(hostView.view.seat).toBe(0)
    expect(guestView.view.seat).toBe(1)
  })

  it('a valid draw intent from the current human seat is applied and rebroadcast', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    server.registerConnection('c1', host)
    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    await server.handleMessage('c1', { type: 'start' })

    const before = host.ofType('state').length
    await server.handleMessage('c1', { type: 'intent', intent: { type: 'draw' } })
    const after = host.ofType('state')
    expect(after.length).toBeGreaterThan(before)
    const latest = after[after.length - 1] as any
    expect(latest.view.phase).toBe('play')
  })

  it('an illegal intent sends an error only to the requester, no state broadcast storm', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    server.registerConnection('c1', host)
    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    await server.handleMessage('c1', { type: 'start' })

    // Cannot discard before drawing (phase is 'draw').
    await server.handleMessage('c1', { type: 'intent', intent: { type: 'discard', cardIndex: 0 } })
    expect(host.ofType('error').length).toBeGreaterThanOrEqual(1)
  })

  it('with all-AI seats after host action, runs AI turns until back to the human', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    server.registerConnection('c1', host)
    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    await server.handleMessage('c1', { type: 'start' })
    await server.handleMessage('c1', { type: 'intent', intent: { type: 'draw' } })
    await server.handleMessage('c1', { type: 'intent', intent: { type: 'discard', cardIndex: 0 } })

    // Give the async AI-turn pacing loop (0ms delay) a tick to finish.
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    const states = host.ofType('state')
    const latest = states[states.length - 1] as any
    // Should be back to seat 0 (human) since seats 1-3 are AI.
    expect(latest.view.currentSeat).toBe(0)
  })

  it('chooseSeat move o convidado e rebroadcasta lobby pros dois lados', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    const guest = new FakeSocket()
    server.registerConnection('c1', host)
    server.registerConnection('c2', guest)

    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    await server.handleMessage('c2', { type: 'join', code: (host.ofType('joined')[0] as any).code, name: 'Bob' })

    await server.handleMessage('c2', { type: 'chooseSeat', seatIndex: 3 })

    const lastLobby = guest.ofType('lobby').at(-1) as any
    expect(lastLobby.seats[3]).toMatchObject({ index: 3, kind: 'human', name: 'Bob' })
    expect(lastLobby.seats[1]).toMatchObject({ kind: 'ai' })
    // O host também recebe o lobby atualizado.
    expect((host.ofType('lobby').at(-1) as any).seats[3]).toMatchObject({ name: 'Bob' })
  })

  it('depois de chooseSeat, uma intent do convidado usa o NOVO assento', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    const guest = new FakeSocket()
    server.registerConnection('c1', host)
    server.registerConnection('c2', guest)

    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    await server.handleMessage('c2', { type: 'join', code: (host.ofType('joined')[0] as any).code, name: 'Bob' })
    // Bob entrou no assento 1; escolhe o assento 3 antes de começar.
    await server.handleMessage('c2', { type: 'chooseSeat', seatIndex: 3 })
    await server.handleMessage('c1', { type: 'start' })

    // A ordem dos turnos começa no assento 0 (o anfitrião) e passa pelo 1 e
    // 2 (IA, com aiTurnDelayMs=0) antes de chegar no 3, onde Bob está agora.
    await server.handleMessage('c1', { type: 'intent', intent: { type: 'draw' } })
    await server.handleMessage('c1', { type: 'intent', intent: { type: 'discard', cardIndex: 0 } })
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))

    const latest = guest.ofType('state').at(-1) as any
    expect(latest.view.currentSeat).toBe(3)

    // Uma intent do convidado só é válida se o servidor souber que ele
    // agora está no assento 3, não mais no 1 (onde entrou originalmente).
    await server.handleMessage('c2', { type: 'intent', intent: { type: 'draw' } })
    expect(guest.ofType('error')).toHaveLength(0)
  })

  it('chooseSeat recusa mover o anfitrião', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    server.registerConnection('c1', host)
    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })

    await server.handleMessage('c1', { type: 'chooseSeat', seatIndex: 1 })
    expect(host.ofType('error')).toHaveLength(1)
  })

  it('rename atualiza o nome e rebroadcasta lobby', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    server.registerConnection('c1', host)
    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })

    await server.handleMessage('c1', { type: 'rename', name: 'Novo Nome' })
    const lastLobby = host.ofType('lobby').at(-1) as any
    expect(lastLobby.seats[0].name).toBe('Novo Nome')
  })
})
