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
    // Regressão: a mensagem 'lobby' precisa dizer ao PRÓPRIO Bob que agora
    // é o assento 3, não só a lista geral - sem isso o cliente continua
    // achando que está no assento 1 (o destaque "(você)" e o lápis de
    // editar nome ficavam presos lá, agora uma IA - relato do usuário).
    expect(lastLobby.seat).toBe(3)
    // O host também recebe o lobby atualizado, com o PRÓPRIO assento dele
    // (0) intacto - trocar assento de outra pessoa não pode mexer no meu.
    const hostLobby = host.ofType('lobby').at(-1) as any
    expect(hostLobby.seats[3]).toMatchObject({ name: 'Bob' })
    expect(hostLobby.seat).toBe(0)
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

  it('chooseSeat recusa trocar de lugar com o anfitrião', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    const guest = new FakeSocket()
    server.registerConnection('c1', host)
    server.registerConnection('c2', guest)
    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    await server.handleMessage('c2', { type: 'join', code: (host.ofType('joined')[0] as any).code, name: 'Bob' })

    await server.handleMessage('c2', { type: 'chooseSeat', seatIndex: 0 })
    expect(guest.ofType('error').length).toBeGreaterThanOrEqual(1)
  })

  it('chooseSeat com um assento já ocupado por outro humano TROCA os dois, e a intent de cada um passa a valer no NOVO assento', async () => {
    const server = makeServer()
    const host = new FakeSocket()
    const bob = new FakeSocket()
    const carol = new FakeSocket()
    server.registerConnection('c1', host)
    server.registerConnection('c2', bob)
    server.registerConnection('c3', carol)
    await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
    const code = (host.ofType('joined')[0] as any).code
    await server.handleMessage('c2', { type: 'join', code, name: 'Bob' }) // assento 1
    await server.handleMessage('c3', { type: 'join', code, name: 'Carol' }) // assento 2

    // Bob (assento 1) toca no assento da Carol (2) - os dois trocam.
    await server.handleMessage('c2', { type: 'chooseSeat', seatIndex: 2 })

    const lastLobby = host.ofType('lobby').at(-1) as any
    expect(lastLobby.seats[2]).toMatchObject({ name: 'Bob' })
    expect(lastLobby.seats[1]).toMatchObject({ name: 'Carol' })

    // Regressão do bug que essa troca poderia introduzir: connStates da
    // CAROL (empurrada pro assento 1 sem ela ter feito nada) precisa
    // acompanhar - senão a próxima intent dela seria avaliada com o
    // assento ANTIGO (2, onde não é mais ela).
    await server.handleMessage('c1', { type: 'start' })
    // Ordem dos turnos: 0 (host) -> 1 (agora Carol) -> 2 (agora Bob) -> 3.
    await server.handleMessage('c1', { type: 'intent', intent: { type: 'draw' } })
    await server.handleMessage('c1', { type: 'intent', intent: { type: 'discard', cardIndex: 0 } })

    const carolState = carol.ofType('state').at(-1) as any
    expect(carolState.view.currentSeat).toBe(1)
    expect(carolState.view.seat).toBe(1) // a própria view da Carol confirma o assento novo

    // A intent da Carol (assento 1 de verdade agora) precisa ser aceita sem
    // erro "não é a vez deste assento".
    await server.handleMessage('c3', { type: 'intent', intent: { type: 'draw' } })
    expect(carol.ofType('error')).toHaveLength(0)
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

  describe('anfitrião cai (handleClose)', () => {
    it('avisa os convidados ainda conectados que a sala fechou', async () => {
      const server = makeServer()
      const host = new FakeSocket()
      const guest = new FakeSocket()
      server.registerConnection('c1', host)
      server.registerConnection('c2', guest)

      await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
      await server.handleMessage('c2', { type: 'join', code: (host.ofType('joined')[0] as any).code, name: 'Bob' })

      server.handleClose('c1') // o anfitrião cai

      const closed = guest.ofType('roomClosed')
      expect(closed).toHaveLength(1)
      expect((closed[0] as any).reason).toMatch(/anfitrião/i)
    })

    it('a sala deixa de existir - uma tentativa de entrar depois falha', async () => {
      const server = makeServer()
      const host = new FakeSocket()
      const guest = new FakeSocket()
      const latecomer = new FakeSocket()
      server.registerConnection('c1', host)
      server.registerConnection('c2', guest)
      server.registerConnection('c3', latecomer)

      await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
      const code = (host.ofType('joined')[0] as any).code
      await server.handleMessage('c2', { type: 'join', code, name: 'Bob' })

      server.handleClose('c1')

      await server.handleMessage('c3', { type: 'join', code, name: 'Tarde Demais' })
      expect(latecomer.ofType('error')).toHaveLength(1)
    })

    it('um convidado comum caindo NÃO fecha a sala - só o anfitrião faz isso', async () => {
      const server = makeServer()
      const host = new FakeSocket()
      const guest = new FakeSocket()
      server.registerConnection('c1', host)
      server.registerConnection('c2', guest)

      await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
      await server.handleMessage('c2', { type: 'join', code: (host.ofType('joined')[0] as any).code, name: 'Bob' })

      server.handleClose('c2') // um convidado comum cai, não o anfitrião

      expect(host.ofType('roomClosed')).toHaveLength(0)
      // o assento do convidado fica marcado offline, mas a sala continua -
      // o comportamento de reconexão de sempre (rooms.test.ts já cobre).
      const lastLobby = host.ofType('lobby').at(-1) as any
      expect(lastLobby.seats[1]).toMatchObject({ kind: 'human', name: 'Bob', connected: false })
    })
  })

  describe('pausa e reconexão no meio da partida', () => {
    async function setupStartedRoom() {
      const server = makeServer()
      const host = new FakeSocket()
      const guest = new FakeSocket()
      server.registerConnection('c1', host)
      server.registerConnection('c2', guest)
      await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
      const code = (host.ofType('joined')[0] as any).code
      await server.handleMessage('c2', { type: 'join', code, name: 'Bob' })
      await server.handleMessage('c1', { type: 'start' })
      return { server, host, guest, code }
    }

    it('um convidado caindo no meio da partida marca o assento offline E pausa - visível no `state`, não só no `lobby`', async () => {
      const { server, host, guest } = await setupStartedRoom()

      server.handleClose('c2') // Bob cai no meio da partida

      const latest = host.ofType('state').at(-1) as any
      expect(latest.view.paused).toBe(true)
      expect(latest.view.players[1]).toMatchObject({ name: 'Bob', connected: false })
      void guest
    })

    it('enquanto pausada, uma intent de QUALQUER assento (inclusive de quem está conectado) é recusada', async () => {
      const { server, host } = await setupStartedRoom()

      server.handleClose('c2') // Bob (assento 1) cai
      const errorsBefore = host.ofType('error').length

      await server.handleMessage('c1', { type: 'intent', intent: { type: 'draw' } })

      expect(host.ofType('error').length).toBeGreaterThan(errorsBefore)
      // Nenhum state novo por causa dessa intent recusada (só o da queda).
      const statesAfterClose = host.ofType('state')
      const lastView = statesAfterClose.at(-1) as any
      expect(lastView.view.phase).toBe('draw') // não avançou pra 'play'
    })

    it('turnos de IA não avançam enquanto pausada', async () => {
      const server = makeServer()
      const host = new FakeSocket()
      const guest = new FakeSocket()
      server.registerConnection('c1', host)
      server.registerConnection('c2', guest)
      await server.handleMessage('c1', { type: 'create', name: 'Host', difficulty: 'medium' })
      const code = (host.ofType('joined')[0] as any).code
      // Bob assume o assento 1 (senão seria IA) - assim o assento 2 (Nós,
      // parceiro) e 3 (Eles) continuam IA, prontos pra "avançar" se a pausa
      // não estivesse segurando.
      await server.handleMessage('c2', { type: 'join', code, name: 'Bob' })
      await server.handleMessage('c1', { type: 'start' })
      // Assento 0 (host) joga e passa a vez pro 1 (Bob, humano) - turnos de
      // IA só começariam depois do assento 1.
      await server.handleMessage('c1', { type: 'intent', intent: { type: 'draw' } })
      await server.handleMessage('c1', { type: 'intent', intent: { type: 'discard', cardIndex: 0 } })

      server.handleClose('c2') // Bob cai bem quando é a vez dele

      // Dá espaço pra qualquer loop de IA (que NÃO deveria rodar) terminar.
      await new Promise((r) => setTimeout(r, 0))
      await new Promise((r) => setTimeout(r, 0))

      const latest = host.ofType('state').at(-1) as any
      expect(latest.view.currentSeat).toBe(1) // ainda esperando Bob, ninguém "jogou por ele"
      expect(latest.view.paused).toBe(true)
    })

    it('reconectar com o MESMO nome no meio da partida: recebe o estado atual e a pausa é levantada pros dois lados', async () => {
      const { server, host, guest, code } = await setupStartedRoom()

      server.handleClose('c2') // Bob cai
      expect((host.ofType('state').at(-1) as any).view.paused).toBe(true)

      const guestBack = new FakeSocket()
      server.registerConnection('c2-new', guestBack)
      await server.handleMessage('c2-new', { type: 'join', code, name: 'Bob' })

      // Quem voltou recebe joined + um state (não fica preso na tela de
      // lobby - ver o efeito em OnlineLobby.tsx que troca de tela ao
      // receber `view`).
      expect(guestBack.ofType('joined')).toHaveLength(1)
      expect(guestBack.ofType('state').length).toBeGreaterThanOrEqual(1)
      expect((guestBack.ofType('joined')[0] as any).seat).toBe(1)

      // E quem ficou (host) também vê a pausa acabar.
      const hostLatest = host.ofType('state').at(-1) as any
      expect(hostLatest.view.paused).toBe(false)
      expect(hostLatest.view.players[1]).toMatchObject({ connected: true })
      void guest
    })

    it('depois de reconectar, uma intent do assento que voltou funciona normalmente de novo', async () => {
      const { server, host, code } = await setupStartedRoom()
      server.handleClose('c2')

      const guestBack = new FakeSocket()
      server.registerConnection('c2-new', guestBack)
      await server.handleMessage('c2-new', { type: 'join', code, name: 'Bob' })

      // Assento 0 (host) ainda está na vez dele (a pausa não avança turnos).
      await server.handleMessage('c1', { type: 'intent', intent: { type: 'draw' } })
      await server.handleMessage('c1', { type: 'intent', intent: { type: 'discard', cardIndex: 0 } })

      const latest = host.ofType('state').at(-1) as any
      expect(latest.view.currentSeat).toBe(1)
      expect(latest.view.paused).toBe(false)
    })
  })
})
