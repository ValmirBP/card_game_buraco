import { RoomManager, Room, Difficulty } from './rooms'
import type { Intent, SeatView } from '../src/session/types'

export interface ClientSocket {
  send(data: string): void
}

export type ClientMessage =
  | { type: 'create'; name: string; difficulty: Difficulty }
  | { type: 'join'; code: string; name: string }
  | { type: 'start' }
  | { type: 'intent'; intent: Intent }
  | { type: 'nextRound' }
  | { type: 'chooseSeat'; seatIndex: number }
  | { type: 'rename'; name: string }

export interface LobbySeatView {
  index: number
  kind: 'human' | 'ai'
  name: string
  connected: boolean
}

export type ServerMessage =
  | { type: 'joined'; code: string; seat: number; isHost: boolean; serverUrl?: string }
  | { type: 'lobby'; code: string; seat: number; seats: LobbySeatView[]; isHost: boolean; serverUrl?: string }
  | { type: 'state'; view: SeatView }
  | { type: 'log'; lines: string[] }
  | { type: 'error'; message: string }
  | { type: 'roomClosed'; reason: string }

interface ConnState {
  roomCode: string
  seat: number
}

/** Between AI turns, wait this long before applying+broadcasting the next
 * one, purely for pacing on the client - mesmos 2s do AI_THINK_DELAY_MS do
 * modo offline (Gameplay.tsx), pra dar tempo de acompanhar a jogada em vez
 * de tudo acontecer instantâneo (relato do usuário: "os bots estão muito
 * rápidos"). Set to 0 in tests. */
const DEFAULT_AI_TURN_DELAY_MS = 2000

export class ProtocolServer {
  private rooms = new RoomManager()
  private sockets = new Map<string, ClientSocket>()
  private connStates = new Map<string, ConnState>()
  private aiTurnDelayMs: number
  private serverUrl?: string

  constructor(opts?: { aiTurnDelayMs?: number; serverUrl?: string }) {
    this.aiTurnDelayMs = opts?.aiTurnDelayMs ?? DEFAULT_AI_TURN_DELAY_MS
    this.serverUrl = opts?.serverUrl
  }

  registerConnection(connId: string, socket: ClientSocket): void {
    this.sockets.set(connId, socket)
  }

  handleClose(connId: string): void {
    const state = this.connStates.get(connId)

    // O ANFITRIÃO (assento 0) caiu: a sala inteira acaba, não só o assento
    // dele. Sem seats[0].connId, startRoom nunca mais autoriza ninguém a
    // iniciar - deixar a sala "zumbi" esperando ele reconectar travaria o
    // jogo pros outros pra sempre (pedido do usuário: "quando o host cai a
    // sala deve cair junto"). Avisa quem ainda estiver conectado.
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
    if (state) this.broadcastLobby(state.roomCode)
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
      // `seat: seat.index` é o assento ATUAL desta conexão específica -
      // sem isso, quem troca de assento via chooseSeat só recebe a lista
      // de assentos (sem saber qual É o dele), e o cliente continuava
      // achando que estava no assento ANTIGO (o destaque "(você)" e o
      // lápis de editar nome ficavam grudados lá, agora ocupado por uma
      // IA - relato do usuário: "o nome não vai e fica em destaque").
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

  private broadcastState(room: Room): void {
    if (!room.session) return
    for (const seat of room.seats) {
      if (!seat.connId || seat.kind !== 'human') continue
      this.send(seat.connId, { type: 'state', view: room.session.getViewFor(seat.index) })
    }
  }

  private broadcastLog(room: Room, lines: string[]): void {
    if (lines.length === 0) return
    for (const seat of room.seats) {
      if (!seat.connId || seat.kind !== 'human') continue
      this.send(seat.connId, { type: 'log', lines })
    }
  }

  /** Runs queued AI turns one at a time, broadcasting state after each, with
   * a pacing delay between them. Resolves once it's a human's turn again or
   * the round/match has ended. */
  private async runAiTurnsPaced(room: Room): Promise<void> {
    if (!room.session) return
    while (room.session.status === 'playing') {
      const seat = room.session.currentSeat
      const config = room.seats[seat]
      if (!config || config.kind !== 'ai') break
      const lines = room.session.runAiTurns()
      this.broadcastState(room)
      this.broadcastLog(room, lines)
      if (this.aiTurnDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, this.aiTurnDelayMs))
      }
    }
  }

  async handleMessage(connId: string, raw: ClientMessage): Promise<void> {
    switch (raw.type) {
      case 'create':
        return this.handleCreate(connId, raw.name, raw.difficulty)
      case 'join':
        return this.handleJoin(connId, raw.code, raw.name)
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
      default:
        this.sendError(connId, 'mensagem desconhecida')
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
    // O assento mudou - connStates precisa acompanhar, senão a próxima
    // intent/start deste jogador seria avaliada com o assento ANTIGO.
    this.connStates.set(connId, { roomCode: state.roomCode, seat: result.seat })
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
    const { code } = this.rooms.createRoom(connId, name, difficulty)
    this.connStates.set(connId, { roomCode: code, seat: 0 })
    this.send(connId, { type: 'joined', code, seat: 0, isHost: true, serverUrl: this.serverUrl })
    this.broadcastLobby(code)
  }

  private handleJoin(connId: string, code: string, name: string): void {
    const result = this.rooms.joinRoom(code, connId, name)
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
    })
    this.broadcastLobby(code)
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
    void this.runAiTurnsPaced(room).then(() => this.broadcastState(room))
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
    const result = room.session.applyIntent(state.seat, intent)
    if (!result.ok) {
      this.sendError(connId, result.error ?? 'jogada invalida')
      return
    }
    this.broadcastState(room)
    void this.runAiTurnsPaced(room).then(() => this.broadcastState(room))
  }
}
