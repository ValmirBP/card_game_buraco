import { act, fireEvent, render, screen } from '@testing-library/react'
import { ProtocolServer, isClientMessage, ServerMessage } from '../../server/protocol'
import { EMOTES, EMOTE_COOLDOWN_MS, EMOTE_VISIBLE_MS, isEmote } from '../../src/online/emotes'
import { useOnlineStore } from '../../src/online/onlineStore'
import EmotePicker from '../../src/components/Online/EmotePicker'
import EmoteLayer from '../../src/components/Online/EmoteLayer'

class FakeSocket {
  messages: ServerMessage[] = []
  send(data: string): void {
    this.messages.push(JSON.parse(data))
  }
  emotes(): any[] {
    return this.messages.filter(m => m.type === 'emote')
  }
}

async function roomWithGuest(clock: { t: number }) {
  const server = new ProtocolServer({ aiTurnDelayMs: 0, now: () => clock.t })
  const host = new FakeSocket()
  const guest = new FakeSocket()
  const outsider = new FakeSocket()
  server.registerConnection('h', host)
  server.registerConnection('g', guest)
  server.registerConnection('x', outsider)
  await server.handleMessage('h', { type: 'create', name: 'Host', difficulty: 'easy' })
  const code = (host.messages.find(m => m.type === 'joined') as any).code
  await server.handleMessage('g', { type: 'join', code, name: 'Bob' })
  return { server, host, guest, outsider }
}

describe('lista de reações', () => {
  it('só emojis, sem texto, sem repetir', () => {
    expect(EMOTES.length).toBeGreaterThanOrEqual(8)
    expect(new Set(EMOTES).size).toBe(EMOTES.length)
    for (const e of EMOTES) expect(/[A-Za-z0-9]/.test(e)).toBe(false)
  })

  it('isEmote aceita só o que está na lista', () => {
    expect(isEmote('👍')).toBe(true)
    for (const bad of ['oi', 'ok', '👍👍', '', ' 👍', '💩', null, 5, { emoji: '👍' }]) {
      expect(isEmote(bad)).toBe(false)
    }
  })
})

describe('servidor: mensagem de reação', () => {
  it('a validação rejeita texto e emojis fora da lista como mensagem inválida', async () => {
    expect(isClientMessage({ type: 'emote', emoji: '👍' })).toBe(true)
    expect(isClientMessage({ type: 'emote', emoji: 'vai perder' })).toBe(false)
    expect(isClientMessage({ type: 'emote', emoji: '💩' })).toBe(false)
    expect(isClientMessage({ type: 'emote' })).toBe(false)
    const clock = { t: 0 }
    const { server, host, guest } = await roomWithGuest(clock)
    await server.handleMessage('g', { type: 'emote', emoji: 'texto livre' })
    expect((guest.messages.at(-1) as any).message).toBe('mensagem invalida')
    expect(host.emotes()).toHaveLength(0)
  })

  it('a reação vai para todos da sala (inclusive quem mandou) com o assento de quem mandou', async () => {
    const clock = { t: 1000 }
    const { server, host, guest, outsider } = await roomWithGuest(clock)
    await server.handleMessage('g', { type: 'emote', emoji: '🔥' })
    expect(host.emotes()).toEqual([{ type: 'emote', seat: 1, emoji: '🔥' }])
    expect(guest.emotes()).toEqual([{ type: 'emote', seat: 1, emoji: '🔥' }])
    expect(outsider.emotes()).toHaveLength(0)
  })

  it('funciona também com a partida em andamento', async () => {
    const clock = { t: 1000 }
    const { server, host, guest } = await roomWithGuest(clock)
    await server.handleMessage('h', { type: 'start' })
    await server.handleMessage('h', { type: 'emote', emoji: '👏' })
    expect(guest.emotes().at(-1)).toEqual({ type: 'emote', seat: 0, emoji: '👏' })
  })

  it('limita a frequência por jogador (anti-flood) sem atrapalhar os outros', async () => {
    const clock = { t: 1000 }
    const { server, host, guest } = await roomWithGuest(clock)
    await server.handleMessage('g', { type: 'emote', emoji: '😂' })
    clock.t += EMOTE_COOLDOWN_MS - 1
    await server.handleMessage('g', { type: 'emote', emoji: '😂' })
    await server.handleMessage('h', { type: 'emote', emoji: '😮' })
    expect(host.emotes().map(e => e.emoji)).toEqual(['😂', '😮'])
    clock.t += 1
    await server.handleMessage('g', { type: 'emote', emoji: '🤝' })
    expect(host.emotes().map(e => e.emoji)).toEqual(['😂', '😮', '🤝'])
  })

  it('quem não está em sala recebe erro e ninguém recebe a reação', async () => {
    const clock = { t: 0 }
    const { server, host, outsider } = await roomWithGuest(clock)
    await server.handleMessage('x', { type: 'emote', emoji: '👍' })
    expect((outsider.messages.at(-1) as any).message).toMatch(/nenhuma sala/)
    expect(host.emotes()).toHaveLength(0)
  })
})

