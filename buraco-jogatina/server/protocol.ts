import { RoomManager, Room, Difficulty, cleanName, MAX_TOKEN_LENGTH } from './rooms'
import type { Intent, SeatView } from '../src/session/types'
import { EMOTE_COOLDOWN_MS, isEmote, type Emote } from '../src/online/emotes'

export interface ClientSocket {
  send(data: string): void
}

export type ClientMessage =
  | { type: 'create'; name: string; difficulty: Difficulty }
  | { type: 'join'; code: string; name: string; token?: string }
  | { type: 'start' }
  | { type: 'intent'; intent: Intent }
  | { type: 'nextRound' }
  | { type: 'chooseSeat'; seatIndex: number }
  | { type: 'rename'; name: string }
  | { type: 'emote'; emoji: Emote }

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard']
const MAX_CODE_LENGTH = 16
const MAX_CARD_INDICES = 40

function isIndex(value: unknown, max: number): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < max
}

function isIndexList(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_CARD_INDICES &&
    value.every(v => isIndex(v, 200)) &&
    new Set(value).size === value.length
  )
}

const MAX_MELD_GROUPS = 8

function isMeldGroups(value: unknown): value is number[][] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MELD_GROUPS) return false
  if (!value.every(group => isIndexList(group) && group.length >= 3)) return false
  const all = value.flat()
  return all.length <= MAX_CARD_INDICES && new Set(all).size === all.length
}

function isIntent(value: unknown): value is Intent {
  if (typeof value !== 'object' || value === null) return false
  const intent = value as Record<string, unknown>
  switch (intent.type) {
    case 'draw':
    case 'takeDiscard':
    case 'nextRound':
      return true
    case 'discard':
      return isIndex(intent.cardIndex, 200)
    case 'playCanasta':
      return isIndexList(intent.cardIndices)
    case 'extendMeld':
      return isIndex(intent.meldIndex, 200) && isIndexList(intent.cardIndices)
    case 'playMelds':
      return isMeldGroups(intent.groups)
    default:
      return false
  }
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (typeof value !== 'object' || value === null) return false
  const msg = value as Record<string, unknown>
  switch (msg.type) {
    case 'create':
      return typeof msg.name === 'string' && DIFFICULTIES.includes(msg.difficulty as Difficulty)
    case 'join':
      return (
        typeof msg.code === 'string' &&
        msg.code.length <= MAX_CODE_LENGTH &&
        typeof msg.name === 'string' &&
        (msg.token === undefined || (typeof msg.token === 'string' && msg.token.length <= MAX_TOKEN_LENGTH))
      )
    case 'start':
    case 'nextRound':
      return true
    case 'intent':
      return isIntent(msg.intent)
    case 'chooseSeat':
      return isIndex(msg.seatIndex, 4)
    case 'rename':
      return typeof msg.name === 'string'
    case 'emote':
      return isEmote(msg.emoji)
    default:
      return false
  }
}

export interface LobbySeatView {
  index: number
  kind: 'human' | 'ai'
  name: string
  connected: boolean
}

export type ServerMessage =
  | { type: 'joined'; code: string; seat: number; isHost: boolean; serverUrl?: string; token?: string }
  | { type: 'lobby'; code: string; seat: number; seats: LobbySeatView[]; isHost: boolean; serverUrl?: string }
  | { type: 'state'; view: SeatView }
  | { type: 'log'; lines: string[] }
  | { type: 'error'; message: string }
  | { type: 'roomClosed'; reason: string }
  | { type: 'emote'; seat: number; emoji: Emote }

interface ConnState {
  roomCode: string
  seat: number
}

const DEFAULT_AI_TURN_DELAY_MS = 2000

export class ProtocolServer {
  private rooms = new RoomManager()
  private sockets = new Map<string, ClientSocket>()
  private connStates = new Map<string, ConnState>()
  private aiTurnDelayMs: number
  private aiLoops = new WeakSet<Room>()
  private serverUrl?: string
  private lastEmoteAt = new Map<string, number>()
  private now: () => number

  constructor(opts?: { aiTurnDelayMs?: number; serverUrl?: string; now?: () => number }) {
    this.aiTurnDelayMs = opts?.aiTurnDelayMs ?? DEFAULT_AI_TURN_DELAY_MS
    this.serverUrl = opts?.serverUrl
    this.now = opts?.now ?? (() => Date.now())
  }

  registerConnection(connId: string, socket: ClientSocket): void {
    this.sockets.set(connId, socket)
  }

