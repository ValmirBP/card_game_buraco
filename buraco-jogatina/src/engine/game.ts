import { Player, PlayerMove } from './player'
import { Card, createDeck, shuffleInPlace } from './card'
import { Canasta } from './canasta'
import { GameState, Team, TeamId, TeamScoreBreakdown, createGameState, teamOfSeat } from './gameState'
import { isValidCanasta, canExtendMeld, scoreCardValue } from './utils'

export const HAND_SIZE = 11
export const MORTO_SIZE = 11
const MORTO_COUNT = 2
export const STALEMATE_RECYCLES = 12
export const VU_THRESHOLD = 1500
export const VU_OPENING_MINIMUM = 75

export function isVulnerableScore(matchScore: number): boolean {
  return matchScore >= VU_THRESHOLD
}

export function openingPoints(cards: Card[]): number {
  return cards.reduce((sum, card) => sum + scoreCardValue(card), 0)
}

export class Game {
  state: GameState
  private lastMeldCardTotal = 0
  private recyclesAtLastMeldChange = 0

  getStalemateTracking(): { lastMeldCardTotal: number; recyclesAtLastMeldChange: number } {
    return { lastMeldCardTotal: this.lastMeldCardTotal, recyclesAtLastMeldChange: this.recyclesAtLastMeldChange }
  }

  restoreStalemateTracking(tracking: { lastMeldCardTotal: number; recyclesAtLastMeldChange: number }): void {
    this.lastMeldCardTotal = tracking.lastMeldCardTotal
    this.recyclesAtLastMeldChange = tracking.recyclesAtLastMeldChange
  }

  constructor(players: Player[]) {
    if (players.length !== 4) {
      throw new Error('Game requires exactly 4 players')
    }
    this.state = createGameState(players)
  }

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

  drawFromDeck(): Card | null {
    this.promoteMortoIfDeckEmpty()
    this.recycleDiscardIfExhausted()
    if (this.state.deck.length === 0) return null
    const card = this.state.deck.pop()!
    this.promoteMortoIfDeckEmpty()
    this.recycleDiscardIfExhausted()
    return card
  }

  private promoteMortoIfDeckEmpty(): void {
    if (this.state.deck.length === 0 && this.state.mortos.length > 0) {
      this.state.deck = this.state.mortos.pop()!
    }
  }

  private recycleDiscardIfExhausted(): void {
    if (this.state.deck.length > 0 || this.state.mortos.length > 0) return
    if (this.state.discardPile.length === 0) return
    const recycled = [...this.state.discardPile]
    this.state.discardPile = []
    this.state.blockedDiscardCard = null
    shuffleInPlace(recycled)
    this.state.deck = recycled
    this.state.discardRecycles++
  }

  takeDiscardPile(): Card[] | null {
    if (this.state.discardPile.length === 0) {
      return null
    }
    const cards = [...this.state.discardPile]
    this.state.discardPile = []
    this.state.blockedDiscardCard = cards.length === 1 ? cards[0] : null
    return cards
  }

  discard(cardIndex: number): boolean {
    const player = this.getCurrentPlayer()
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= player.hand.getSize()) return false

    const team = this.getTeamOfCurrentPlayer()
    if (this.wouldLeaveTeamStuck(player, 1, 1, team, team.melds)) return false

    if (this.isDiscardBlockedCard(cardIndex)) return false

