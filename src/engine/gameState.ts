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
}

/**
 * Seat -> team mapping: seats 0 and 2 are Team A (partners across the
 * table), seats 1 and 3 are Team B.
 */
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
  players: Player[] // exactly 4, index === seat
  teams: Team[] // exactly 2: 'A' and 'B'
  currentPlayerIndex: number // 0..3
  deck: Card[] // baço
  discardPile: Card[]
  mortos: Card[][] // 2 mortos of 11 cards each; removed once taken via
  // pickUpMorto, or once consumed as the new baço when the deck runs dry
  // (see Game.drawFromDeck)
  round: number
  status: GameStatus
  winnerTeam?: TeamId
}

export function createGameState(players: Player[]): GameState {
  if (players.length !== 4) {
    throw new Error('createGameState requires exactly 4 players')
  }
  return {
    players,
    teams: [
      { id: 'A', seats: [0, 2], melds: [], score: 0, hasTakenMorto: false },
      { id: 'B', seats: [1, 3], melds: [], score: 0, hasTakenMorto: false },
    ],
    currentPlayerIndex: 0,
    deck: [],
    discardPile: [],
    mortos: [],
    round: 1,
    status: 'setup',
  }
}
