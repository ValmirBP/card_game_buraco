import { Card, Suit, Rank } from '../engine/card'
import { Canasta } from '../engine/canasta'
import { Game } from '../engine/game'
import { GameState, GameStatus, Team, TeamId, TeamScoreBreakdown } from '../engine/gameState'
import { HumanPlayer, Player } from '../engine/player'
import { AIPlayer, AIDifficulty } from '../engine/ai'
import type { CanastraCount, MatchConfig } from './gameStore'

const STORAGE_KEY = 'buraco-jogatina:saved-game'
const SCHEMA_VERSION = 1

interface CardJSON {
  suit: Suit
  rank: Rank
  isWild: boolean
}

interface PlayerJSON {
  kind: 'human' | 'ai'
  name: string
  hand: CardJSON[]
  difficulty?: AIDifficulty
}

interface TeamJSON {
  id: TeamId
  seats: number[]
  melds: CardJSON[][]
  score: number
  hasTakenMorto: boolean
  mortoTakenBySeat?: number
  mortoUsed?: boolean
}

interface GameStateJSON {
  players: PlayerJSON[]
  teams: TeamJSON[]
  currentPlayerIndex: number
  deck: CardJSON[]
  discardPile: CardJSON[]
  mortos: CardJSON[][]
  round: number
  status: GameStatus
  winnerTeam?: TeamId
  scoreBreakdowns?: TeamScoreBreakdown[]
  closerSeat?: number
  discardRecycles: number
  /** Índice, na mão do jogador da vez, da carta bloqueada do lixo unitário
   * (ver GameState.blockedDiscardCard) - salvo por ÍNDICE, não por valor,
   * porque o bloqueio é comparado por REFERÊNCIA ao objeto Card exato. Ao
   * restaurar, reaponta pro objeto reconstruído naquele mesmo índice, senão
   * o bloqueio (ou sua ausência) se perderia silenciosamente. null quando
   * não há carta bloqueada. */
  blockedDiscardCardHandIndex: number | null
}

/** Estado completo salvo em localStorage para "retomar partida": o `Game`
 * (engine) inteiro mais os campos do gameStore que vivem por cima dele
 * (placar da partida, config pra reconstruir os 4 jogadores em
 * startNextRound, log). `selectedCardIndices` fica de fora de propósito -
 * é seleção efêmera de UI, sempre volta vazia (mesmo comportamento de
 * resetGame/startNextRound). */
export interface SavedGame {
  schemaVersion: number
  gameState: GameStateJSON
  store: {
    matchScores: Record<TeamId, number>
    matchCanastras: Record<TeamId, CanastraCount>
    round: number
    matchWinner?: TeamId
    previousMatchScores?: Record<TeamId, number>
    matchConfig?: MatchConfig
    gameLog: string[]
    roundFinalized: boolean
  }
}

function cardToJSON(card: Card): CardJSON {
  return { suit: card.suit, rank: card.rank, isWild: card.isWild }
}

function cardFromJSON(json: CardJSON): Card {
  return new Card(json.suit, json.rank, json.isWild)
}

function meldToJSON(meld: Canasta): CardJSON[] {
  return meld.cards.map(cardToJSON)
}

function meldFromJSON(json: CardJSON[]): Canasta {
  return new Canasta(json.map(cardFromJSON))
}

function playerToJSON(player: Player): PlayerJSON {
  const hand = player.hand.getCards().map(cardToJSON)
  if (player instanceof AIPlayer) {
    return { kind: 'ai', name: player.name, hand, difficulty: player.difficulty }
  }
  return { kind: 'human', name: player.name, hand }
}

function playerFromJSON(json: PlayerJSON): Player {
  const cards = json.hand.map(cardFromJSON)
  if (json.kind === 'ai') {
    return new AIPlayer(json.name, json.difficulty ?? 'medium', cards)
  }
  return new HumanPlayer(json.name, cards)
}

function teamToJSON(team: Team): TeamJSON {
  return {
    id: team.id,
    seats: [...team.seats],
    melds: team.melds.map(meldToJSON),
    score: team.score,
    hasTakenMorto: team.hasTakenMorto,
    mortoTakenBySeat: team.mortoTakenBySeat,
    mortoUsed: team.mortoUsed,
  }
}

