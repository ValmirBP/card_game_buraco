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
  /** Seat (0..3) do jogador que pegou o morto do time - definido por
   * pickUpMorto. Usado junto com mortoUsed pela regra do "morto não usado"
   * (ver Game.finish). */
  mortoTakenBySeat?: number
  /** false do momento em que o time pega o morto até o jogador que o pegou
   * fazer QUALQUER jogada com a mão nova (baixar, estender ou descartar).
   * Se a rodada terminar ainda false, a penalidade é os -100 do morto e as
   * cartas na mão desse jogador NÃO contam como pontos negativos (regra do
   * usuário: "perde os 100 do morto, não os pontos que estão na mão"). */
  mortoUsed?: boolean
}

/**
 * Per-team score breakdown produced by Game.finish(), so the result screen
 * can show exactly where a team's final score came from instead of just the
 * total. `total` always equals `team.score` after finish() runs.
 */
/** Pontos das cartas restantes na mão de UM jogador ao fim da rodada, pro
 * placar mostrar cada mão separadamente. `counted=false` quando essas cartas
 * não entram na conta (regra do morto não usado - ver Game.finish). */
export interface SeatHandPoints {
  seat: number
  playerName: string
  points: number // positivo: soma de scoreCardValue das cartas na mão
  counted: boolean
}

export interface TeamScoreBreakdown {
  teamId: TeamId
  meldPoints: number // sum of canasta.getScore() across the team's melds on the table
  batidaBonus: number // +100 if this team closed the round (bateu), else 0
  mortoPenalty: number // -100 if penalized per the morto rule (see Game.finish), else 0
  handPenalty: number // negative: -(sum of counted hand points across the team's seats)
  handBySeat: SeatHandPoints[] // per-player hand points (both partners, in seat order)
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
  /** Assento (0..3) do jogador que BATEU (esvaziou a mão com direito de
   * bater) — definido por finish(). undefined se a rodada terminou pelo
   * fallback de emergência (nenhuma carta pra comprar em lugar nenhum). A UI
   * usa isso pro banner "Fulano bateu!" antes do placar. */
  closerSeat?: number
  /** Quantas vezes o LIXO foi embaralhado e virou o novo monte (após monte e
   * mortos esgotarem — ver Game.drawFromDeck). As UIs comparam antes/depois
   * de uma compra pra logar o evento. */
  discardRecycles: number
  /** Referência exata (mesmo objeto Card) da carta que NÃO pode ser
   * descartada neste turno: quando o lixo tinha UMA única carta e o jogador
   * a pegou, devolvê-la no mesmo turno seria uma "espiada grátis" - regra
   * apontada pelo usuário. Comparação por referência (não por valor) de
   * propósito: o baralho duplo tem duas cópias idênticas de cada carta, e a
   * cópia-gêmea que já estava na mão continua descartável. Limpo em
   * endTurn. */
  blockedDiscardCard?: Card | null
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
    discardRecycles: 0,
  }
}
