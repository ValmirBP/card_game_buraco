import { create } from 'zustand'
import { Game } from '../engine/game'
import { HumanPlayer, Player } from '../engine/player'
import { AIPlayer, AIDifficulty, GameStateForAI } from '../engine/ai'
import { Card } from '../engine/card'
import { scoreCardValue } from '../engine/utils'
import type { Team, TeamId } from '../engine/gameState'

/** Max meld actions (play_canasta/extend_meld) the AI is allowed to make in a
 * single turn before we force it to discard. Guards against an infinite loop
 * if playTurn() ever kept returning meld moves (e.g. a buggy/adversarial
 * strategy). */
const MAX_AI_MELD_ACTIONS_PER_TURN = 12

/** A "partida" (match) is won by the first team to reach this many
 * accumulated points across however many rounds (`Game` instances) it takes.
 * A single `Game` only ever models one round; the match layer lives entirely
 * in this store. */
export const MATCH_TARGET = 3000

export type CanastraCount = { clean: number; dirty: number }

/** Config remembered across rounds so `startNextRound()` can rebuild a fresh
 * `Game` with the same 4 players (same names/difficulty) that `initGame()`
 * was called with. */
export interface MatchConfig {
  playerName: string
  aiDifficulty: AIDifficulty
  names?: { partner?: string; opponent1?: string; opponent2?: string }
}

/** Counts this round's 7+ canastras per team, split by clean/dirty. */
function countRoundCanastras(team: Team): CanastraCount {
  let clean = 0
  let dirty = 0
  for (const meld of team.melds) {
    if (!meld.isCanastra) continue
    if (meld.isClean) clean++
    else dirty++
  }
  return { clean, dirty }
}

/** Pure accumulation step for the match layer: folds one finished round's
 * per-team scores/canastras into the running match totals, and decides
 * whether the match itself just ended (a team reached MATCH_TARGET; ties at
 * or above the target go to team A). Exported for direct unit testing since
 * `team.score` gets recomputed by the engine's `Game.finish()` from the
 * actual hand/melds and can't easily be forced to an arbitrary value in an
 * integration test. */
export function accumulateMatchRound(
  matchScores: Record<TeamId, number>,
  matchCanastras: Record<TeamId, CanastraCount>,
  teams: Team[]
): {
  matchScores: Record<TeamId, number>
  matchCanastras: Record<TeamId, CanastraCount>
  matchWinner?: TeamId
} {
  const newScores = { ...matchScores }
  const newCanastras: Record<TeamId, CanastraCount> = {
    A: { ...matchCanastras.A },
    B: { ...matchCanastras.B },
  }

  for (const team of teams) {
    newScores[team.id] += team.score
    const { clean, dirty } = countRoundCanastras(team)
    newCanastras[team.id].clean += clean
    newCanastras[team.id].dirty += dirty
  }

  let matchWinner: TeamId | undefined
  if (newScores.A >= MATCH_TARGET || newScores.B >= MATCH_TARGET) {
    matchWinner = newScores.B > newScores.A ? 'B' : 'A'
  }

  return { matchScores: newScores, matchCanastras: newCanastras, matchWinner }
}

export interface GameStore {
  /**
   * The mutable engine instance. `Game` is a plain class that this store
   * mutates in place (calling `game.discard(...)`, `game.endTurn()`, etc.
   * directly) rather than replacing with a new object on every action.
   *
   * REACTIVITY CONTRACT: because `game` keeps the SAME object reference
   * across actions, any component that subscribes only to `s.game` will
   * never re-render when the game state changes (Zustand/React bail out on
   * reference-equal values). Every action below that mutates the game also
   * increments `version`. UI components MUST subscribe to `version`
   * alongside `game` (e.g. `useGameStore(s => s.version)` next to
   * `useGameStore(s => s.game)`, or select both together) so the changed
   * primitive forces a re-render even though `game` itself is the same
   * reference.
   */
  game: Game | null
  version: number
  /** Multi-select for building a canasta (or an extend_meld) from the hand
   * (indices into the current player's hand array). */
  selectedCardIndices: number[]
  gameLog: string[]

