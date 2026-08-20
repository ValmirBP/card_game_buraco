import { useOnlineStore } from '../../src/online/onlineStore'

/** WebSocket falso e controlável: cada `new WebSocket(url)` vira uma
 * instância registrada em `FakeWebSocket.instances`, e os testes disparam
 * `simulateClose()` manualmente (nunca chega a abrir de verdade — é
 * exatamente o cenário do bug B7: nenhum servidor no endereço). */
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

  simulateClose(): void {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.()
  }

  simulateOpen(): void {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.()
  }
}

describe('onlineStore reconnect loop (B7)', () => {
  const OriginalWebSocket = global.WebSocket

  beforeEach(() => {
    FakeWebSocket.instances = []
    ;(global as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket
    jest.useFakeTimers()
    useOnlineStore.getState().leave() // reseta connection/lastJoin/reconnectAttempts
  })

  afterEach(() => {
    useOnlineStore.getState().leave()
    jest.useRealTimers()
    ;(global as unknown as { WebSocket: unknown }).WebSocket = OriginalWebSocket
  })

  test('a connection that never opens stops retrying after a bounded number of attempts (not forever)', () => {
    useOnlineStore.getState().join('ABCDE', 'Você')
    expect(FakeWebSocket.instances).toHaveLength(1)

    // Simula várias quedas seguidas (nunca chega a abrir), avançando o
    // timer de reconexão (1500ms) a cada vez.
    for (let i = 0; i < 20; i++) {
      const current = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
      current.simulateClose()
      jest.advanceTimersByTime(1600)
    }

    // Sem o fix, isso cresceria sem parar (20+ instâncias, uma por rodada).
    // Com o fix, para num teto pequeno.
    expect(FakeWebSocket.instances.length).toBeLessThan(10)
    expect(useOnlineStore.getState().errorMsg).toMatch(/não foi possível conectar/i)
  })

  test('a successful connection resets the retry counter, so a LATER disconnect gets its own fresh attempts', () => {
    useOnlineStore.getState().join('ABCDE', 'Você')
    const first = FakeWebSocket.instances[0]
    first.simulateOpen()
    expect(useOnlineStore.getState().connection).toBe('open')
    expect(useOnlineStore.getState().errorMsg).toBeNull()

    // Cai depois de já ter aberto uma vez - deve tentar reconectar de novo
    // (não deve já estar "esgotado" por causa de tentativas anteriores).
    first.simulateClose()
    jest.advanceTimersByTime(1600)
    expect(FakeWebSocket.instances.length).toBeGreaterThan(1)
    expect(useOnlineStore.getState().errorMsg).toBeNull()
  })

  test('leave() stops any pending reconnect (no zombie retries after the user navigates away)', () => {
    useOnlineStore.getState().join('ABCDE', 'Você')
    const first = FakeWebSocket.instances[0]
    first.simulateClose()

    useOnlineStore.getState().leave()
    const countAfterLeave = FakeWebSocket.instances.length
    jest.advanceTimersByTime(5000)

    expect(FakeWebSocket.instances.length).toBe(countAfterLeave)
  })

  test('a synchronous WebSocket constructor error (ex.: SecurityError de mixed-content numa pagina https:// tentando ws://) surfaces errorMsg instead of failing silently', () => {
    // Reproduz o bug real encontrado no emulador: dentro do APK, a pagina
    // carrega em https://localhost e `new WebSocket('ws://...')` lanca
    // SecurityError SINCRONO (nao um erro assincrono via onclose/onerror).
    // Sem o try/catch em connect(), isso derrubava o handler de clique
    // inteiro em silencio - a tela so "voltava" pro formulario, sem
    // nenhuma mensagem de erro visivel pro usuario.
    class ThrowingWebSocket {
      constructor() {
        throw new DOMException(
          "Failed to construct 'WebSocket': An insecure WebSocket connection may not be initiated from a page loaded over HTTPS.",
          'SecurityError'
        )
      }
    }
    ;(global as unknown as { WebSocket: unknown }).WebSocket = ThrowingWebSocket

    useOnlineStore.getState().join('ABCDE', 'Você')

    expect(useOnlineStore.getState().connection).toBe('closed')
    expect(useOnlineStore.getState().errorMsg).toMatch(/não foi possível conectar/i)
  })
})
