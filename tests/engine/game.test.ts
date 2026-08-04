import { Game } from '../../src/engine/game'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer } from '../../src/engine/ai'
import { Card } from '../../src/engine/card'

describe('Game', () => {
  test('creates game with 2 players', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    expect(game.state.players.length).toBe(2)
  })

  test('throws error with invalid player count', () => {
    const p1 = new HumanPlayer('Alice')
    expect(() => new Game([p1])).toThrow()
  })

  test('setup deals 14 cards to each player', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    game.setup()
    expect(p1.hand.getSize()).toBe(14)
    expect(p2.hand.getSize()).toBe(14)
    expect(game.state.status).toBe('playing')
  })

  test('draw returns a card from deck', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    game.setup()
    const deckSize = game.state.deck.length
    const card = game.draw()
    expect(card).not.toBeNull()
    expect(game.state.deck.length).toBe(deckSize - 1)
  })

  test('discard removes card from hand', () => {
    const p1 = new HumanPlayer('Alice', [new Card('hearts', '5', false)])
    const p2 = new AIPlayer('Bot', 'easy', [new Card('diamonds', '6', false)])
    const game = new Game([p1, p2])
    const success = game.discard(0)
    expect(success).toBe(true)
    expect(p1.hand.getSize()).toBe(0)
    expect(game.state.discardPile.length).toBe(1)
  })

  test('endTurn cycles to next player', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    expect(game.state.currentPlayerIndex).toBe(0)
    game.endTurn()
    expect(game.state.currentPlayerIndex).toBe(1)
    game.endTurn()
    expect(game.state.currentPlayerIndex).toBe(0)
  })

  test('getCurrentPlayer returns active player', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    expect(game.getCurrentPlayer().name).toBe('Alice')
  })

  test('getValidMoves includes draw and a discard move per card in hand', () => {
    const p1 = new HumanPlayer('Alice', [new Card('hearts', '5', false), new Card('clubs', '9', false)])
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    const moves = game.getValidMoves()
    expect(moves.some(m => m.type === 'draw')).toBe(true)
    expect(moves.filter(m => m.type === 'discard').length).toBe(2)
  })

  // NOTE: deviation from the plan. The plan's original test constructed a
  // player with an empty hand and asserted isGameOver() === true *before*
  // calling setup(). But isGameOver() also treats an empty deck as "game
  // over", and before setup() the deck is always empty (deck is only filled
  // by setup()) — so that test passed for the wrong reason and could not
  // distinguish "empty hand" from "empty deck". It also meant isGameOver()
  // was true during the 'setup' status, which is not meaningful.
  //
  // Fixed contract: isGameOver() returns true only when status === 'playing'
  // AND (some player's hand is empty OR the deck is empty). The tests below
  // set up the game first, then explicitly drive each condition.
  describe('isGameOver', () => {
    test('returns false before setup even if a player hand is empty', () => {
      const p1 = new HumanPlayer('Alice')
      const p2 = new AIPlayer('Bot', 'easy', [new Card('diamonds', '6', false)])
      const game = new Game([p1, p2])
      expect(game.state.status).toBe('setup')
      expect(game.isGameOver()).toBe(false)
    })

    test('returns false right after setup', () => {
      const p1 = new HumanPlayer('Alice')
      const p2 = new AIPlayer('Bot', 'easy')
      const game = new Game([p1, p2])
      game.setup()
      expect(game.isGameOver()).toBe(false)
    })

    test('returns true when a player hand becomes empty during play', () => {
      const p1 = new HumanPlayer('Alice')
      const p2 = new AIPlayer('Bot', 'easy')
      const game = new Game([p1, p2])
      game.setup()
      while (!p1.hand.isEmpty()) {
        p1.hand.removeCard(0)
      }
      expect(game.isGameOver()).toBe(true)
    })

    test('returns true when the deck becomes empty during play', () => {
      const p1 = new HumanPlayer('Alice')
      const p2 = new AIPlayer('Bot', 'easy')
      const game = new Game([p1, p2])
      game.setup()
      while (game.draw() !== null) {
        // drain the deck
      }
      expect(game.state.deck.length).toBe(0)
      expect(game.isGameOver()).toBe(true)
    })
  })

  test('finish sets status to finished and picks the highest-score player as winner', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    game.setup()
    p2.score = 500
    game.finish()
    expect(game.state.status).toBe('finished')
    expect(game.state.winner).toBe(p2)
  })

  test('getGameState returns the current state', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    expect(game.getGameState()).toBe(game.state)
  })

  test('clone produces an independent game with equivalent state', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    game.setup()
    const clone = game.clone()

    expect(clone).not.toBe(game)
    expect(clone.state.players[0].hand.getSize()).toBe(game.state.players[0].hand.getSize())
    expect(clone.state.deck.length).toBe(game.state.deck.length)

    // Mutating the clone's deck must not affect the original
    clone.state.deck.pop()
    expect(clone.state.deck.length).not.toBe(game.state.deck.length)
  })

  // NOTE: deviation from the plan. The plan's playCanasta() only pushed the
  // Canasta into state.melds; it never removed the played cards from the
  // player's hand and never called player.addCanasta(), so the player's
  // score never increased. Fixed contract: playCanasta() validates the
  // cards, builds the Canasta, adds it to the current player's meld entry,
  // removes exactly those cards from the current player's hand, and calls
  // player.addCanasta(canasta) so the score is credited exactly once.
  describe('playCanasta', () => {
    test('valid canasta removes the cards from hand, adds to melds, and increases score', () => {
      const canastaCards = [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
      ]
      const keeper = new Card('clubs', 'K', false)
      const p1 = new HumanPlayer('Alice', [...canastaCards, keeper])
      const p2 = new AIPlayer('Bot', 'easy')
      const game = new Game([p1, p2])

      expect(p1.score).toBe(0)

      const success = game.playCanasta(canastaCards)

      expect(success).toBe(true)

      // Hand loses exactly the played cards
      expect(p1.hand.getSize()).toBe(1)
      expect(p1.hand.getCards()[0].equals(keeper)).toBe(true)

      // Meld gains the canasta
      const melds = game.state.melds.get('Alice')
      expect(melds).toHaveLength(1)
      expect(melds![0].cards).toHaveLength(3)

      // Score increases exactly once (addCanasta also pushes into player.canastas)
      expect(p1.canastas).toHaveLength(1)
      expect(p1.score).toBe(melds![0].getScore())
    })

    test('returns false and has no side effects for invalid cards', () => {
      const invalidCards = [new Card('hearts', '5', false), new Card('diamonds', '6', false)]
      const p1 = new HumanPlayer('Alice', [...invalidCards])
      const p2 = new AIPlayer('Bot', 'easy')
      const game = new Game([p1, p2])

      const success = game.playCanasta(invalidCards)

      expect(success).toBe(false)
      expect(p1.hand.getSize()).toBe(2)
      expect(game.state.melds.get('Alice')).toEqual([])
      expect(p1.score).toBe(0)
      expect(p1.canastas).toHaveLength(0)
    })
  })
})
