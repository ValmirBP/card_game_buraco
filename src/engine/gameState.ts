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
 * Per-team score breakdown produced by Game.finish(), so the result screen
 * can show exactly where a team's final score came from instead of just the
 * total. `total` always equals `team.score` after finish() runs.
 */
export interface TeamScoreBreakdown {
  teamId: TeamId
  meldPoints: number // sum of canasta.getScore() across the team's melds on the table
  batidaBonus: number // +100 if this team closed the round (bateu), else 0
  mortoPenalty: number // -100 if penalized per the morto rule (see Game.finish), else 0
  handPenalty: number // negative: -(sum of scoreCardValue across both partners' remaining hand cards)
  total: number // meldPoints + batidaBonus + mortoPenalty + handPenalty
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
  scoreBreakdowns?: TeamScoreBreakdown[]
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
