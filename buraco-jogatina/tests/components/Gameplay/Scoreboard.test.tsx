import { render, screen } from '@testing-library/react'
import Scoreboard from '../../../src/components/Gameplay/Scoreboard'
import { useGameStore } from '../../../src/store/gameStore'

describe('Scoreboard', () => {
  afterEach(() => {
    useGameStore.getState().resetGame()
  })

  test('B3: does NOT double-count the just-finished round (roundFinalized=true)', () => {
    // Simula o frame final da rodada: finalizeRoundIfNeeded() já somou
    // team.score (185) dentro de matchScores (também 185) e marcou
    // roundFinalized=true - somar os dois de novo mostraria 370.
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.setState({ matchScores: { A: 185, B: 0 }, roundFinalized: true })
    const teamA = useGameStore.getState().game!.state.teams.find(t => t.id === 'A')!
    teamA.score = 185

    render(<Scoreboard />)

    expect(screen.getByText('185')).toBeInTheDocument()
    expect(screen.queryByText('370')).not.toBeInTheDocument()
  })

  test('still adds the in-progress round score when roundFinalized=false (normal mid-round display)', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.setState({ matchScores: { A: 100, B: 0 }, roundFinalized: false })
    const teamA = useGameStore.getState().game!.state.teams.find(t => t.id === 'A')!
    teamA.score = 85

    render(<Scoreboard />)

    expect(screen.getByText('185')).toBeInTheDocument()
  })
})
