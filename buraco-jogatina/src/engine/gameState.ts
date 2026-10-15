import { Player } from './player'
import { Card } from './card'
import { Canasta } from './canasta'

export type GameStatus = 'setup' | 'playing' | 'finished'

export type TeamId = 'A' | 'B'

export interface Team {
  id: TeamId
  seats: number[]
  melds: Canasta[]
  score: number
  hasTakenMorto: boolean
  mortoTakenBySeat?: number
  mortoUsed?: boolean
  openingMinimum: number
}

export interface SeatHandPoints {
  seat: number
  playerName: string
  points: number
  counted: boolean
}

export interface TeamScoreBreakdown {
  teamId: TeamId
  meldPoints: number
  batidaBonus: number
  mortoPenalty: number
  handPenalty: number
  handBySeat: SeatHandPoints[]
  total: number
}

export function teamIdOfSeat(seat: number): TeamId {
  return seat % 2 === 0 ? 'A' : 'B'
}

export function teamOfSeat(state: GameState, seat: number): Team {
  const id = teamIdOfSeat(seat)
  const team = state.teams.find(t => t.id === id)
  if (!team) throw new Error(`Team ${id} not found in state`)
  return team
}

export interface GameState {
  players: Player[]
  teams: Team[]
  currentPlayerIndex: number
  deck: Card[]
  discardPile: Card[]
  mortos: Card[][]
  round: number
  status: GameStatus
  winnerTeam?: TeamId
  scoreBreakdowns?: TeamScoreBreakdown[]
  closerSeat?: number
  discardRecycles: number
  blockedDiscardCard?: Card | null
}

export function createGameState(players: Player[]): GameState {
  if (players.length !== 4) {
    throw new Error('createGameState requires exactly 4 players')
  }
  return {
    players,
    teams: [
      { id: 'A', seats: [0, 2], melds: [], score: 0, hasTakenMorto: false, openingMinimum: 0 },
      { id: 'B', seats: [1, 3], melds: [], score: 0, hasTakenMorto: false, openingMinimum: 0 },
    ],
    currentPlayerIndex: 0,
    deck: [],
    discardPile: [],
    mortos: [],
    round: 1,
    status: 'setup',
    discardRecycles: 0,
  }
}
