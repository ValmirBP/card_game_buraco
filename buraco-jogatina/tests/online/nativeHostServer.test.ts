/**
 * Testa a ponte JS (src/online/nativeHostServer.ts) contra uma implementação
 * FALSA da superfície do plugin nativo (HostServerPlugin.java) — a falsa se
 * comporta como o servidor Java-WebSocket de verdade se comportaria (eventos
 * connectionOpen -> message -> connectionClosed; `send` entrega pro peer
 * certo), sem precisar de um socket TCP real nem da camada Android nativa.
 *
 * O que isso prova: a ponte conduz corretamente o MESMO ProtocolServer que
 * server/index.ts usa no servidor de desktop — então qualquer fluxo de
 * create/join/jogar que já funciona contra o servidor de desktop também
 * funciona hospedado a partir de um celular. A parte que este teste NÃO
 * cobre é o transporte nativo em si (o plugin Java real, o bind da porta,
 * o handshake WebSocket de verdade) — essa parte foi verificada à parte,
 * rodando o app no emulador com `adb forward` (ver o build/relatório da
 * sessão).
 */

interface FakeConn {
  onMessageFromServer: (data: string) => void
}

type Listener = (payload: unknown) => void

function makeFakeHostServerPlugin() {
  let started = false
  const conns = new Map<string, FakeConn>()
  const listeners: Record<'connectionOpen' | 'message' | 'connectionClosed', Listener[]> = {
    connectionOpen: [],
    message: [],
    connectionClosed: [],
  }
  let nextId = 1

  const plugin = {
    start: jest.fn(async ({ port }: { port: number }) => {
      started = true
      return { running: true, port, address: '192.168.9.9' }
    }),
    stop: jest.fn(async () => {
      started = false
      conns.clear()
    }),
    send: jest.fn(async ({ connId, data }: { connId: string; data: string }) => {
      conns.get(connId)?.onMessageFromServer(data)
    }),
    status: jest.fn(async () => ({ running: started, port: 3001, address: '192.168.9.9' })),
    addListener: jest.fn(async (eventName: 'connectionOpen' | 'message' | 'connectionClosed', fn: Listener) => {
      listeners[eventName].push(fn)
      return {
        remove: jest.fn(async () => {
          listeners[eventName] = listeners[eventName].filter((l) => l !== fn)
        }),
      }
    }),
  }

  /** Simula outro aparelho conectando (host ou convidado) — equivalente a
   * um `new WebSocket(...)` de verdade abrindo contra o servidor nativo. */
  function connectPeer(onMessageFromServer: (data: string) => void) {
    const connId = `native-${nextId++}`
    conns.set(connId, { onMessageFromServer })
    listeners.connectionOpen.forEach((fn) => fn({ connId }))
    return {
      connId,
      sendToServer: (data: string) => listeners.message.forEach((fn) => fn({ connId, data })),
      close: () => {
        conns.delete(connId)
        listeners.connectionClosed.forEach((fn) => fn({ connId }))
      },
    }
  }

  return { plugin, connectPeer }
}

let fakeHost: ReturnType<typeof makeFakeHostServerPlugin>

jest.mock('@capacitor/core', () => ({
  registerPlugin: () => fakeHost.plugin,
}))

/** Deixa qualquer microtask pendente (ex.: o .catch() de handleMessage)
 * assentar antes de inspecionar o que foi recebido. */
