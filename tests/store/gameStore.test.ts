import { useGameStore } from '../../src/store/gameStore'
import { Card } from '../../src/engine/card'

describe('useGameStore', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame()
  })

  test('initGame creates a playing game with 14 cards dealt to each player', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const { game } = useGameStore.getState()

    expect(game).not.toBeNull()
    expect(game!.state.status).toBe('playing')
    expect(game!.state.players).toHaveLength(2)
    expect(game!.state.players[0].hand.getSize()).toBe(14)
    expect(game!.state.players[1].hand.getSize()).toBe(14)
  })

  test('draw adds a card to the current player hand and bumps version', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const versionBefore = useGameStore.getState().version
    const sizeBefore = useGameStore.getState().game!.getCurrentPlayer().hand.getSize()

    useGameStore.getState().draw()

    const state = useGameStore.getState()
    expect(state.game!.getCurrentPlayer().hand.getSize()).toBe(sizeBefore + 1)
    expect(state.version).toBe(versionBefore + 1)
  })

  test('discard removes a card from hand, advances the turn, and bumps version', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const versionBefore = useGameStore.getState().version
    const sizeBefore = useGameStore.getState().game!.state.players[0].hand.getSize()

    useGameStore.getState().discard(0)

    const state = useGameStore.getState()
    expect(state.game!.state.players[0].hand.getSize()).toBe(sizeBefore - 1)
    expect(state.game!.state.discardPile.length).toBe(1)
    expect(state.game!.state.currentPlayerIndex).toBe(1)
    expect(state.version).toBeGreaterThan(versionBefore)
  })

  test('playCanasta with 5H/6H/7H artificially placed in hand removes 3 cards, adds a meld, and increases score', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    const player = game.getCurrentPlayer()
    const sizeBefore = player.hand.getSize()
    const scoreBefore = player.score

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
    expect(currentPlayer.score).toBeGreaterThan(scoreBefore)
    expect(state.game!.state.melds.get(player.name)).toHaveLength(1)
    expect(state.selectedCardIndices).toEqual([])
    expect(state.version).toBeGreaterThan(versionBefore)
  })

  test('playCanasta with an invalid combination does not touch hand, score, or version', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    const player = game.getCurrentPlayer()
    const sizeBefore = player.hand.getSize()
    const scoreBefore = player.score
    const versionBefore = useGameStore.getState().version

    // First 2 cards of a freshly dealt hand are essentially never a valid canasta.
    useGameStore.getState().playCanasta([0, 1])

    const state = useGameStore.getState()
    expect(state.game!.getCurrentPlayer().hand.getSize()).toBe(sizeBefore)
    expect(state.game!.getCurrentPlayer().score).toBe(scoreBefore)
    expect(state.version).toBe(versionBefore)
  })

  test('aiTurn executes a real AI turn and returns control to the human player', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.getState().discard(0) // human's turn -> AI's turn (index 1)
    expect(useGameStore.getState().game!.state.currentPlayerIndex).toBe(1)

    const versionBefore = useGameStore.getState().version
    useGameStore.getState().aiTurn()

    const state = useGameStore.getState()
    expect(state.game!.state.currentPlayerIndex).toBe(0)
    expect(state.version).toBeGreaterThan(versionBefore)
    expect(state.gameLog.some(l => l.includes('Bot'))).toBe(true)
  })

  test('game finishes (status finished) once a player empties their hand via discard', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    const player = game.getCurrentPlayer() // Alice, index 0
    while (player.hand.getSize() > 1) {
      player.hand.removeCard(0)
    }
    expect(player.hand.getSize()).toBe(1)

    useGameStore.getState().discard(0)

    const state = useGameStore.getState()
    expect(player.hand.isEmpty()).toBe(true)
    expect(state.game!.state.status).toBe('finished')
    expect(state.game!.state.winner).toBeDefined()
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
