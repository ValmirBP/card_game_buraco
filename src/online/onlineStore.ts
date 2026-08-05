import { create } from 'zustand'
import type { AIDifficulty } from '../engine/ai'
import type { Intent, SeatView } from '../session/types'

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed'

export interface LobbySeat {
  index: number
  kind: 'human' | 'ai'
  name: string
  connected: boolean
}

type ClientMessage =
  | { type: 'create'; name: string; difficulty: AIDifficulty }
  | { type: 'join'; code: string; name: string }
  | { type: 'start' }
  | { type: 'intent'; intent: Intent }
  | { type: 'nextRound' }

type ServerMessage =
  | { type: 'joined'; code: string; seat: number; isHost: boolean }
  | { type: 'lobby'; code: string; seats: LobbySeat[]; isHost: boolean }
  | { type: 'state'; view: SeatView }
  | { type: 'log'; lines: string[] }
  | { type: 'error'; message: string }

interface OnlineState {
  connection: ConnectionStatus
  code: string | null
  seat: number | null
  isHost: boolean
  lobby: LobbySeat[]
  view: SeatView | null
  log: string[]
  errorMsg: string | null
  /** Local UI-only selection state, mirrors the single-player store's
   * selectedCardIndices — indices into `view.yourHand`. */
  selectedCardIndices: number[]

  create: (name: string, difficulty: AIDifficulty) => void
  join: (code: string, name: string) => void
  start: () => void
  sendIntent: (intent: Intent) => void
  nextRound: () => void
  leave: () => void
  toggleCardSelection: (index: number) => void
  clearSelection: () => void
  clearError: () => void
}

let socket: WebSocket | null = null
// Remembered so a reconnect attempt can auto-rejoin the same room/name.
let lastJoin: { name: string; code?: string; difficulty?: AIDifficulty } | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let intentionalClose = false

function wsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}`
}

function send(msg: ClientMessage): void {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg))
  }
}

function connect(onOpen: () => void): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  intentionalClose = false
  useOnlineStore.setState({ connection: 'connecting', errorMsg: null })

  const ws = new WebSocket(wsUrl())
  socket = ws

  ws.onopen = () => {
    useOnlineStore.setState({ connection: 'open' })
    onOpen()
  }

  ws.onmessage = (event) => {
    let msg: ServerMessage
    try {
      msg = JSON.parse(event.data)
    } catch {
      return
    }
    handleServerMessage(msg)
  }

  ws.onclose = () => {
    useOnlineStore.setState({ connection: 'closed' })
    if (!intentionalClose && lastJoin) {
      // Best-effort reconnect: the server resumes a disconnected human seat
      // with the same name (see server/rooms.ts joinRoom reconnection path).
      reconnectTimer = setTimeout(() => {
        connect(() => {
          if (lastJoin?.code) {
            send({ type: 'join', code: lastJoin.code, name: lastJoin.name })
          }
        })
      }, 1500)
    }
  }

  ws.onerror = () => {
    // onclose fires right after; nothing extra to do here.
  }
}

function handleServerMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case 'joined':
      lastJoin = { name: lastJoin?.name ?? '', code: msg.code, difficulty: lastJoin?.difficulty }
      useOnlineStore.setState({ code: msg.code, seat: msg.seat, isHost: msg.isHost, errorMsg: null })
      break
    case 'lobby':
      useOnlineStore.setState({ code: msg.code, isHost: msg.isHost, lobby: msg.seats })
      break
    case 'state':
      useOnlineStore.setState({ view: msg.view, selectedCardIndices: [] })
      break
    case 'log':
      useOnlineStore.setState((s) => ({ log: [...s.log, ...msg.lines] }))
      break
    case 'error':
      useOnlineStore.setState({ errorMsg: msg.message })
      break
  }
}

export const useOnlineStore = create<OnlineState>((set, get) => ({
  connection: 'idle',
  code: null,
  seat: null,
  isHost: false,
  lobby: [],
  view: null,
  log: [],
  errorMsg: null,
  selectedCardIndices: [],

  create: (name, difficulty) => {
    lastJoin = { name, difficulty }
    connect(() => send({ type: 'create', name, difficulty }))
  },

  join: (code, name) => {
    lastJoin = { name, code }
    connect(() => send({ type: 'join', code, name }))
  },

  start: () => send({ type: 'start' }),

  sendIntent: (intent) => {
    send({ type: 'intent', intent })
    get().clearSelection()
  },

  nextRound: () => send({ type: 'nextRound' }),

  leave: () => {
    intentionalClose = true
    lastJoin = null
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (socket) {
      socket.close()
      socket = null
    }
    set({
      connection: 'idle',
      code: null,
      seat: null,
      isHost: false,
      lobby: [],
      view: null,
      log: [],
      errorMsg: null,
      selectedCardIndices: [],
    })
  },

  toggleCardSelection: (index) =>
    set((s) => ({
      selectedCardIndices: s.selectedCardIndices.includes(index)
        ? s.selectedCardIndices.filter((i) => i !== index)
        : [...s.selectedCardIndices, index],
    })),

  clearSelection: () => set({ selectedCardIndices: [] }),

  clearError: () => set({ errorMsg: null }),
}))