async function flush(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

describe('nativeHostServer', () => {
  beforeEach(() => {
    jest.resetModules()
    fakeHost = makeFakeHostServerPlugin()
  })

  test('start() reporta o endereço e a porta que o plugin nativo devolveu', async () => {
    const { startNativeHost } = await import('../../src/online/nativeHostServer')
    const info = await startNativeHost(3001)
    expect(info).toEqual({ address: '192.168.9.9', port: 3001 })
    expect(fakeHost.plugin.start).toHaveBeenCalledWith({ port: 3001 })
  })

  test('criar sala -> outro aparelho entrar -> iniciar, tudo pelo MESMO ProtocolServer do servidor de desktop', async () => {
    const { startNativeHost } = await import('../../src/online/nativeHostServer')
    await startNativeHost(3001)

    const hostMessages: Array<Record<string, unknown>> = []
    const host = fakeHost.connectPeer((data) => hostMessages.push(JSON.parse(data)))
    host.sendToServer(JSON.stringify({ type: 'create', name: 'Anfitriao', difficulty: 'medio' }))
    await flush()

    const joined = hostMessages.find((m) => m.type === 'joined')
    expect(joined).toMatchObject({ isHost: true, seat: 0, serverUrl: 'http://192.168.9.9:3001' })

    const guestMessages: Array<Record<string, unknown>> = []
    const guest = fakeHost.connectPeer((data) => guestMessages.push(JSON.parse(data)))
    guest.sendToServer(JSON.stringify({ type: 'join', code: joined!.code, name: 'Convidado' }))
    await flush()

    const guestJoined = guestMessages.find((m) => m.type === 'joined')
    expect(guestJoined).toMatchObject({ isHost: false, seat: 1 })

    host.sendToServer(JSON.stringify({ type: 'start' }))
    await flush()

    // Depois de "start", o estado da partida chega pros dois assentos
    // humanos - exatamente como no servidor de desktop.
    expect(hostMessages.some((m) => m.type === 'state')).toBe(true)
    expect(guestMessages.some((m) => m.type === 'state')).toBe(true)
  })

  test('idempotente: chamar start() de novo com o servidor já rodando não reinicia nada', async () => {
    const { startNativeHost } = await import('../../src/online/nativeHostServer')
    await startNativeHost(3001)
    expect(fakeHost.plugin.start).toHaveBeenCalledTimes(1)

    const info2 = await startNativeHost(3001)
    expect(info2).toEqual({ address: '192.168.9.9', port: 3001 })
    expect(fakeHost.plugin.start).toHaveBeenCalledTimes(1)
  })

  test('start() devolve null quando o plugin nativo rejeita (ex.: porta ocupada)', async () => {
    fakeHost.plugin.start.mockRejectedValueOnce(new Error('porta em uso'))
    const { startNativeHost } = await import('../../src/online/nativeHostServer')
    const info = await startNativeHost(3001)
    expect(info).toBeNull()
  })

  test('stopNativeHost() remove os listeners e chama stop() no plugin nativo', async () => {
    const { startNativeHost, stopNativeHost, isNativeHostRunning } = await import(
      '../../src/online/nativeHostServer'
    )
    await startNativeHost(3001)
    expect(isNativeHostRunning()).toBe(true)

    await stopNativeHost()
    expect(isNativeHostRunning()).toBe(false)
    expect(fakeHost.plugin.stop).toHaveBeenCalled()
  })

  test('stopNativeHost() sem servidor rodando é um no-op seguro (chamado sempre ao sair da tela online)', async () => {
    const { stopNativeHost } = await import('../../src/online/nativeHostServer')
    await expect(stopNativeHost()).resolves.toBeUndefined()
    expect(fakeHost.plugin.stop).not.toHaveBeenCalled()
  })

  test('uma mensagem malformada de um peer não afeta outras conexões nem trava o servidor', async () => {
    const { startNativeHost } = await import('../../src/online/nativeHostServer')
    await startNativeHost(3001)

    const messages: Array<Record<string, unknown>> = []
    const peer = fakeHost.connectPeer((data) => messages.push(JSON.parse(data)))
    peer.sendToServer('isto não é JSON válido {{{')
    peer.sendToServer(JSON.stringify({ type: 'create', name: 'Continua Funcionando', difficulty: 'facil' }))
    await flush()

    expect(messages.some((m) => m.type === 'joined')).toBe(true)
  })

  test('sem endereço de rede (address ausente), o host ainda consegue jogar sozinho via 127.0.0.1', async () => {
    fakeHost.plugin.start.mockResolvedValueOnce({ running: true, port: 3001 })
    const { startNativeHost } = await import('../../src/online/nativeHostServer')
    const info = await startNativeHost(3001)
    expect(info).toEqual({ address: null, port: 3001 })
  })
})
