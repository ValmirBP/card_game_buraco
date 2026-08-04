import { Player, PlayerMove } from './player'
import { Card, createDeck } from './card'
import { Canasta } from './canasta'
import { GameState, createGameState } from './gameState'
import { isValidCanasta, scoreCard } from './utils'

export class Game {
  state: GameState
  private HAND_SIZE = 14

  constructor(players: Player[]) {
    if (players.length < 2 || players.length > 4) {
      throw new Error('Game requires 2-4 players')
    }
    this.state = createGameState(players)
  }

  setup(): void {
    // Deal initial cards
    this.state.deck = createDeck()
    for (let p = 0; p < this.state.players.length; p++) {
      for (let i = 0; i < this.HAND_SIZE; i++) {
        const card = this.state.deck.pop()!
        this.state.players[p].hand.addCard(card)
      }
    }
    this.state.status = 'playing'
  }

  draw(): Card | null {
    if (this.state.deck.length === 0) {
      return null // Buraco (morte)
    }
    return this.state.deck.pop()!
  }

  discard(cardIndex: number): boolean {
    const player = this.getCurrentPlayer()
    const card = player.hand.removeCard(cardIndex)
    if (!card) return false
    this.state.discardPile.push(card)
    return true
  }

  /**
   * Validates and plays a canasta for the current player.
   *
   * Deviation from the plan: the plan's implementation only pushed the new
   * Canasta into state.melds and never touched the player's hand or score.
   * This version also removes exactly the played cards from the current
   * player's hand and calls player.addCanasta(canasta), which is the single
   * place that credits the score (state.melds itself carries no score, so
   * there is no double counting). Returns false with no side effects if the
   * cards don't form a valid canasta.
   */
  playCanasta(cards: Card[]): boolean {
    if (!isValidCanasta(cards)) {
      return false
    }

    let canasta: Canasta
    try {
      canasta = new Canasta(cards)
    } catch {
      return false
    }

    const player = this.getCurrentPlayer()
    const handCards = player.hand.getCards()
    const used = new Array(handCards.length).fill(false)
    const indicesToRemove: number[] = []

    for (const card of cards) {
      let idx = handCards.findIndex((c, i) => !used[i] && c === card)
      if (idx === -1) {
        idx = handCards.findIndex((c, i) => !used[i] && c.equals(card))
      }
      if (idx === -1) {
        // Card isn't actually in the player's hand: abort with no side effects.
        return false
      }
      used[idx] = true
      indicesToRemove.push(idx)
    }

    // Remove highest indices first so earlier indices stay valid.
    indicesToRemove.sort((a, b) => b - a)
    for (const idx of indicesToRemove) {
      player.hand.removeCard(idx)
    }

    const playerName = player.name
    const playerCanastas = this.state.melds.get(playerName) || []
    playerCanastas.push(canasta)
    this.state.melds.set(playerName, playerCanastas)

    // Player (the interface) doesn't declare addCanasta, though both
    // HumanPlayer and AIPlayer implement it — narrow via unknown rather than
    // editing player.ts, which belongs to Task 3.
    ;(player as unknown as { addCanasta(c: Canasta): void }).addCanasta(canasta)

    return true
  }

  endTurn(): void {
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length
  }

  getCurrentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex]
  }

  getValidMoves(): PlayerMove[] {
    // Simplificado: sempre pode comprar ou descartar
    const moves: PlayerMove[] = [{ type: 'draw' }]
    const hand = this.getCurrentPlayer().hand.getCards()
    for (let i = 0; i < hand.length; i++) {
      moves.push({ type: 'discard', cardIndex: i })
    }
    return moves
  }

  /**
   * Deviation from the plan: the plan checked
   * `this.getCurrentPlayer().hand.isEmpty() || this.state.deck.length === 0`
   * unconditionally. Before setup() runs, the deck is always empty (it's
   * only populated by setup()), so the plan's corresponding test asserted
   * isGameOver() === true on a freshly constructed game — passing for the
   * wrong reason and unable to distinguish "hand empty" from "deck empty".
   * Fixed contract: only meaningful once the game is actually 'playing'.
   */
  isGameOver(): boolean {
    if (this.state.status !== 'playing') return false
    const someHandEmpty = this.state.players.some(p => p.hand.isEmpty())
    const deckEmpty = this.state.deck.length === 0
    return someHandEmpty || deckEmpty
  }

  /**
   * Finalizes the game: applies the hand penalty and closing bonus to each
   * player's score, then determines the winner from the adjusted scores.
   * Idempotent - calling finish() again after the game is already
   * 'finished' is a no-op, so scores are never adjusted twice.
   */
  finish(): void {
    if (this.state.status === 'finished') return

    this.state.status = 'finished'

    const closer = this.state.players.find(p => p.hand.isEmpty())

    for (const player of this.state.players) {
      const handPenalty = player.hand
        .getCards()
        .reduce((sum, card) => sum + scoreCard(card.rank), 0)
      player.score -= handPenalty
      if (player === closer) {
        player.score += 100
      }
    }

    const winner = this.calculateWinner()
    this.state.winner = winner
  }

  private calculateWinner(): Player {
    let maxScore = -Infinity
    let winner = this.state.players[0]
    for (const player of this.state.players) {
      if (player.score > maxScore) {
        maxScore = player.score
        winner = player
      }
    }
    return winner
  }

  getGameState(): GameState {
    return this.state
  }

  clone(): Game {
    // Same rationale as addCanasta above: Player doesn't declare clone().
    const clonedPlayers = this.state.players.map(p =>
      (p as unknown as { clone(): Player }).clone()
    )
    const game = new Game(clonedPlayers)
    game.state = {
      ...this.state,
      players: clonedPlayers,
      deck: [...this.state.deck],
      discardPile: [...this.state.discardPile],
      melds: new Map(
        Array.from(this.state.melds.entries()).map(([name, canastas]) => [
          name,
          canastas.map(c => c.clone()),
        ])
      ),
    }
    return game
  }
}
