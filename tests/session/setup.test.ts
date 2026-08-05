import { GameSession } from '../../src/session/GameSession'
import { SeatConfig } from '../../src/session/types'

function fourSeats(): SeatConfig[] {
  return [
    { kind: 'human', name: 'Alice' },
    { kind: 'ai', name: 'Bot1', difficulty: 'easy' },
    { kind: 'human', name: 'Bob' },
    { kind: 'ai', name: 'Bot2', difficulty: 'hard' },
  ]
}

describe('GameSession construction', () => {
  it('deals 11 cards to each of the 4 seats', () => {
    const session = new GameSession(fourSeats())
    for (let seat = 0; seat < 4; seat++) {
      expect(session.getViewFor(seat).yourHand.length).toBe(11)
    }
  })

  it('reserves 2 mortos of 11 cards each', () => {
    const session = new GameSession(fourSeats())
    const view = session.getViewFor(0)
    expect(view.mortos).toEqual([{ count: 11 }, { count: 11 }])
  })

  it('starts with an empty discard pile', () => {
    const session = new GameSession(fourSeats())
    expect(session.getViewFor(0).discardPile).toEqual([])
  })

  it('leaves 42 cards in the deck (108 - 44 hands - 22 mortos)', () => {
    const session = new GameSession(fourSeats())
    expect(session.getViewFor(0).deckCount).toBe(42)
  })

  it('throws when not given exactly 4 seats', () => {
    expect(() => new GameSession(fourSeats().slice(0, 3))).toThrow()
  })

  it('starts at seat 0, draw phase, status playing', () => {
    const session = new GameSession(fourSeats())
    expect(session.currentSeat).toBe(0)
    expect(session.phase).toBe('draw')
    expect(session.status).toBe('playing')
  })
})
