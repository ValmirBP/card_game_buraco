import { GameSession } from '../../src/session/GameSession'
import { SeatConfig } from '../../src/session/types'

function humanThenThreeAi(): SeatConfig[] {
  return [
    { kind: 'human', name: 'Human' },
    { kind: 'ai', name: 'Bot1', difficulty: 'easy' },
    { kind: 'ai', name: 'Bot2', difficulty: 'medium' },
    { kind: 'ai', name: 'Bot3', difficulty: 'hard' },
  ]
}

function allAi(): SeatConfig[] {
  return [
    { kind: 'ai', name: 'Bot0', difficulty: 'easy' },
    { kind: 'ai', name: 'Bot1', difficulty: 'medium' },
    { kind: 'ai', name: 'Bot2', difficulty: 'hard' },
    { kind: 'ai', name: 'Bot3', difficulty: 'easy' },
  ]
}

describe('GameSession.runAiTurns', () => {
  it('no-ops when the current seat is human', () => {
    const session = new GameSession(humanThenThreeAi())
    const events = session.runAiTurns()
    expect(events).toEqual([])
    expect(session.currentSeat).toBe(0)
  })

  it('advances through consecutive AI seats and stops at the next human seat', () => {
    const session = new GameSession(humanThenThreeAi())
    // Complete seat 0's (human) turn manually to hand control to seat 1 (AI).
    session.applyIntent(0, { type: 'draw' })
    session.applyIntent(0, { type: 'discard', cardIndex: 0 })
    expect(session.currentSeat).toBe(1)

    const events = session.runAiTurns()

    expect(events.length).toBeGreaterThan(0)
    // Either it looped back around to the human seat, or the round ended.
    expect(session.currentSeat === 0 || session.status === 'finished').toBe(true)
    if (session.status === 'playing') {
      expect(session.phase).toBe('draw')
    }
  })

  it('always ends each AI turn with a discard (never leaves the table mid-meld) unless the round just ended', () => {
    const session = new GameSession(humanThenThreeAi())
    session.applyIntent(0, { type: 'draw' })
    session.applyIntent(0, { type: 'discard', cardIndex: 0 })

    session.runAiTurns()

    if (session.status === 'playing') {
      // Back to the human seat in draw phase means every AI seat completed
      // a full draw->...->discard cycle without getting stuck.
      expect(session.currentSeat).toBe(0)
      expect(session.phase).toBe('draw')
    }
  })

  it('with all 4 seats AI, runs the entire round to completion without throwing', () => {
    const session = new GameSession(allAi())
    const events = session.runAiTurns()

    expect(events.length).toBeGreaterThan(0)
    expect(session.status).toBe('finished')
  }, 15000)

  it('produces a non-empty log describing AI actions', () => {
    const session = new GameSession(allAi())
    const events = session.runAiTurns()
    expect(events.some(e => e.includes('Bot0') || e.includes('Bot1') || e.includes('Bot2') || e.includes('Bot3'))).toBe(true)
  }, 15000)
})
