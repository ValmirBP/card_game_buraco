import { useOnlineStore } from '../../src/online/onlineStore'

const LAST_ROOM_KEY = 'buraco-last-online-room'

/** Mesmo FakeWebSocket controlável de reconnectLoop.test.ts, com um extra:
 * `simulateMessage` pra injetar mensagens do servidor (aqui, `joined`). */
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readyState = FakeWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(): void {}

  close(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }

  simulateOpen(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }

  simulateMessage(msg: unknown): void {
    this.onmessage?.({ data: JSON.stringify(msg) })
  }
}

/** Simula o fluxo completo join() -> conexão abre -> servidor responde
 * `joined` — o ponto em que o store grava `lastRoom`. */
function simulateSuccessfulJoin(code: string, name: string): FakeWebSocket {
  useOnlineStore.getState().join(code, name)
  const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
  ws.simulateOpen()
  ws.simulateMessage({ type: 'joined', code, seat: 1, isHost: false })
  return ws
}

describe('onlineStore: lastRoom (persistência pra "Reconectar à sala")', () => {
  const OriginalWebSocket = global.WebSocket

  beforeEach(() => {
    FakeWebSocket.instances = []
    ;(global as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket
    window.localStorage.clear()
    useOnlineStore.getState().leave()
  })

  afterEach(() => {
    useOnlineStore.getState().leave()
    ;(global as unknown as { WebSocket: unknown }).WebSocket = OriginalWebSocket
  })

  test('um join bem-sucedido persiste código+nome em localStorage e no store', () => {
    simulateSuccessfulJoin('ABCDE', 'Alice')

    expect(useOnlineStore.getState().lastRoom).toEqual({ code: 'ABCDE', name: 'Alice' })
    const raw = window.localStorage.getItem(LAST_ROOM_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!)).toEqual({ code: 'ABCDE', name: 'Alice' })
  })

  test('reconnectToLastRoom() chama join com o código+nome persistidos', () => {
    simulateSuccessfulJoin('ABCDE', 'Alice')
    useOnlineStore.getState().leave() // sai (limpa a CONEXÃO, mas não localStorage se simularmos reabrir)

    // Simula "reabrir o app": o módulo já rodou loadLastRoom() no boot, mas
    // aqui simulamos o efeito direto - grava de volta no store como se
    // fosse um boot novo que leu do localStorage.
    useOnlineStore.setState({ lastRoom: { code: 'ABCDE', name: 'Alice' } })

    useOnlineStore.getState().reconnectToLastRoom()

    expect(FakeWebSocket.instances.length).toBeGreaterThan(0)
    const last = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
    expect(last.url).toBeDefined() // conexão foi de fato iniciada
  })

  test('reconnectToLastRoom() é no-op sem nenhuma sala salva', () => {
    useOnlineStore.setState({ lastRoom: null })
    const countBefore = FakeWebSocket.instances.length

    useOnlineStore.getState().reconnectToLastRoom()

    expect(FakeWebSocket.instances.length).toBe(countBefore)
  })

  test('leave() (saída intencional) limpa lastRoom do store E do localStorage', () => {
    simulateSuccessfulJoin('ABCDE', 'Alice')
    expect(useOnlineStore.getState().lastRoom).not.toBeNull()

    useOnlineStore.getState().leave()

    expect(useOnlineStore.getState().lastRoom).toBeNull()
    expect(window.localStorage.getItem(LAST_ROOM_KEY)).toBeNull()
  })

  test('roomClosed (anfitrião saiu) limpa lastRoom — nada pra reconectar numa sala que não existe mais', () => {
    const ws = simulateSuccessfulJoin('ABCDE', 'Alice')
    expect(useOnlineStore.getState().lastRoom).not.toBeNull()

    ws.simulateMessage({ type: 'roomClosed', reason: 'O anfitrião saiu da sala.' })

    expect(useOnlineStore.getState().lastRoom).toBeNull()
    expect(window.localStorage.getItem(LAST_ROOM_KEY)).toBeNull()
  })

  test('um novo join sobrescreve o lastRoom anterior (sempre reflete o mais recente)', () => {
    simulateSuccessfulJoin('AAAAA', 'Alice')
    expect(useOnlineStore.getState().lastRoom).toEqual({ code: 'AAAAA', name: 'Alice' })

    simulateSuccessfulJoin('BBBBB', 'Alice')
    expect(useOnlineStore.getState().lastRoom).toEqual({ code: 'BBBBB', name: 'Alice' })
    expect(JSON.parse(window.localStorage.getItem(LAST_ROOM_KEY)!)).toEqual({ code: 'BBBBB', name: 'Alice' })
  })
})
