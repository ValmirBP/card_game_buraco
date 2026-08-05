import { GameSession, accumulateMatchRound } from '../../src/session/GameSession'
import { SeatConfig } from '../../src/session/types'
import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'
import type { Team } from '../../src/engine/gameState'

function allHumans(): SeatConfig[] {
  return [
    { kind: 'human', name: 'P0' },
    { kind: 'human', name: 'P1' },
    { kind: 'human', name: 'P2' },
    { kind: 'human', name: 'P3' },
  ]
}

function cleanCanastra(length: number): Canasta {
  const ranks = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
  const cards = ranks.slice(0, length).map(r => new Card('hearts', r, false))
  return new Canasta(cards)
}

function fakeTeam(id: 'A' | 'B', score: number, melds: Canasta[] = []): Team {
  return { id, seats: id === 'A' ? [0, 2] : [1, 3], melds, score, hasTakenMorto: false }
}

/** Forces the current round to end via the real draw/discard flow: gives the
 * current player's team a clean canastra + morto already taken, shrinks
 * their hand to 1 card, then discards it so the round finishes. Mirrors
 * tests/store/matchScore.test.ts's forceRoundEnd against the real store. */
function forceRoundEnd(session: GameSession, teamId: 'A' | 'B' = 'A') {
  const seat = session.currentSeat
  session.applyIntent(seat, { type: 'draw' })

  const game: any = (session as any).game
  const team = game.state.teams.find((t: any) => t.id === teamId)
  team.hasTakenMorto = true
  team.melds.push(cleanCanastra(7))
  game.state.mortos = []

  const player = game.getCurrentPlayer()
  while (player.hand.getSize() > 1) {
    player.hand.removeCard(0)
  }
  session.applyIntent(seat, { type: 'discard', cardIndex: 0 })
}

describe('accumulateMatchRound (pure, parametrized by matchTarget)', () => {
  it('adds each team round score into running match totals', () => {
    const result = accumulateMatchRound(
      { A: 500, B: 300 },
      { A: { clean: 1, dirty: 0 }, B: { clean: 0, dirty: 1 } },
      [fakeTeam('A', 200), fakeTeam('B', 150)],
      3000
    )
    expect(result.matchScores).toEqual({ A: 700, B: 450 })
    expect(result.matchWinner).toBeUndefined()
  })

  it('sets matchWinner once a team reaches matchTarget', () => {
    const result = accumulateMatchRound(
      { A: 2900, B: 2000 },
      { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } },
      [fakeTeam('A', 150), fakeTeam('B', 50)],
      3000
    )
    expect(result.matchWinner).toBe('A')
  })
})

describe('GameSession match layer', () => {
  it('accumulates matchScores once the round finishes', () => {
    const session = new GameSession(allHumans())
    forceRoundEnd(session, 'A')

    const view = session.getViewFor(0)
    expect(view.status).toBe('finished')
    const roundTotalA = view.teams.find(t => t.id === 'A')!.score
    const roundTotalB = view.teams.find(t => t.id === 'B')!.score

    expect(view.matchScores.A).toBe(roundTotalA)
    expect(view.matchScores.B).toBe(roundTotalB)
    expect(view.matchCanastras.A.clean).toBeGreaterThanOrEqual(1)
  })

  it('does not double-accumulate when intents are applied again after the round finished', () => {
    const session = new GameSession(allHumans())
    forceRoundEnd(session, 'A')

    const scoresAfter = { ...session.getViewFor(0).matchScores }

    session.applyIntent(session.currentSeat, { type: 'discard', cardIndex: 0 })
    session.applyIntent(session.currentSeat, { type: 'playCanasta', cardIndices: [0, 1, 2] })

    expect(session.getViewFor(0).matchScores).toEqual(scoresAfter)
  })

  it('nextRound recreates a fresh playing round, keeps accumulated match state, bumps round', () => {
    const session = new GameSession(allHumans())
    forceRoundEnd(session, 'A')
    const matchScoresBefore = { ...session.getViewFor(0).matchScores }

    const result = session.applyIntent(0, { type: 'nextRound' })

    expect(result.ok).toBe(true)
    const view = session.getViewFor(0)
    expect(view.status).toBe('playing')
    expect(view.round).toBe(2)
    expect(view.matchScores).toEqual(matchScoresBefore)
    for (let seat = 0; seat < 4; seat++) {
      expect(session.getViewFor(seat).yourHand.length).toBe(11)
    }
    expect(session.currentSeat).toBe(0)
    expect(session.phase).toBe('draw')
  })

  it('crossing matchTarget sets matchWinner, and nextRound becomes a no-op', () => {
    const session = new GameSession(allHumans(), 3000)
    // Force the match to be right at the edge before this round ends.
    ;(session as any).matchScores = { A: 2950, B: 100 }

    forceRoundEnd(session, 'A')

    const view = session.getViewFor(0)
    expect(view.matchScores.A).toBeGreaterThanOrEqual(3000)
    expect(view.matchWinner).toBe('A')

    const roundBefore = view.round
    const result = session.applyIntent(0, { type: 'nextRound' })

    expect(result.ok).toBe(false)
    expect(session.getViewFor(0).round).toBe(roundBefore)
    expect(session.getViewFor(0).status).toBe('finished')
  })
})
