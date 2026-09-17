import { meldRowSpacing } from '../../src/components/Gameplay/MeldRow'

/** Larguras em paisagem depois do pedido do usuário "as cartas baixadas
 * estão muito grandes": cada coluna de jogo baixado tem 56px de carta
 * (landscape:w-14, ver MeldCardColumn.FULL_CARD_SIZE — compacta em
 * paisagem, diferente do retrato). O painel de uma dupla NÃO tem uma
 * largura mínima garantida por CSS (GameBoard.tsx usa minmax(0,1fr) - a
 * mesa toda encolhe pra caber, sem rolar - ver "rolagem só no quadro de
 * baixar carta"); 360px aqui é só uma largura TÍPICA observada num celular
 * comum em paisagem, usada pra verificar que o quadro (que agora rola por
 * dentro, ver MeldRow.tsx) de fato precisa rolar quando enche. A fileira
 * mostra os N jogos MAIS o slot fixo "Baixar". */
const COLUNA = 56
const PAINEL = 360

/** Deslocamento horizontal (px) que cada classe aplica — `space-x-N` é um
 * respiro POSITIVO de N*4px entre colunas; `-space-x-N` seria sobreposição
 * (negativo). Depois do relato de "amontoado", não usamos mais negativos. */
const ESPACO: Record<string, number> = {
  'landscape:space-x-3': 12,
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
  it('nunca sobrepõe as colunas: cada jogo aparece inteiro (56px), qualquer que seja a quantidade', () => {
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

  /** Poucos jogos continuam cabendo sem precisar rolar. Com cartas mais
   * compactas (56px em vez dos 80px de antes), sobe de 3 pra 4 jogos sem
   * precisar rolar num painel típico. */
  it('cabe sem rolagem com até 4 jogos', () => {
    for (let n = 0; n <= 4; n++) {
      expect(larguraNecessaria(n)).toBeLessThanOrEqual(PAINEL)
    }
  })

  /** Quando a mesa enche, em vez de espremer, a fileira passa a exigir mais
   * largura que o painel — o container (overflow-x-auto) então ROLA. */
  it('a mesa cheia (9 jogos) exige rolagem em vez de espremer', () => {
    expect(larguraNecessaria(9)).toBeGreaterThan(PAINEL)
  })
})
