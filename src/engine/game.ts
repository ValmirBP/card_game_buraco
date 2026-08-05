import { Player, PlayerMove } from './player'
import { Card, createDeck } from './card'
import { Canasta } from './canasta'
import { GameState, Team, TeamId, createGameState, teamOfSeat } from './gameState'
import { isValidCanasta, canExtendMeld, scoreCard } from './utils'

const HAND_SIZE = 11
const MORTO_SIZE = 11
const MORTO_COUNT = 2

export class Game {
  state: GameState

  constructor(players: Player[]) {
    if (players.length !== 4) {
      throw new Error('Game requires exactly 4 players')
    }
    this.state = createGameState(players)
  }

  /**
   * Deals 11 cards to each of the 4 players, reserves 2 mortos of 11 cards
   * each, and leaves the rest as the baço. The discard pile starts EMPTY -
   * no card is flipped at setup, so on the first turn the current player can
   * only draw from the deck. Count check: 4*11 (hands) + 2*11 (mortos) = 66
   * cards used immediately out of 108, leaving 42 in the deck.
   */
  setup(): void {
    this.state.deck = createDeck()

    for (let p = 0; p < this.state.players.length; p++) {
      for (let i = 0; i < HAND_SIZE; i++) {
        const card = this.state.deck.pop()!
        this.state.players[p].hand.addCard(card)
      }
    }

    this.state.mortos = []
    for (let m = 0; m < MORTO_COUNT; m++) {
      const morto: Card[] = []
      for (let i = 0; i < MORTO_SIZE; i++) {
        morto.push(this.state.deck.pop()!)
      }
      this.state.mortos.push(morto)
    }

    this.state.discardPile = []
    this.state.status = 'playing'
  }

  /**
   * Draws the top card of the baço. If the baço is empty but at least one
   * morto is still on the table, the last morto (mortos.pop(), i.e. "morto
   * 2" while it's still around) becomes the new baço and the draw proceeds
   * from it - this keeps the round alive instead of ending it by exhaustion.
   * Only returns null once both the deck and the mortos are exhausted.
   */
  drawFromDeck(): Card | null {
    if (this.state.deck.length === 0) {
      const morto = this.state.mortos.pop()
      if (!morto) return null
      this.state.deck = morto
    }
    return this.state.deck.pop()!
  }

  /**
   * Takes the entire discard pile, returning it (or null if the pile is
   * empty) and clearing it from state. This is a mechanism only: the
   * traditional Buraco condition ("can only take the pile if the top card is
   * immediately used in a meld") is NOT enforced here. Enforcing it inside
   * this method would require either a transactional "take + must-meld-or-
   * rollback" API, or forcing the caller to pass the intended meld/extend
   * cards up front - both add complexity the engine doesn't need yet. The
   * decision: expose the raw mechanism, and let the caller (UI flow or
   * AIPlayer decision logic) verify - e.g. via isValidCanasta/canExtendMeld
   * against the top card - that the pile can legally be used before calling
   * this method. This mirrors how discard()/playCanasta() already leave
   * ordering/turn-flow decisions to the caller.
   */
  takeDiscardPile(): Card[] | null {
    if (this.state.discardPile.length === 0) {
      return null
    }
    const cards = [...this.state.discardPile]
    this.state.discardPile = []
    return cards
  }

  discard(cardIndex: number): boolean {
    const player = this.getCurrentPlayer()
    const card = player.hand.removeCard(cardIndex)
    if (!card) return false
    this.state.discardPile.push(card)
    this.maybeAutoPickUpMorto()
    return true
  }

  /**
   * Validates and plays a canasta for the current player's team. Melds
   * belong to the team (shared by both partners), not the individual
   * player. Returns false with no side effects if the cards don't form a
   * valid meld or aren't actually in the current player's hand.
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
    const indicesToRemove = this.findCardIndices(player, cards)
    if (indicesToRemove === null) return false

    for (const idx of indicesToRemove) {
      player.hand.removeCard(idx)
    }

    const team = this.getTeamOfCurrentPlayer()
    team.melds.push(canasta)
    team.score += canasta.getScore()

    this.maybeAutoPickUpMorto()
    return true
  }

  /**
   * Adds `cards` from the current player's hand to an existing meld
   * (identified by index) belonging to the current player's team. Any
   * partner may extend any of their team's melds. Revalidates via
   * canExtendMeld; returns false with no side effects if the meld doesn't
   * exist, the extension is invalid, or the cards aren't in hand.
   */
  extendMeld(meldIndex: number, cards: Card[]): boolean {
    const team = this.getTeamOfCurrentPlayer()
    const meld = team.melds[meldIndex]
    if (!meld) return false
    if (!canExtendMeld(meld.cards, cards)) return false

    const player = this.getCurrentPlayer()
    const indicesToRemove = this.findCardIndices(player, cards)
    if (indicesToRemove === null) return false

    for (const idx of indicesToRemove) {
      player.hand.removeCard(idx)
    }

    const oldScore = meld.getScore()
    const extended = meld.withExtraCards(cards)
    team.melds[meldIndex] = extended
    team.score += extended.getScore() - oldScore

    this.maybeAutoPickUpMorto()
    return true
  }

