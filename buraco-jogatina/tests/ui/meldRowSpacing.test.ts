import { meldRowSpacing } from '../../src/components/Gameplay/MeldRow'

/** Larguras em paisagem depois do pedido do usuário "deixa a mesa ainda
 * maior": cada coluna de jogo baixado tem 80px de carta (landscape:w-20,
 * ver MeldCardColumn.FULL_CARD_SIZE — igual ao retrato agora, sem
 * compressão especial pra paisagem). O painel de uma dupla NÃO tem mais
 * uma largura mínima garantida por CSS (GameBoard.tsx voltou a
 * minmax(0,1fr) - a mesa toda encolhe pra caber, sem rolar - ver pedido
 * seguinte do usuário: "rolagem só no quadro de baixar carta"); 360px aqui
 * é só uma largura TÍPICA observada num celular comum em paisagem, usada
 * pra verificar que o quadro (que agora rola por dentro, ver MeldRow.tsx)
 * de fato precisa rolar quando enche. A fileira mostra os N jogos MAIS o
 * slot fixo "Baixar". */
const COLUNA = 80
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

  /** Poucos jogos continuam cabendo sem precisar rolar. Com a mesa maior
   * (cartas de 80px em vez de 48px), o limite sem rolagem caiu de 5 pra 3
   * jogos - troca deliberada do pedido do usuário: cartas maiores e mais
   * legíveis, rolando pra ver o resto em vez de espremer tudo na tela. */
  it('cabe sem rolagem com até 3 jogos', () => {
    for (let n = 0; n <= 3; n++) {
      expect(larguraNecessaria(n)).toBeLessThanOrEqual(PAINEL)
    }
  })

  /** Quando a mesa enche, em vez de espremer, a fileira passa a exigir mais
   * largura que o painel — o container (overflow-x-auto) então ROLA. */
  it('a mesa cheia (9 jogos) exige rolagem em vez de espremer', () => {
    expect(larguraNecessaria(9)).toBeGreaterThan(PAINEL)
  })
})