  private handleEmote(connId: string, emoji: Emote): void {
    const state = this.connStates.get(connId)
    if (!state) {
      this.sendError(connId, 'voce nao esta em nenhuma sala')
      return
    }
    const room = this.rooms.getRoom(state.roomCode)
    if (!room) return
    const now = this.now()
    const last = this.lastEmoteAt.get(connId)
    if (last !== undefined && now - last < EMOTE_COOLDOWN_MS) return
    this.lastEmoteAt.set(connId, now)
    for (const seat of room.seats) {
      if (seat.kind === 'human' && seat.connId) {
        this.send(seat.connId, { type: 'emote', seat: state.seat, emoji })
      }
    }
  }

  handleClose(connId: string): void {
    this.lastEmoteAt.delete(connId)
    const state = this.connStates.get(connId)

    if (state?.seat === 0) {
      const remaining = this.rooms.closeRoom(state.roomCode)
      for (const otherConnId of remaining) {
        this.send(otherConnId, { type: 'roomClosed', reason: 'O anfitrião saiu da sala.' })
        this.connStates.delete(otherConnId)
      }
      this.sockets.delete(connId)
      this.connStates.delete(connId)
      return
    }

    this.rooms.leaveRoom(connId)
    this.sockets.delete(connId)
    this.connStates.delete(connId)
    if (!state) return
    this.broadcastLobby(state.roomCode)

    const room = this.rooms.getRoom(state.roomCode)
    if (room?.started && room.session) {
      this.broadcastState(room)
    }
  }

  private send(connId: string, msg: ServerMessage): void {
    const socket = this.sockets.get(connId)
    if (!socket) return
    socket.send(JSON.stringify(msg))
  }

  private sendError(connId: string, message: string): void {
    this.send(connId, { type: 'error', message })
  }

  private lobbySeats(room: Room): LobbySeatView[] {
    return room.seats.map((s) => ({
      index: s.index,
      kind: s.kind,
      name: s.name,
      connected: s.connId !== undefined,
    }))
  }

  private broadcastLobby(code: string): void {
    const room = this.rooms.getRoom(code)
    if (!room) return
    for (const seat of room.seats) {
      if (!seat.connId) continue
      this.send(seat.connId, {
        type: 'lobby',
        code: room.code,
        seat: seat.index,
        seats: this.lobbySeats(room),
        isHost: seat.index === 0,
        serverUrl: this.serverUrl,
      })
    }
  }

  private isPaused(room: Room): boolean {
    return room.seats.some((s) => s.kind === 'human' && s.connId === undefined)
  }

  private broadcastState(room: Room): void {
    if (!room.session) return
    const paused = this.isPaused(room)
    for (const seat of room.seats) {
      if (!seat.connId || seat.kind !== 'human') continue
      const view = room.session.getViewFor(seat.index)
      view.paused = paused
      view.players = view.players.map((p) => ({
        ...p,
        connected: room.seats[p.seat]?.kind === 'ai' || room.seats[p.seat]?.connId !== undefined,
      }))
      this.send(seat.connId, { type: 'state', view })
    }
  }

  private broadcastLog(room: Room, lines: string[]): void {
    if (lines.length === 0) return
    for (const seat of room.seats) {
      if (!seat.connId || seat.kind !== 'human') continue
      this.send(seat.connId, { type: 'log', lines })
    }
  }

