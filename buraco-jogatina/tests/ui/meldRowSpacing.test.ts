import { meldRowSpacing } from '../../src/components/Gameplay/MeldRow'

/** Larguras medidas no aparelho, em paisagem: cada coluna de jogo baixado
 * ocupa 52px (48px de carta + 2px de padding de cada lado) e o painel de uma
 * dupla tem 383px. A fileira mostra os N jogos MAIS o slot fixo "Baixar". */
const COLUNA = 52
const PAINEL = 383

/** Sobreposição (px) que cada classe aplica — `-space-x-N` vira margin-left
 * negativa de N*4px; `space-x-N`, positiva. */
const SOBREPOSICAO: Record<string, number> = {
  'landscape:space-x-1.5': -6,
  'landscape:space-x-0': 0,
  'landscape:-space-x-3': 12,
}

function larguraNecessaria(jogos: number): number {
  const passo = COLUNA - SOBREPOSICAO[meldRowSpacing(jogos)]
  return COLUNA + jogos * passo // N jogos + o slot "Baixar"
}

function visivelPorColuna(jogos: number): number {
  return COLUNA - SOBREPOSICAO[meldRowSpacing(jogos)]
}

describe('meldRowSpacing', () => {
  it('só devolve classes conhecidas', () => {
    for (let n = 0; n <= 20; n++) {
      expect(Object.keys(SOBREPOSICAO)).toContain(meldRowSpacing(n))
    }
  })

  /** A regressão que o usuário relatou: pra caber tudo sem rolagem as
   * colunas eram espremidas até 28px (9 jogos) e 20px (11) — "vira uma
   * zona". Agora a compressão tem piso. */
  it('nunca espreme uma coluna abaixo de 40px, por mais cheia que a mesa fique', () => {
    for (let n = 0; n <= 20; n++) {
      expect(visivelPorColuna(n)).toBeGreaterThanOrEqual(40)
    }
  })

  it('cabe sem rolagem até 8 jogos', () => {
    for (let n = 0; n <= 8; n++) {
      expect(larguraNecessaria(n)).toBeLessThanOrEqual(PAINEL)
    }
  })

  it('a partir do 9º jogo passa a rolar em vez de espremer mais', () => {
    expect(larguraNecessaria(9)).toBeGreaterThan(PAINEL)
    // e a coluna continua no piso, não encolhe junto
    expect(visivelPorColuna(9)).toBe(visivelPorColuna(20))
  })

  /** A compressão só pode andar num sentido: mesa mais cheia nunca deixa as
   * colunas MAIS largas. (A largura total da fileira, essa sim, dá um degrau
   * pra baixo quando a compressão entra, no 7º jogo — é o efeito desejado:
   * apertar um pouco pra adiar a rolagem.) */
  it('a coluna nunca fica mais larga ao baixar mais um jogo', () => {
    for (let n = 1; n <= 20; n++) {
      expect(visivelPorColuna(n)).toBeLessThanOrEqual(visivelPorColuna(n - 1))
    }
  })
})
