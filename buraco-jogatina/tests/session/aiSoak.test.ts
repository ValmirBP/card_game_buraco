import { GameSession } from '../../src/session/GameSession'
import type { SeatConfig } from '../../src/session/types'

const MAX_AI_TURNS_PER_ROUND = 3000

const allAi = (difficulty: 'easy' | 'medium' | 'hard'): SeatConfig[] =>
  [0, 1, 2, 3].map(i => ({ kind: 'ai', name: `IA ${i}`, difficulty }))

describe('soak: rodadas só de IA sempre terminam, sem exceção e sem laço infinito', () => {
  const proto = GameSession.prototype as unknown as { runOneAiTurn: () => void }
  const original = proto.runOneAiTurn
  let turns = 0

  beforeEach(() => {
    turns = 0
    proto.runOneAiTurn = function (this: unknown) {
      if (++turns > MAX_AI_TURNS_PER_ROUND) {
        throw new Error(`mais de ${MAX_AI_TURNS_PER_ROUND} turnos de IA numa rodada: a rodada não termina`)
      }
      return original.call(this)
    }
  })
  afterEach(() => {
    proto.runOneAiTurn = original
  })

  it.each(['easy', 'medium', 'hard'] as const)('dificuldade %s: 60 rodadas terminam', difficulty => {
    for (let i = 0; i < 60; i++) {
      turns = 0
      const session = new GameSession(allAi(difficulty))
      session.runAiTurns()
      expect(session.status).toBe('finished')
    }
  })

  it('uma partida completa (várias rodadas) de IAs difíceis chega ao fim', () => {
    const session = new GameSession(allAi('hard'))
    let rounds = 0
    for (; rounds < 100; rounds++) {
      turns = 0
      session.runAiTurns()
      expect(session.status).toBe('finished')
      if (!session.applyIntent(0, { type: 'nextRound' }).ok) break
    }
    expect(rounds).toBeGreaterThan(0)
    expect(rounds).toBeLessThan(100)
  })
})
