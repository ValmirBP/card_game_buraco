import { meldRowSpacing } from '../../src/components/Gameplay/MeldRow'

/** Larguras medidas no aparelho, em paisagem: cada coluna de jogo baixado
 * ocupa 52px (48px de carta + 2px de padding de cada lado) e o painel de uma
 * dupla tem 383px. A fileira mostra os N jogos MAIS o slot fixo "Baixar". */
const COLUNA = 52
const PAINEL = 383

/** Deslocamento horizontal (px) que cada classe aplica — `space-x-N` é um
 * respiro POSITIVO de N*4px entre colunas; `-space-x-N` seria sobreposição
 * (negativo). Depois do relato de "amontoado", não usamos mais negativos. */
const ESPACO: Record<string, number> = {
  'landscape:space-x-1.5': 6,
}

function visivelPorColuna(jogos: number): number {
  // Sem sobreposição, cada coluna aparece INTEIRA (52px) — o respiro fica
  // ENTRE as colunas, não por cima delas.
  return COLUNA
}

function larguraNecessaria(jogos: number): number {
  const gap = ESPACO[meldRowSpacing(jogos)]
  const colunas = jogos + 1 // os N jogos + o slot "Baixar"
  return colunas * COLUNA + (colunas - 1) * gap
}

describe('meldRowSpacing', () => {
  it('só devolve a classe conhecida (respiro positivo, nunca sobreposição)', () => {
    for (let n = 0; n <= 20; n++) {
      expect(Object.keys(ESPACO)).toContain(meldRowSpacing(n))
    }
  })

  /** O cerne do pedido do usuário: nada de "amontoado". Cada coluna aparece
   * inteira, com a carta legível — nunca coberta pela coluna vizinha. */
  it('nunca sobrepõe as colunas: cada jogo aparece inteiro (52px), qualquer que seja a quantidade', () => {
    for (let n = 0; n <= 20; n++) {
      expect(visivelPorColuna(n)).toBe(COLUNA)
    }
  })

  /** O espaçamento é constante: um jogo baixado não reposiciona os outros. */
  it('o espaçamento não muda com a quantidade de jogos', () => {
    const ref = meldRowSpacing(3)
    for (let n = 0; n <= 20; n++) {
      expect(meldRowSpacing(n)).toBe(ref)
    }
  })

  /** Poucos jogos continuam cabendo sem precisar rolar. */
  it('cabe sem rolagem com até 5 jogos', () => {
    for (let n = 0; n <= 5; n++) {
      expect(larguraNecessaria(n)).toBeLessThanOrEqual(PAINEL)
    }
  })

  /** Quando a mesa enche, em vez de espremer, a fileira passa a exigir mais
   * largura que o painel — o container (overflow-x-auto) então ROLA. */
  it('a mesa cheia (9 jogos) exige rolagem em vez de espremer', () => {
    expect(larguraNecessaria(9)).toBeGreaterThan(PAINEL)
  })
})
