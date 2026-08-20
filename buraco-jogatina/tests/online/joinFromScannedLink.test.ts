import { useOnlineStore } from '../../src/online/onlineStore'

/** WebSocket falso que registra a URL de cada conexão — é ela que prova que
 * o endereço veio do QR, e não do que estava configurado antes. */
class FakeWebSocket {
  static instances: FakeWebSocket[] = []
  static readonly OPEN = 1

  readyState = FakeWebSocket.OPEN
  sent: string[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onerror: (() => void) | null = null

  constructor(public url: string) {
    FakeWebSocket.instances.push(this)
  }

  send(data: string): void {
    this.sent.push(data)
  }

  close(): void {}

  /** Dispara o onopen, que é quando o store manda o `join` de verdade. */
  simulateOpen(): void {
    this.onopen?.()
  }
}

const QR_HOST = '192.168.2.142:3001'

describe('joinFromScannedLink (conexão pelo QR)', () => {
  const OriginalWebSocket = global.WebSocket

  beforeEach(() => {
    FakeWebSocket.instances = []
    ;(global as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket
    useOnlineStore.getState().leave()
    useOnlineStore.getState().setServerAddress('')
  })

  afterEach(() => {
    useOnlineStore.getState().leave()
    ;(global as unknown as { WebSocket: unknown }).WebSocket = OriginalWebSocket
  })

  test('QR completo: configura o servidor do link e conecta NELE (não no de antes)', () => {
    // Cenário real: segundo celular, que nunca teve endereço configurado.
    const entered = useOnlineStore.getState().joinFromScannedLink(`http://${QR_HOST}/?sala=ABCDE`, 'Maria')

    expect(entered).toBe(true)
    expect(useOnlineStore.getState().serverAddress).toBe(QR_HOST)
    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].url).toBe(`ws://${QR_HOST}`)
  })

  test('ao abrir a conexão, manda o join com o código do QR e o nome digitado', () => {
    useOnlineStore.getState().joinFromScannedLink(`http://${QR_HOST}/?sala=ABCDE`, 'Maria')
    const ws = FakeWebSocket.instances[0]
    ws.simulateOpen()

    expect(ws.sent).toHaveLength(1)
    expect(JSON.parse(ws.sent[0])).toEqual({ type: 'join', code: 'ABCDE', name: 'Maria' })
  })

  test('o endereço do QR SOBRESCREVE um endereço antigo errado', () => {
    useOnlineStore.getState().setServerAddress('10.0.0.99:3001') // sobra de outra rede
    useOnlineStore.getState().joinFromScannedLink(`http://${QR_HOST}/?sala=ABCDE`, 'Maria')

    expect(useOnlineStore.getState().serverAddress).toBe(QR_HOST)
    expect(FakeWebSocket.instances[0].url).toBe(`ws://${QR_HOST}`)
  })

  test('QR só com o código (sem servidor) preserva o endereço já configurado', () => {
    useOnlineStore.getState().setServerAddress(QR_HOST)
    const entered = useOnlineStore.getState().joinFromScannedLink('ABCDE', 'Maria')

    expect(entered).toBe(true)
    expect(useOnlineStore.getState().serverAddress).toBe(QR_HOST)
    expect(FakeWebSocket.instances[0].url).toBe(`ws://${QR_HOST}`)
  })

  test('QR que não é convite (Wi-Fi/texto solto) NÃO conecta e devolve false', () => {
    expect(useOnlineStore.getState().joinFromScannedLink('WIFI:S:Casa;T:WPA;P:1234;;', 'Maria')).toBe(false)
    expect(useOnlineStore.getState().joinFromScannedLink('bom dia', 'Maria')).toBe(false)
    expect(FakeWebSocket.instances).toHaveLength(0)
  })

  test('link só com servidor, sem ?sala=, não entra em sala nenhuma', () => {
    expect(useOnlineStore.getState().joinFromScannedLink(`http://${QR_HOST}/`, 'Maria')).toBe(false)
    expect(FakeWebSocket.instances).toHaveLength(0)
  })
})
