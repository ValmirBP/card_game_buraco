import { render } from '@testing-library/react'
import Result from '../../../src/components/Result/Result'
import { useGameStore } from '../../../src/store/gameStore'

describe('Result', () => {
  afterEach(() => {
    useGameStore.getState().resetGame()
  })

  test('B2: match progress bar never gets a negative width when a team has a negative score', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.setState({ matchScores: { A: -120, B: 250 } })

    const { container } = render(
      <Result onBackToMenu={() => {}} onNextRound={() => {}} onNewMatch={() => {}} />
    )

    const bars = container.querySelectorAll('.bg-card-gold.transition-\\[width\\]')
    expect(bars.length).toBeGreaterThan(0)
    bars.forEach(bar => {
      const width = (bar as HTMLElement).style.width
      expect(width).not.toMatch(/^-/)
      const pct = parseFloat(width)
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThanOrEqual(100)
    })
  })
})