  private async runAiTurnsPaced(room: Room): Promise<void> {
    if (!room.session || this.aiLoops.has(room)) return
    this.aiLoops.add(room)
    try {
      while (room.session.status === 'playing' && this.rooms.getRoom(room.code) === room) {
        if (this.isPaused(room)) break
        const config = room.seats[room.session.currentSeat]
        if (!config || config.kind !== 'ai') break
        const lines = room.session.runNextAiTurn()
        this.broadcastState(room)
        this.broadcastLog(room, lines)
        if (this.aiTurnDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, this.aiTurnDelayMs))
        }
      }
    } finally {
      this.aiLoops.delete(room)
    }
  }

  private launchAiTurns(room: Room): void {
    this.runAiTurnsPaced(room)
      .then(() => this.broadcastState(room))
      .catch((err) => {
        console.error('Falha nos turnos da IA:', err)
        this.broadcastState(room)
      })
  }

  async handleMessage(connId: string, raw: unknown): Promise<void> {
    if (!isClientMessage(raw)) {
      this.sendError(connId, 'mensagem invalida')
      return
    }
    try {
      switch (raw.type) {
        case 'create':
          return this.handleCreate(connId, raw.name, raw.difficulty)
        case 'join':
          return this.handleJoin(connId, raw.code, raw.name, raw.token)
        case 'start':
          return this.handleStart(connId)
        case 'intent':
          return this.handleIntent(connId, raw.intent)
        case 'nextRound':
          return this.handleIntent(connId, { type: 'nextRound' })
        case 'chooseSeat':
          return this.handleChooseSeat(connId, raw.seatIndex)
        case 'rename':
          return this.handleRename(connId, raw.name)
        case 'emote':
          return this.handleEmote(connId, raw.emoji)
      }
    } catch (err) {
      console.error('Erro ao tratar mensagem:', err)
      this.sendError(connId, 'erro interno ao processar a mensagem')
    }
  }

  private handleChooseSeat(connId: string, seatIndex: number): void {
    const state = this.connStates.get(connId)
    if (!state) {
      this.sendError(connId, 'voce nao esta em nenhuma sala')
      return
    }
    const result = this.rooms.chooseSeat(state.roomCode, connId, seatIndex)
    if ('error' in result) {
      this.sendError(connId, result.error)
      return
    }
    const room = this.rooms.getRoom(state.roomCode)
    if (room) {
      for (const seat of room.seats) {
        if (seat.kind === 'human' && seat.connId) {
          this.connStates.set(seat.connId, { roomCode: room.code, seat: seat.index })
        }
      }
    }
    this.broadcastLobby(state.roomCode)
  }

  private handleRename(connId: string, name: string): void {
    const state = this.connStates.get(connId)
    if (!state) {
      this.sendError(connId, 'voce nao esta em nenhuma sala')
      return
    }
    const result = this.rooms.rename(state.roomCode, connId, name)
    if ('error' in result) {
      this.sendError(connId, result.error)
      return
    }
    this.broadcastLobby(state.roomCode)
  }

  private handleCreate(connId: string, name: string, difficulty: Difficulty): void {
    if (this.connStates.has(connId)) {
      this.sendError(connId, 'voce ja esta em uma sala')
      return
    }
    const { code, room } = this.rooms.createRoom(connId, cleanName(name) || 'Jogador', difficulty)
    this.connStates.set(connId, { roomCode: code, seat: 0 })
    this.send(connId, { type: 'joined', code, seat: 0, isHost: true, serverUrl: this.serverUrl, token: room.seats[0].token })
    this.broadcastLobby(code)
  }

  private handleJoin(connId: string, code: string, name: string, token?: string): void {
    if (this.connStates.has(connId)) {
      this.sendError(connId, 'voce ja esta em uma sala')
      return
    }
    const result = this.rooms.joinRoom(code, connId, cleanName(name) || 'Jogador', token)
    if ('error' in result) {
      this.sendError(connId, result.error)
      return
    }
    this.connStates.set(connId, { roomCode: code, seat: result.seat })
    this.send(connId, {
      type: 'joined',
      code,
      seat: result.seat,
      isHost: result.seat === 0,
      serverUrl: this.serverUrl,
      token: result.token,
    })
    this.broadcastLobby(code)

    const room = this.rooms.getRoom(code)
    if (room?.started && room.session) {
      this.broadcastState(room)
      this.launchAiTurns(room)
    }
  }

  private handleStart(connId: string): void {
    const state = this.connStates.get(connId)
    if (!state) {
      this.sendError(connId, 'voce nao esta em nenhuma sala')
      return
    }
    const result = this.rooms.startRoom(state.roomCode, connId)
    if ('error' in result) {
      this.sendError(connId, result.error)
      return
    }
    const room = this.rooms.getRoom(state.roomCode)
    if (!room) return
    this.broadcastState(room)
    this.launchAiTurns(room)
  }

  private handleIntent(connId: string, intent: Intent): void {
    const state = this.connStates.get(connId)
    if (!state) {
      this.sendError(connId, 'voce nao esta em nenhuma sala')
      return
    }
    const room = this.rooms.getRoom(state.roomCode)
    if (!room || !room.session) {
      this.sendError(connId, 'sala nao encontrada ou partida nao iniciada')
      return
    }
    if (this.isPaused(room)) {
      this.sendError(connId, 'partida pausada - aguardando alguem reconectar')
      return
    }
    const result = room.session.applyIntent(state.seat, intent)
    if (!result.ok) {
      this.sendError(connId, result.error ?? 'jogada invalida')
      return
    }
    this.broadcastState(room)
    this.launchAiTurns(room)
  }
}
