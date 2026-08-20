import { render, screen, fireEvent } from '@testing-library/react'
import Menu from '../../../src/components/Menu/Menu'
import { useGameStore } from '../../../src/store/gameStore'

describe('Menu', () => {
  afterEach(() => {
    useGameStore.getState().resetGame()
  })

  test('renders title and action buttons', () => {
    render(<Menu onStart={() => {}} />)
    expect(screen.getByText('Buraco')).toBeInTheDocument()
    expect(screen.getByText('Jogatina')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Jogar vs IA' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Regras' })).toBeInTheDocument()
  })

  test('clicking "Jogar vs IA" shows difficulty options', () => {
    render(<Menu onStart={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Jogar vs IA' }))
    expect(screen.getByText('Fácil')).toBeInTheDocument()
    expect(screen.getByText('Médio')).toBeInTheDocument()
    expect(screen.getByText('Difícil')).toBeInTheDocument()
  })

  test('selecting a difficulty initializes the game and calls onStart', () => {
    const onStart = jest.fn()
    render(<Menu onStart={onStart} />)
    fireEvent.click(screen.getByRole('button', { name: 'Jogar vs IA' }))
    fireEvent.click(screen.getByRole('button', { name: /Fácil/ }))

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(useGameStore.getState().game).not.toBeNull()
    expect(useGameStore.getState().game!.state.status).toBe('playing')
  })

  test('clicking "Regras" shows the rules modal', () => {
    render(<Menu onStart={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Regras' }))
    expect(screen.getByText('Como Jogar Buraco')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(screen.queryByText('Como Jogar Buraco')).not.toBeInTheDocument()
  })
})
