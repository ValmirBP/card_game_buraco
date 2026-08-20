import { useGameStore, accumulateMatchRound, MATCH_TARGET } from '../../src/store/gameStore'
import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'
import type { Team } from '../../src/engine/gameState'

/** Builds a clean (no wilds) canastra of `length` cards, all hearts. */
function cleanCanastra(length: number): Canasta {
  const ranks = ['4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const
  const cards = ranks.slice(0, length).map(r => new Card('hearts', r, false))
  return new Canasta(cards)
}

/** Minimal fake Team for exercising accumulateMatchRound() in isolation from
 * the engine's actual scoring (which recomputes team.score from hand/melds
 * on finish() and can't be forced to an arbitrary value directly). */
function fakeTeam(id: 'A' | 'B', score: number, melds: Canasta[] = []): Team {
  return { id, seats: id === 'A' ? [0, 2] : [1, 3], melds, score, hasTakenMorto: false }
}

/** Forces the round to end via the real discard flow: empties the current
 * player's hand down to 1 card, marks their team as morto-taken with a clean
 * canastra already on the table (so canClose is satisfied), then discards
 * the last card so the hand empties and the round finishes. */
function forceRoundEnd(teamId: 'A' | 'B' = 'A') {
  const game = useGameStore.getState().game!
  const team = game.state.teams.find(t => t.id === teamId)!
  team.hasTakenMorto = true
  team.melds.push(cleanCanastra(7))
  game.state.mortos = []

  const player = game.getCurrentPlayer()
  while (player.hand.getSize() > 1) {
    player.hand.removeCard(0)
  }
  useGameStore.getState().discard(0)
}

describe('accumulateMatchRound (pure)', () => {
  test('adds each team round score into the running match totals', () => {
    const result = accumulateMatchRound(
      { A: 500, B: 300 },
      { A: { clean: 1, dirty: 0 }, B: { clean: 0, dirty: 1 } },
      [fakeTeam('A', 200), fakeTeam('B', 150)]
    )

    expect(result.matchScores).toEqual({ A: 700, B: 450 })
    expect(result.matchWinner).toBeUndefined()
  })

  test('counts canastras (7+) split by clean/dirty, ignoring smaller melds', () => {
    const smallMeld = new Canasta([
      new Card('hearts', '4', false),
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
    ])
    const clean = cleanCanastra(7)
    const dirty = new Canasta([
      new Card('hearts', '4', false),
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '7', false),
      new Card('hearts', '8', false),
      new Card('hearts', '9', false),
      new Card('clubs', '2', true), // wild -> dirty
    ])
    expect(clean.isClean).toBe(true)
    expect(dirty.isClean).toBe(false)

    const result = accumulateMatchRound(
      { A: 0, B: 0 },
      { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } },
      [fakeTeam('A', 100, [smallMeld, clean, dirty]), fakeTeam('B', 50)]
    )

    expect(result.matchCanastras.A).toEqual({ clean: 1, dirty: 1 })
    expect(result.matchCanastras.B).toEqual({ clean: 0, dirty: 0 })
  })

  test('sets matchWinner to whichever team is >= MATCH_TARGET with the higher total', () => {
    const result = accumulateMatchRound(
      { A: 2900, B: 2000 },
      { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } },
      [fakeTeam('A', 150), fakeTeam('B', 50)]
    )

    expect(result.matchScores.A).toBe(3050)
    expect(result.matchScores.A).toBeGreaterThanOrEqual(MATCH_TARGET)
    expect(result.matchWinner).toBe('A')
  })

  test('a tie at/above MATCH_TARGET is awarded to team A', () => {
    const result = accumulateMatchRound(
      { A: 2950, B: 2950 },
      { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } },
      [fakeTeam('A', 50), fakeTeam('B', 50)]
    )

    expect(result.matchScores).toEqual({ A: 3000, B: 3000 })
    expect(result.matchWinner).toBe('A')
  })

  test('does not set matchWinner when both totals stay under MATCH_TARGET', () => {
    const result = accumulateMatchRound(
      { A: 100, B: 100 },
      { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } },
      [fakeTeam('A', 50), fakeTeam('B', 2899)]
    )

    expect(result.matchWinner).toBeUndefined()
    expect(result.matchScores.B).toBe(2999)
  })
})

describe('gameStore match integration (partida até 3000)', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame()
  })

  test('initGame zeroes the match state', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const state = useGameStore.getState()

    expect(state.matchScores).toEqual({ A: 0, B: 0 })
    expect(state.matchCanastras).toEqual({
      A: { clean: 0, dirty: 0 },
      B: { clean: 0, dirty: 0 },
    })
    expect(state.round).toBe(1)
    expect(state.matchWinner).toBeUndefined()
  })

  test('finishing a round accumulates matchScores (matching the round totals) and counts canastras once', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    forceRoundEnd('A')

    const state = useGameStore.getState()
    expect(state.game!.state.status).toBe('finished')
    const roundTotalA = state.game!.state.teams.find(t => t.id === 'A')!.score
    const roundTotalB = state.game!.state.teams.find(t => t.id === 'B')!.score

    expect(state.matchScores.A).toBe(roundTotalA)
    expect(state.matchScores.B).toBe(roundTotalB)
    expect(state.matchCanastras.A.clean).toBeGreaterThanOrEqual(1)
  })

  test('does not double-accumulate if store actions run again after the round is finished', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    forceRoundEnd('A')

    const scoresAfterFirstFinish = { ...useGameStore.getState().matchScores }
    const canastrasAfterFirstFinish = JSON.parse(JSON.stringify(useGameStore.getState().matchCanastras))

    // Actions on a finished game are no-ops (status !== 'playing'), but call
    // a few of them anyway to make sure nothing double counts.
    useGameStore.getState().discard(0)
    useGameStore.getState().playCanasta([0, 1, 2])
    useGameStore.getState().aiTurn()

    const state = useGameStore.getState()
    expect(state.matchScores).toEqual(scoresAfterFirstFinish)
    expect(state.matchCanastras).toEqual(canastrasAfterFirstFinish)
  })

  test('startNextRound recreates a fresh playing round, keeps accumulated match state, and bumps round', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    forceRoundEnd('A')

    const matchScoresBefore = { ...useGameStore.getState().matchScores }
    const versionBefore = useGameStore.getState().version

    useGameStore.getState().startNextRound()

    const state = useGameStore.getState()
    expect(state.game!.state.status).toBe('playing')
    expect(state.round).toBe(2)
    expect(state.matchScores).toEqual(matchScoresBefore)
    expect(state.version).toBeGreaterThan(versionBefore)
    // Fresh round: hands dealt again, same players/names carried over.
    state.game!.state.players.forEach(p => expect(p.hand.getSize()).toBe(11))
    expect(state.game!.state.players[0].name).toBe('Alice')
  })

  test('crossing MATCH_TARGET sets matchWinner and startNextRound becomes a no-op', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.setState({ matchScores: { A: 2950, B: 100 } })

    forceRoundEnd('A')

    const state = useGameStore.getState()
    expect(state.matchScores.A).toBeGreaterThanOrEqual(MATCH_TARGET)
    expect(state.matchWinner).toBe('A')

    const roundBefore = state.round
    const gameBefore = state.game
    useGameStore.getState().startNextRound()

    expect(useGameStore.getState().round).toBe(roundBefore)
    expect(useGameStore.getState().game).toBe(gameBefore) // no new round created
  })
})
