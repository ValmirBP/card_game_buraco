import { render, screen } from '@testing-library/react'
import MeldArea, { footerClass, frameClass, isWildStrip, meldSuitOf, type MeldAreaMeld } from '../../src/components/Gameplay/MeldArea'
import { Card } from '../../src/engine/card'

const cards = (suit: 'hearts' | 'diamonds' | 'spades', ranks: string[]) =>
  ranks.map(r => new Card(suit, r as never))

function meld(overrides: Partial<MeldAreaMeld> = {}): MeldAreaMeld {
  return {
    strips: cards('hearts', ['3', '4', '5']).map(card => ({ card, wild: false })),
    closed: false,
    clean: true,
    kind: 'simples',
    points: 15,
    highlight: null,
    onClick: () => {},
    ...overrides,
  }
}

describe('frameClass / footerClass — o realce "compatível" nunca muda a leitura aberta/fechada', () => {
  const estados = [
    { nome: 'aberto', m: { closed: false, clean: true } },
    { nome: 'canastra limpa', m: { closed: true, clean: true } },
    { nome: 'canastra suja', m: { closed: true, clean: false } },
  ]

  it.each(estados)('$nome: mesma cor de moldura e de rodapé com ou sem realce', ({ m }) => {
    const base = meld(m)
    const realcado = meld({ ...m, highlight: 'compatible' })
    const semContorno = (c: string) => c.split(' ').filter(x => !/outline|shadow/.test(x)).join(' ')
    expect(semContorno(frameClass(realcado))).toBe(frameClass(base))
    expect(footerClass(realcado)).toBe(footerClass(base))
    expect(frameClass(realcado)).toContain('outline-sky-300')
  })

  it('aberto, canastra limpa e canastra suja têm molduras diferentes entre si', () => {
    const aberto = frameClass(meld({ closed: false }))
    const limpa = frameClass(meld({ closed: true, clean: true }))
    const suja = frameClass(meld({ closed: true, clean: false }))
    expect(new Set([aberto, limpa, suja]).size).toBe(3)
  })

  it('um jogo aberto compatível NÃO ganha o dourado da canastra fechada', () => {
    expect(frameClass(meld({ closed: false, highlight: 'compatible' }))).not.toContain('bg-card-gold')
  })
})

describe('isWildStrip — mesma regra do engine (2 só é natural no naipe do jogo, na posição 2)', () => {
  it('2 do mesmo naipe na posição 2 é natural', () => {
    expect(isWildStrip(new Card('hearts', '2'), 2, 'hearts')).toBe(false)
  })
  it('2 de OUTRO naipe na posição 2 é curinga (jogo sujo)', () => {
    expect(isWildStrip(new Card('spades', '2'), 2, 'hearts')).toBe(true)
  })
  it('2 fora da posição 2 é curinga; coringa é sempre curinga', () => {
    expect(isWildStrip(new Card('hearts', '2'), 5, 'hearts')).toBe(true)
    expect(isWildStrip(new Card('hearts', '2', true), 2, 'hearts')).toBe(true)
  })
  it('carta comum nunca é curinga', () => {
    expect(isWildStrip(new Card('hearts', '7'), 7, 'hearts')).toBe(false)
  })
  it('meldSuitOf ignora coringas e 2s', () => {
    expect(meldSuitOf([new Card('spades', '2'), new Card('hearts', '2', true), new Card('diamonds', '4')])).toBe('diamonds')
  })
})

describe('MeldArea — renderiza todos os jogos, identificáveis', () => {
  it('cada jogo é um grupo com descrição de cartas, tipo e pontos; canastra fechada é marcada', () => {
    render(
      <MeldArea
        melds={[
          meld(),
          meld({
            strips: cards('spades', ['3', '4', '5', '6', '7', '8', '9']).map(card => ({ card, wild: false })),
            closed: true,
            kind: 'limpa',
            points: 245,
          }),
        ]}
      />
    )
    const grupos = screen.getAllByRole('group')
    expect(grupos).toHaveLength(2)
    expect(grupos[0].getAttribute('aria-label')).toMatch(/Jogo limpo, 15 pontos: 3 de copas, 4 de copas, 5 de copas/)
    expect(grupos[1].getAttribute('aria-label')).toMatch(/Canastra limpa, 245 pontos: 3 de espadas/)
    expect(grupos[0].getAttribute('data-meld-closed')).toBeNull()
    expect(grupos[1].getAttribute('data-meld-closed')).toBe('true')
  })
})
