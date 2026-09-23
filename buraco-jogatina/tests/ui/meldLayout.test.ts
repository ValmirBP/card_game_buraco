import {
  computeMeldLayout,
  meldBox,
  meldMetrics,
  MELD_FONT_MAX,
  MELD_FONT_MIN,
  type MeldLayout,
} from '../../src/components/Gameplay/meldLayout'

/** Quadros de baixar carta medidos/estimados em paisagem:
 *  - TIPICO: medido no navegador a 844x390 (MeldArea.clientWidth/Height);
 *  - PEQUENO: celular de 640x360;
 *  - GRANDE: tablet/celular grande. */
const TIPICO = { width: 323, height: 221 }
const PEQUENO = { width: 215, height: 190 }
const GRANDE = { width: 420, height: 300 }
const PAINEIS = { TIPICO, PEQUENO, GRANDE }

/** A mesa de teste usada no emulador: 10 jogos, 54 cartas (uma canastra
 * real de 14, duas fechadas de 7, e jogos curtos). */
const MESA_CHEIA = [14, 7, 7, 3, 3, 3, 3, 4, 6, 4]

function assertFits(layout: MeldLayout, W: number, H: number, count: number) {
  expect(layout.fits).toBe(true)
  expect(layout.placements).toHaveLength(count)
  for (const p of layout.placements) {
    expect(p.x).toBeGreaterThanOrEqual(0)
    expect(p.y).toBeGreaterThanOrEqual(0)
    expect(p.x + p.width).toBeLessThanOrEqual(W)
    expect(p.y + p.height).toBeLessThanOrEqual(H)
    expect(Number.isFinite(p.width) && Number.isFinite(p.height)).toBe(true)
  }
  // Nenhuma caixa encosta/cobre outra.
  const ps = layout.placements
  for (let i = 0; i < ps.length; i++) {
    for (let j = i + 1; j < ps.length; j++) {
      const a = ps[i]
      const b = ps[j]
      const separate = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
      expect(separate).toBe(true)
    }
  }
  expect(layout.totalHeight).toBeLessThanOrEqual(H)
  expect(layout.totalWidth).toBeLessThanOrEqual(W)
}

/** Gerador determinístico (LCG) — mesas "aleatórias" reprodutíveis. */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function randomTable(rand: () => number, maxCards: number): number[] {
  const lengths: number[] = []
  let total = 0
  const target = 3 + Math.floor(rand() * (maxCards - 2))
  while (total + 3 <= target) {
    const len = Math.min(14, 3 + Math.floor(rand() ** 2 * 12), target - total)
    lengths.push(len)
    total += len
  }
  return lengths
}

describe('computeMeldLayout — cabe sempre, sem rolagem', () => {
  it.each(Object.entries(PAINEIS))('a mesa cheia de teste cabe no quadro %s', (_nome, painel) => {
    for (const dockSlot of [true, false]) {
      const layout = computeMeldLayout({ ...painel, lengths: MESA_CHEIA, dockSlot })
      assertFits(layout, painel.width, painel.height, MESA_CHEIA.length + (dockSlot ? 1 : 0))
    }
  })

  it('cabe em 600 mesas sorteadas (até 108 cartas, jogos de 3 a 14), em todos os tamanhos de quadro', () => {
    const rand = rng(20260923)
    for (let t = 0; t < 200; t++) {
      const lengths = randomTable(rand, 108)
      for (const painel of Object.values(PAINEIS)) {
        const layout = computeMeldLayout({ ...painel, lengths, dockSlot: t % 2 === 0 })
        assertFits(layout, painel.width, painel.height, lengths.length + (t % 2 === 0 ? 1 : 0))
      }
    }
  })

  it('casos extremos: 36 trincas (108 cartas), 7 canastras reais, um jogo só', () => {
    const extremos = [Array(36).fill(3), Array(7).fill(14), [3], [14]]
    for (const lengths of extremos) {
      for (const painel of Object.values(PAINEIS)) {
        const layout = computeMeldLayout({ ...painel, lengths, dockSlot: true })
        assertFits(layout, painel.width, painel.height, lengths.length + 1)
        expect(layout.metrics.fontPx).toBeGreaterThanOrEqual(MELD_FONT_MIN)
      }
    }
  })
})

