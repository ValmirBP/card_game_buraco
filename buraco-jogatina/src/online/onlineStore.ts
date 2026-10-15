import { create } from 'zustand'
import type { AIDifficulty } from '../engine/ai'
import type { Intent, SeatView } from '../session/types'
import { resolveWsUrl } from './wsUrl'
import { parseJoinLink } from './joinLink'
import type { DrawAnimState } from '../components/Gameplay/DrawAnimation'
import type { FlyAnimState } from '../components/Gameplay/CardFlyAnimation'

const SERVER_ADDRESS_STORAGE_KEY = 'buraco-server-address'
const LAST_ROOM_STORAGE_KEY = 'buraco-last-online-room'

function loadStoredServerAddress(): string {
  try {
    return window.localStorage.getItem(SERVER_ADDRESS_STORAGE_KEY) ?? ''
  } catch {
    return ''
  }
}

export interface LastRoomInfo {
  code: string
  name: string
  token?: string
}

function loadLastRoom(): LastRoomInfo | null {
  try {
    const raw = window.localStorage.getItem(LAST_ROOM_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed?.code === 'string' && typeof parsed?.name === 'string' && parsed.code && parsed.name) {
      return {
        code: parsed.code,
        name: parsed.name,
        token: typeof parsed.token === 'string' && parsed.token ? parsed.token : undefined,
      }
    }
    return null
  } catch {
    return null
  }
}

function saveLastRoom(info: LastRoomInfo): void {
  try {
    window.localStorage.setItem(LAST_ROOM_STORAGE_KEY, JSON.stringify(info))
  } catch {
  }
}

function clearLastRoom(): void {
  try {
    window.localStorage.removeItem(LAST_ROOM_STORAGE_KEY)
  } catch {
  }
}

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'closed'

export interface LobbySeat {
  index: number
  kind: 'human' | 'ai'
  name: string
  connected: boolean
}

type ClientMessage =
  | { type: 'create'; name: string; difficulty: AIDifficulty }
  | { type: 'join'; code: string; name: string; token?: string }
  | { type: 'start' }
  | { type: 'intent'; intent: Intent }
  | { type: 'nextRound' }
  | { type: 'chooseSeat'; seatIndex: number }
  | { type: 'rename'; name: string }

type ServerMessage =
  | { type: 'joined'; code: string; seat: number; isHost: boolean; serverUrl?: string; token?: string }
  | { type: 'lobby'; code: string; seat: number; seats: LobbySeat[]; isHost: boolean; serverUrl?: string }
  | { type: 'state'; view: SeatView }
  | { type: 'log'; lines: string[] }
  | { type: 'error'; message: string }
  | { type: 'roomClosed'; reason: string }

interface OnlineState {
  connection: ConnectionStatus
  code: string | null
  seat: number | null
  isHost: boolean
  lobby: LobbySeat[]
  view: SeatView | null
  log: string[]
  errorMsg: string | null
  roomClosedReason: string | null
  serverUrl: string | null
  serverAddress: string
  lastRoom: LastRoomInfo | null
  selectedCardIndices: number[]

  drawAnim: DrawAnimState | null
  pickupAnim: FlyAnimState | null
  discardAnim: FlyAnimState | null
  tableAnim: FlyAnimState | null
  playDrawAnim: (anim: Omit<DrawAnimState, 'id'>) => void
  playPickupAnim: (anim: Omit<FlyAnimState, 'id'>) => void
  playDiscardAnim: (anim: Omit<FlyAnimState, 'id'>) => void
  playTableAnim: (anim: Omit<FlyAnimState, 'id'>) => void

  create: (name: string, difficulty: AIDifficulty) => void
  join: (code: string, name: string, token?: string) => void
  joinFromScannedLink: (raw: string, name: string) => boolean
  reconnectToLastRoom: () => void
  start: () => void
  sendIntent: (intent: Intent) => void
  nextRound: () => void
  leave: () => void
  toggleCardSelection: (index: number) => void
  clearSelection: () => void
  clearError: () => void
  clearRoomClosedReason: () => void
  setServerAddress: (address: string) => void
  chooseSeat: (seatIndex: number) => void
  rename: (name: string) => void
}

export function joinUrlFor(code: string, serverUrl: string | null): string {
  const base = serverUrl || window.location.origin
  return `${base}/?sala=${code}`
}

let socket: WebSocket | null = null
let lastJoin: { name: string; code?: string; difficulty?: AIDifficulty; token?: string } | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let intentionalClose = false
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

function teardownConnection(): void {
  intentionalClose = true
  lastJoin = null
  reconnectAttempts = 0
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (socket) {
    socket.close()
    socket = null
  }
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

  if (socket) {
    const previous = socket
    previous.onopen = null
    previous.onmessage = null
    previous.onclose = null
    previous.onerror = null
    previous.close()
    socket = null
  }
  let ws: WebSocket
  try {
    ws = new WebSocket(resolveWsUrl(useOnlineStore.getState().serverAddress))
  } catch (err) {
    useOnlineStore.setState({
      connection: 'closed',
      errorMsg:
        err instanceof Error
          ? `Não foi possível conectar: ${err.message}`
          : 'Não foi possível conectar ao servidor.',
    })
    return
  }
  socket = ws

  ws.onopen = () => {
    reconnectAttempts = 0
    useOnlineStore.setState({ connection: 'open', errorMsg: null })
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
    if (ws !== socket) return
    useOnlineStore.setState({ connection: 'closed' })
    if (!intentionalClose && lastJoin) {
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        useOnlineStore.setState({
          errorMsg: 'Não foi possível conectar ao servidor. Verifique se ele está rodando e tente novamente.',
        })
        return
      }
      reconnectAttempts++
      reconnectTimer = setTimeout(() => {
        connect(() => {
          if (lastJoin?.code) {
            send({ type: 'join', code: lastJoin.code, name: lastJoin.name, token: lastJoin.token })
          }
        })
      }, 1500)
    }
  }

  ws.onerror = () => {
  }
}

function handleServerMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case 'joined': {
      lastJoin = {
        name: lastJoin?.name ?? '',
        code: msg.code,
        difficulty: lastJoin?.difficulty,
        token: msg.token ?? lastJoin?.token,
      }
      const lastRoom = lastJoin.name ? { code: msg.code, name: lastJoin.name, token: lastJoin.token } : null
      if (lastRoom) saveLastRoom(lastRoom)
      useOnlineStore.setState({
        code: msg.code,
        seat: msg.seat,
        isHost: msg.isHost,
        errorMsg: null,
        serverUrl: msg.serverUrl || null,
        lastRoom: lastRoom ?? useOnlineStore.getState().lastRoom,
      })
      break
    }
    case 'lobby':
      useOnlineStore.setState({
        code: msg.code,
        seat: msg.seat,
        isHost: msg.isHost,
        lobby: msg.seats,
        serverUrl: msg.serverUrl || null,
      })
      break
    case 'state':
      useOnlineStore.setState({ view: msg.view, selectedCardIndices: [] })
      break
    case 'log':
      useOnlineStore.setState((s) => ({ log: [...s.log, ...msg.lines] }))
      break
    case 'error':
      if (msg.message === 'room not found') {
        clearLastRoom()
        useOnlineStore.setState({ errorMsg: msg.message, lastRoom: null })
      } else {
        useOnlineStore.setState({ errorMsg: msg.message })
      }
      break
    case 'roomClosed':
      teardownConnection()
      clearLastRoom()
      useOnlineStore.setState({
        connection: 'idle',
        code: null,
        seat: null,
        isHost: false,
        lobby: [],
        view: null,
        log: [],
        errorMsg: null,
        serverUrl: null,
        selectedCardIndices: [],
        drawAnim: null,
        pickupAnim: null,
        discardAnim: null,
        tableAnim: null,
        roomClosedReason: msg.reason,
        lastRoom: null,
      })
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
  roomClosedReason: null,
  serverUrl: null,
  serverAddress: loadStoredServerAddress(),
  lastRoom: loadLastRoom(),
  selectedCardIndices: [],
  drawAnim: null,
  pickupAnim: null,
  discardAnim: null,
  tableAnim: null,

  create: (name, difficulty) => {
    reconnectAttempts = 0
    lastJoin = { name, difficulty }
    connect(() => send({ type: 'create', name, difficulty }))
  },

  join: (code, name, token) => {
    reconnectAttempts = 0
    lastJoin = { name, code, token }
    connect(() => send({ type: 'join', code, name, token }))
  },

  joinFromScannedLink: (raw, name) => {
    const link = parseJoinLink(raw)
    if (!link || !link.code) return false
    if (link.serverAddress) get().setServerAddress(link.serverAddress)
    get().join(link.code, name)
    return true
  },

  reconnectToLastRoom: () => {
    const { lastRoom } = get()
    if (!lastRoom) return
    get().join(lastRoom.code, lastRoom.name, lastRoom.token)
  },

  start: () => send({ type: 'start' }),

  sendIntent: (intent) => {
    send({ type: 'intent', intent })
    get().clearSelection()
  },

  nextRound: () => send({ type: 'nextRound' }),

  leave: () => {
    teardownConnection()
    set({
      connection: 'idle',
      code: null,
      seat: null,
      isHost: false,
      lobby: [],
      view: null,
      log: [],
      errorMsg: null,
      serverUrl: null,
      selectedCardIndices: [],
      drawAnim: null,
      pickupAnim: null,
      discardAnim: null,
      tableAnim: null,
      roomClosedReason: null,
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

  clearRoomClosedReason: () => set({ roomClosedReason: null }),

  setServerAddress: (address) => {
    set({ serverAddress: address })
    try {
      window.localStorage.setItem(SERVER_ADDRESS_STORAGE_KEY, address)
    } catch {
    }
  },

  chooseSeat: (seatIndex) => send({ type: 'chooseSeat', seatIndex }),

  rename: (name) => send({ type: 'rename', name }),

  playDrawAnim: (anim) => {
    const id = Date.now()
    set({ drawAnim: { id, ...anim } })
    window.setTimeout(() => {
      set((s) => (s.drawAnim?.id === id ? { drawAnim: null } : {}))
    }, 2250)
  },

  playPickupAnim: (anim) => {
    const id = Date.now()
    set({ pickupAnim: { id, ...anim } })
    window.setTimeout(() => {
      set((s) => (s.pickupAnim?.id === id ? { pickupAnim: null } : {}))
    }, 650)
  },

  playDiscardAnim: (anim) => {
    const id = Date.now()
    set({ discardAnim: { id, ...anim } })
    window.setTimeout(() => {
      set((s) => (s.discardAnim?.id === id ? { discardAnim: null } : {}))
    }, 650)
  },

  playTableAnim: (anim) => {
    const id = Date.now()
    set({ tableAnim: { id, ...anim } })
    window.setTimeout(() => {
      set((s) => (s.tableAnim?.id === id ? { tableAnim: null } : {}))
    }, 650)
  },
}))
