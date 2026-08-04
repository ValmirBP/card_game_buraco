import { AIPlayer, GameStateForAI } from '../../src/engine/ai'
import { Card, createDeck } from '../../src/engine/card'

function makeGameState(ai: AIPlayer, overrides: Partial<GameStateForAI> = {}): GameStateForAI {
  return {
    currentPlayerIndex: 0,
    players: [ai],
    deck: createDeck(),
    discardPile: [],
    melds: new Map(),
    ...overrides,
  }
}

describe('AIPlayer', () => {
  test('creates AI with difficulty level', () => {
    const ai = new AIPlayer('Bot', 'easy')
    expect(ai.name).toBe('Bot')
    expect(ai.difficulty).toBe('easy')
  })

  test('easy AI returns random valid move', () => {
    const ai = new AIPlayer('Bot', 'easy', [new Card('hearts', '5', false)])
    const gameState = makeGameState(ai)
    const move = ai.playTurn(gameState)
    expect(['draw', 'discard', 'play_canasta']).toContain(move.type)
  })

  test('easy AI never returns a discard move with an out-of-range cardIndex', () => {
    const ai = new AIPlayer('Bot', 'easy', [
      new Card('hearts', '5', false),
      new Card('clubs', '9', false),
    ])
    const gameState = makeGameState(ai)
    for (let i = 0; i < 20; i++) {
      const move = ai.playTurn(gameState)
      if (move.type === 'discard') {
        expect(move.cardIndex).toBeGreaterThanOrEqual(0)
        expect(move.cardIndex).toBeLessThan(ai.hand.getSize())
      }
    }
  })

  test('medium AI prefers playing canastas when one is available', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '7', false),
    ]
    const ai = new AIPlayer('Bot', 'medium', cards)
    const gameState = makeGameState(ai)
    const move = ai.playTurn(gameState)
    expect(move.type).toBe('play_canasta')
  })

  test('medium AI with 5H6H7H plus unrelated cards returns play_canasta with exactly those 3 cards', () => {
    const cards = [
      new Card('clubs', 'K', false),
      new Card('hearts', '5', false),
      new Card('diamonds', '9', false),
      new Card('hearts', '6', false),
      new Card('spades', '3', false),
      new Card('hearts', '7', false),
    ]
    const ai = new AIPlayer('Bot', 'medium', cards)
    const gameState = makeGameState(ai)
    const move = ai.playTurn(gameState)

    expect(move.type).toBe('play_canasta')
    expect(move.cards).toBeDefined()
    const ranks = move.cards!.map(c => c.toString()).sort()
    expect(ranks).toEqual(['5H', '6H', '7H'])
  })

  test('medium AI discards a safe low card when no canasta is available', () => {
    const cards = [
      new Card('hearts', '3', false),
      new Card('clubs', 'K', false),
      new Card('spades', 'A', false),
    ]
    const ai = new AIPlayer('Bot', 'medium', cards)
    const gameState = makeGameState(ai)
    const move = ai.playTurn(gameState)
    if (move.type === 'discard') {
      const card = ai.hand.getCards()[move.cardIndex!]
      expect(['2', '3', '4', '5']).toContain(card.rank)
    }
  })

  test('hard AI is deterministic for the same game state', () => {
    const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false)]
    const ai = new AIPlayer('Bot', 'hard', cards)
    const gameState = makeGameState(ai)
    const move1 = ai.playTurn(gameState)
    const move2 = ai.playTurn(gameState)
    expect(move1.type).toBe(move2.type)
    expect(move1.cardIndex).toBe(move2.cardIndex)
  })

  test('hard AI plays a canasta when one is available', () => {
    const cards = [
      new Card('spades', '4', false),
      new Card('spades', '5', false),
      new Card('spades', '6', false),
    ]
    const ai = new AIPlayer('Bot', 'hard', cards)
    const gameState = makeGameState(ai)
    const move = ai.playTurn(gameState)
    expect(move.type).toBe('play_canasta')
  })

  test('hard AI tracks discarded cards across turns', () => {
    const ai = new AIPlayer('Bot', 'hard', [new Card('hearts', '5', false)])
    const discarded = new Card('clubs', '9', false)
    const gameState = makeGameState(ai, { discardPile: [discarded] })
    ai.playTurn(gameState)
    expect(ai.getDiscardedCards().has(discarded.toString())).toBe(true)
  })

  test('addCanasta pushes canasta and increases score', () => {
    const ai = new AIPlayer('Bot', 'easy')
    const cards = [
      new Card('diamonds', '8', false),
      new Card('diamonds', '9', false),
      new Card('diamonds', '10', false),
    ]
    const { Canasta } = require('../../src/engine/canasta')
    const canasta = new Canasta(cards)
    ai.addCanasta(canasta)
    expect(ai.canastas.length).toBe(1)
    expect(ai.score).toBeGreaterThan(0)
  })

  test('clone copies hand, score, canastas and difficulty', () => {
    const ai = new AIPlayer('Bot', 'hard', [new Card('hearts', '5', false)])
    ai.score = 42
    const clone = ai.clone()
    expect(clone.name).toBe('Bot')
    expect(clone.difficulty).toBe('hard')
    expect(clone.score).toBe(42)
    expect(clone.hand.getSize()).toBe(1)
  })
})