  /** Accumulated points across every round of the current match (persists
   * across `startNextRound()`, reset by `initGame()`). */
  matchScores: Record<TeamId, number>
  /** Accumulated count of 7+ canastras per team across the match, split by
   * clean/dirty. */
  matchCanastras: Record<TeamId, CanastraCount>
  /** 1-based current round number within the match. */
  round: number
  /** Set once a team's `matchScores` reaches MATCH_TARGET; undefined while
   * the match is still in progress. */
  matchWinner?: TeamId
  /** Final `matchScores` of the PREVIOUS match (before the current one was
   * started via `initGame`). Undefined on the very first match. Shown next to
   * the current totals as "atual / partida anterior". */
  previousMatchScores?: Record<TeamId, number>
  /** Remembers the settings `initGame()` was last called with, so
   * `startNextRound()` can rebuild a fresh `Game` with the same 4 players. */
  matchConfig?: MatchConfig
  /** Guards against double-accumulating the same finished round into
   * matchScores/matchCanastras (e.g. if a UI action fires again after the
   * round already ended). Reset to false by `startNextRound()`. */
  roundFinalized: boolean

  /** Seat 0 = human (`playerName`); seat 2 = human's AI partner (`names.partner`);
   * seat 1 = `names.opponent1`; seat 3 = `names.opponent2`. All three AIs play
   * at `aiDifficulty`. `names` is optional and defaults to "Bruno" (partner) /
   * "Ana" (opponent1) / "Carlos" (opponent2) when omitted or blank. */
  initGame: (
    playerName: string,
    aiDifficulty: AIDifficulty,
    names?: { partner?: string; opponent1?: string; opponent2?: string }
  ) => void
  /** Draw one card from the deck (baço) into the current player's hand. */
  drawFromDeck: () => void
  /** Take the entire discard pile into the current player's hand. */
  takeDiscardPile: () => void
  discard: (cardIndex: number) => void
  playCanasta: (cardIndices: number[]) => void
  /** Extends an existing meld belonging to the current player's team with
   * cards from the current player's hand. */
  extendMeld: (meldIndex: number, cardIndices: number[]) => void
  /** Runs one full AI turn for whichever seat is currently up, PROVIDED that
   * seat is an AI (no-ops for the human seat). One call = one seat's turn
   * (draw/take-discard -> meld while the AI keeps proposing melds -> discard
   * -> end turn). The UI calls this repeatedly while
   * `currentPlayerIndex !== 0`, i.e. once per AI seat (1, 2, 3). This store
   * never schedules this itself (no setTimeout) — the calling UI decides
   * when/whether to delay it. */
  aiTurn: () => void
  toggleCardSelection: (index: number) => void
  clearSelection: () => void
  resetGame: () => void
  /** Starts the next round of the current match: builds a fresh `Game` with
   * the same 4 players (from `matchConfig`), deals new hands, increments
   * `round`, and resets per-round selection/finalization state while
   * keeping `matchScores`/`matchCanastras`. No-op once `matchWinner` is
   * set (the match already ended). */
  startNextRound: () => void
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'fácil',
  medium: 'médio',
  hard: 'difícil',
}

/** Um curinga: joker (isWild) ou qualquer 2 (todo 2 pode ser curinga). */
function isWildCard(card: Card): boolean {
  return card.isWild || card.rank === '2'
}

/** Fallback discard used whenever the AI's move can't be honored as-is (or it
 * didn't propose a discard at all): discards the lowest scoreCardValue()-value
 * card in hand, but NEVER a curinga while a non-wild card is available (wilds
 * are the most valuable cards to hold). Returns true if a card was discarded. */
function discardLowestValueCard(game: Game, player: Player): boolean {
  const cards = player.hand.getCards()
  if (cards.length === 0) return false

  const hasNonWild = cards.some(c => !isWildCard(c))
  let lowestIndex = -1
  let lowestValue = Infinity
  for (let i = 0; i < cards.length; i++) {
    if (hasNonWild && isWildCard(cards[i])) continue
    const value = scoreCardValue(cards[i])
    if (value < lowestValue) {
      lowestValue = value
      lowestIndex = i
    }
  }
  return game.discard(lowestIndex)
}

/** Logs "X pegou o morto!" the moment the current player's team transitions
 * from not-having to having taken the morto (the engine's discard/
 * playCanasta/extendMeld auto-pick up the morto internally the instant the
 * current player's hand empties, so this only needs to detect the flip and
 * report it). Returns the up-to-date hasTakenMorto flag so callers can track
 * it across a sequence of actions within the same turn. */
