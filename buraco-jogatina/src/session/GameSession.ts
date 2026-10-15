import { Game, openingPoints } from '../engine/game'
import { HumanPlayer, Player } from '../engine/player'
import { AIPlayer, GameStateForAI } from '../engine/ai'
import { Card } from '../engine/card'
import { Canasta } from '../engine/canasta'
import { isValidCanasta, canExtendMeld, scoreCardValue } from '../engine/utils'
import { Team, TeamId, teamIdOfSeat } from '../engine/gameState'
import {
  Intent,
  IntentResult,
  MeldView,
  PlainCard,
  SeatConfig,
  SeatView,
  TurnPhase,
} from './types'

const MAX_AI_MELD_ACTIONS_PER_TURN = 12

export const DEFAULT_MATCH_TARGET = 3000

export type CanastraCount = { clean: number; dirty: number }

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
  teams: Team[],
  matchTarget: number
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
  if (newScores.A >= matchTarget || newScores.B >= matchTarget) {
    matchWinner = newScores.B > newScores.A ? 'B' : 'A'
  }

  return { matchScores: newScores, matchCanastras: newCanastras, matchWinner }
}

function ok(): IntentResult {
  return { ok: true }
}

function fail(error: string): IntentResult {
  return { ok: false, error }
}

function toPlainCard(card: Card): PlainCard {
  return { suit: card.suit, rank: card.rank, isWild: card.isWild }
}

function mapMeld(meld: Canasta): MeldView {
  return {
    layout: meld.layout.map(entry => ({
      card: toPlainCard(entry.card),
      representsValue: entry.representsValue,
    })),
    isClean: meld.isClean,
    isCanastra: meld.isCanastra,
    kind: meld.kind,
    points: meld.points,
    type: meld.type,
  }
}

function buildPlayers(seats: SeatConfig[]): Player[] {
  return seats.map(seat =>
    seat.kind === 'human'
      ? new HumanPlayer(seat.name)
      : new AIPlayer(seat.name, seat.difficulty ?? 'medium')
  )
}

export class GameSession {
  private game: Game
  private readonly seatsConfig: SeatConfig[]
  private readonly matchTarget: number
  private turnPhase: TurnPhase = 'draw'
  private log: string[] = []
  private round = 1
  private matchScores: Record<TeamId, number> = { A: 0, B: 0 }
  private matchCanastras: Record<TeamId, CanastraCount> = {
    A: { clean: 0, dirty: 0 },
    B: { clean: 0, dirty: 0 },
  }
  private matchWinner?: TeamId
  private roundFinalized = false

  constructor(seats: SeatConfig[], matchTarget: number = DEFAULT_MATCH_TARGET) {
    if (seats.length !== 4) {
      throw new Error('GameSession requires exactly 4 seats')
    }
    this.seatsConfig = seats
    this.matchTarget = matchTarget
    this.game = new Game(buildPlayers(seats))
    this.game.setup()
    this.game.setOpeningMinimums(this.matchScores)
  }

  private logVulnerability(): void {
    for (const team of this.game.state.teams) {
      if (team.openingMinimum > 0) {
        this.log.push(
          `⚠️ Time ${team.id} está vulnerável (VU): a primeira descida da rodada precisa somar ${team.openingMinimum} pontos.`
        )
      }
    }
  }

  get currentSeat(): number {
    return this.game.state.currentPlayerIndex
  }

  get phase(): TurnPhase {
    return this.turnPhase
  }

  get status(): 'playing' | 'finished' {
    return this.game.state.status === 'finished' ? 'finished' : 'playing'
  }

  applyIntent(seat: number, intent: Intent): IntentResult {
    switch (intent.type) {
      case 'draw':
        return this.handleDraw(seat)
      case 'takeDiscard':
        return this.handleTakeDiscard(seat)
      case 'discard':
        return this.handleDiscard(seat, intent.cardIndex)
      case 'playCanasta':
        return this.handlePlayCanasta(seat, intent.cardIndices)
      case 'playMelds':
        return this.handlePlayMelds(seat, intent.groups)
      case 'extendMeld':
        return this.handleExtendMeld(seat, intent.meldIndex, intent.cardIndices)
      case 'nextRound':
        return this.handleNextRound()
    }
  }

