import type { AIDifficulty } from '../engine/ai'
import type { TeamId, TeamScoreBreakdown } from '../engine/gameState'

export type SeatKind = 'human' | 'ai'

/** Config for one of the 4 seats (index 0..3) a GameSession is built with. */
export interface SeatConfig {
  kind: SeatKind
  name: string
  /** Only meaningful when kind === 'ai'; defaults to 'medium' when omitted. */
  difficulty?: AIDifficulty
}

/** Server-authoritative phase within a seat's turn: `draw` (must draw or
 * take the discard pile before anything else) then `play` (may meld any
 * number of times, must eventually discard to end the turn). */
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

/** JSON-serializable stand-in for a Card (an engine `Card` instance carries
 * methods, so views hand back plain objects instead of raw class instances). */
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
}

export interface SeatTeamView {
  id: TeamId
  score: number
  hasTakenMorto: boolean
  melds: MeldView[]
}

/** Redacted view of the table for a single seat: everything except other
 * seats' hands (only counts). `getPublicView()` produces the same shape with
 * `yourHand` empty and `seat` set to -1 (no seat is being addressed). */
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
  log: string[]
}
