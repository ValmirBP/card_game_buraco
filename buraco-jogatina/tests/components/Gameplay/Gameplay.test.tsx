import { act, fireEvent, render, screen } from '@testing-library/react'
import Gameplay from '../../../src/components/Gameplay/Gameplay'
import { useGameStore } from '../../../src/store/gameStore'

function setup() {
  const onGameEnd = jest.fn()
  const onExit = jest.fn()
  useGameStore.getState().initGame('Alice', 'easy')
  return { onGameEnd, onExit }
}

describe('Gameplay', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers())
    jest.useRealTimers()
    act(() => useGameStore.getState().resetGame())
  })

  it('começa na vez do jogador, com 11 cartas na mão e o placar visível', () => {
    const { onGameEnd, onExit } = setup()
    render(<Gameplay onGameEnd={onGameEnd} onExit={onExit} />)
    expect(useGameStore.getState().game!.state.currentPlayerIndex).toBe(0)
    expect(screen.getAllByText('Nós').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Eles').length).toBeGreaterThan(0)
    expect(useGameStore.getState().game!.state.players[0].hand.getSize()).toBe(11)
  })

  it('comprar do monte dá +1 carta; descartar passa a vez e as IAs jogam até voltar ao jogador', () => {
    const { onGameEnd, onExit } = setup()
    const { container } = render(<Gameplay onGameEnd={onGameEnd} onExit={onExit} />)
    const game = useGameStore.getState().game!

    fireEvent.click(container.querySelector('[data-deck-pile]')!)
    act(() => jest.advanceTimersByTime(1500))
    expect(game.state.players[0].hand.getSize()).toBe(12)

    act(() => useGameStore.getState().discard(0))
    expect(game.state.currentPlayerIndex).not.toBe(0)

    for (let i = 0; i < 12 && game.state.currentPlayerIndex !== 0 && game.state.status === 'playing'; i++) {
      act(() => jest.advanceTimersByTime(2600))
    }
    expect(game.state.currentPlayerIndex).toBe(0)
    expect(game.state.status).toBe('playing')
  })

  it('o botão de sair chama onExit', () => {
    const { onGameEnd, onExit } = setup()
    render(<Gameplay onGameEnd={onGameEnd} onExit={onExit} />)
    fireEvent.click(screen.getByRole('button', { name: /sair/i }))
    expect(onExit).toHaveBeenCalled()
  })

  it('rodada terminada chama onGameEnd depois do banner', () => {
    const { onGameEnd, onExit } = setup()
    render(<Gameplay onGameEnd={onGameEnd} onExit={onExit} />)
    const game = useGameStore.getState().game!
    act(() => {
      game.finish()
      useGameStore.setState({ version: useGameStore.getState().version + 1 })
    })
    expect(onGameEnd).not.toHaveBeenCalled()
    act(() => jest.advanceTimersByTime(2100))
    expect(onGameEnd).toHaveBeenCalledTimes(1)
  })
})
