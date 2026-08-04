import { Player } from './player'
import { Card } from './card'
import { Canasta } from './canasta'

export type GameStatus = 'setup' | 'playing' | 'finished'

export interface GameState {
  players: Player[]
  currentPlayerIndex: number
  deck: Card[]
  discardPile: Card[]
  melds: Map<string, Canasta[]> // playerName -> canastas
  round: number
  status: GameStatus
  winner?: Player
}

export function createGameState(players: Player[]): GameState {
  return {
    players,
    currentPlayerIndex: 0,
    deck: [],
    discardPile: [],
    melds: new Map(players.map(p => [p.name, []])),
    round: 1,
    status: 'setup',
  }
}
