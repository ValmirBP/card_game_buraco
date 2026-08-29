import { create } from 'zustand'
import type { AIDifficulty } from '../engine/ai'
import type { Intent, SeatView } from '../session/types'
import { resolveWsUrl } from './wsUrl'
import { parseJoinLink } from './joinLink'
import type { DrawAnimState } from '../components/Gameplay/DrawAnimation'
import type { FlyAnimState } from '../components/Gameplay/CardFlyAnimation'

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
  | { type: 'chooseSeat'; seatIndex: number }
  | { type: 'rename'; name: string }

type ServerMessage =
  | { type: 'joined'; code: string; seat: number; isHost: boolean; serverUrl?: string }
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
  /** Motivo pelo qual a sala foi fechada à força (hoje só "o anfitrião
   * saiu") - diferente de errorMsg (uma jogada recusada, a sala continua
   * de pé): aqui a sala JÁ NÃO EXISTE MAIS, então quem vê isso precisa
   * sair da tela online, não só dispensar um aviso. App.tsx observa este
   * campo pra voltar ao menu sozinho quando ele aparece. */
  roomClosedReason: string | null
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

  /** Fantasmas de animação — mesma ideia do modo offline (Gameplay.tsx),
   * só que vivendo no store em vez de useState local: OnlineGameBoard.tsx e
   * OnlineDiscardRow.tsx disparam essas ações no momento do clique (onde
   * ainda sabem QUAIS cartas/retângulos estão envolvidos), e
   * OnlineGameplay.tsx só lê e renderiza os componentes de fantasma
   * (DrawAnimation/CardFlyAnimation), compartilhados com o offline.
   * `drawAnim` é a exceção: como a carta comprada só é conhecida depois da
   * resposta do servidor (ao contrário do offline, que muta local e
   * síncrono), quem dispara é um efeito em OnlineGameBoard.tsx reagindo ao
   * tamanho da mão crescer, não o clique em si. */
  drawAnim: DrawAnimState | null
  pickupAnim: FlyAnimState | null
  discardAnim: FlyAnimState | null
  tableAnim: FlyAnimState | null
  playDrawAnim: (anim: Omit<DrawAnimState, 'id'>) => void
  playPickupAnim: (anim: Omit<FlyAnimState, 'id'>) => void
  playDiscardAnim: (anim: Omit<FlyAnimState, 'id'>) => void
  playTableAnim: (anim: Omit<FlyAnimState, 'id'>) => void

  create: (name: string, difficulty: AIDifficulty) => void
  join: (code: string, name: string) => void
  /** Entra numa sala a partir do texto CRU de um QR lido (ver joinLink.ts):
   * configura o endereço do servidor embutido no link e já entra. Retorna
   * false se o texto não for um convite válido — aí o leitor segue lendo em
   * vez de fechar. */
  joinFromScannedLink: (raw: string, name: string) => boolean
  start: () => void
  sendIntent: (intent: Intent) => void
  nextRound: () => void
  leave: () => void
  toggleCardSelection: (index: number) => void
  clearSelection: () => void
  clearError: () => void
  clearRoomClosedReason: () => void
  setServerAddress: (address: string) => void
  /** "Escolher o lado que quer entrar": move você pra outro assento AI
   * livre, antes da partida começar — como times são fixos por assento
   * (0/2 = Nós, 1/3 = Eles), escolher o assento é escolher o lado. O
   * anfitrião (assento 0) não pode se mover (ver rooms.ts). */
  chooseSeat: (seatIndex: number) => void
  /** Renomeia você na sala atual, antes da partida começar. */
  rename: (name: string) => void
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

/** Fecha a conexão e cancela qualquer reconexão pendente — usado tanto por
 * leave() (saída intencional) quanto pelo handler de 'roomClosed' (a sala
 * foi fechada à força porque o anfitrião saiu, ver server/protocol.ts
 * handleClose). Sem marcar intentionalClose, o onclose do socket tentaria
 * reconectar numa sala que já não existe mais. */
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

  // `new WebSocket(...)` pode lançar SÍNCRONO (não é um erro assíncrono
  // pego por onerror/onclose) em cenários de política do navegador/WebView -
  // ex.: uma página https:// tentando abrir ws:// (mixed content) lança
  // SecurityError na hora. Sem o try/catch, isso derrubava o handler de
  // clique inteiro em silêncio: sem errorMsg, sem log, o usuário só via a
  // tela voltar pro formulário como se nada tivesse acontecido.
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
      useOnlineStore.setState({ errorMsg: msg.message })
      break
    case 'roomClosed':
      // A sala JÁ NÃO EXISTE MAIS no servidor (o anfitrião saiu) - mesma
      // limpeza de leave(), mas preservando o motivo pra App.tsx mostrar e
      // então levar de volta ao menu sozinho (ver o efeito lá).
      teardownConnection()
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

  join: (code, name) => {
    reconnectAttempts = 0
    lastJoin = { name, code }
    connect(() => send({ type: 'join', code, name }))
  },

  joinFromScannedLink: (raw, name) => {
    const link = parseJoinLink(raw)
    // Sem código não dá pra entrar em sala nenhuma (ex.: QR de Wi-Fi, ou um
    // link só com o servidor): o leitor continua lendo.
    if (!link || !link.code) return false
    // O endereço vem ANTES do join: connect() lê serverAddress via
    // getState() (ver connect/resolveWsUrl), e setServerAddress grava
    // sincronamente - então o join já sai apontando pro servidor do QR,
    // que é justamente o passo manual que o segundo aparelho tinha que
    // fazer à mão. Link sem servidor (ex.: localhost, descartado por
    // parseJoinLink) mantém o endereço já configurado.
    if (link.serverAddress) get().setServerAddress(link.serverAddress)
    get().join(link.code, name)
    return true
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
      // localStorage indisponível (ex.: modo privado) - só não persiste
      // entre sessões, sem quebrar o app.
    }
  },

  chooseSeat: (seatIndex) => send({ type: 'chooseSeat', seatIndex }),

  rename: (name) => send({ type: 'rename', name }),

  // Duração de cada fantasma DEVE acompanhar a animação real (ver TOTAL_S
  // de DrawAnimation.tsx e DURATION_S de CardFlyAnimation.tsx) + pequena
  // folga — mesmos valores usados pelo Gameplay.tsx offline.
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
