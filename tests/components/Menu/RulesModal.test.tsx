import { render, screen } from '@testing-library/react'
import RulesModal from '../../../src/components/Menu/RulesModal'
import { HAND_SIZE } from '../../../src/engine/game'
import { canastaPoints } from '../../../src/engine/utils'
import { MATCH_TARGET } from '../../../src/store/gameStore'

// B1: o texto das Regras já divergiu do motor de verdade uma vez ("14
// cartas" / "limpa 500, suja 300" quando o motor usa 11 cartas e
// 200/100/500/1000). Este teste lê os valores DIRETO do motor - se o
// componente algum dia voltar a hardcodar um número diferente, ele quebra
// sozinho, em vez de silenciosamente divergir de novo.
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

    // Não deve mais dizer que cada jogador RECEBE 14 cartas (o número antigo,
    // errado, na Preparação) - "14 cartas" sozinho não basta como checagem,
    // pois o texto novo legitimamente menciona "Canastra Real (14 cartas)".
    expect(text).not.toMatch(/receb\w*\s*14\s*cartas/i)
  })
})