function teamFromJSON(json: TeamJSON): Team {
  return {
    id: json.id,
    seats: [...json.seats],
    melds: json.melds.map(meldFromJSON),
    score: json.score,
    hasTakenMorto: json.hasTakenMorto,
    mortoTakenBySeat: json.mortoTakenBySeat,
    mortoUsed: json.mortoUsed,
  }
}

/** Serializa a partida (Game + campos do gameStore por cima dela) para um
 * objeto JSON-safe. Retorna null se não há partida em andamento. */
export function serializeGame(game: Game, storeFields: SavedGame['store']): SavedGame {
  const state = game.state
  const currentHand = state.players[state.currentPlayerIndex].hand.getCards()
  const blockedDiscardCardHandIndex = state.blockedDiscardCard
    ? currentHand.findIndex(c => c === state.blockedDiscardCard)
    : -1

  return {
    schemaVersion: SCHEMA_VERSION,
    gameState: {
      players: state.players.map(playerToJSON),
      teams: state.teams.map(teamToJSON),
      currentPlayerIndex: state.currentPlayerIndex,
      deck: state.deck.map(cardToJSON),
      discardPile: state.discardPile.map(cardToJSON),
      mortos: state.mortos.map(m => m.map(cardToJSON)),
      round: state.round,
      status: state.status,
      winnerTeam: state.winnerTeam,
      scoreBreakdowns: state.scoreBreakdowns,
      closerSeat: state.closerSeat,
      discardRecycles: state.discardRecycles,
      blockedDiscardCardHandIndex:
        blockedDiscardCardHandIndex >= 0 ? blockedDiscardCardHandIndex : null,
    },
    store: storeFields,
  }
}

/** Reconstrói um `Game` (e os campos do gameStore) a partir do que
 * `serializeGame` salvou. Lança se `saved` estiver corrompido ou de um
 * schema incompatível - o chamador deve tratar isso como "nada pra
 * retomar" (ver loadSavedGame). */
export function deserializeGame(saved: SavedGame): { game: Game; store: SavedGame['store'] } {
  if (saved.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(`Unsupported saved game schema version: ${saved.schemaVersion}`)
  }
  const g = saved.gameState

  const players = g.players.map(playerFromJSON)
  if (players.length !== 4) {
    throw new Error('Saved game must have exactly 4 players')
  }

  const game = new Game(players)
  const teams = g.teams.map(teamFromJSON)
  const state: GameState = {
    players,
    teams,
    currentPlayerIndex: g.currentPlayerIndex,
    deck: g.deck.map(cardFromJSON),
    discardPile: g.discardPile.map(cardFromJSON),
    mortos: g.mortos.map(m => m.map(cardFromJSON)),
    round: g.round,
    status: g.status,
    winnerTeam: g.winnerTeam,
    scoreBreakdowns: g.scoreBreakdowns,
    closerSeat: g.closerSeat,
    discardRecycles: g.discardRecycles,
    blockedDiscardCard: null,
  }

  if (g.blockedDiscardCardHandIndex !== null) {
    const currentHand = players[g.currentPlayerIndex].hand.getCards()
    state.blockedDiscardCard = currentHand[g.blockedDiscardCardHandIndex] ?? null
  }

  game.state = state
  return { game, store: saved.store }
}

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    // localStorage indisponível (modo privado restrito, etc.) - sem retomar.
    return null
  }
}

/** true se existe uma partida salva (sem precisar desserializá-la) - usado
 * pra decidir se o Menu mostra o botão "Continuar partida" sem custo de
 * reconstruir o Game inteiro. */
export function hasSavedGame(): boolean {
  return readStorage() !== null
}

/** Lê e desserializa a partida salva. Retorna null se não há nenhuma, ou se
 * o que está salvo está corrompido/incompatível - nesse caso também limpa
 * a entrada, pra não tentar de novo com o mesmo dado quebrado. */
export function loadSavedGame(): { game: Game; store: SavedGame['store'] } | null {
  const raw = readStorage()
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as SavedGame
    return deserializeGame(parsed)
  } catch {
    clearSavedGame()
    return null
  }
}

export function saveGame(game: Game, storeFields: SavedGame['store']): void {
  try {
    const saved = serializeGame(game, storeFields)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
  } catch {
    // Storage cheia ou indisponível - retomar partida é um extra, não deixa
    // de funcionar o resto do jogo por isso.
  }
}

export function clearSavedGame(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Idem saveGame - falha silenciosa.
  }
}
