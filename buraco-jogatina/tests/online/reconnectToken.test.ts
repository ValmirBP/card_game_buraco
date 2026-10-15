import { useOnlineStore } from '../../src/online/onlineStore'

class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = FakeWebSocket.CONNECTING
  sent: Array<Record<string, unknown>> = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(JSON.parse(data))
  }

  close(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }

  open(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  receive(msg: unknown): void {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
}

const TOKEN = 'ab12'.repeat(8)

describe('onlineStore: token de reconexão', () => {
  const OriginalWebSocket = global.WebSocket

  beforeEach(() => {
    FakeWebSocket.instances = []
    ;(global as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket
    window.localStorage.clear()
    jest.useFakeTimers()
    useOnlineStore.getState().leave()
  })

  afterEach(() => {
    useOnlineStore.getState().leave()
    jest.useRealTimers()
    ;(global as unknown as { WebSocket: unknown }).WebSocket = OriginalWebSocket
  })

  function joinAndReceiveToken() {
    useOnlineStore.getState().join('ABCDE', 'Bob')
    const ws = FakeWebSocket.instances[0]
    ws.open()
    ws.receive({ type: 'joined', code: 'ABCDE', seat: 1, isHost: false, token: TOKEN })
    return ws
  }

  it('a primeira entrada não manda token; o token recebido é guardado na última sala', () => {
    const ws = joinAndReceiveToken()
    expect(ws.sent[0]).toEqual({ type: 'join', code: 'ABCDE', name: 'Bob', token: undefined })
    expect(useOnlineStore.getState().lastRoom).toEqual({ code: 'ABCDE', name: 'Bob', token: TOKEN })
    expect(JSON.parse(window.localStorage.getItem('buraco-last-online-room')!)).toEqual({
      code: 'ABCDE',
      name: 'Bob',
      token: TOKEN,
    })
  })

  it('a reconexão automática depois de uma queda reenvia o token', () => {
    const ws = joinAndReceiveToken()
    ws.close()
    jest.advanceTimersByTime(1600)
    const second = FakeWebSocket.instances[1]
    second.open()
    expect(second.sent[0]).toMatchObject({ type: 'join', code: 'ABCDE', name: 'Bob', token: TOKEN })
  })

  it('"Reconectar à sala" depois de fechar e reabrir o app usa o token salvo', () => {
    window.localStorage.setItem(
      'buraco-last-online-room',
      JSON.stringify({ code: 'ABCDE', name: 'Bob', token: TOKEN })
    )
    jest.resetModules()
    return import('../../src/online/onlineStore').then(({ useOnlineStore: fresh }) => {
      expect(fresh.getState().lastRoom).toEqual({ code: 'ABCDE', name: 'Bob', token: TOKEN })
      fresh.getState().reconnectToLastRoom()
      const ws = FakeWebSocket.instances.at(-1)!
      ws.open()
      expect(ws.sent[0]).toMatchObject({ type: 'join', code: 'ABCDE', name: 'Bob', token: TOKEN })
    })
  })

  it('entrar por QR/link (jogador novo) nunca manda token', () => {
    window.localStorage.setItem(
      'buraco-last-online-room',
      JSON.stringify({ code: 'OLD11', name: 'Bob', token: TOKEN })
    )
    useOnlineStore.getState().join('NEW22', 'Bob')
    const ws = FakeWebSocket.instances.at(-1)!
    ws.open()
    expect(ws.sent[0].token).toBeUndefined()
  })

  it('uma última sala antiga, salva sem token, continua sendo lida', () => {
    window.localStorage.setItem('buraco-last-online-room', JSON.stringify({ code: 'ABCDE', name: 'Bob' }))
    jest.resetModules()
    return import('../../src/online/onlineStore').then(({ useOnlineStore: fresh }) => {
      expect(fresh.getState().lastRoom).toEqual({ code: 'ABCDE', name: 'Bob', token: undefined })
    })
  })
})
