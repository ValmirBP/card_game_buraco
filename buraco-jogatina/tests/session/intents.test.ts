import { GameSession } from '../../src/session/GameSession'
import { SeatConfig } from '../../src/session/types'
import { Card } from '../../src/engine/card'
import { Hand } from '../../src/engine/hand'

function allHumans(): SeatConfig[] {
  return [
    { kind: 'human', name: 'P0' },
    { kind: 'human', name: 'P1' },
    { kind: 'human', name: 'P2' },
    { kind: 'human', name: 'P3' },
  ]
}

/** White-box helper: reaches into the session's private engine Game to set
 * up deterministic scenarios, mirroring the pattern already used by
 * tests/store/gameStore.test.ts against the real engine. */
function internalGame(session: GameSession): any {
  return (session as any).game
}

describe('GameSession illegal intents are rejected without side effects', () => {
  it('rejects playCanasta with fewer than 3 cards (invalid meld), leaving hand/score untouched', () => {
    const session = new GameSession(allHumans())
    session.applyIntent(0, { type: 'draw' })
    const handSizeBefore = session.getViewFor(0).yourHand.length

    const result = session.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1] })

    expect(result.ok).toBe(false)
    expect(session.getViewFor(0).yourHand.length).toBe(handSizeBefore)
    expect(session.phase).toBe('play') // still mid-turn, nothing consumed
  })

  it('rejects extendMeld against a meld index that does not exist', () => {
    const session = new GameSession(allHumans())
    session.applyIntent(0, { type: 'draw' })

    const result = session.applyIntent(0, { type: 'extendMeld', meldIndex: 0, cardIndices: [0] })

    expect(result.ok).toBe(false)
    expect(result.error).toBeTruthy()
  })

  it('accepts a valid new canasta (5H/6H/7H) and credits team score/meld', () => {
    const session = new GameSession(allHumans())
    session.applyIntent(0, { type: 'draw' })

    const game = internalGame(session)
    const player = game.getCurrentPlayer()
    const sizeBefore = player.hand.getSize()
    player.hand.addCard(new Card('hearts', '5', false))
    player.hand.addCard(new Card('hearts', '6', false))
    player.hand.addCard(new Card('hearts', '7', false))

    const result = session.applyIntent(0, {
      type: 'playCanasta',
      cardIndices: [sizeBefore, sizeBefore + 1, sizeBefore + 2],
    })

    expect(result.ok).toBe(true)
    expect(session.getViewFor(0).yourHand.length).toBe(sizeBefore)
    const teamA = session.getViewFor(0).teams.find(t => t.id === 'A')!
    expect(teamA.melds).toHaveLength(1)
    expect(teamA.score).toBeGreaterThan(0)
  })

  it('rejects a play that would empty the hand illegally (team already took morto, no clean canastra yet)', () => {
    const session = new GameSession(allHumans())
    session.applyIntent(0, { type: 'draw' })

    const game = internalGame(session)
    const teamA = game.state.teams.find((t: any) => t.id === 'A')
    teamA.hasTakenMorto = true // morto already taken -> can't fall back to taking it

    const c5 = new Card('hearts', '5', false)
    const c6 = new Card('hearts', '6', false)
    const c7 = new Card('hearts', '7', false)
    // Replace the hand entirely with exactly these 3 cards, so playing them
    // as a canasta (a non-canastra meld, <7 cards) would empty the hand with
    // no clean canastra on the table -> illegal per Game.wouldEmptyHandIllegally.
    game.getCurrentPlayer().hand = new Hand([c5, c6, c7])

    const result = session.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1, 2] })

    expect(result.ok).toBe(false)
    expect(game.getCurrentPlayer().hand.getSize()).toBe(3) // untouched
  })

  it('A1: rejects discarding the last card without morto/close rights, with a SPECIFIC error message (not "indice invalido")', () => {
    const session = new GameSession(allHumans())
    session.applyIntent(0, { type: 'draw' })

    const game = internalGame(session)
    const teamA = game.state.teams.find((t: any) => t.id === 'A')
    teamA.hasTakenMorto = true
    game.state.mortos = []
    // Sem canastra limpa -> canClose fica false.
    game.getCurrentPlayer().hand = new Hand([new Card('diamonds', 'Q', false)])

    const result = session.applyIntent(0, { type: 'discard', cardIndex: 0 })

    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/bater/i)
    expect(result.error).not.toMatch(/indice/i)
    expect(game.getCurrentPlayer().hand.getSize()).toBe(1) // untouched
  })

  it('rejects takeDiscard when the discard pile is empty', () => {
    const session = new GameSession(allHumans())
    const result = session.applyIntent(0, { type: 'takeDiscard' })
    expect(result.ok).toBe(false)
  })

  it('rejects nextRound while the round is still in progress', () => {
    const session = new GameSession(allHumans())
    const result = session.applyIntent(0, { type: 'nextRound' })
    expect(result.ok).toBe(false)
  })
})