  /**
   * Finds the hand indices matching `cards` (by reference, falling back to
   * value equality), each used at most once. Returns null if any card isn't
   * found, so the caller can abort with no side effects. Indices are
   * returned sorted descending so removing them in order is index-stable.
   */
  private findCardIndices(player: Player, cards: Card[]): number[] | null {
    const handCards = player.hand.getCards()
    const used = new Array(handCards.length).fill(false)
    const indices: number[] = []

    for (const card of cards) {
      let idx = handCards.findIndex((c, i) => !used[i] && c === card)
      if (idx === -1) {
        idx = handCards.findIndex((c, i) => !used[i] && c.equals(card))
      }
      if (idx === -1) return null
      used[idx] = true
      indices.push(idx)
    }

    indices.sort((a, b) => b - a)
    return indices
  }

  /**
   * If the current player's hand is empty and their team hasn't taken a
   * morto yet, automatically gives them a morto as a fresh hand. Called
   * after discard/playCanasta/extendMeld, any of which can empty the hand.
   */
  private maybeAutoPickUpMorto(): void {
    const player = this.getCurrentPlayer()
    if (!player.hand.isEmpty()) return
    const team = this.getTeamOfCurrentPlayer()
    if (team.hasTakenMorto) return
    if (this.state.mortos.length === 0) return
    this.pickUpMorto()
  }

  /**
   * Gives the current player a morto (11 cards) as their new hand and marks
   * their team as having taken the morto. Returns false if the team already
   * took a morto or none remain.
   */
  pickUpMorto(): boolean {
    const team = this.getTeamOfCurrentPlayer()
    if (team.hasTakenMorto) return false
    if (this.state.mortos.length === 0) return false

    const morto = this.state.mortos.shift()!
    const player = this.getCurrentPlayer()
    for (const card of morto) {
      player.hand.addCard(card)
    }
    team.hasTakenMorto = true
    return true
  }

  /**
   * A team may only close (bater) the round when:
   *  1. it has at least one clean canastra (7+ cards, no curinga - a
   *     natural 2 in its own position doesn't count against this), AND
   *  2. the morto requirement is satisfied: the team took a morto, OR
   *     there is no morto left on the table (e.g. it became the new deck
   *     after the stock ran out), so taking one is no longer possible.
   * (Hand emptiness is the trigger checked by the caller.)
   */
  canClose(team: Team): boolean {
    const mortoSatisfied = team.hasTakenMorto || this.state.mortos.length === 0
    return mortoSatisfied && team.melds.some(m => m.isCanastra && m.isClean)
  }

  endTurn(): void {
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length
  }

  getCurrentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex]
  }

  getTeamOfCurrentPlayer(): Team {
    return teamOfSeat(this.state, this.state.currentPlayerIndex)
  }

  getValidMoves(): PlayerMove[] {
    const moves: PlayerMove[] = [{ type: 'draw' }]
    const hand = this.getCurrentPlayer().hand.getCards()
    for (let i = 0; i < hand.length; i++) {
      moves.push({ type: 'discard', cardIndex: i })
    }
    if (this.state.discardPile.length > 0) {
      moves.push({ type: 'take_discard' })
    }
    return moves
  }

  /**
   * A round is over once status is 'playing' AND either:
   *  - a team has "batido" (a player's hand is empty AND their team
   *    canClose - has taken the morto and has a clean 7+ card canastra), or
   *  - the deck (baço) AND both mortos are exhausted (a morto becomes the
   *    new baço when the deck runs out while a morto is still available -
   *    see drawFromDeck).
   */
  isGameOver(): boolean {
    if (this.state.status !== 'playing') return false

    const deckEmpty = this.state.deck.length === 0 && this.state.mortos.length === 0
    const someoneClosed = this.state.players.some((p, seat) => {
      if (!p.hand.isEmpty()) return false
      return this.canClose(teamOfSeat(this.state, seat))
    })

    return someoneClosed || deckEmpty
  }

  /**
   * Finalizes the round: each team's score is reduced by the sum of the
   * remaining hand card values across BOTH partners, and the team that
   * closed (a player emptied their hand while their team had already taken
   * the morto) gets a +100 bonus. winnerTeam is set to whichever team has
   * the higher adjusted score. Idempotent - calling finish() again after
   * the round is already 'finished' is a no-op.
   */
  finish(): void {
    if (this.state.status === 'finished') return
    this.state.status = 'finished'

    let closerTeamId: TeamId | null = null
    this.state.players.forEach((p, seat) => {
      if (p.hand.isEmpty() && this.canClose(teamOfSeat(this.state, seat))) {
        closerTeamId = teamOfSeat(this.state, seat).id
      }
    })

    this.state.players.forEach((p, seat) => {
      const handPenalty = p.hand.getCards().reduce((sum, card) => sum + scoreCard(card.rank), 0)
      const team = teamOfSeat(this.state, seat)
      team.score -= handPenalty
    })

    if (closerTeamId) {
      const team = this.state.teams.find(t => t.id === closerTeamId)!
      team.score += 100
    }

    const winner = this.state.teams.reduce((best, t) => (t.score > best.score ? t : best), this.state.teams[0])
    this.state.winnerTeam = winner.id
  }

  getGameState(): GameState {
    return this.state
  }

  clone(): Game {
    // Player doesn't declare clone() in its interface, though both
    // HumanPlayer and AIPlayer implement it - narrow via unknown rather than
    // editing player.ts, which is out of scope here.
    const clonedPlayers = this.state.players.map(p => (p as unknown as { clone(): Player }).clone())
    const game = new Game(clonedPlayers)
    game.state = {
      ...this.state,
      players: clonedPlayers,
      teams: this.state.teams.map(t => ({
        ...t,
        seats: [...t.seats],
        melds: t.melds.map(c => c.clone()),
      })),
      deck: [...this.state.deck],
      discardPile: [...this.state.discardPile],
      mortos: this.state.mortos.map(m => [...m]),
    }
    return game
  }
}