describe('computeMeldLayout — legibilidade', () => {
  it('mesa cheia de teste: cartas com fonte de pelo menos 10px no celular típico', () => {
    const layout = computeMeldLayout({ ...TIPICO, lengths: MESA_CHEIA, dockSlot: true })
    expect(layout.metrics.fontPx).toBeGreaterThanOrEqual(10)
  })

  it('mesa cheia de teste: pelo menos 8px mesmo no celular pequeno', () => {
    const layout = computeMeldLayout({ ...PEQUENO, lengths: MESA_CHEIA, dockSlot: true })
    expect(layout.metrics.fontPx).toBeGreaterThanOrEqual(8)
  })

  it('mesa típica de meio de partida (5 jogos, 3 a 9 cartas): fonte de pelo menos 13px', () => {
    const layout = computeMeldLayout({ ...TIPICO, lengths: [3, 4, 7, 9, 5], dockSlot: true })
    expect(layout.metrics.fontPx).toBeGreaterThanOrEqual(13)
  })

  it('poucos jogos usam o tamanho máximo', () => {
    const layout = computeMeldLayout({ ...TIPICO, lengths: [3, 3], dockSlot: true })
    expect(layout.metrics.fontPx).toBe(MELD_FONT_MAX)
  })

  it('mais cartas nunca deixam a fonte maior (monotonia)', () => {
    let previous = Infinity
    for (let n = 1; n <= 30; n++) {
      const layout = computeMeldLayout({ ...TIPICO, lengths: Array(n).fill(5), dockSlot: true })
      expect(layout.metrics.fontPx).toBeLessThanOrEqual(previous)
      previous = layout.metrics.fontPx
    }
  })
})

describe('computeMeldLayout — forma dos jogos', () => {
  it('mantém a ordem em que os jogos foram baixados (leitura linha a linha)', () => {
    const layout = computeMeldLayout({ ...TIPICO, lengths: MESA_CHEIA, dockSlot: true })
    const ps = [...layout.placements].sort((a, b) => a.index - b.index)
    for (let i = 1; i < ps.length; i++) {
      const sameLine = ps[i].y === ps[i - 1].y
      if (sameLine) expect(ps[i].x).toBeGreaterThan(ps[i - 1].x)
      else expect(ps[i].y).toBeGreaterThan(ps[i - 1].y)
    }
    // O slot "Baixar" é sempre o último.
    expect(ps[ps.length - 1].index).toBe(MESA_CHEIA.length)
  })

  it('jogo longo quebra em sub-colunas balanceadas (13 → 7 + 6, 14 → 7 + 7)', () => {
    const m = meldMetrics(12, true)
    expect(meldBox(13, 11, m)).toMatchObject({ subCols: 2, rows: 7 })
    expect(meldBox(14, 7, m)).toMatchObject({ subCols: 2, rows: 7 })
    expect(meldBox(5, 11, m)).toMatchObject({ subCols: 1, rows: 5 })
  })

  it('normalmente não quebra um jogo em mais de 2 sub-colunas', () => {
    for (const painel of Object.values(PAINEIS)) {
      const layout = computeMeldLayout({ ...painel, lengths: [13, 8, 3, 5, 3, 3], dockSlot: false })
      for (const p of layout.placements) expect(p.subCols).toBeLessThanOrEqual(2)
    }
  })

  it('retrato (altura livre) usa o tamanho máximo e só quebra linhas pela largura', () => {
    const layout = computeMeldLayout({ width: 360, height: Infinity, lengths: MESA_CHEIA, dockSlot: true })
    expect(layout.metrics.fontPx).toBe(MELD_FONT_MAX)
    expect(layout.placements.every(p => p.subCols === 1)).toBe(true)
    for (const p of layout.placements) expect(p.x + p.width).toBeLessThanOrEqual(360)
  })

  it('quadro ainda sem tamanho (antes de medir) não gera NaN nem quebra', () => {
    const layout = computeMeldLayout({ width: 0, height: 0, lengths: [3, 7], dockSlot: true })
    expect(layout.fits).toBe(false)
    expect(layout.placements).toHaveLength(3)
    for (const p of layout.placements) {
      expect(Number.isFinite(p.x + p.y + p.width + p.height)).toBe(true)
    }
  })
})

describe('computeMeldLayout — rodapé de pontos vs. divisão em sub-colunas', () => {
  it('não escolhe um layout com rodapé e 3 sub-colunas quando sem rodapé dá fonte maior (~235x190)', () => {
    const layout = computeMeldLayout({ width: 235, height: 190, lengths: [4, 4, 14, 4, 4, 3, 13, 4], dockSlot: true })
    expect(layout.fits).toBe(true)
    expect(layout.metrics.fontPx).toBeGreaterThanOrEqual(10)
    expect(layout.metrics.footerH).toBe(0)
  })

  it('sem salto de fonte entre larguras vizinhas (458 vs 459) em quadro baixo', () => {
    const lengths = [14, 8, 4, 13, 4, 3, 3, 10, 4, 10, 5, 6, 5]
    const a = computeMeldLayout({ width: 458, height: 172, lengths, dockSlot: true })
    const b = computeMeldLayout({ width: 459, height: 172, lengths, dockSlot: true })
    expect(b.metrics.fontPx).toBeGreaterThanOrEqual(a.metrics.fontPx - 1)
  })
})
