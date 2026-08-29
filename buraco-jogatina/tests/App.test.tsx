import { render, screen, fireEvent, act } from '@testing-library/react'
import App from '../src/App'
import { useGameStore } from '../src/store/gameStore'
import { useOnlineStore } from '../src/online/onlineStore'

/**
 * Cobre o roteamento do botão VOLTAR de hardware do Android (App.tsx),
 * motivado pelo relato do usuário: "em momento nenhum tem um botão de
 * voltar durante o processo... o voltar pode ser pelo voltar normal do
 * Android ou um botão na tela". Sem isso, o padrão do WebView era minimizar
 * o app inteiro em QUALQUER tela — este teste prova que cada tela tem uma
 * ação sensata, com confirmação exatamente onde algo em andamento seria
 * perdido.
 */

let backButtonHandler: (() => void) | null = null
const exitAppMock = jest.fn()

jest.mock('@capacitor/app', () => ({
  App: {
    addListener: jest.fn((eventName: string, fn: () => void) => {
      if (eventName === 'backButton') backButtonHandler = fn
      return Promise.resolve({ remove: jest.fn(() => Promise.resolve()) })
    }),
    exitApp: () => {
      exitAppMock()
      return Promise.resolve()
    },
  },
}))

/** WebSocket falso e controlável — mesmo padrão de tests/online/reconnectLoop.test.ts. */
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

function pressHardwareBack(): void {
  expect(backButtonHandler).not.toBeNull()
  act(() => backButtonHandler!())
}

describe('App — botão voltar (hardware Android)', () => {
  const OriginalWebSocket = global.WebSocket

  beforeEach(() => {
    backButtonHandler = null
    exitAppMock.mockClear()
    FakeWebSocket.instances = []
    ;(global as unknown as { WebSocket: unknown }).WebSocket = FakeWebSocket
    useGameStore.getState().resetGame()
    useOnlineStore.getState().leave()
    jest.spyOn(window, 'confirm')
  })

  afterEach(() => {
    ;(global as unknown as { WebSocket: unknown }).WebSocket = OriginalWebSocket
    jest.restoreAllMocks()
  })

  test('no menu: fecha o app (sem confirmação — nada em andamento pra perder)', () => {
    render(<App />)
    expect(backButtonHandler).not.toBeNull()

    pressHardwareBack()

    expect(window.confirm).not.toHaveBeenCalled()
    expect(exitAppMock).toHaveBeenCalledTimes(1)
  })

  test('numa partida offline em andamento: pede confirmação antes de sair', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Jogar vs IA' }))
    fireEvent.click(screen.getByRole('button', { name: /Médio/ }))
    expect(useGameStore.getState().game).not.toBeNull()

    ;(window.confirm as jest.Mock).mockReturnValue(true)
    pressHardwareBack()

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/sair da partida/i))
    expect(useGameStore.getState().game).toBeNull() // resetGame() rodou
  })

  test('recusando a confirmação: a partida offline continua intacta', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Jogar vs IA' }))
    fireEvent.click(screen.getByRole('button', { name: /Médio/ }))
    expect(useGameStore.getState().game).not.toBeNull()

    ;(window.confirm as jest.Mock).mockReturnValue(false)
    pressHardwareBack()

    expect(useGameStore.getState().game).not.toBeNull() // resetGame() NÃO rodou
    expect(exitAppMock).not.toHaveBeenCalled()
  })

  test('na tela Online, antes de entrar numa sala: volta direto ao menu, sem confirmação', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Jogar Online' }))
    expect(screen.getByText('Jogar Online')).toBeInTheDocument()

    pressHardwareBack()

    expect(window.confirm).not.toHaveBeenCalled()
    // De volta ao menu: o botão "Jogar vs IA" reaparece.
    expect(screen.getByRole('button', { name: 'Jogar vs IA' })).toBeInTheDocument()
  })

  test('dentro de uma sala online (antes da partida começar): pede confirmação antes de sair', async () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Jogar Online' }))
    fireEvent.click(screen.getByRole('button', { name: 'Criar Sala' }))
    fireEvent.click(screen.getByRole('button', { name: /Médio/ }))

    const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1]
    act(() => {
      ws.simulateOpen()
      ws.simulateMessage({ type: 'joined', code: 'ABCDE', seat: 0, isHost: true })
    })
    expect(useOnlineStore.getState().code).toBe('ABCDE')

    ;(window.confirm as jest.Mock).mockReturnValue(true)
    pressHardwareBack()

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/sair da sala/i))
    expect(useOnlineStore.getState().code).toBeNull() // leave() rodou
  })
})