  private guardDrawPhase(seat: number): IntentResult | null {
    if (this.status !== 'playing') return fail('a partida nao esta em andamento')
    if (seat !== this.currentSeat) return fail('nao e a vez deste assento')
    if (this.turnPhase !== 'draw') return fail('fase invalida: e preciso descartar antes de comprar de novo')
    return null
  }

  private guardPlayPhase(seat: number): IntentResult | null {
    if (this.status !== 'playing') return fail('a partida nao esta em andamento')
    if (seat !== this.currentSeat) return fail('nao e a vez deste assento')
    if (this.turnPhase !== 'play') return fail('fase invalida: e preciso comprar antes')
    return null
  }

  private handleDraw(seat: number): IntentResult {
    const guardResult = this.guardDrawPhase(seat)
    if (guardResult) return guardResult

    const player = this.game.getCurrentPlayer()
    const mortosBefore = this.game.state.mortos.length
    const recyclesBefore = this.game.state.discardRecycles
    const card = this.game.drawFromDeck()
    if (this.game.state.mortos.length < mortosBefore) {
      this.log.push('O monte acabou — o morto virou o novo monte!')
    }
    if (this.game.state.discardRecycles > recyclesBefore) {
      this.log.push('🔀 O lixo foi embaralhado e virou o novo monte!')
    }
    if (!card) {
      this.log.push('O monte acabou.')
    } else {
      player.hand.addCard(card)
      this.log.push(`${player.name} comprou uma carta.`)
    }
    this.turnPhase = 'play'
    return ok()
  }

  private handleTakeDiscard(seat: number): IntentResult {
    const guardResult = this.guardDrawPhase(seat)
    if (guardResult) return guardResult

    const player = this.game.getCurrentPlayer()
    const cards = this.game.takeDiscardPile()
    if (!cards || cards.length === 0) {
      return fail('a pilha de descarte esta vazia')
    }
    for (const card of cards) player.hand.addCard(card)
    this.log.push(`${player.name} pegou a pilha de descarte (${cards.length} cartas).`)
    this.turnPhase = 'play'
    return ok()
  }

  private handleDiscard(seat: number, cardIndex: number): IntentResult {
    const guardResult = this.guardPlayPhase(seat)
    if (guardResult) return guardResult

    const player = this.game.getCurrentPlayer()
    if (!Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= player.hand.getSize()) return fail('indice de carta invalido')
    if (this.game.wouldDiscardEmptyHandIllegally(cardIndex)) {
      return fail('voce nao pode descartar a ultima carta sem poder bater')
    }
    if (this.game.isDiscardBlockedCard(cardIndex)) {
      return fail('voce pegou essa carta do descarte agora - nao pode devolve-la neste turno')
    }

    const hadMorto = this.game.getTeamOfCurrentPlayer().hasTakenMorto

    const success = this.game.discard(cardIndex)
    if (!success) return fail('indice de carta invalido')

    this.log.push(`${player.name} descartou uma carta.`)
    this.checkMortoTransition(player, hadMorto)

    if (this.checkGameOver()) {
      this.finalizeRoundIfNeeded()
    } else {
      this.game.endTurn()
      this.turnPhase = 'draw'
    }
    return ok()
  }

  private handlePlayCanasta(seat: number, cardIndices: number[]): IntentResult {
    const guardResult = this.guardPlayPhase(seat)
    if (guardResult) return guardResult

    const player = this.game.getCurrentPlayer()
    const cards = this.resolveCards(player, cardIndices)
    if (!cards) return fail('indices de carta invalidos')
    if (cards.length === 0) return fail('nenhuma carta selecionada')
    if (!isValidCanasta(cards)) return fail('conjunto de cartas nao forma uma canastra valida')
    const shortfall = this.openingError(cards)
    if (shortfall) return fail(shortfall)
    if (this.game.wouldLeaveOnlyBlockedCard(cards)) return fail('voce ficaria so com a carta que pegou do lixo, e ela nao pode voltar para o descarte')
    if (this.game.wouldPlayCanastaEmptyHandIllegally(cards)) {
      return fail('essa jogada esvaziaria a mao sem poder bater')
    }

    const hadMorto = this.game.getTeamOfCurrentPlayer().hasTakenMorto
    const success = this.game.playCanasta(cards)
    if (!success) return fail('jogada invalida')

    this.log.push(`${player.name} baixou uma canastra!`)
    this.checkMortoTransition(player, hadMorto)
    if (this.checkGameOver()) {
      this.finalizeRoundIfNeeded()
    }
    return ok()
  }

