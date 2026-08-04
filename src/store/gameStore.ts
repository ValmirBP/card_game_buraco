import { create } from 'zustand'
import { Game } from '../engine/game'
import { HumanPlayer } from '../engine/player'
import { AIPlayer, AIDifficulty, GameStateForAI } from '../engine/ai'
import { Card } from '../engine/card'
import { scoreCard } from '../engine/utils'

/** Max canasta plays the AI is allowed to make in a single turn before we
 * force it to discard. Guards against an infinite loop if playTurn() ever
 * kept returning play_canasta moves (e.g. a buggy/adversarial strategy). */
const MAX_CANASTAS_PER_AI_TURN = 10

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
  /** Multi-select for building a canasta from the hand (indices into the
   * current player's hand array). */
  selectedCardIndices: number[]
  gameLog: string[]

  initGame: (playerName: string, aiDifficulty: AIDifficulty) => void
  draw: () => void
  discard: (cardIndex: number) => void
  playCanasta: (cardIndices: number[]) => void
  /** Runs one full AI turn (draw -> play any canastas the AI's strategy
   * finds -> discard -> end turn). This store never schedules this itself
   * (no setTimeout) — the calling UI decides when/whether to delay it. */
  aiTurn: () => void
  toggleCardSelection: (index: number) => void
  clearSelection: () => void
  resetGame: () => void
}

function appendGameOverLog(game: Game, log: string[]): void {
  if (!game.isGameOver()) return
  game.finish()
  const winnerName = game.state.winner?.name ?? 'unknown'
  log.push(`Game over — ${winnerName} venceu.`)
}

/** Fallback discard used whenever the AI's move can't be honored as-is:
 * discards the lowest scoreCard()-value card in hand. Returns true if a
 * card was actually discarded. */
function discardLowestValueCard(game: Game, player: { hand: { getCards(): Card[] } }): boolean {
  const cards = player.hand.getCards()
  if (cards.length === 0) return false

  let lowestIndex = 0
  let lowestValue = scoreCard(cards[0].rank)
  for (let i = 1; i < cards.length; i++) {
    const value = scoreCard(cards[i].rank)
    if (value < lowestValue) {
      lowestValue = value
      lowestIndex = i
    }
  }
  return game.discard(lowestIndex)
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  version: 0,
  selectedCardIndices: [],
  gameLog: [],

  initGame: (playerName, aiDifficulty) => {
    const human = new HumanPlayer(playerName)
    const ai = new AIPlayer('Bot', aiDifficulty)
    const game = new Game([human, ai])
    game.setup()
    set({
      game,
      version: get().version + 1,
      selectedCardIndices: [],
      gameLog: [`Game started: ${playerName} vs Bot (${aiDifficulty}).`],
    })
  },

  draw: () => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    const card = game.draw()
    if (!card) {
      set({
        gameLog: [...gameLog, 'The deck is empty.'],
        version: get().version + 1,
      })
      return
    }

    player.hand.addCard(card)
    set({
      gameLog: [...gameLog, `${player.name} drew a card.`],
      version: get().version + 1,
    })
  },

  discard: (cardIndex) => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    const success = game.discard(cardIndex)
    if (!success) return

    const log = [...gameLog, `${player.name} discarded a card.`]
    game.endTurn()
    appendGameOverLog(game, log)

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

    // Game.playCanasta validates, removes the exact cards from the hand,
    // and credits score via player.addCanasta() — this store does NOT
    // remove cards itself (the plan's version double-removed them).
    const success = game.playCanasta(cards)
    if (!success) return

    set({
      gameLog: [...gameLog, `${player.name} played a canasta!`],
      selectedCardIndices: [],
      version: get().version + 1,
    })
  },

  aiTurn: () => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const aiPlayer = game.getCurrentPlayer()
    const log = [...gameLog]

    const drawnCard = game.draw()
    if (drawnCard) {
      aiPlayer.hand.addCard(drawnCard)
      log.push(`${aiPlayer.name} drew a card.`)
    } else {
      log.push('The deck is empty.')
    }

    let discarded = false
    for (let iteration = 0; iteration < MAX_CANASTAS_PER_AI_TURN; iteration++) {
      const gameStateForAI: GameStateForAI = {
        currentPlayerIndex: game.state.currentPlayerIndex,
        players: game.state.players,
        deck: game.state.deck,
        discardPile: game.state.discardPile,
        melds: game.state.melds,
      }
      const move = (aiPlayer as AIPlayer).playTurn(gameStateForAI)

      if (move && move.type === 'play_canasta' && move.cards) {
        const played = game.playCanasta(move.cards)
        if (!played) break // avoid an infinite loop on a move the engine rejects
        log.push(`${aiPlayer.name} played a canasta!`)
        continue
      }

      if (move && move.type === 'discard' && move.cardIndex !== undefined) {
        discarded = game.discard(move.cardIndex)
        if (discarded) log.push(`${aiPlayer.name} discarded a card.`)
      }
      break
    }

    // Whatever happened above (move was 'draw', null, an out-of-range
    // discard, or the canasta loop hit its cap), guarantee the AI ends its
    // turn by discarding its least valuable card.
    if (!discarded) {
      discarded = discardLowestValueCard(game, aiPlayer)
      if (discarded) log.push(`${aiPlayer.name} discarded a card.`)
    }

    game.endTurn()
    appendGameOverLog(game, log)

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

  resetGame: () => set({ game: null, version: 0, selectedCardIndices: [], gameLog: [] }),
}))
