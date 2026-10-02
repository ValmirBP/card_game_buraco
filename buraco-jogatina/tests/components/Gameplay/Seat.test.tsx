import { render, screen } from '@testing-library/react'
import Seat from '../../../src/components/Gameplay/Seat'

describe('Seat', () => {
  it('mostra inicial, nome e contagem de cartas no singular e no plural', () => {
    const { rerender } = render(<Seat name="Ana" cardCount={1} isCurrentTurn={false} teamId="B" />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(screen.getByText('1 carta')).toBeInTheDocument()
    rerender(<Seat name="Ana" cardCount={11} isCurrentTurn={false} teamId="B" />)
    expect(screen.getByText('11 cartas')).toBeInTheDocument()
  })

  it('mostra "Sua vez" só quando é a vez do assento', () => {
    const { rerender } = render(<Seat name="Ana" cardCount={5} isCurrentTurn={false} teamId="A" />)
    expect(screen.queryByText('Sua vez')).not.toBeInTheDocument()
    rerender(<Seat name="Ana" cardCount={5} isCurrentTurn teamId="A" />)
    expect(screen.getByText('Sua vez')).toBeInTheDocument()
  })

  it('com isThinking mostra "jogando…" no lugar de "Sua vez"', () => {
    render(<Seat name="Bot" cardCount={5} isCurrentTurn isThinking teamId="B" />)
    expect(screen.getByText(/jogando/)).toBeInTheDocument()
    expect(screen.queryByText('Sua vez')).not.toBeInTheDocument()
  })

  it('modo compacto não mostra o leque de versos nem a contagem', () => {
    const { container } = render(<Seat name="Você" cardCount={11} isCurrentTurn={false} teamId="A" compact />)
    expect(screen.queryByText('11 cartas')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.card-back-pattern-blue, .card-back-pattern-red')).toHaveLength(0)
  })

  it('o leque tem no máximo 7 versos, na cor da dupla', () => {
    const { container, rerender } = render(<Seat name="Ana" cardCount={11} isCurrentTurn={false} teamId="A" />)
    expect(container.querySelectorAll('.card-back-pattern-blue')).toHaveLength(7)
    rerender(<Seat name="Ana" cardCount={3} isCurrentTurn={false} teamId="B" />)
    expect(container.querySelectorAll('.card-back-pattern-red')).toHaveLength(3)
  })
})