  private openingError(cards: Card[]): string | null {
    const team = this.game.getTeamOfCurrentPlayer()
    if (this.game.openingShortfall(cards, team) === 0) return null
    return `vulneravel: a abertura precisa somar ${team.openingMinimum} pontos (estas cartas somam ${openingPoints(cards)})`
  }

  private handlePlayMelds(seat: number, groups: number[][]): IntentResult {
    const guardResult = this.guardPlayPhase(seat)
    if (guardResult) return guardResult
    if (groups.length === 0) return fail('nenhuma carta selecionada')

    const allIndices = groups.flat()
    if (new Set(allIndices).size !== allIndices.length) return fail('indices de carta invalidos')

    const player = this.game.getCurrentPlayer()
    const cardGroups: Card[][] = []
    for (const group of groups) {
      const cards = this.resolveCards(player, group)
      if (!cards) return fail('indices de carta invalidos')
      if (!isValidCanasta(cards)) return fail('conjunto de cartas nao forma uma canastra valida')
      cardGroups.push(cards)
    }

    const all = cardGroups.flat()
    const team = this.game.getTeamOfCurrentPlayer()
    const wasOpening = this.game.needsOpening(team)
    const shortfall = this.openingError(all)
    if (shortfall) return fail(shortfall)
    if (this.game.wouldLeaveOnlyBlockedCard(all)) return fail('voce ficaria so com a carta que pegou do lixo, e ela nao pode voltar para o descarte')
    if (this.game.wouldPlayMeldsEmptyHandIllegally(cardGroups)) {
      return fail('essa jogada esvaziaria a mao sem poder bater')
    }

    const hadMorto = team.hasTakenMorto
    if (!this.game.playMelds(cardGroups)) return fail('jogada invalida')

    this.log.push(
      wasOpening
        ? `${player.name} abriu o jogo da dupla com ${openingPoints(all)} pontos (vulnerável).`
        : `${player.name} baixou ${cardGroups.length} jogo(s)!`
    )
    this.checkMortoTransition(player, hadMorto)
    if (this.checkGameOver()) {
      this.finalizeRoundIfNeeded()
    }
    return ok()
  }

  private handleExtendMeld(seat: number, meldIndex: number, cardIndices: number[]): IntentResult {
    const guardResult = this.guardPlayPhase(seat)
    if (guardResult) return guardResult

    const team = this.game.getTeamOfCurrentPlayer()
    const meld = team.melds[meldIndex]
    if (!meld) return fail('meld inexistente')

    const player = this.game.getCurrentPlayer()
    const cards = this.resolveCards(player, cardIndices)
    if (!cards) return fail('indices de carta invalidos')
    if (cards.length === 0) return fail('nenhuma carta selecionada')
    if (!canExtendMeld(meld.cards, cards)) return fail('extensao invalida')
    if (this.game.wouldLeaveOnlyBlockedCard(cards)) {
      return fail('voce ficaria so com a carta que pegou do lixo, e ela nao pode voltar para o descarte')
    }
    if (this.game.wouldExtendMeldEmptyHandIllegally(meldIndex, cards)) {
      return fail('essa extensao esvaziaria a mao sem poder bater')
    }

    const hadMorto = this.game.getTeamOfCurrentPlayer().hasTakenMorto
    const success = this.game.extendMeld(meldIndex, cards)
    if (!success) return fail('extensao invalida')

    this.log.push(`${player.name} estendeu um jogo do time!`)
    this.checkMortoTransition(player, hadMorto)
    if (this.checkGameOver()) {
      this.finalizeRoundIfNeeded()
    }
    return ok()
  }

  private handleNextRound(): IntentResult {
    if (this.status !== 'finished') return fail('a rodada atual ainda nao terminou')
    if (this.matchWinner) return fail('a partida ja foi encerrada')

    this.game = new Game(buildPlayers(this.seatsConfig))
    this.game.setup()
    this.game.setOpeningMinimums(this.matchScores)
    this.round += 1
    this.turnPhase = 'draw'
    this.roundFinalized = false
    this.log.push(`Rodada ${this.round} iniciada.`)
    this.logVulnerability()
    return ok()
  }

