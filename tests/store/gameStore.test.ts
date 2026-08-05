import { useGameStore } from '../../src/store/gameStore'
import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame()
  })

  test('initGame creates a playing game with 4 players and 2 teams, 11 cards each', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const { game } = useGameStore.getState()

    expect(game).not.toBeNull()
    expect(game!.state.status).toBe('playing')
    expect(game!.state.players).toHaveLength(4)
    game!.state.players.forEach(p => {
      expect(p.hand.getSize()).toBe(11)
    })

    expect(game!.state.teams).toHaveLength(2)
    const teamA = game!.state.teams.find(t => t.id === 'A')!
    const teamB = game!.state.teams.find(t => t.id === 'B')!
    expect(teamA.seats).toEqual([0, 2])
    expect(teamB.seats).toEqual([1, 3])
    expect(game!.state.players[0].name).toBe('Alice')

    expect(game!.state.mortos).toHaveLength(2)
    // Descarte começa vazio: 108 − 44 (mãos) − 22 (mortos) = 42 no baço.
    expect(game!.state.discardPile).toHaveLength(0)
    expect(game!.state.deck.length).toBe(108 - 4 * 11 - 2 * 11)
  })

  test('initGame accepts optional bot names and assigns them to the right seats', () => {
    useGameStore.getState().initGame('Alice', 'easy', {
      partner: 'Bia',
      opponent1: 'Carlos',
      opponent2: 'Duda',
    })
    const { game, gameLog } = useGameStore.getState()

    expect(game!.state.players[0].name).toBe('Alice')
    expect(game!.state.players[1].name).toBe('Carlos')
    expect(game!.state.players[2].name).toBe('Bia')
    expect(game!.state.players[3].name).toBe('Duda')
    expect(gameLog.some(l => l.includes('Bia') && l.includes('Carlos') && l.includes('Duda'))).toBe(true)
  })

  test('initGame without names falls back to the default bot names (backward compatible)', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const { game } = useGameStore.getState()

    expect(game!.state.players[1].name).toBe('Adversário 1')
    expect(game!.state.players[2].name).toBe('Parceiro')
    expect(game!.state.players[3].name).toBe('Adversário 2')
  })

  test('drawFromDeck adds a card to the current player hand and bumps version', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const versionBefore = useGameStore.getState().version
    const sizeBefore = useGameStore.getState().game!.getCurrentPlayer().hand.getSize()

    useGameStore.getState().drawFromDeck()

    const state = useGameStore.getState()
    expect(state.game!.getCurrentPlayer().hand.getSize()).toBe(sizeBefore + 1)
    expect(state.version).toBe(versionBefore + 1)
  })

  test('takeDiscardPile moves the whole discard pile into the current player hand', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    // O descarte agora começa vazio — semeia 3 cartas para o teste.
    game.state.discardPile.push(
      new Card('hearts', '5', false),
      new Card('spades', '9', false),
      new Card('clubs', 'K', false)
    )
    const sizeBefore = game.getCurrentPlayer().hand.getSize()
    const pileSize = game.state.discardPile.length
    expect(pileSize).toBe(3)

    const versionBefore = useGameStore.getState().version
    useGameStore.getState().takeDiscardPile()

    const state = useGameStore.getState()
    expect(state.game!.getCurrentPlayer().hand.getSize()).toBe(sizeBefore + pileSize)
    expect(state.game!.state.discardPile.length).toBe(0)
    expect(state.version).toBe(versionBefore + 1)
  })

  test('discard removes a card from hand, advances the turn to seat 1, and bumps version', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const versionBefore = useGameStore.getState().version
    const sizeBefore = useGameStore.getState().game!.state.players[0].hand.getSize()
    const pileBefore = useGameStore.getState().game!.state.discardPile.length

    useGameStore.getState().discard(0)

    const state = useGameStore.getState()
    expect(state.game!.state.players[0].hand.getSize()).toBe(sizeBefore - 1)
    expect(state.game!.state.discardPile.length).toBe(pileBefore + 1)
    expect(state.game!.state.currentPlayerIndex).toBe(1)
    expect(state.version).toBeGreaterThan(versionBefore)
  })

  test('playCanasta with 5H/6H/7H artificially placed in hand removes 3 cards, credits the team meld/score', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    const player = game.getCurrentPlayer()
    const teamA = game.state.teams.find(t => t.id === 'A')!
    const sizeBefore = player.hand.getSize()
    const teamScoreBefore = teamA.score

    const c5 = new Card('hearts', '5', false)
    const c6 = new Card('hearts', '6', false)
    const c7 = new Card('hearts', '7', false)
    player.hand.addCard(c5)
    player.hand.addCard(c6)
    player.hand.addCard(c7)

    const versionBefore = useGameStore.getState().version
    useGameStore.getState().playCanasta([sizeBefore, sizeBefore + 1, sizeBefore + 2])

    const state = useGameStore.getState()
    const currentPlayer = state.game!.getCurrentPlayer()
    expect(currentPlayer.hand.getSize()).toBe(sizeBefore)
    expect(teamA.score).toBeGreaterThan(teamScoreBefore)
    expect(teamA.melds).toHaveLength(1)
    expect(state.selectedCardIndices).toEqual([])
    expect(state.version).toBeGreaterThan(versionBefore)
  })

  test('playCanasta with an invalid combination does not touch hand, team score, or version', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    const player = game.getCurrentPlayer()
    const teamA = game.state.teams.find(t => t.id === 'A')!
    const sizeBefore = player.hand.getSize()
    const teamScoreBefore = teamA.score
    const versionBefore = useGameStore.getState().version

    // First 2 cards of a freshly dealt hand are essentially never a valid canasta.
    useGameStore.getState().playCanasta([0, 1])

    const state = useGameStore.getState()
    expect(state.game!.getCurrentPlayer().hand.getSize()).toBe(sizeBefore)
    expect(teamA.score).toBe(teamScoreBefore)
    expect(state.version).toBe(versionBefore)
  })

  test('extendMeld adds cards from hand to an existing team meld and updates score', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    const player = game.getCurrentPlayer()
    const teamA = game.state.teams.find(t => t.id === 'A')!

    const c5 = new Card('hearts', '5', false)
    const c6 = new Card('hearts', '6', false)
    const c7 = new Card('hearts', '7', false)
    player.hand.addCard(c5)
    player.hand.addCard(c6)
    player.hand.addCard(c7)
    const sizeAfterAdd = player.hand.getSize()
    useGameStore
      .getState()
      .playCanasta([sizeAfterAdd - 3, sizeAfterAdd - 2, sizeAfterAdd - 1])

    const scoreAfterMeld = teamA.score
    const sizeAfterMeld = player.hand.getSize()

    const c8 = new Card('hearts', '8', false)
    player.hand.addCard(c8)
    const versionBefore = useGameStore.getState().version

    useGameStore.getState().extendMeld(0, [sizeAfterMeld])

    const state = useGameStore.getState()
    expect(state.game!.getCurrentPlayer().hand.getSize()).toBe(sizeAfterMeld)
    expect(teamA.score).toBeGreaterThan(scoreAfterMeld)
    expect(teamA.melds[0].cards).toHaveLength(4)
    expect(state.version).toBeGreaterThan(versionBefore)
  })

  test('aiTurn runs one AI seat and advances currentPlayerIndex, logging the AI name', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.getState().discard(0) // human's turn -> seat 1 (AI, "Adversário 1")
    expect(useGameStore.getState().game!.state.currentPlayerIndex).toBe(1)

    const versionBefore = useGameStore.getState().version
    useGameStore.getState().aiTurn()

    const state = useGameStore.getState()
    expect(state.game!.state.currentPlayerIndex).toBe(2)
    expect(state.version).toBeGreaterThan(versionBefore)
    expect(state.gameLog.some(l => l.includes('Adversário 1'))).toBe(true)
  })

  test('aiTurn does not get stuck when the engine rejects a hand-emptying meld (team already took morto, no clean canastra): falls back to discard and ends the turn', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.getState().discard(0) // human's turn -> seat 1 (AI, "Adversário 1")
    const game = useGameStore.getState().game!
    expect(game.state.currentPlayerIndex).toBe(1)

    const aiPlayer = game.getCurrentPlayer()
    const teamB = game.getTeamOfCurrentPlayer()
    teamB.hasTakenMorto = true // already took the morto
    game.state.mortos = [] // none left to auto-pick-up
    teamB.melds = [] // no clean canastra

    // Force the AI's hand down to exactly one valid (non-canastra) trio, so
    // any meld strategy that proposes playing it would empty the hand -
    // exactly the confirmed-bug scenario the engine now refuses.
    while (!aiPlayer.hand.isEmpty()) {
      aiPlayer.hand.removeCard(0)
    }
    aiPlayer.hand.addCard(new Card('hearts', '5', false))
    aiPlayer.hand.addCard(new Card('hearts', '6', false))
    aiPlayer.hand.addCard(new Card('hearts', '7', false))

    useGameStore.getState().aiTurn()

    const state = useGameStore.getState()
    // The turn must have progressed to the next seat (2) rather than
    // stalling on seat 1 with an empty/unplayable hand.
    expect(state.game!.state.currentPlayerIndex).toBe(2)
    expect(teamB.hasTakenMorto).toBe(true)
  })

  test('aiTurn no-ops when called on the human seat', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    expect(useGameStore.getState().game!.state.currentPlayerIndex).toBe(0)

    const versionBefore = useGameStore.getState().version
    useGameStore.getState().aiTurn()

    const state = useGameStore.getState()
    expect(state.game!.state.currentPlayerIndex).toBe(0)
    expect(state.version).toBe(versionBefore)
  })

  test('picking up the morto keeps the round going, and logs the pickup', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    const player = game.getCurrentPlayer() // Alice, seat 0, team A
    while (player.hand.getSize() > 1) {
      player.hand.removeCard(0)
    }
    expect(player.hand.getSize()).toBe(1)
    expect(game.state.mortos.length).toBe(2)

    useGameStore.getState().discard(0)

    const state = useGameStore.getState()
    // Team A took the morto automatically, so the hand refills instead of
    // ending the round.
    expect(state.game!.state.teams.find(t => t.id === 'A')!.hasTakenMorto).toBe(true)
    expect(player.hand.getSize()).toBe(11)
    expect(state.game!.state.status).toBe('playing')
    expect(state.gameLog.some(l => l.toLowerCase().includes('pegou o morto'))).toBe(true)
  })

  test('game finishes (status finished) once a player empties their hand a second time, having already taken the morto', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    const player = game.getCurrentPlayer() // Alice, seat 0, team A

    // Manually mark the team as having already taken the morto, give it a
    // clean canastra (7+ cards, no wilds — now required to close), and empty
    // deck/mortos so the second empty-hand triggers the round end rather than
    // another auto pickup.
    const teamA = game.state.teams.find(t => t.id === 'A')!
    teamA.hasTakenMorto = true
    teamA.melds.push(
      new Canasta([
        new Card('hearts', '4', false),
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
        new Card('hearts', '8', false),
        new Card('hearts', '9', false),
        new Card('hearts', '10', false),
      ])
    )
    game.state.mortos = []

    while (player.hand.getSize() > 1) {
      player.hand.removeCard(0)
    }
    expect(player.hand.getSize()).toBe(1)

    useGameStore.getState().discard(0)

    const state = useGameStore.getState()
    expect(player.hand.isEmpty()).toBe(true)
    expect(state.game!.state.status).toBe('finished')
    expect(state.game!.state.winnerTeam).toBeDefined()
    expect(state.gameLog.some(l => l.toLowerCase().includes('fim de jogo'))).toBe(true)
  })

  test('game finishes once the deck (baço) runs out', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    // A morto still on the table becomes the new baço when the deck runs
    // out (see Game.drawFromDeck), so exhaustion requires both to be empty.
    game.state.deck = []
    game.state.mortos = []

    useGameStore.getState().discard(0)

    const state = useGameStore.getState()
    expect(state.game!.state.status).toBe('finished')
    expect(state.game!.state.winnerTeam).toBeDefined()
    expect(state.gameLog.some(l => l.toLowerCase().includes('fim de jogo'))).toBe(true)
  })

  test('toggleCardSelection adds and removes indices; clearSelection empties it', () => {
    useGameStore.getState().initGame('Alice', 'easy')

    useGameStore.getState().toggleCardSelection(2)
    useGameStore.getState().toggleCardSelection(5)
    expect(useGameStore.getState().selectedCardIndices).toEqual([2, 5])

    useGameStore.getState().toggleCardSelection(2)
    expect(useGameStore.getState().selectedCardIndices).toEqual([5])

    useGameStore.getState().clearSelection()
    expect(useGameStore.getState().selectedCardIndices).toEqual([])
  })

  test('resetGame clears the store back to its initial state', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.getState().toggleCardSelection(1)

    useGameStore.getState().resetGame()

    const state = useGameStore.getState()
    expect(state.game).toBeNull()
    expect(state.selectedCardIndices).toEqual([])
    expect(state.gameLog).toEqual([])
  })
})
