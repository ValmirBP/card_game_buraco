import { GameSession } from '../src/session/GameSession'
import type { SeatConfig } from '../src/session/types'
import type { AIDifficulty } from '../src/engine/ai'

export type Difficulty = AIDifficulty

export interface RoomSeat {
  index: number
  kind: 'human' | 'ai'
  name: string
  connId?: string
}

export interface Room {
  code: string
  hostId: string
  difficulty: Difficulty
  seats: RoomSeat[]
  session?: GameSession
  started: boolean
}

export interface JoinOk {
  seat: number
}

export interface ErrorResult {
  error: string
}

/** Chars A-Z0-9 minus ambiguous O/0/I/1. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 5
const SEAT_COUNT = 4

function randomCode(): string {
  let out = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]
  }
  return out
}

function defaultAiName(seatIndex: number): string {
  return `IA ${seatIndex + 1}`
}

export class RoomManager {
  private rooms = new Map<string, Room>()

  private generateUniqueCode(): string {
    let code = randomCode()
    while (this.rooms.has(code)) {
      code = randomCode()
    }
    return code
  }

  createRoom(hostConnId: string, hostName: string, difficulty: Difficulty): { code: string; room: Room } {
    const code = this.generateUniqueCode()
    const seats: RoomSeat[] = []
    for (let i = 0; i < SEAT_COUNT; i++) {
      if (i === 0) {
        seats.push({ index: 0, kind: 'human', name: hostName, connId: hostConnId })
      } else {
        seats.push({ index: i, kind: 'ai', name: defaultAiName(i) })
      }
    }
    const room: Room = {
      code,
      hostId: hostConnId,
      difficulty,
      seats,
      started: false,
    }
    this.rooms.set(code, room)
    return { code, room }
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code)
  }

  findRoomByConn(connId: string): Room | undefined {
    for (const room of this.rooms.values()) {
      if (room.seats.some((s) => s.connId === connId)) return room
    }
    return undefined
  }

  joinRoom(code: string, connId: string, name: string): JoinOk | ErrorResult {
    const room = this.rooms.get(code)
    if (!room) return { error: 'room not found' }
    if (room.started) return { error: 'room already started' }

    // Reconnection: a disconnected human seat with the same name resumes it.
    const reconnectSeat = room.seats.find(
      (s) => s.kind === 'human' && s.name === name && s.connId === undefined
    )
    if (reconnectSeat) {
      reconnectSeat.connId = connId
      if (reconnectSeat.index === 0) room.hostId = connId
      return { seat: reconnectSeat.index }
    }

    const freeSeat = room.seats.find((s) => s.kind === 'ai')
    if (!freeSeat) return { error: 'room is full' }

    freeSeat.kind = 'human'
    freeSeat.name = name
    freeSeat.connId = connId
    return { seat: freeSeat.index }
  }

  /**
   * Move o assento do chamador pra um assento AI livre `targetIndex`, antes
   * da partida começar — "escolher o lado que quer entrar" (pedido do
   * usuário): os times são fixos por assento (0/2 = Nós, 1/3 = Eles), então
   * escolher o assento É escolher o lado.
   *
   * O ANFITRIÃO (assento 0) nunca pode se mover: startRoom só autoriza quem
   * está em `seats[0]` a iniciar a partida, então deixar o assento 0 vago
   * (virando AI, sem connId) travaria a sala pra sempre - ninguém mais
   * conseguiria dar início. Assentos 1/2/3 podem trocar livremente entre si.
   */
  chooseSeat(code: string, connId: string, targetIndex: number): JoinOk | ErrorResult {
    const room = this.rooms.get(code)
    if (!room) return { error: 'room not found' }
    if (room.started) return { error: 'room already started' }

    const mySeat = room.seats.find((s) => s.connId === connId)
    if (!mySeat) return { error: 'voce nao esta em nenhuma sala' }
    if (mySeat.index === 0) return { error: 'o anfitriao nao pode trocar de assento' }

    const target = room.seats[targetIndex]
    if (!target) return { error: 'assento invalido' }
    if (target.index === mySeat.index) return { seat: mySeat.index }
    if (target.kind !== 'ai') return { error: 'assento ocupado' }

    const myName = mySeat.name
    mySeat.kind = 'ai'
    mySeat.name = defaultAiName(mySeat.index)
    mySeat.connId = undefined
    target.kind = 'human'
    target.name = myName
    target.connId = connId
    return { seat: target.index }
  }

  /**
   * Renomeia o assento do chamador, só antes da partida começar - o nome
   * exibido DURANTE uma partida vem de uma cópia congelada dentro do
   * GameSession (ver GameSession.ts, `name: cfg.name`), então renomear
   * depois de startRoom não mudaria nada visível; melhor recusar do que
   * fingir que funcionou.
   */
  rename(code: string, connId: string, name: string): JoinOk | ErrorResult {
    const room = this.rooms.get(code)
    if (!room) return { error: 'room not found' }
    if (room.started) return { error: 'room already started' }

    const mySeat = room.seats.find((s) => s.connId === connId)
    if (!mySeat) return { error: 'voce nao esta em nenhuma sala' }

    const trimmed = name.trim().slice(0, 24)
    if (!trimmed) return { error: 'nome nao pode ser vazio' }
    mySeat.name = trimmed
    return { seat: mySeat.index }
  }

  leaveRoom(connId: string): void {
    const room = this.findRoomByConn(connId)
    if (!room) return
    const seat = room.seats.find((s) => s.connId === connId)
    if (!seat) return
    seat.connId = undefined
  }

  startRoom(code: string, byConnId: string): { ok: true } | ErrorResult {
    const room = this.rooms.get(code)
    if (!room) return { error: 'room not found' }
    if (room.seats[0].connId !== byConnId) return { error: 'only the host can start the room' }
    if (room.started) return { error: 'room already started' }

    const seatConfigs: SeatConfig[] = room.seats.map((s) => ({
      kind: s.kind,
      name: s.name,
      difficulty: s.kind === 'ai' ? room.difficulty : undefined,
    }))
    room.session = new GameSession(seatConfigs)
    room.started = true
    return { ok: true }
  }
}
