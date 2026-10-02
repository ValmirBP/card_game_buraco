import { render, screen } from '@testing-library/react'
import RulesModal from '../../../src/components/Menu/RulesModal'
import { HAND_SIZE, MORTO_SIZE } from '../../../src/engine/game'
import { canastaPoints } from '../../../src/engine/utils'
import { MATCH_TARGET } from '../../../src/store/gameStore'

describe('RulesModal', () => {
  test('shows the real hand size, match target and canasta point values from the engine', () => {
    render(<RulesModal onClose={() => {}} />)

    const text = screen.getByRole('dialog').textContent ?? ''

    expect(text).toContain(String(HAND_SIZE))
    expect(text).toContain(String(MATCH_TARGET))
    expect(text).toContain(String(canastaPoints('limpa', 7)))
    expect(text).toContain(String(canastaPoints('suja', 7)))
    expect(text).toContain(String(canastaPoints('quinhentos', 13)))
    expect(text).toContain(String(canastaPoints('real', 14)))

    expect(text).not.toMatch(/receb\w*\s*14\s*cartas/i)
  })

  test('explica o que é o morto, não só que ele existe', () => {
    render(<RulesModal onClose={() => {}} />)
    const text = screen.getByRole('dialog').textContent ?? ''

    expect(text).toContain(String(MORTO_SIZE))
    expect(text).toMatch(/pega automaticamente o morto/i)
    expect(text).toMatch(/vira o novo monte/i)
  })

  test('define o curinga (coringa e o 2) em vez de só citar a palavra', () => {
    render(<RulesModal onClose={() => {}} />)
    const text = screen.getByRole('dialog').textContent ?? ''

    expect(text).toMatch(/coringa e qualquer carta 2/i)
  })

  test('deixa claro que são 4 jogadores em 2 duplas fixas', () => {
    render(<RulesModal onClose={() => {}} />)
    const text = screen.getByRole('dialog').textContent ?? ''

    expect(text).toMatch(/4 pessoas/i)
    expect(text).toMatch(/2 duplas/i)
  })

  test('avisa sobre a trava do descarte de 1 carta só', () => {
    render(<RulesModal onClose={() => {}} />)
    const text = screen.getByRole('dialog').textContent ?? ''

    expect(text).toMatch(/só 1 carta.*não pode voltar/is)
  })
})
