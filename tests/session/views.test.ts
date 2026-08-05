import { GameSession } from '../../src/session/GameSession'
import { SeatConfig } from '../../src/session/types'

function mixedSeats(): SeatConfig[] {
  return [
    { kind: 'human', name: 'Alice' },
    { kind: 'ai', name: 'Bot1', difficulty: 'easy' },
    { kind: 'human', name: 'Bob' },
    { kind: 'ai', name: 'Bot2', difficulty: 'hard' },
  ]
}

describe('GameSession.getViewFor', () => {
  it('only exposes the requested seat\'s hand, others are redacted to counts', () => {
    const session = new GameSession(mixedSeats())
    const view = session.getViewFor(0)

    expect(view.seat).toBe(0)
    expect(view.yourHand).toHaveLength(11)
    // No other seat's cards appear anywhere in the view.
    view.players.forEach(p => {
      expect(p.handCount).toBe(11)
    })
    // Only seat 0's 11 cards should ever be serialized as {suit,...} objects
    // in the whole view (discard pile is empty, no melds yet) — no other
    // seat's hand leaks in anywhere.
    const suitOccurrences = (JSON.stringify(view).match(/"suit":/g) ?? []).length
    expect(suitOccurrences).toBe(11)
  })

  it('reports correct player metadata (kind, name, teamId)', () => {
    const session = new GameSession(mixedSeats())
    const view = session.getViewFor(0)

    expect(view.players).toEqual([
      { seat: 0, name: 'Alice', kind: 'human', handCount: 11, teamId: 'A' },
      { seat: 1, name: 'Bot1', kind: 'ai', handCount: 11, teamId: 'B' },
      { seat: 2, name: 'Bob', kind: 'human', handCount: 11, teamId: 'A' },
      { seat: 3, name: 'Bot2', kind: 'ai', handCount: 11, teamId: 'B' },
    ])
  })

  it('discard pile is fully visible (open information)', () => {
    const session = new GameSession(mixedSeats())
    session.applyIntent(0, { type: 'draw' })
    session.applyIntent(0, { type: 'discard', cardIndex: 0 })

    const view = session.getViewFor(2)
    expect(view.discardPile).toHaveLength(1)
  })

  it('mortos only expose counts, never contents', () => {
    const session = new GameSession(mixedSeats())
    const view = session.getViewFor(1)
    expect(view.mortos).toEqual([{ count: 11 }, { count: 11 }])
    expect(JSON.stringify(view.mortos)).not.toMatch(/suit|rank/)
  })

  it('a different seat asking for its own view sees its own hand, not the first seat\'s', () => {
    const session = new GameSession(mixedSeats())
    const viewSeat0 = session.getViewFor(0)
    const viewSeat2 = session.getViewFor(2)
    expect(viewSeat2.seat).toBe(2)
    expect(viewSeat2.yourHand).not.toEqual(viewSeat0.yourHand)
  })
})

describe('GameSession.getPublicView', () => {
  it('exposes no hand at all (TV mode)', () => {
    const session = new GameSession(mixedSeats())
    const view = session.getPublicView()
    expect(view.yourHand).toEqual([])
    view.players.forEach(p => expect(p.handCount).toBe(11))
  })
})