describe('cliente: reações recebidas', () => {
  const OriginalWebSocket = global.WebSocket
  class FakeWS {
    static instances: FakeWS[] = []
    static readonly OPEN = 1
    readyState = 0
    sent: any[] = []
    onopen: (() => void) | null = null
    onclose: (() => void) | null = null
    onmessage: ((e: { data: string }) => void) | null = null
    onerror: (() => void) | null = null
    constructor(public url: string) {
      FakeWS.instances.push(this)
    }
    send(d: string) {
      this.sent.push(JSON.parse(d))
    }
    close() {
      this.readyState = 3
      this.onclose?.()
    }
    open() {
      this.readyState = 1
      this.onopen?.()
    }
    receive(m: unknown) {
      this.onmessage?.({ data: JSON.stringify(m) })
    }
  }

  beforeEach(() => {
    FakeWS.instances = []
    ;(global as any).WebSocket = FakeWS
    jest.useFakeTimers()
    useOnlineStore.getState().leave()
  })
  afterEach(() => {
    act(() => useOnlineStore.getState().leave())
    jest.useRealTimers()
    ;(global as any).WebSocket = OriginalWebSocket
  })

  function connected() {
    useOnlineStore.getState().join('ABCDE', 'Bob')
    const ws = FakeWS.instances[0]
    ws.open()
    return ws
  }

  it('sendEmote manda só emojis da lista', () => {
    const ws = connected()
    useOnlineStore.getState().sendEmote('👍')
    useOnlineStore.getState().sendEmote('oi' as any)
    expect(ws.sent.filter(m => m.type === 'emote')).toEqual([{ type: 'emote', emoji: '👍' }])
  })

  it('a reação aparece e some sozinha depois de alguns segundos', () => {
    const ws = connected()
    act(() => ws.receive({ type: 'emote', seat: 2, emoji: '🍀' }))
    expect(useOnlineStore.getState().emotes).toEqual([expect.objectContaining({ seat: 2, emoji: '🍀' })])
    act(() => jest.advanceTimersByTime(EMOTE_VISIBLE_MS))
    expect(useOnlineStore.getState().emotes).toEqual([])
  })

  it('uma nova reação do mesmo jogador substitui a anterior; de jogadores diferentes convivem', () => {
    const ws = connected()
    act(() => {
      ws.receive({ type: 'emote', seat: 1, emoji: '😂' })
      ws.receive({ type: 'emote', seat: 1, emoji: '😢' })
      ws.receive({ type: 'emote', seat: 3, emoji: '🔥' })
    })
    expect(useOnlineStore.getState().emotes.map(e => [e.seat, e.emoji])).toEqual([
      [1, '😢'],
      [3, '🔥'],
    ])
  })

  it('ignora reação malformada vinda do servidor', () => {
    const ws = connected()
    act(() => {
      ws.receive({ type: 'emote', seat: 1, emoji: 'texto' })
      ws.receive({ type: 'emote', seat: 'x', emoji: '👍' })
    })
    expect(useOnlineStore.getState().emotes).toEqual([])
  })
})

describe('interface das reações', () => {
  afterEach(() => act(() => useOnlineStore.setState({ emotes: [] })))

  it('o botão abre a paleta e escolher um emoji envia e fecha', () => {
    const sendEmote = jest.fn()
    useOnlineStore.setState({ sendEmote })
    render(<EmotePicker />)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Reações'))
    expect(screen.getAllByRole('menuitem')).toHaveLength(EMOTES.length)
    fireEvent.click(screen.getByLabelText('🙏'))
    expect(sendEmote).toHaveBeenCalledWith('🙏')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('depois de enviar, o botão espera o intervalo antes de permitir outro', () => {
    jest.useFakeTimers()
    const sendEmote = jest.fn()
    useOnlineStore.setState({ sendEmote })
    render(<EmotePicker />)
    fireEvent.click(screen.getByLabelText('Reações'))
    fireEvent.click(screen.getByLabelText('👍'))
    expect(screen.getByLabelText('Reações')).toBeDisabled()
    act(() => jest.advanceTimersByTime(EMOTE_COOLDOWN_MS))
    expect(screen.getByLabelText('Reações')).not.toBeDisabled()
    jest.useRealTimers()
  })

  it('a camada mostra o balão de cada reação ativa, com o emoji', () => {
    useOnlineStore.setState({
      emotes: [
        { id: 1, seat: 0, emoji: '😎' },
        { id: 2, seat: 2, emoji: '🤔' },
      ],
    })
    const { container } = render(<EmoteLayer mySeat={0} />)
    expect(container.querySelector('[data-emote-seat="0"]')!.textContent).toBe('😎')
    expect(container.querySelector('[data-emote-seat="2"]')!.textContent).toBe('🤔')
  })
})
