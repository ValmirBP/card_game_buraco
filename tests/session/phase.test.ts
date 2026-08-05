import { GameSession } from '../../src/session/GameSession'
import { SeatConfig } from '../../src/session/types'

function allHumans(): SeatConfig[] {
  return [
    { kind: 'human', name: 'P0' },
    { kind: 'human', name: 'P1' },
    { kind: 'human', name: 'P2' },
    { kind: 'human', name: 'P3' },
  ]
}

describe('GameSession turn phase', () => {
  it('starts a seat turn in draw phase', () => {
    const session = new GameSession(allHumans())
    expect(session.phase).toBe('draw')
  })

  it('draw transitions phase to play', () => {
    const session = new GameSession(allHumans())
    const result = session.applyIntent(0, { type: 'draw' })
    expect(result.ok).toBe(true)
    expect(session.phase).toBe('play')
    expect(session.currentSeat).toBe(0) // still seat 0's turn
  })

  it('rejects discard while in draw phase', () => {
    const session = new GameSession(allHumans())
    const result = session.applyIntent(0, { type: 'discard', cardIndex: 0 })
    expect(result.ok).toBe(false)
    expect(session.phase).toBe('draw')
  })

  it('discard is valid in play phase and ends the turn, advancing to next seat in draw phase', () => {
    const session = new GameSession(allHumans())
    session.applyIntent(0, { type: 'draw' })
    const result = session.applyIntent(0, { type: 'discard', cardIndex: 0 })
    expect(result.ok).toBe(true)
    expect(session.currentSeat).toBe(1)
    expect(session.phase).toBe('draw')
  })

  it('rejects an intent from a seat that is not the current seat', () => {
    const session = new GameSession(allHumans())
    const result = session.applyIntent(1, { type: 'draw' })
    expect(result.ok).toBe(false)
    expect(session.currentSeat).toBe(0)
    expect(session.phase).toBe('draw')
  })

  it('rejects draw twice in a row without discarding', () => {
    const session = new GameSession(allHumans())
    session.applyIntent(0, { type: 'draw' })
    const result = session.applyIntent(0, { type: 'draw' })
    expect(result.ok).toBe(false)
  })

  it('takeDiscard is only valid in draw phase, also moves to play phase', () => {
    const session = new GameSession(allHumans())
    // Nothing on the discard pile yet, so this fails, but importantly it's a
    // draw-phase-only intent.
    const emptyPileResult = session.applyIntent(0, { type: 'takeDiscard' })
    expect(emptyPileResult.ok).toBe(false)
    expect(session.phase).toBe('draw')

    // Put a card on the pile via a full turn, then verify seat 1 can take it.
    session.applyIntent(0, { type: 'draw' })
    session.applyIntent(0, { type: 'discard', cardIndex: 0 })
    expect(session.currentSeat).toBe(1)

    const takeResult = session.applyIntent(1, { type: 'takeDiscard' })
    expect(takeResult.ok).toBe(true)
    expect(session.phase).toBe('play')
  })
})
