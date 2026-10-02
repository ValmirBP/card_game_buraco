import type { AIDifficulty } from '../engine/ai'
import type { TeamId, TeamScoreBreakdown } from '../engine/gameState'

export type SeatKind = 'human' | 'ai'

export interface SeatConfig {
  kind: SeatKind
  name: string
  difficulty?: AIDifficulty
}

export type TurnPhase = 'draw' | 'play'

export type Intent =
  | { type: 'draw' }
  | { type: 'takeDiscard' }
  | { type: 'discard'; cardIndex: number }
  | { type: 'playCanasta'; cardIndices: number[] }
  | { type: 'extendMeld'; meldIndex: number; cardIndices: number[] }
  | { type: 'nextRound' }

export interface IntentResult {
  ok: boolean
  error?: string
}

export interface PlainCard {
  suit: string
  rank: string
  isWild: boolean
}

export interface MeldLayoutEntryView {
  card: PlainCard
  representsValue?: number
}

export interface MeldView {
  layout: MeldLayoutEntryView[]
  isClean: boolean
  isCanastra: boolean
  kind: string
  points: number
  type: string
}

export interface SeatPlayerView {
  seat: number
  name: string
  kind: SeatKind
  handCount: number
  teamId: TeamId
  connected: boolean
}

export interface SeatTeamView {
  id: TeamId
  score: number
  hasTakenMorto: boolean
  melds: MeldView[]
}

export interface SeatView {
  seat: number
  yourHand: PlainCard[]
  players: SeatPlayerView[]
  teams: SeatTeamView[]
  discardPile: PlainCard[]
  deckCount: number
  mortos: { count: number }[]
  currentSeat: number
  phase: TurnPhase
  status: 'playing' | 'finished'
  round: number
  matchScores: Record<TeamId, number>
  matchCanastras: Record<TeamId, { clean: number; dirty: number }>
  matchWinner?: TeamId
  winnerTeam?: TeamId
  scoreBreakdowns?: TeamScoreBreakdown[]
  closerSeat?: number
  log: string[]
  paused: boolean
}