    const card = player.hand.removeCard(cardIndex)
    if (!card) return false
    this.markMortoUsedIfApplicable(team)
    this.state.discardPile.push(card)
    this.maybeAutoPickUpMorto()
    return true
  }

  isDiscardBlockedCard(cardIndex: number): boolean {
    const blocked = this.state.blockedDiscardCard
    if (!blocked) return false
    return this.getCurrentPlayer().hand.getCards()[cardIndex] === blocked
  }

  private markMortoUsedIfApplicable(team: Team): void {
    if (team.hasTakenMorto && team.mortoTakenBySeat === this.state.currentPlayerIndex) {
      team.mortoUsed = true
    }
  }

  playCanasta(cards: Card[]): boolean {
    return this.playMelds([cards])
  }

  setOpeningMinimums(matchScores: Record<TeamId, number>): void {
    for (const team of this.state.teams) {
      team.openingMinimum = isVulnerableScore(matchScores[team.id] ?? 0) ? VU_OPENING_MINIMUM : 0
    }
  }

  needsOpening(team: Team = this.getTeamOfCurrentPlayer()): boolean {
    return team.openingMinimum > 0 && team.melds.length === 0
  }

  openingShortfall(cards: Card[], team: Team = this.getTeamOfCurrentPlayer()): number {
    if (!this.needsOpening(team)) return 0
    return Math.max(0, team.openingMinimum - openingPoints(cards))
  }

  private buildMelds(groups: Card[][]): Canasta[] | null {
    if (groups.length === 0) return null
    const melds: Canasta[] = []
    for (const group of groups) {
      if (!isValidCanasta(group)) return null
      try {
        melds.push(new Canasta(group))
      } catch {
        return null
      }
    }
    return melds
  }

  playMelds(groups: Card[][]): boolean {
    const melds = this.buildMelds(groups)
    if (!melds) return false
    const cards = groups.flat()

    const team = this.getTeamOfCurrentPlayer()
    if (this.openingShortfall(cards, team) > 0) return false

    const player = this.getCurrentPlayer()
    const indicesToRemove = this.findCardIndices(player, cards)
    if (indicesToRemove === null) return false
    if (this.wouldLeaveOnlyBlockedCard(cards)) return false

    if (this.wouldEmptyHandIllegally(player, cards.length, team, [...team.melds, ...melds])) return false

    for (const idx of indicesToRemove) {
      player.hand.removeCard(idx)
    }

    this.markMortoUsedIfApplicable(team)
    for (const meld of melds) {
      team.melds.push(meld)
      team.score += meld.getScore()
    }

    this.maybeAutoPickUpMorto()
    return true
  }

  wouldLeaveOnlyBlockedCard(cards: Card[]): boolean {
    const blocked = this.state.blockedDiscardCard
    if (!blocked) return false
    const player = this.getCurrentPlayer()
    const indices = this.findCardIndices(player, cards)
    if (!indices) return false
    const removed = new Set(indices)
    const remaining = player.hand.getCards().filter((_, i) => !removed.has(i))
    return remaining.length === 1 && remaining[0] === blocked
  }

  wouldPlayMeldsEmptyHandIllegally(groups: Card[][]): boolean {
    const melds = this.buildMelds(groups)
    if (!melds) return false
    const player = this.getCurrentPlayer()
    const team = this.getTeamOfCurrentPlayer()
    return this.wouldEmptyHandIllegally(player, groups.flat().length, team, [...team.melds, ...melds])
  }

  extendMeld(meldIndex: number, cards: Card[]): boolean {
    const team = this.getTeamOfCurrentPlayer()
    const meld = team.melds[meldIndex]
    if (!meld) return false
    if (!canExtendMeld(meld.cards, cards)) return false

    const player = this.getCurrentPlayer()
    const indicesToRemove = this.findCardIndices(player, cards)
    if (indicesToRemove === null) return false
    if (this.wouldLeaveOnlyBlockedCard(cards)) return false

    const extended = meld.withExtraCards(cards)
    const resultingMelds = team.melds.map((m, i) => (i === meldIndex ? extended : m))
    if (this.wouldEmptyHandIllegally(player, cards.length, team, resultingMelds)) return false

    for (const idx of indicesToRemove) {
      player.hand.removeCard(idx)
    }

    this.markMortoUsedIfApplicable(team)
    const oldScore = meld.getScore()
    team.melds[meldIndex] = extended
    team.score += extended.getScore() - oldScore

    this.maybeAutoPickUpMorto()
    return true
  }

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

  private maybeAutoPickUpMorto(): void {
    const player = this.getCurrentPlayer()
    if (!player.hand.isEmpty()) return
    const team = this.getTeamOfCurrentPlayer()
    if (team.hasTakenMorto) return
    if (this.state.mortos.length === 0) return
    this.pickUpMorto()
  }

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
    team.mortoTakenBySeat = this.state.currentPlayerIndex
    team.mortoUsed = false
    return true
  }

  canClose(team: Team): boolean {
    return this.canCloseWithMelds(team, team.melds)
  }

  private canCloseWithMelds(team: Team, melds: Canasta[]): boolean {
    const mortoSatisfied = team.hasTakenMorto || this.state.mortos.length === 0
    return mortoSatisfied && melds.some(m => m.isCanastra && m.isClean)
  }

  private wouldLeaveTeamStuck(
    player: Player,
    cardsToRemoveCount: number,
    minSafeRemaining: number,
    team: Team,
    resultingMelds: Canasta[]
  ): boolean {
    if (player.hand.getSize() - cardsToRemoveCount >= minSafeRemaining) return false

    const couldTakeMorto = !team.hasTakenMorto && this.state.mortos.length > 0
    if (couldTakeMorto) return false

    return !this.canCloseWithMelds(team, resultingMelds)
  }

  wouldEmptyHandIllegally(
    player: Player,
    cardsToRemoveCount: number,
    team: Team,
    resultingMelds: Canasta[]
  ): boolean {
    return this.wouldLeaveTeamStuck(player, cardsToRemoveCount, 2, team, resultingMelds)
  }

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

  wouldDiscardEmptyHandIllegally(cardIndex: number): boolean {
    const player = this.getCurrentPlayer()
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= player.hand.getSize()) return false
    const team = this.getTeamOfCurrentPlayer()
    return this.wouldLeaveTeamStuck(player, 1, 1, team, team.melds)
  }

  endTurn(): void {
    this.state.blockedDiscardCard = null
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

  isGameOver(): boolean {
    if (this.state.status !== 'playing') return false

    const nothingLeftAnywhere =
      this.state.deck.length === 0 &&
      this.state.mortos.length === 0 &&
      this.state.discardPile.length === 0
    const someoneClosed = this.state.players.some((p, seat) => {
      if (!p.hand.isEmpty()) return false
      return this.canClose(teamOfSeat(this.state, seat))
    })

    return someoneClosed || nothingLeftAnywhere || this.isStalemate()
  }

  private isStalemate(): boolean {
    const meldCards = this.state.teams.reduce((sum, t) => sum + t.melds.reduce((n, m) => n + m.cards.length, 0), 0)
    if (meldCards !== this.lastMeldCardTotal) {
      this.lastMeldCardTotal = meldCards
      this.recyclesAtLastMeldChange = this.state.discardRecycles
    }
    return this.state.discardRecycles - this.recyclesAtLastMeldChange >= STALEMATE_RECYCLES
  }

  finish(): void {
    if (this.state.status === 'finished') return
    this.state.status = 'finished'

    let closerTeamId: TeamId | null = null
    this.state.players.forEach((p, seat) => {
      if (p.hand.isEmpty() && this.canClose(teamOfSeat(this.state, seat))) {
        closerTeamId = teamOfSeat(this.state, seat).id
        this.state.closerSeat = seat
      }
    })

    const breakdowns: TeamScoreBreakdown[] = this.state.teams.map(team => {
      const meldPoints = team.melds.reduce((sum, m) => sum + m.getScore(), 0)
      const batidaBonus = closerTeamId === team.id ? 100 : 0

      const mortoNeverTaken = !team.hasTakenMorto && this.state.mortos.length > 0
      const mortoTakenButUnused = team.hasTakenMorto && team.mortoUsed === false
      const mortoPenalty = mortoNeverTaken || mortoTakenButUnused ? -100 : 0

      const handBySeat = team.seats.map(seat => {
        const player = this.state.players[seat]
        const points = player.hand.getCards().reduce((s, card) => s + scoreCardValue(card), 0)
        const counted = !(mortoTakenButUnused && seat === team.mortoTakenBySeat)
        return { seat, playerName: player.name, points, counted }
      })
      const handPenalty = 0 - handBySeat.reduce((sum, h) => sum + (h.counted ? h.points : 0), 0)

      const total = meldPoints + batidaBonus + mortoPenalty + handPenalty
      return { teamId: team.id, meldPoints, batidaBonus, mortoPenalty, handPenalty, handBySeat, total }
    })

    breakdowns.forEach(b => {
      const team = this.state.teams.find(t => t.id === b.teamId)!
      team.score = b.total
    })
    this.state.scoreBreakdowns = breakdowns

    const winner = this.state.teams.reduce((best, t) => (t.score > best.score ? t : best), this.state.teams[0])
    this.state.winnerTeam = winner.id
  }

  getGameState(): GameState {
    return this.state
  }

  clone(): Game {
    const clonedPlayers = this.state.players.map(p => (p as unknown as { clone(): Player }).clone())
    const game = new Game(clonedPlayers)
    game.lastMeldCardTotal = this.lastMeldCardTotal
    game.recyclesAtLastMeldChange = this.recyclesAtLastMeldChange
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
