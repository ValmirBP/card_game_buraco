import { Player, PlayerMove } from './player'
import { Card, createDeck, shuffleInPlace } from './card'
import { Canasta } from './canasta'
import { GameState, Team, TeamId, TeamScoreBreakdown, createGameState, teamOfSeat } from './gameState'
import { isValidCanasta, canExtendMeld, scoreCardValue } from './utils'

export const HAND_SIZE = 11
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
    this.recycleDiscardIfExhausted()
    if (this.state.deck.length === 0) return null
    const card = this.state.deck.pop()!
    this.promoteMortoIfDeckEmpty()
    this.recycleDiscardIfExhausted()
    return card
  }

  /** If the baço is empty and a morto remains on the table, the morto
   * immediately becomes the new baço. */
  private promoteMortoIfDeckEmpty(): void {
    if (this.state.deck.length === 0 && this.state.mortos.length > 0) {
      this.state.deck = this.state.mortos.pop()!
    }
  }

  /** Regra do usuário: a rodada SÓ termina quando alguém bate (0 cartas) —
   * nunca por esgotamento do monte. Quando monte E mortos acabam, o LIXO é
   * embaralhado e vira o novo monte (o descarte esvazia), e o jogo segue
   * até a batida. Só se ATÉ o lixo estiver vazio (raro ao extremo) é que
   * isGameOver aceita encerrar sem batida, como último recurso. */
  private recycleDiscardIfExhausted(): void {
    if (this.state.deck.length > 0 || this.state.mortos.length > 0) return
    if (this.state.discardPile.length === 0) return
    const recycled = [...this.state.discardPile]
    this.state.discardPile = []
    // A carta bloqueada do lixo unitário saiu de cena junto com o lixo.
    this.state.blockedDiscardCard = null
    shuffleInPlace(recycled)
    this.state.deck = recycled
    this.state.discardRecycles++
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
    // Regra do lixo de carta única: se o lixo tinha SÓ esta carta, ela não
    // pode ser devolvida ao descarte neste mesmo turno (senão pegar o lixo
    // vira uma espiada grátis sem custo). Com 2+ cartas não há bloqueio -
    // o jogador ficou com o resto da pilha, pagou o preço.
    this.state.blockedDiscardCard = cards.length === 1 ? cards[0] : null
    return cards
  }

  discard(cardIndex: number): boolean {
    const player = this.getCurrentPlayer()
    if (cardIndex < 0 || cardIndex >= player.hand.getSize()) return false

    // Descarte é o único caminho de esvaziar a mão que faltava essa guarda:
    // playCanasta/extendMeld já recusam a jogada se ela deixaria a mão sem
    // direito de bater (ver wouldEmptyHandIllegally). Sem isso aqui, um
    // jogador podia descartar a última carta e ficar preso com 0 cartas sem
    // ter pego o morto nem ter canastra limpa - e, se o parceiro fechasse uma
    // canastra limpa depois, isGameOver()/finish() creditava +100 de bônus de
    // batida sem ninguém ter batido de fato.
    //
    // minSafeRemaining = 1, NÃO 2: descartar até sobrar 1 carta é jogada
    // normal (no próximo turno o jogador compra e volta a ter 2) - só
    // descartar a ÚLTIMA carta (indo a 0) é que exige direito de bater.
    // Usar o limiar de 2 (o de wouldEmptyHandIllegally, para melds) aqui
    // travaria a dupla em qualquer mão de 2 cartas, incapaz de descartar
    // para sempre - um travamento bem pior que o bug original.
    const team = this.getTeamOfCurrentPlayer()
    if (this.wouldLeaveTeamStuck(player, 1, 1, team, team.melds)) return false

    // Regra do lixo de carta única (ver takeDiscardPile): a carta exata
    // pega de um lixo unitário não pode voltar pro descarte neste turno.
    if (this.isDiscardBlockedCard(cardIndex)) return false

    const card = player.hand.removeCard(cardIndex)
    if (!card) return false
    this.markMortoUsedIfApplicable(team)
    this.state.discardPile.push(card)
    this.maybeAutoPickUpMorto()
    return true
  }

  /**
   * UI helper + guarda interna do discard(): a carta neste índice da mão é
   * a carta bloqueada do turno (pega de um lixo que tinha só ela)?
   * Comparação por REFERÊNCIA - a cópia-gêmea do baralho duplo que já
   * estava na mão continua liberada.
   */
  isDiscardBlockedCard(cardIndex: number): boolean {
    const blocked = this.state.blockedDiscardCard
    if (!blocked) return false
    return this.getCurrentPlayer().hand.getCards()[cardIndex] === blocked
  }

  /**
   * Regra do "morto não usado": marca o morto do time como usado quando o
   * jogador que o pegou completa QUALQUER jogada (baixar/estender/descartar)
   * com a mão nova. Chamado ANTES de maybeAutoPickUpMorto em cada ação, de
   * propósito: a jogada que ESVAZIOU a mão e disparou a pega automática usou
   * a mão antiga, não o morto - nesse momento hasTakenMorto ainda é false e
   * nada é marcado.
   */
  private markMortoUsedIfApplicable(team: Team): void {
    if (team.hasTakenMorto && team.mortoTakenBySeat === this.state.currentPlayerIndex) {
      team.mortoUsed = true
    }
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
    // A lista precisa ser a mesa RESULTANTE, não só o jogo novo: canCloseWithMelds
    // só enxerga o que recebe, então passar [canasta] escondia a canastra limpa
    // que o time já tinha baixado e recusava a batida. extendMeld (abaixo) e o
    // helper wouldPlayCanastaEmptyHandIllegally sempre passaram a lista inteira.
    if (this.wouldEmptyHandIllegally(player, cards.length, team, [...team.melds, canasta])) return false

    for (const idx of indicesToRemove) {
      player.hand.removeCard(idx)
    }

    this.markMortoUsedIfApplicable(team)
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

    this.markMortoUsedIfApplicable(team)
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
    // Regra do "morto não usado" (ver finish/markMortoUsedIfApplicable):
    // registra QUEM pegou e que ele ainda não jogou com a mão nova.
    team.mortoTakenBySeat = this.state.currentPlayerIndex
    team.mortoUsed = false
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
   * Shared "would this leave the team stuck" predicate behind both
   * wouldEmptyHandIllegally (melds/extends) and discard()'s own guard.
   * `minSafeRemaining` is deliberately DIFFERENT for the two callers - see
   * their respective doc comments for why 1 card left is fine for a discard
   * but not for a meld:
   *
   * A play is only even in question when it would leave FEWER than
   * `minSafeRemaining` cards. Then it's legal only if the team can EITHER
   * take the morto (hasn't taken one yet AND one is still on the table) OR
   * close/bater (canClose, evaluated against `resultingMelds` - the team's
   * meld set AFTER this play, since a canastra just completed by this very
   * play must count).
   */
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

  /**
   * The Buraco rule this enforces: a player may only meld/extend down to 0
   * or 1 cards left in hand if, immediately after, their team has morto or
   * closing rights (see wouldLeaveTeamStuck). Requires 2+ cards left
   * (`minSafeRemaining = 2`), NOT just "would leave 0": every turn MUST end
   * with exactly one discard (endTurn only runs after a successful discard()
   * - see gameStore.ts), with no further draw in between. So a meld that
   * leaves exactly 1 card commits the player to discarding that very card
   * next, in the SAME turn, which would empty the hand with no closing
   * rights one step later - and by then extending is already refused (this
   * same check) and discarding would be refused too (discard()'s own guard,
   * a laxer minSafeRemaining=1 - see there), leaving no legal move at all.
   * Blocking the meld a step earlier avoids that dead end.
   *
   * Returns false (legal) whenever this particular play would leave 2+ cards
   * in hand - plenty of room, no risk of getting stuck.
   */
  wouldEmptyHandIllegally(
    player: Player,
    cardsToRemoveCount: number,
    team: Team,
    resultingMelds: Canasta[]
  ): boolean {
    return this.wouldLeaveTeamStuck(player, cardsToRemoveCount, 2, team, resultingMelds)
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

  /**
   * UI helper: would discarding the card at `cardIndex` be refused because it
   * empties the hand illegally (down to 0 cards, no morto/close rights)?
   * Mirrors the guard discard() itself runs, without mutating anything.
   */
  wouldDiscardEmptyHandIllegally(cardIndex: number): boolean {
    const player = this.getCurrentPlayer()
    if (cardIndex < 0 || cardIndex >= player.hand.getSize()) return false
    const team = this.getTeamOfCurrentPlayer()
    return this.wouldLeaveTeamStuck(player, 1, 1, team, team.melds)
  }

  endTurn(): void {
    // O bloqueio da carta pega de um lixo unitário vale só pelo turno em
    // que ela foi pega (ver takeDiscardPile/discard).
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

  /**
   * A round is over once status is 'playing' AND either:
   *  - a team has "batido" (a player's hand is empty AND their team
   *    canClose - has taken the morto and has a clean 7+ card canastra), or
   *  - NADA sobrou pra comprar em lugar NENHUM: monte, mortos E lixo todos
   *    vazios (fallback de emergência, raríssimo). Esgotar só o monte+mortos
   *    NÃO termina mais a rodada — o lixo é embaralhado e vira o novo monte
   *    (regra do usuário: "o jogo somente finaliza quando o jogador tem 0
   *    cartas"; ver recycleDiscardIfExhausted). Era exatamente isso que
   *    fazia rodadas "terminarem do nada" com cartas na mão.
   */
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

    return someoneClosed || nothingLeftAnywhere
  }

  /**
   * Finalizes the round and computes a per-team score breakdown
   * (state.scoreBreakdowns) with 4 components:
   *  - meldPoints: sum of canasta.getScore() across the team's current
   *    melds, recomputed fresh from `team.melds` (NOT read off the
   *    incrementally-accumulated `team.score`) so this can never double-count
   *    whatever score bookkeeping happened during play.
   *  - batidaBonus: +100 if this team closed the round (a player emptied
   *    their hand while canClose held for their team), else 0.
   *  - mortoPenalty: -100 if the team never took a morto AND a morto is
   *    still on the table (state.mortos.length > 0) - i.e. taking one was
   *    still possible but they didn't. If both mortos already became the
   *    new baço (mortos.length === 0, see drawFromDeck/promoteMortoIfDeckEmpty),
   *    nobody could take one anymore, so nobody is penalized for it.
   *  - handPenalty: negative sum of scoreCardValue (jokers=20) across BOTH
   *    partners' remaining hand cards.
   * team.score is set to the sum of these 4 components (meldPoints +
   * batidaBonus + mortoPenalty + handPenalty), so `team.score` and the
   * corresponding breakdown's `total` always agree. winnerTeam is set to
   * whichever team ends with the higher score. Idempotent - calling finish()
   * again after the round is already 'finished' is a no-op (scoreBreakdowns
   * and team.score are left untouched from the first call).
   */
  finish(): void {
    if (this.state.status === 'finished') return
    this.state.status = 'finished'

    let closerTeamId: TeamId | null = null
    this.state.players.forEach((p, seat) => {
      if (p.hand.isEmpty() && this.canClose(teamOfSeat(this.state, seat))) {
        closerTeamId = teamOfSeat(this.state, seat).id
        // Registrado pro banner "Fulano bateu!" da UI (ver GameState.closerSeat).
        this.state.closerSeat = seat
      }
    })

    const breakdowns: TeamScoreBreakdown[] = this.state.teams.map(team => {
      const meldPoints = team.melds.reduce((sum, m) => sum + m.getScore(), 0)
      const batidaBonus = closerTeamId === team.id ? 100 : 0

      // Duas formas de levar os -100 do morto:
      //  a) nunca pegou um morto que ainda estava disponível na mesa, ou
      //  b) pegou o morto mas o jogador que o pegou NUNCA jogou com a mão
      //     nova (regra do usuário: "perde os 100 pontos do morto, e não os
      //     pontos que estão na mão") - nesse caso as cartas na mão DESSE
      //     jogador ficam fora da penalidade de mão (counted=false abaixo).
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