  private resolveCards(player: Player, cardIndices: number[]): Card[] | null {
    const handCards = player.hand.getCards()
    const cards = cardIndices.map(i => handCards[i]).filter((c): c is Card => Boolean(c))
    if (cards.length !== cardIndices.length) return null
    return cards
  }

  private checkMortoTransition(player: Player, hadMortoBefore: boolean): boolean {
    const hasMortoNow = this.game.getTeamOfCurrentPlayer().hasTakenMorto
    if (!hadMortoBefore && hasMortoNow) {
      this.log.push(`${player.name} pegou o morto!`)
    }
    return hasMortoNow
  }

  private checkGameOver(): boolean {
    if (!this.game.isGameOver()) return false
    this.game.finish()
    this.log.push(`Fim de jogo — Time ${this.game.state.winnerTeam} venceu!`)
    return true
  }

  private finalizeRoundIfNeeded(): void {
    if (this.roundFinalized) return
    const result = accumulateMatchRound(this.matchScores, this.matchCanastras, this.game.state.teams, this.matchTarget)
    this.matchScores = result.matchScores
    this.matchCanastras = result.matchCanastras
    this.matchWinner = result.matchWinner
    if (result.matchWinner) {
      this.log.push(`Fim da partida — Time ${result.matchWinner} venceu!`)
    } else {
      this.log.push(`Fim da rodada ${this.round}.`)
    }
    this.roundFinalized = true
  }

  runNextAiTurn(): string[] {
    const start = this.log.length
    if (this.status === 'playing' && this.seatsConfig[this.currentSeat].kind === 'ai') {
      this.runOneAiTurn()
    }
    return this.log.slice(start)
  }

  runAiTurns(): string[] {
    const start = this.log.length
    while (this.status === 'playing' && this.seatsConfig[this.currentSeat].kind === 'ai') {
      this.runOneAiTurn()
    }
    return this.log.slice(start)
  }

  private buildAIState(): GameStateForAI {
    return {
      currentPlayerIndex: this.game.state.currentPlayerIndex,
      players: this.game.state.players,
      deck: this.game.state.deck,
      discardPile: this.game.state.discardPile,
      teams: this.game.state.teams,
    }
  }

  private discardLowestValueCard(player: Player): boolean {
    const cards = player.hand.getCards()
    if (cards.length === 0) return false

    let lowestIndex = -1
    let lowestValue = Infinity
    for (let i = 0; i < cards.length; i++) {
      if (this.game.isDiscardBlockedCard(i)) continue
      const value = scoreCardValue(cards[i])
      if (value < lowestValue) {
        lowestValue = value
        lowestIndex = i
      }
    }
    if (lowestIndex === -1) return false
    return this.game.discard(lowestIndex)
  }