function checkMortoTransition(game: Game, player: Player, log: string[], hadMortoBefore: boolean): boolean {
  const hasMortoNow = game.getTeamOfCurrentPlayer().hasTakenMorto
  if (!hadMortoBefore && hasMortoNow) {
    log.push(`${player.name} pegou o morto!`)
  }
  return hasMortoNow
}

/** If the round just ended (a team batendo with morto already taken, or the
 * baço ran out), finalizes it via game.finish() and logs the winning team.
 * Returns true if the round ended. */
function checkGameOver(game: Game, log: string[]): boolean {
  if (!game.isGameOver()) return false
  game.finish()
  log.push(`Fim de jogo — Time ${game.state.winnerTeam} venceu!`)
  return true
}

function buildAIState(game: Game): GameStateForAI {
  return {
    currentPlayerIndex: game.state.currentPlayerIndex,
    players: game.state.players,
    deck: game.state.deck,
    discardPile: game.state.discardPile,
    teams: game.state.teams,
  }
}

export const useGameStore = create<GameStore>((set, get) => {
  /** Called immediately after `checkGameOver()` reports the round just
   * ended. Folds this round's per-team scores/canastras into the match
   * totals (accumulateMatchRound), guarded by `roundFinalized` so it can
   * never double-count the same finished round, and logs either "Fim da
   * partida" (if a team just reached MATCH_TARGET, setting `matchWinner`)
   * or "Fim da rodada N". Issues its own `set()` call, separate from
   * whatever gameLog/version patch the caller applies afterwards. */
  function finalizeRoundIfNeeded(game: Game, log: string[]): void {
    const { roundFinalized, matchScores, matchCanastras, round } = get()
    if (roundFinalized) return

    const result = accumulateMatchRound(matchScores, matchCanastras, game.state.teams)
    if (result.matchWinner) {
      log.push(`Fim da partida — Time ${result.matchWinner} venceu!`)
    } else {
      log.push(`Fim da rodada ${round}.`)
    }

    set({
      matchScores: result.matchScores,
      matchCanastras: result.matchCanastras,
      matchWinner: result.matchWinner,
      roundFinalized: true,
    })
  }

  return {
  game: null,
  version: 0,
  selectedCardIndices: [],
  gameLog: [],
  matchScores: { A: 0, B: 0 },
  matchCanastras: { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } },
  round: 1,
  matchWinner: undefined,
  matchConfig: undefined,
  previousMatchScores: undefined,
  roundFinalized: false,

  initGame: (playerName, aiDifficulty, names) => {
    const partnerName = names?.partner?.trim() || 'Bruno'
    const opponent1Name = names?.opponent1?.trim() || 'Ana'
    const opponent2Name = names?.opponent2?.trim() || 'Carlos'

    // Guarda a pontuação final da partida que está terminando (se houver uma
    // em andamento com pontos) para exibir como "partida anterior".
    const prev = get().matchScores
    const previousMatchScores =
      prev.A !== 0 || prev.B !== 0 ? { A: prev.A, B: prev.B } : get().previousMatchScores

    const human = new HumanPlayer(playerName)
    const opponent1 = new AIPlayer(opponent1Name, aiDifficulty)
    const partner = new AIPlayer(partnerName, aiDifficulty)
    const opponent2 = new AIPlayer(opponent2Name, aiDifficulty)
    const game = new Game([human, opponent1, partner, opponent2])
    game.setup()

    const label = DIFFICULTY_LABEL[aiDifficulty] ?? aiDifficulty
    set({
      game,
      version: get().version + 1,
      selectedCardIndices: [],
      gameLog: [
        `Partida iniciada: ${playerName} e ${partnerName} (Time A) vs ${opponent1Name} e ${opponent2Name} (Time B), dificuldade ${label}.`,
      ],
      matchScores: { A: 0, B: 0 },
      matchCanastras: { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } },
      round: 1,
      matchWinner: undefined,
      matchConfig: { playerName, aiDifficulty, names },
      previousMatchScores,
      roundFinalized: false,
    })
  },

  drawFromDeck: () => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    const mortosBefore = game.state.mortos.length
    const card = game.drawFromDeck()
    const log = [...gameLog]
    // Nas compras, mortos só diminuem quando um morto é promovido a monte.
    if (game.state.mortos.length < mortosBefore) {
      log.push('O monte acabou — o morto virou o novo monte!')
    }
    if (!card) {
      set({
        gameLog: [...log, 'O monte acabou.'],
        version: get().version + 1,
      })
      return
    }

    player.hand.addCard(card)
    set({
      gameLog: [...log, `${player.name} comprou uma carta.`],
      version: get().version + 1,
    })
  },

  takeDiscardPile: () => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    const cards = game.takeDiscardPile()
    if (!cards || cards.length === 0) {
      set({
        gameLog: [...gameLog, 'A pilha de descarte está vazia.'],
        version: get().version + 1,
      })
      return
    }

    for (const card of cards) {
      player.hand.addCard(card)
    }
    set({
      gameLog: [...gameLog, `${player.name} pegou a pilha de descarte (${cards.length} cartas).`],
      version: get().version + 1,
    })
  },

  discard: (cardIndex) => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    const hadMorto = game.getTeamOfCurrentPlayer().hasTakenMorto

    const success = game.discard(cardIndex)
    if (!success) return

    const log = [...gameLog, `${player.name} descartou uma carta.`]
    checkMortoTransition(game, player, log, hadMorto)

    if (checkGameOver(game, log)) {
      finalizeRoundIfNeeded(game, log)
    } else {
      game.endTurn()
    }

    set({
      gameLog: log,
      selectedCardIndices: [],
      version: get().version + 1,
    })
  },

  playCanasta: (cardIndices) => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    const handCards = player.hand.getCards()
    const cards = cardIndices.map(i => handCards[i]).filter((c): c is Card => Boolean(c))
    if (cards.length !== cardIndices.length) return

    const hadMorto = game.getTeamOfCurrentPlayer().hasTakenMorto

    // Game.playCanasta validates, removes the exact cards from the hand, and
    // credits the score to the current player's team — this store does NOT
    // remove cards or touch team.score itself.
    const success = game.playCanasta(cards)
    if (!success) return

    const log = [...gameLog, `${player.name} baixou uma canastra!`]
    checkMortoTransition(game, player, log, hadMorto)
    if (checkGameOver(game, log)) {
      finalizeRoundIfNeeded(game, log)
    }

    set({
      gameLog: log,
      selectedCardIndices: [],
      version: get().version + 1,
    })
  },

  extendMeld: (meldIndex, cardIndices) => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    const handCards = player.hand.getCards()
    const cards = cardIndices.map(i => handCards[i]).filter((c): c is Card => Boolean(c))
    if (cards.length !== cardIndices.length) return

    const hadMorto = game.getTeamOfCurrentPlayer().hasTakenMorto

    const success = game.extendMeld(meldIndex, cards)
    if (!success) return

    const log = [...gameLog, `${player.name} estendeu um jogo do time!`]
    checkMortoTransition(game, player, log, hadMorto)
    if (checkGameOver(game, log)) {
      finalizeRoundIfNeeded(game, log)
    }

    set({
      gameLog: log,
      selectedCardIndices: [],
      version: get().version + 1,
    })
  },

  aiTurn: () => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    if (!(player instanceof AIPlayer)) return

    const log = [...gameLog]
    let hadMorto = game.getTeamOfCurrentPlayer().hasTakenMorto
    let gameEnded = false
    const mortosBeforeDraw = game.state.mortos.length

    // Draw phase: normally draws from the deck, but honors a take_discard
    // proposal from the AI's strategy if one comes back (the current
    // AIPlayer strategies never actually propose take_discard since
    // getValidMoves() doesn't offer it, but we handle it defensively per the
    // documented contract).
    const firstMove = player.playTurn(buildAIState(game))
    if (firstMove && firstMove.type === 'take_discard') {
      const pileCards = game.takeDiscardPile()
      if (pileCards && pileCards.length > 0) {
        for (const card of pileCards) player.hand.addCard(card)
        log.push(`${player.name} pegou a pilha de descarte.`)
      } else {
        const card = game.drawFromDeck()
        if (card) {
          player.hand.addCard(card)
          log.push(`${player.name} comprou uma carta.`)
        } else {
          log.push('O monte acabou.')
        }
      }
    } else {
      const card = game.drawFromDeck()
      if (card) {
        player.hand.addCard(card)
        log.push(`${player.name} comprou uma carta.`)
      } else {
        log.push('O monte acabou.')
      }
    }

    // Nas compras, mortos só diminuem quando um morto é promovido a monte.
    if (game.state.mortos.length < mortosBeforeDraw) {
      log.push('O monte acabou — o morto virou o novo monte!')
    }

    let discarded = false
    for (let iteration = 0; iteration < MAX_AI_MELD_ACTIONS_PER_TURN; iteration++) {
      const move = player.playTurn(buildAIState(game))

      if (move && move.type === 'play_canasta' && move.cards) {
        const played = game.playCanasta(move.cards)
        if (!played) break // avoid an infinite loop on a move the engine rejects
        log.push(`${player.name} baixou uma canastra!`)
        hadMorto = checkMortoTransition(game, player, log, hadMorto)
        if (checkGameOver(game, log)) {
          gameEnded = true
          break
        }
        continue
      }

      if (move && move.type === 'extend_meld' && move.meldIndex !== undefined && move.cards) {
        const extended = game.extendMeld(move.meldIndex, move.cards)
        if (!extended) break
        log.push(`${player.name} estendeu um jogo do time!`)
        hadMorto = checkMortoTransition(game, player, log, hadMorto)
        if (checkGameOver(game, log)) {
          gameEnded = true
          break
        }
        continue
      }

      if (move && move.type === 'discard' && move.cardIndex !== undefined) {
        discarded = game.discard(move.cardIndex)
        if (discarded) {
          log.push(`${player.name} descartou uma carta.`)
          hadMorto = checkMortoTransition(game, player, log, hadMorto)
          if (checkGameOver(game, log)) {
            gameEnded = true
          }
        }
      }
      break
    }

    if (!gameEnded && !discarded) {
      discarded = discardLowestValueCard(game, player)
      if (discarded) {
        log.push(`${player.name} descartou uma carta.`)
        hadMorto = checkMortoTransition(game, player, log, hadMorto)
        if (checkGameOver(game, log)) {
          gameEnded = true
        }
      }
    }

    if (gameEnded) {
      finalizeRoundIfNeeded(game, log)
    } else {
      game.endTurn()
    }

    set({
      gameLog: log,
      version: get().version + 1,
    })
  },

  toggleCardSelection: (index) => {
    const { selectedCardIndices } = get()
    set({
      selectedCardIndices: selectedCardIndices.includes(index)
        ? selectedCardIndices.filter(i => i !== index)
        : [...selectedCardIndices, index],
    })
  },

  clearSelection: () => set({ selectedCardIndices: [] }),

  resetGame: () => {
    // Mesma guarda de initGame: guarda a pontuação da partida que está sendo
    // abandonada (se houver pontos) como "partida anterior" - sem isso,
    // "Voltar ao Menu" -> "Jogar vs IA" mostrava o placar de DUAS partidas
    // atrás (o de initGame nunca rodava de novo pra atualizar), e uma
    // partida abandonada no meio nunca virava "anterior".
    const prev = get().matchScores
    const previousMatchScores =
      prev.A !== 0 || prev.B !== 0 ? { A: prev.A, B: prev.B } : get().previousMatchScores

    set({
      game: null,
      version: 0,
      selectedCardIndices: [],
      gameLog: [],
      matchScores: { A: 0, B: 0 },
      matchCanastras: { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } },
      round: 1,
      matchWinner: undefined,
      matchConfig: undefined,
      previousMatchScores,
      roundFinalized: false,
    })
  },

  startNextRound: () => {
    const { matchWinner, matchConfig, gameLog, round } = get()
    if (matchWinner) return // match already over — nothing to do.
    if (!matchConfig) return // no round to rebuild from (shouldn't happen once a match is running).

    const partnerName = matchConfig.names?.partner?.trim() || 'Bruno'
    const opponent1Name = matchConfig.names?.opponent1?.trim() || 'Ana'
    const opponent2Name = matchConfig.names?.opponent2?.trim() || 'Carlos'

    const human = new HumanPlayer(matchConfig.playerName)
    const opponent1 = new AIPlayer(opponent1Name, matchConfig.aiDifficulty)
    const partner = new AIPlayer(partnerName, matchConfig.aiDifficulty)
    const opponent2 = new AIPlayer(opponent2Name, matchConfig.aiDifficulty)
    const game = new Game([human, opponent1, partner, opponent2])
    game.setup()

    const nextRound = round + 1
    set({
      game,
      version: get().version + 1,
      selectedCardIndices: [],
      gameLog: [...gameLog, `Rodada ${nextRound} iniciada.`],
      round: nextRound,
      roundFinalized: false,
    })
  },
  }
})
