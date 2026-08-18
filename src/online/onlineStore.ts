import { create } from 'zustand'
import type { AIDifficulty } from '../engine/ai'
import type { Intent, SeatView } from '../session/types'
import { resolveWsUrl } from './wsUrl'

const SERVER_ADDRESS_STORAGE_KEY = 'buraco-server-address'

/** Lido uma vez no boot: lembra o último endereço de servidor digitado, pra
 * o usuário não ter que retitar o IP do PC toda vez que abrir o app. Vazio
 * (default) = mesma origem da página, que é o único caso que funciona
 * quando o jogo é aberto num navegador servido pelo próprio servidor. */
function loadStoredServerAddress(): string {
  try {
    return window.localStorage.getItem(SERVER_ADDRESS_STORAGE_KEY) ?? ''
  } catch {
    return ''
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
  | { type: 'join'; code: string; name: string }
  | { type: 'start' }
  | { type: 'intent'; intent: Intent }
  | { type: 'nextRound' }

type ServerMessage =
  | { type: 'joined'; code: string; seat: number; isHost: boolean; serverUrl?: string }
  | { type: 'lobby'; code: string; seats: LobbySeat[]; isHost: boolean; serverUrl?: string }
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
  /** LAN base URL reported by the server (e.g. `http://192.168.2.169:3001`),
   * used to build a join link/QR that works from another device. Falls back
   * to window.location.origin when the server didn't find a LAN IP. */
  serverUrl: string | null
  /** Endereço explícito do servidor (ex.: "192.168.2.142:3001"), digitado
   * pelo usuário. OBRIGATÓRIO dentro do APK — lá a página é servida de
   * capacitor://localhost/https://localhost, então "mesma origem" (o
   * default vazio) tentaria conectar no próprio aparelho e nunca
   * funcionaria. Persistido em localStorage (ver resolveWsUrl em wsUrl.ts). */
  serverAddress: string
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
  setServerAddress: (address: string) => void
}

/** Builds the shareable "join this room" URL for the given room code, using
 * the server-reported LAN base URL when available so it works from another
 * device on the network (falls back to this page's own origin). */
export function joinUrlFor(code: string, serverUrl: string | null): string {
  const base = serverUrl || window.location.origin
  return `${base}/?sala=${code}`
}

let socket: WebSocket | null = null
// Remembered so a reconnect attempt can auto-rejoin the same room/name.
let lastJoin: { name: string; code?: string; difficulty?: AIDifficulty } | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let intentionalClose = false
// B7: sem isso, uma conexão que nunca abre (ex.: nenhum servidor no
// endereço, ou o APK tentando wss://localhost - ver wsUrl()) reagendava uma
// nova tentativa a cada 1.5s PARA SEMPRE, silenciosamente, em background,
// mesmo depois do usuário sair da tela online. Reseta a cada conexão bem-
// sucedida (onopen) e a cada novo create()/join() explícito.
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5

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

  const ws = new WebSocket(resolveWsUrl(useOnlineStore.getState().serverAddress))
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
    useOnlineStore.setState({ connection: 'closed' })
    if (!intentionalClose && lastJoin) {
      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        useOnlineStore.setState({
          errorMsg: 'Não foi possível conectar ao servidor. Verifique se ele está rodando e tente novamente.',
        })
        return
      }
      reconnectAttempts++
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
    // onclose fires right after (WebSocket sempre fecha após erro), que já
    // atualiza connection/errorMsg - nada extra necessário aqui.
  }
}

function handleServerMessage(msg: ServerMessage): void {
  switch (msg.type) {
    case 'joined':
      lastJoin = { name: lastJoin?.name ?? '', code: msg.code, difficulty: lastJoin?.difficulty }
      useOnlineStore.setState({
        code: msg.code,
        seat: msg.seat,
        isHost: msg.isHost,
        errorMsg: null,
        serverUrl: msg.serverUrl || null,
      })
      break
    case 'lobby':
      useOnlineStore.setState({
        code: msg.code,
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
  serverUrl: null,
  serverAddress: loadStoredServerAddress(),
  selectedCardIndices: [],

  create: (name, difficulty) => {
    reconnectAttempts = 0
    lastJoin = { name, difficulty }
    connect(() => send({ type: 'create', name, difficulty }))
  },

  join: (code, name) => {
    reconnectAttempts = 0
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
    reconnectAttempts = 0
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
      serverUrl: null,
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

  setServerAddress: (address) => {
    set({ serverAddress: address })
    try {
      window.localStorage.setItem(SERVER_ADDRESS_STORAGE_KEY, address)
    } catch {
      // localStorage indisponível (ex.: modo privado) - só não persiste
      // entre sessões, sem quebrar o app.
    }
  },
}))