  private runOneAiTurn(): void {
    const player = this.game.getCurrentPlayer() as AIPlayer
    let hadMorto = this.game.getTeamOfCurrentPlayer().hasTakenMorto
    let gameEnded = false
    const mortosBeforeDraw = this.game.state.mortos.length
    const recyclesBeforeDraw = this.game.state.discardRecycles

    const firstMove = player.playTurn(this.buildAIState())
    if (firstMove && firstMove.type === 'take_discard') {
      const pileCards = this.game.takeDiscardPile()
      if (pileCards && pileCards.length > 0) {
        for (const card of pileCards) player.hand.addCard(card)
        this.log.push(`${player.name} pegou a pilha de descarte.`)
      } else {
        const card = this.game.drawFromDeck()
        if (card) {
          player.hand.addCard(card)
          this.log.push(`${player.name} comprou uma carta.`)
        } else {
          this.log.push('O monte acabou.')
        }
      }
    } else {
      const card = this.game.drawFromDeck()
      if (card) {
        player.hand.addCard(card)
        this.log.push(`${player.name} comprou uma carta.`)
      } else {
        this.log.push('O monte acabou.')
      }
    }

    if (this.game.state.mortos.length < mortosBeforeDraw) {
      this.log.push('O monte acabou — o morto virou o novo monte!')
    }
    if (this.game.state.discardRecycles > recyclesBeforeDraw) {
      this.log.push('🔀 O lixo foi embaralhado e virou o novo monte!')
    }
    this.turnPhase = 'play'

    let discarded = false
    if (this.game.needsOpening()) {
      const minimum = this.game.getTeamOfCurrentPlayer().openingMinimum
      for (const plan of player.planOpening(minimum)) {
        if (!this.game.playMelds(plan)) continue
        this.log.push(`${player.name} abriu o jogo da dupla com ${openingPoints(plan.flat())} pontos (vulnerável).`)
        hadMorto = this.checkMortoTransition(player, hadMorto)
        if (this.checkGameOver()) gameEnded = true
        break
      }
    }
    for (let iteration = 0; !gameEnded && iteration < MAX_AI_MELD_ACTIONS_PER_TURN; iteration++) {
      const move = player.playTurn(this.buildAIState())

      if (move && move.type === 'play_canasta' && move.cards) {
        const played = this.game.playCanasta(move.cards)
        if (!played) break
        this.log.push(`${player.name} baixou uma canastra!`)
        hadMorto = this.checkMortoTransition(player, hadMorto)
        if (this.checkGameOver()) {
          gameEnded = true
          break
        }
        continue
      }

      if (move && move.type === 'extend_meld' && move.meldIndex !== undefined && move.cards) {
        const extended = this.game.extendMeld(move.meldIndex, move.cards)
        if (!extended) break
        this.log.push(`${player.name} estendeu um jogo do time!`)
        hadMorto = this.checkMortoTransition(player, hadMorto)
        if (this.checkGameOver()) {
          gameEnded = true
          break
        }
        continue
      }

      if (move && move.type === 'discard' && move.cardIndex !== undefined) {
        discarded = this.game.discard(move.cardIndex)
        if (discarded) {
          this.log.push(`${player.name} descartou uma carta.`)
          hadMorto = this.checkMortoTransition(player, hadMorto)
          if (this.checkGameOver()) {
            gameEnded = true
          }
        }
      }
      break
    }

    if (!gameEnded && !discarded) {
      discarded = this.discardLowestValueCard(player)
      for (let i = 0; !discarded && i < player.hand.getSize(); i++) discarded = this.game.discard(i)
      if (discarded) {
        this.log.push(`${player.name} descartou uma carta.`)
        hadMorto = this.checkMortoTransition(player, hadMorto)
        if (this.checkGameOver()) {
          gameEnded = true
        }
      }
    }

    if (gameEnded) {
      this.finalizeRoundIfNeeded()
    } else {
      this.game.endTurn()
      this.turnPhase = 'draw'
    }
  }

  getViewFor(seat: number): SeatView {
    return this.buildView(seat, true)
  }

  getPublicView(): SeatView {
    return this.buildView(-1, false)
  }

  private buildView(seat: number, includeHand: boolean): SeatView {
    const players = this.seatsConfig.map((cfg, i) => ({
      seat: i,
      name: cfg.name,
      kind: cfg.kind,
      handCount: this.game.state.players[i].hand.getSize(),
      teamId: teamIdOfSeat(i),
      connected: true,
    }))

    const teams = this.game.state.teams.map(team => ({
      id: team.id,
      score: team.score,
      hasTakenMorto: team.hasTakenMorto,
      melds: team.melds.map(mapMeld),
      openingMinimum: team.openingMinimum,
    }))

    return {
      seat,
      yourHand:
        includeHand && seat >= 0 && seat < this.game.state.players.length
          ? this.game.state.players[seat].hand.getCards().map(toPlainCard)
          : [],
      players,
      teams,
      discardPile: this.game.state.discardPile.map(toPlainCard),
      deckCount: this.game.state.deck.length,
      mortos: this.game.state.mortos.map(m => ({ count: m.length })),
      currentSeat: this.game.state.currentPlayerIndex,
      phase: this.turnPhase,
      status: this.status,
      round: this.round,
      matchScores: { ...this.matchScores },
      matchCanastras: { A: { ...this.matchCanastras.A }, B: { ...this.matchCanastras.B } },
      matchWinner: this.matchWinner,
      winnerTeam: this.game.state.winnerTeam,
      scoreBreakdowns: this.game.state.scoreBreakdowns,
      closerSeat: this.game.state.closerSeat,
      log: [...this.log],
      paused: false,
    }
  }
}
