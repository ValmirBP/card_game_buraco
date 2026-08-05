import { AIPlayer, GameStateForAI } from '../../src/engine/ai'
import { Card, createDeck } from '../../src/engine/card'
import { Team } from '../../src/engine/gameState'

function makeTeams(): Team[] {
  return [
    { id: 'A', seats: [0, 2], melds: [], score: 0, hasTakenMorto: false },
    { id: 'B', seats: [1, 3], melds: [], score: 0, hasTakenMorto: false },
  ]
}

function makeGameState(
  ai: AIPlayer,
  overrides: Partial<GameStateForAI> = {},
  seatIndex = 0
): GameStateForAI {
  const players = [ai]
  players[seatIndex] = ai
  return {
    currentPlayerIndex: seatIndex,
    players,
    deck: createDeck(),
    discardPile: [],
    teams: makeTeams(),
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
    expect(['draw', 'discard', 'play_canasta', 'take_discard', 'extend_meld']).toContain(move.type)
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

  test('finds an ace-trio canasta move when hand has 3+ aces', () => {
    const cards = [
      new Card('hearts', 'A', false),
      new Card('diamonds', 'A', false),
      new Card('clubs', 'A', false),
    ]
    const ai = new AIPlayer('Bot', 'medium', cards)
    const gameState = makeGameState(ai)
    const move = ai.playTurn(gameState)
    expect(move.type).toBe('play_canasta')
    expect(move.cards).toHaveLength(3)
  })

  test('finds an ace-high sequence canasta move (Q,K,A)', () => {
    const cards = [
      new Card('hearts', 'Q', false),
      new Card('hearts', 'K', false),
      new Card('hearts', 'A', false),
    ]
    const ai = new AIPlayer('Bot', 'medium', cards)
    const gameState = makeGameState(ai)
    const move = ai.playTurn(gameState)
    expect(move.type).toBe('play_canasta')
    const ranks = move.cards!.map(c => c.rank).sort()
    expect(ranks).toEqual(['A', 'K', 'Q'])
  })

  test('medium AI extends an existing team meld when it can, instead of just discarding', () => {
    const ai = new AIPlayer('Bot', 'medium', [
      new Card('hearts', '8', false),
      new Card('clubs', 'K', false),
    ])
    const { Canasta } = require('../../src/engine/canasta')
    const existingMeld = new Canasta([
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '7', false),
    ])
    const teams = makeTeams()
    teams[0].melds = [existingMeld]
    const gameState = makeGameState(ai, { teams })
    const move = ai.playTurn(gameState)
    expect(move.type).toBe('extend_meld')
    expect(move.meldIndex).toBe(0)
  })

  test('never returns an invalid move regardless of difficulty', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const cards = [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('spades', 'K', false),
        new Card('diamonds', '9', false),
      ]
      const ai = new AIPlayer('Bot', difficulty, cards)
      const gameState = makeGameState(ai)
      const move = ai.playTurn(gameState)
      expect(move).toBeDefined()
      if (move.type === 'play_canasta') {
        const { isValidCanasta } = require('../../src/engine/utils')
        expect(isValidCanasta(move.cards!)).toBe(true)
      }
    }
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

  describe('Part C: compra da mesa (take_discard)', () => {
    test('getValidMoves includes take_discard when the top of the pile extends a team meld', () => {
      const ai = new AIPlayer('Bot', 'medium', [new Card('clubs', 'K', false)])
      const { Canasta } = require('../../src/engine/canasta')
      const existingMeld = new Canasta([
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
      ])
      const teams = makeTeams()
      teams[0].melds = [existingMeld]
      const gameState = makeGameState(ai, { teams, discardPile: [new Card('hearts', '8', false)] })
      const moves = ai.getValidMoves(gameState)
      expect(moves.some(m => m.type === 'take_discard')).toBe(true)
    })

    test('getValidMoves includes take_discard when the top card forms a new meld with 2+ hand cards', () => {
      const ai = new AIPlayer('Bot', 'medium', [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
      ])
      const gameState = makeGameState(ai, { discardPile: [new Card('hearts', '7', false)] })
      const moves = ai.getValidMoves(gameState)
      expect(moves.some(m => m.type === 'take_discard')).toBe(true)
    })

    test('getValidMoves does NOT include take_discard when the top card is useless', () => {
      const ai = new AIPlayer('Bot', 'medium', [new Card('clubs', 'K', false)])
      const gameState = makeGameState(ai, { discardPile: [new Card('hearts', '3', false)] })
      const moves = ai.getValidMoves(gameState)
      expect(moves.some(m => m.type === 'take_discard')).toBe(false)
    })

    test('medium AI takes the discard pile whenever the top card is useful', () => {
      const ai = new AIPlayer('Bot', 'medium', [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
      ])
      const gameState = makeGameState(ai, { discardPile: [new Card('hearts', '7', false)] })
      const move = ai.playTurn(gameState)
      expect(move.type).toBe('take_discard')
    })

    test('hard AI takes the discard pile whenever the top card is useful', () => {
      const ai = new AIPlayer('Bot', 'hard', [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
      ])
      const gameState = makeGameState(ai, { discardPile: [new Card('hearts', '7', false)] })
      const move = ai.playTurn(gameState)
      expect(move.type).toBe('take_discard')
    })

    test('easy AI sometimes takes the useful discard pile (50% chance)', () => {
      const ai = new AIPlayer('Bot', 'easy', [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
      ])
      const gameState = makeGameState(ai, { discardPile: [new Card('hearts', '7', false)] })

      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.1)
      expect(ai.playTurn(gameState).type).toBe('take_discard')
      spy.mockReturnValue(0.9)
      expect(ai.playTurn(gameState).type).not.toBe('take_discard')
      spy.mockRestore()
    })

    test('medium AI never proposes take_discard when the pile is empty', () => {
      const ai = new AIPlayer('Bot', 'medium', [new Card('hearts', '5', false)])
      const gameState = makeGameState(ai, { discardPile: [] })
      const move = ai.playTurn(gameState)
      expect(move.type).not.toBe('take_discard')
    })
  })

  describe('Part C: extend_meld priorizado sobre play_canasta', () => {
    test('medium AI prefers extend_meld over play_canasta when both are available', () => {
      const ai = new AIPlayer('Bot', 'medium', [
        new Card('hearts', '8', false), // extends existing meld
        new Card('spades', '4', false),
        new Card('spades', '5', false),
        new Card('spades', '6', false), // forms a brand-new canasta
      ])
      const { Canasta } = require('../../src/engine/canasta')
      const existingMeld = new Canasta([
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
      ])
      const teams = makeTeams()
      teams[0].melds = [existingMeld]
      const gameState = makeGameState(ai, { teams })
      const move = ai.playTurn(gameState)
      expect(move.type).toBe('extend_meld')
    })

    test('hard AI prefers extend_meld over play_canasta when both are available', () => {
      const ai = new AIPlayer('Bot', 'hard', [
        new Card('hearts', '8', false),
        new Card('spades', '4', false),
        new Card('spades', '5', false),
        new Card('spades', '6', false),
      ])
      const { Canasta } = require('../../src/engine/canasta')
      const existingMeld = new Canasta([
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
      ])
      const teams = makeTeams()
      teams[0].melds = [existingMeld]
      const gameState = makeGameState(ai, { teams })
      const move = ai.playTurn(gameState)
      expect(move.type).toBe('extend_meld')
    })
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
