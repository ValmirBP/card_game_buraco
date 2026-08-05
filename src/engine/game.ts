import { Player, PlayerMove } from './player'
import { Card, createDeck } from './card'
import { Canasta } from './canasta'
import { GameState, Team, TeamId, createGameState, teamOfSeat } from './gameState'
import { isValidCanasta, canExtendMeld, scoreCardValue } from './utils'

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
   *
   * The promotion is also done EAGERLY right after a draw empties the baço
   * (not only lazily on the next draw), so the table never shows an empty
   * monte while a morto sits unused - which players read as a stuck game.
   */
  drawFromDeck(): Card | null {
    this.promoteMortoIfDeckEmpty()
    if (this.state.deck.length === 0) return null
    const card = this.state.deck.pop()!
    this.promoteMortoIfDeckEmpty()
    return card
  }

  /** If the baço is empty and a morto remains on the table, the morto
   * immediately becomes the new baço. */
  private promoteMortoIfDeckEmpty(): void {
    if (this.state.deck.length === 0 && this.state.mortos.length > 0) {
      this.state.deck = this.state.mortos.pop()!
    }
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

    const team = this.getTeamOfCurrentPlayer()
    if (this.wouldEmptyHandIllegally(player, cards.length, team, [canasta])) return false

    for (const idx of indicesToRemove) {
      player.hand.removeCard(idx)
    }

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

    const extended = meld.withExtraCards(cards)
    const resultingMelds = team.melds.map((m, i) => (i === meldIndex ? extended : m))
    if (this.wouldEmptyHandIllegally(player, cards.length, team, resultingMelds)) return false

    for (const idx of indicesToRemove) {
      player.hand.removeCard(idx)
    }

    const oldScore = meld.getScore()
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
    return this.canCloseWithMelds(team, team.melds)
  }

  /**
   * Same check as canClose, but against an explicit `melds` list rather than
   * `team.melds` directly - lets callers evaluate a hypothetical post-play
   * meld set (e.g. including a canasta not yet committed to the team) before
   * mutating state. See wouldEmptyHandIllegally.
   */
  private canCloseWithMelds(team: Team, melds: Canasta[]): boolean {
    const mortoSatisfied = team.hasTakenMorto || this.state.mortos.length === 0
    return mortoSatisfied && melds.some(m => m.isCanastra && m.isClean)
  }

  /**
   * The Buraco rule this enforces: a player may only empty their hand via a
   * meld (playCanasta/extendMeld) if, immediately after, their team can
   * EITHER take the morto (team hasn't taken one yet AND one is still on the
   * table) OR close/bater (canClose, evaluated against `resultingMelds` -
   * the team's meld set AFTER this play, including the new/extended meld -
   * since a canastra just completed by this very play must count). If
   * neither holds, emptying the hand would leave the player stuck with
   * nothing to discard and no way to end the turn, so the play is illegal.
   *
   * Returns false (legal) whenever this particular play wouldn't actually
   * empty the hand - `cardsToRemoveCount` must equal the current hand size
   * for the illegality check to even apply.
   */
  wouldEmptyHandIllegally(
    player: Player,
    cardsToRemoveCount: number,
    team: Team,
    resultingMelds: Canasta[]
  ): boolean {
    if (player.hand.getSize() !== cardsToRemoveCount) return false

    const couldTakeMorto = !team.hasTakenMorto && this.state.mortos.length > 0
    if (couldTakeMorto) return false

    return !this.canCloseWithMelds(team, resultingMelds)
  }

  /**
   * UI helper: would playing `cards` as a NEW canasta (via playCanasta) for
   * the current player's team be refused because it empties the hand
   * illegally? Mirrors the check playCanasta itself runs, without mutating
   * anything - lets the UI disable the "Jogar Canasta" button and show a
   * hint before the player attempts an illegal play. Returns false (i.e.
   * "not illegal") for a card set that doesn't even form a valid canasta,
   * since playCanasta would already reject it for that separate reason.
   */
  wouldPlayCanastaEmptyHandIllegally(cards: Card[]): boolean {
    if (!isValidCanasta(cards)) return false
    let canasta: Canasta
    try {
      canasta = new Canasta(cards)
    } catch {
      return false
    }
    const player = this.getCurrentPlayer()
    const team = this.getTeamOfCurrentPlayer()
    return this.wouldEmptyHandIllegally(player, cards.length, team, [...team.melds, canasta])
  }

  /**
   * UI helper: would extending meld `meldIndex` with `cards` (via
   * extendMeld) for the current player's team be refused because it empties
   * the hand illegally? Mirrors the check extendMeld itself runs, without
   * mutating anything. Returns false when the meld index doesn't exist or
   * the extension isn't itself valid, since extendMeld would already reject
   * it for that separate reason.
   */
  wouldExtendMeldEmptyHandIllegally(meldIndex: number, cards: Card[]): boolean {
    const team = this.getTeamOfCurrentPlayer()
    const meld = team.melds[meldIndex]
    if (!meld) return false
    if (!canExtendMeld(meld.cards, cards)) return false

    const player = this.getCurrentPlayer()
    const extended = meld.withExtraCards(cards)
    const resultingMelds = team.melds.map((m, i) => (i === meldIndex ? extended : m))
    return this.wouldEmptyHandIllegally(player, cards.length, team, resultingMelds)
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
   * remaining hand card values across BOTH partners (using scoreCardValue,
   * which correctly values jokers at 20 - unlike the rank-only scoreCard),
   * and the team that closed (a player emptied their hand while their team
   * had already taken the morto) gets a +100 bonus. Additionally, any team
   * that never took a morto (team.hasTakenMorto === false) is penalized an
   * extra -100, regardless of why (never emptied a hand to trigger the
   * auto-pickup, or the morto became the new baço before they could take
   * it). winnerTeam is set to whichever team has the higher adjusted score.
   * Idempotent - calling finish() again after the round is already
   * 'finished' is a no-op.
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
      const handPenalty = p.hand.getCards().reduce((sum, card) => sum + scoreCardValue(card), 0)
      const team = teamOfSeat(this.state, seat)
      team.score -= handPenalty
    })

    if (closerTeamId) {
      const team = this.state.teams.find(t => t.id === closerTeamId)!
      team.score += 100
    }

    this.state.teams.forEach(team => {
      if (!team.hasTakenMorto) {
        team.score -= 100
      }
    })

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
