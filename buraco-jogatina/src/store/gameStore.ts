import { create } from 'zustand'
import { Game } from '../engine/game'
import { HumanPlayer, Player } from '../engine/player'
import { AIPlayer, AIDifficulty, GameStateForAI } from '../engine/ai'
import { Card } from '../engine/card'
import { scoreCardValue } from '../engine/utils'
import type { Team, TeamId } from '../engine/gameState'
import { saveGame, loadSavedGame, clearSavedGame } from './gamePersistence'

const MAX_AI_MELD_ACTIONS_PER_TURN = 12

export const MATCH_TARGET = 3000

export type CanastraCount = { clean: number; dirty: number }

export interface MatchConfig {
  playerName: string
  aiDifficulty: AIDifficulty
  names?: { partner?: string; opponent1?: string; opponent2?: string }
}

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
  game: Game | null
  version: number
  selectedCardIndices: number[]
  gameLog: string[]

  matchScores: Record<TeamId, number>
  matchCanastras: Record<TeamId, CanastraCount>
  round: number
  matchWinner?: TeamId
  previousMatchScores?: Record<TeamId, number>
  matchConfig?: MatchConfig
  roundFinalized: boolean

  initGame: (
    playerName: string,
    aiDifficulty: AIDifficulty,
    names?: { partner?: string; opponent1?: string; opponent2?: string }
  ) => void
  drawFromDeck: () => void
  takeDiscardPile: () => void
  discard: (cardIndex: number) => void
  playCanasta: (cardIndices: number[]) => void
  extendMeld: (meldIndex: number, cardIndices: number[]) => void
  aiTurn: () => void
  toggleCardSelection: (index: number) => void
  clearSelection: () => void
  resetGame: () => void
  startNextRound: () => void
  resumeSavedGame: () => boolean
}

const DIFFICULTY_LABEL: Record<string, string> = {
  easy: 'fácil',
  medium: 'médio',
  hard: 'difícil',
}

function isWildCard(card: Card): boolean {
  return card.isWild || card.rank === '2'
}

function discardLowestValueCard(game: Game, player: Player): boolean {
  const cards = player.hand.getCards()
  if (cards.length === 0) return false

  const hasNonWild = cards.some(c => !isWildCard(c))
  let lowestIndex = -1
  let lowestValue = Infinity
  for (let i = 0; i < cards.length; i++) {
    if (hasNonWild && isWildCard(cards[i])) continue
    if (game.isDiscardBlockedCard(i)) continue
    const value = scoreCardValue(cards[i])
    if (value < lowestValue) {
      lowestValue = value
      lowestIndex = i
    }
  }
  if (lowestIndex === -1) return false
  return game.discard(lowestIndex)
}

function checkMortoTransition(game: Game, player: Player, log: string[], hadMortoBefore: boolean): boolean {
  const hasMortoNow = game.getTeamOfCurrentPlayer().hasTakenMorto
  if (!hadMortoBefore && hasMortoNow) {
    log.push(`${player.name} pegou o morto!`)
  }
  return hasMortoNow
}

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
    const recyclesBefore = game.state.discardRecycles
    const card = game.drawFromDeck()
    const log = [...gameLog]
    if (game.state.mortos.length < mortosBefore) {
      log.push('O monte acabou — o morto virou o novo monte!')
    }
    if (game.state.discardRecycles > recyclesBefore) {
      log.push('🔀 O lixo foi embaralhado e virou o novo monte!')
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
    const recyclesBeforeDraw = game.state.discardRecycles

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

    if (game.state.mortos.length < mortosBeforeDraw) {
      log.push('O monte acabou — o morto virou o novo monte!')
    }
    if (game.state.discardRecycles > recyclesBeforeDraw) {
      log.push('🔀 O lixo foi embaralhado e virou o novo monte!')
    }

    let discarded = false
    for (let iteration = 0; iteration < MAX_AI_MELD_ACTIONS_PER_TURN; iteration++) {
      const move = player.playTurn(buildAIState(game))

      if (move && move.type === 'play_canasta' && move.cards) {
        const played = game.playCanasta(move.cards)
        if (!played) break
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
    if (matchWinner) return
    if (!matchConfig) return

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

  resumeSavedGame: () => {
    const loaded = loadSavedGame()
    if (!loaded) return false

    set({
      game: loaded.game,
      version: get().version + 1,
      selectedCardIndices: [],
      matchScores: loaded.store.matchScores,
      matchCanastras: loaded.store.matchCanastras,
      round: loaded.store.round,
      matchWinner: loaded.store.matchWinner,
      previousMatchScores: loaded.store.previousMatchScores,
      matchConfig: loaded.store.matchConfig,
      gameLog: loaded.store.gameLog,
      roundFinalized: loaded.store.roundFinalized,
    })
    return true
  },
  }
})

useGameStore.subscribe((state, prevState) => {
  if (state.game === prevState.game && state.version === prevState.version) return
  if (!state.game) {
    clearSavedGame()
    return
  }
  saveGame(state.game, {
    matchScores: state.matchScores,
    matchCanastras: state.matchCanastras,
    round: state.round,
    matchWinner: state.matchWinner,
    previousMatchScores: state.previousMatchScores,
    matchConfig: state.matchConfig,
    gameLog: state.gameLog,
    roundFinalized: state.roundFinalized,
  })
})
