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

export const MAX_NAME_LENGTH = 24

export function cleanName(name: unknown): string {
  return typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LENGTH) : ''
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
        seats.push({ index: 0, kind: 'human', name: cleanName(hostName), connId: hostConnId })
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

    const reconnectSeat = room.seats.find(
      (s) => s.kind === 'human' && s.name === cleanName(name) && s.connId === undefined
    )
    if (reconnectSeat) {
      reconnectSeat.connId = connId
      if (reconnectSeat.index === 0) room.hostId = connId
      return { seat: reconnectSeat.index }
    }

    if (room.started) return { error: 'room already started' }

    const freeSeat = room.seats.find((s) => s.kind === 'ai')
    if (!freeSeat) return { error: 'room is full' }

    freeSeat.kind = 'human'
    freeSeat.name = cleanName(name)
    freeSeat.connId = connId
    return { seat: freeSeat.index }
  }

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
    if (target.index === 0) return { error: 'nao e possivel trocar de lugar com o anfitriao' }

    if (target.kind === 'ai') {
      const myName = mySeat.name
      mySeat.kind = 'ai'
      mySeat.name = defaultAiName(mySeat.index)
      mySeat.connId = undefined
      target.kind = 'human'
      target.name = myName
      target.connId = connId
      return { seat: target.index }
    }

    const myName = mySeat.name
    const myConnId = mySeat.connId
    mySeat.name = target.name
    mySeat.connId = target.connId
    target.name = myName
    target.connId = myConnId
    return { seat: target.index }
  }

  rename(code: string, connId: string, name: string): JoinOk | ErrorResult {
    const room = this.rooms.get(code)
    if (!room) return { error: 'room not found' }
    if (room.started) return { error: 'room already started' }

    const mySeat = room.seats.find((s) => s.connId === connId)
    if (!mySeat) return { error: 'voce nao esta em nenhuma sala' }

    const trimmed = cleanName(name)
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
    if (!room.started && seat.index !== 0) {
      seat.kind = 'ai'
      seat.name = defaultAiName(seat.index)
    }
  }

  closeRoom(code: string): string[] {
    const room = this.rooms.get(code)
    if (!room) return []
    const connIds = room.seats
      .filter((s): s is RoomSeat & { connId: string } => s.kind === 'human' && s.connId !== undefined)
      .map((s) => s.connId)
    this.rooms.delete(code)
    return connIds
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
