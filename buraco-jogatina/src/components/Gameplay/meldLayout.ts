/**
 * Layout dos jogos baixados de uma dupla ("quadro de baixar carta").
 *
 * Pedido do cliente: TODO jogo baixado tem que caber no quadro, qualquer que
 * seja a quantidade de jogos ou de cartas — nada de rolagem — e cada carta
 * tem que continuar identificável (número + naipe), com canastra fechada
 * visivelmente diferente.
 *
 * Cada carta vira uma "tira" (rank + naipe lado a lado, como a borda de uma
 * carta num leque) e cada jogo, uma coluna de tiras dentro de uma moldura.
 * Dado o espaço medido do quadro, procura-se o MAIOR tamanho de fonte em que
 * tudo cabe, podendo:
 *  - distribuir os jogos em várias linhas (sempre na ordem em que foram
 *    baixados — o índice do jogo é o que o clique de "estender" usa);
 *  - quebrar jogos longos em sub-colunas lado a lado dentro da MESMA moldura
 *    (ex.: uma canastra real de 14 cartas vira 7 + 7), em vez de encolher
 *    todas as cartas da mesa por causa de um único jogo alto;
 *  - esconder o rodapé de pontos de cada jogo quando ele custaria
 *    legibilidade (o total da dupla continua no cabeçalho).
 * Se nem o menor tamanho legível couber, a fonte continua diminuindo até
 * caber — cabe sempre, que foi o pedido.
 */

export const MELD_FONT_MAX = 18
export const MELD_FONT_MIN = 3
const FONT_STEP = 0.5
/** Abaixo disso, o rodapé de pontos só fica se não custar tamanho de carta. */
const FOOTER_KEEP_FONT = 10
/** Um jogo nunca é quebrado em sub-colunas com menos cartas que isso. */
const MIN_ROWS_WHEN_SPLIT = 4
/** Normalmente um jogo quebra em no máximo 2 sub-colunas — com 3 ou 4 a
 * sequência vira um bloco difícil de ler. Só passa disso se, limitado a 2,
 * a fonte ficasse abaixo deste tamanho. */
const PREFERRED_MAX_SUBCOLS = 2
const RELAX_SUBCOLS_BELOW_FONT = 9

/** Moldura fixa (px) em volta de cada jogo — reservada sempre (colorida só
 * quando a canastra está fechada ou o jogo aceita as cartas selecionadas),
 * pra todos os jogos ficarem alinhados. */
export const MELD_FRAME = 2
/** Canastra FECHADA: moldura grossa + faixa com o tipo escrito no topo
 * (REAL / 500 / LIMPA / SUJA) — pedido do cliente: "não identifico se é
 * canastra ou não" com só uma moldura fina. */
export const MELD_FRAME_CLOSED = 4
/** Espaço (px) entre as sub-colunas de um mesmo jogo quebrado. */
export const MELD_SUBCOL_GAP = 1
/** Quantas cartas de altura tem o slot tracejado "Baixar". */
const DOCK_ROWS = 3

export interface MeldMetrics {
  fontPx: number
  /** Largura de uma tira (uma carta). */
  stripW: number
  /** Altura de uma tira. */
  stripH: number
  /** Altura do rodapé com os pontos do jogo (0 = sem rodapé). */
  footerH: number
  /** Altura da faixa de tipo das canastras fechadas. */
  headerH: number
  gapX: number
  gapY: number
}

export function meldMetrics(fontPx: number, withFooter: boolean): MeldMetrics {
  return {
    fontPx,
    // "10" em negrito (~1.15em) + naipe (0.9em) + folgas laterais.
    stripW: Math.ceil(fontPx * 2.55 + 3),
    // Uma linha de texto (leading-none) + a borda que separa as tiras.
    stripH: Math.ceil(fontPx * 1.2 + 1),
    footerH: withFooter ? Math.ceil(fontPx * 1.1) : 0,
    headerH: Math.ceil(fontPx * 1.1),
    gapX: Math.max(3, Math.round(fontPx * 0.35)),
    gapY: Math.max(3, Math.round(fontPx * 0.35)),
  }
}

export interface MeldBox {
  /** Espessura da moldura e altura da faixa de tipo (0 se aberto). */
  frame: number
  headerH: number
  /** Cartas por sub-coluna (a altura do jogo em tiras). */
  rows: number
  subCols: number
  width: number
  height: number
}

/** Caixa de um jogo de `length` cartas quebrado em sub-colunas de até
 * `maxRows` cartas cada — divididas por igual (13 com limite 11 vira 7 + 6,
 * não 11 + 2). */
export function meldBox(length: number, maxRows: number, m: MeldMetrics, closed = false): MeldBox {
  const safeLen = Math.max(1, length)
  const subCols = Math.ceil(safeLen / Math.max(1, maxRows))
  const rows = Math.ceil(safeLen / subCols)
  const frame = closed ? MELD_FRAME_CLOSED : MELD_FRAME
  const headerH = closed ? m.headerH : 0
  return {
    frame,
    headerH,
    rows,
    subCols,
    width: subCols * m.stripW + (subCols - 1) * MELD_SUBCOL_GAP + 2 * frame,
    height: rows * m.stripH + 2 * frame + headerH + m.footerH,
  }
}

function dockBox(maxRows: number, m: MeldMetrics): MeldBox {
  const rows = Math.min(DOCK_ROWS, maxRows)
  return {
    frame: MELD_FRAME,
    headerH: 0,
    rows,
    subCols: 1,
    width: m.stripW + 2 * MELD_FRAME,
    height: rows * m.stripH + 2 * MELD_FRAME + m.footerH,
  }
}

export interface MeldPlacement extends MeldBox {
  /** Índice do jogo em `lengths`; `lengths.length` = o slot "Baixar". */
  index: number
  x: number
  y: number
}

export interface MeldLayoutInput {
  /** Espaço disponível, em px. */
  width: number
  /** `Infinity` = sem limite de altura (retrato: o quadro cresce). */
  height: number
  /** Quantidade de cartas de cada jogo, na ordem em que foram baixados. */
  lengths: number[]
  /** Quais jogos são canastra fechada (mesma ordem de `lengths`); ausente =
   * todos abertos. */
  closed?: boolean[]
  /** Reserva o slot tracejado "Baixar" no fim (só no quadro do jogador). */
  dockSlot: boolean
}

export interface MeldLayout {
  metrics: MeldMetrics
  /** Máximo de cartas por sub-coluna usado neste layout. */
  maxRows: number
  placements: MeldPlacement[]
  totalWidth: number
  totalHeight: number
  /** false só em casos degenerados (quadro sem tamanho, ex. antes de medir). */
  fits: boolean
}

interface Packing {
  placements: MeldPlacement[]
  totalWidth: number
  totalHeight: number
}

/**
 * Distribui as caixas em linhas CONTÍGUAS (mantém a ordem), minimizando a
 * altura total — programação dinâmica sobre onde quebrar cada linha. Devolve
 * null se alguma caixa não couber na largura ou o total passar da altura.
 */
function pack(boxes: MeldBox[], W: number, H: number, m: MeldMetrics): Packing | null {
  const n = boxes.length
  if (boxes.some(b => b.width > W)) return null

  const best = new Array<number>(n + 1).fill(Infinity)
  const prev = new Array<number>(n + 1).fill(0)
  best[0] = 0
  for (let i = 1; i <= n; i++) {
    let lineW = 0
    let lineH = 0
    for (let j = i - 1; j >= 0; j--) {
      lineW += boxes[j].width + (j < i - 1 ? m.gapX : 0)
      if (lineW > W) break
      lineH = Math.max(lineH, boxes[j].height)
      const candidate = best[j] + lineH + (j > 0 ? m.gapY : 0)
      if (candidate < best[i]) {
        best[i] = candidate
        prev[i] = j
      }
    }
  }
  if (!(best[n] <= H)) return null

  const lines: [number, number][] = []
  for (let i = n; i > 0; i = prev[i]) lines.unshift([prev[i], i])

  const placements: MeldPlacement[] = []
  let y = 0
  let totalWidth = 0
  for (const [start, end] of lines) {
    let x = 0
    let lineH = 0
    for (let k = start; k < end; k++) {
      if (k > start) x += m.gapX
      placements.push({ ...boxes[k], index: k, x, y })
      x += boxes[k].width
      lineH = Math.max(lineH, boxes[k].height)
    }
    totalWidth = Math.max(totalWidth, x)
    y += lineH + m.gapY
  }
  return { placements, totalWidth, totalHeight: n > 0 ? y - m.gapY : 0 }
}

function boxesFor(
  lengths: number[],
  closed: boolean[],
  dockSlot: boolean,
  maxRows: number,
  m: MeldMetrics
): MeldBox[] {
  const boxes = lengths.map((len, i) => meldBox(len, maxRows, m, closed[i] ?? false))
  if (dockSlot) boxes.push(dockBox(maxRows, m))
  return boxes
}

interface Candidate {
  metrics: MeldMetrics
  maxRows: number
  packing: Packing
}

/** O maior `maxRows` (menos quebras) que cabe com essa fonte, ou null.
 * `maxSubCols` = Infinity libera quantas sub-colunas forem precisas. */
function bestRowsFor(
  fontPx: number,
  withFooter: boolean,
  lengths: number[],
  closed: boolean[],
  dockSlot: boolean,
  W: number,
  H: number,
  maxSubCols: number
): Candidate | null {
  const m = meldMetrics(fontPx, withFooter)
  const longest = Math.max(DOCK_ROWS, ...lengths)
  const minRows = Math.min(longest, Math.max(MIN_ROWS_WHEN_SPLIT, Math.ceil(longest / maxSubCols)))
  for (let rows = longest; rows >= minRows; rows--) {
    const packing = pack(boxesFor(lengths, closed, dockSlot, rows, m), W, H, m)
    if (packing) return { metrics: m, maxRows: rows, packing }
  }
  return null
}

function largestFittingWith(
  withFooter: boolean,
  lengths: number[],
  closed: boolean[],
  dockSlot: boolean,
  W: number,
  H: number,
  maxSubCols: number
): Candidate | null {
  for (let f = MELD_FONT_MAX; f >= MELD_FONT_MIN; f -= FONT_STEP) {
    const found = bestRowsFor(f, withFooter, lengths, closed, dockSlot, W, H, maxSubCols)
    if (!found) continue
    // Quebrar jogos em sub-colunas só compensa se ganhar tamanho de
    // verdade: se até 1px menor já dá pra quebrar menos, fica com isso.
    let chosen = found
    for (const smaller of [f - FONT_STEP, f - 2 * FONT_STEP]) {
      if (smaller < MELD_FONT_MIN) break
      const alt = bestRowsFor(smaller, withFooter, lengths, closed, dockSlot, W, H, maxSubCols)
      if (alt && alt.maxRows > chosen.maxRows) chosen = alt
    }
    return chosen
  }
  return null
}

function largestFitting(
  withFooter: boolean,
  lengths: number[],
  closed: boolean[],
  dockSlot: boolean,
  W: number,
  H: number
): Candidate | null {
  const preferred = largestFittingWith(withFooter, lengths, closed, dockSlot, W, H, PREFERRED_MAX_SUBCOLS)
  if (preferred && preferred.metrics.fontPx >= RELAX_SUBCOLS_BELOW_FONT) return preferred
  const relaxed = largestFittingWith(withFooter, lengths, closed, dockSlot, W, H, Infinity)
  if (!preferred) return relaxed
  return relaxed && relaxed.metrics.fontPx > preferred.metrics.fontPx ? relaxed : preferred
}

function maxSubColsOf(c: Candidate): number {
  return Math.max(1, ...c.packing.placements.map(p => p.subCols))
}

export function computeMeldLayout({ width, height, lengths, closed = [], dockSlot }: MeldLayoutInput): MeldLayout {
  const W = Math.max(0, Math.floor(width))
  const H = height === Infinity ? Infinity : Math.max(0, Math.floor(height))

  const withFooter = largestFitting(true, lengths, closed, dockSlot, W, H)
  let chosen = withFooter
  if (!withFooter || withFooter.metrics.fontPx < FOOTER_KEEP_FONT) {
    let without = largestFitting(false, lengths, closed, dockSlot, W, H)
    // Se o layout COM rodapé já precisou de mais de 2 sub-colunas, o SEM
    // rodapé recebe a mesma liberdade — senão a comparação é desigual e o
    // layout com rodapé pode ganhar mesmo sendo pior em tudo.
    if (withFooter && maxSubColsOf(withFooter) > PREFERRED_MAX_SUBCOLS) {
      const relaxed = largestFittingWith(false, lengths, closed, dockSlot, W, H, Infinity)
      if (relaxed && (!without || relaxed.metrics.fontPx > without.metrics.fontPx)) without = relaxed
    }
    if (
      without &&
      (!withFooter ||
        without.metrics.fontPx > withFooter.metrics.fontPx ||
        // Empate de fonte abaixo de 10px: abre mão do rodapé se isso
        // significa menos quebras de jogo.
        (without.metrics.fontPx === withFooter.metrics.fontPx &&
          maxSubColsOf(without) < maxSubColsOf(withFooter)))
    ) {
      chosen = without
    }
  }

  if (chosen) {
    return {
      metrics: chosen.metrics,
      maxRows: chosen.maxRows,
      placements: chosen.packing.placements,
      totalWidth: chosen.packing.totalWidth,
      totalHeight: chosen.packing.totalHeight,
      fits: true,
    }
  }

  // Degenerado (quadro ainda sem tamanho medido): empilha tudo no menor
  // tamanho, uma caixa por linha, só pra renderizar algo coerente.
  const m = meldMetrics(MELD_FONT_MIN, false)
  const maxRows = Math.max(DOCK_ROWS, ...lengths)
  const boxes = boxesFor(lengths, closed, dockSlot, maxRows, m)
  const placements: MeldPlacement[] = []
  let y = 0
  boxes.forEach((box, index) => {
    placements.push({ ...box, index, x: 0, y })
    y += box.height + m.gapY
  })
  return {
    metrics: m,
    maxRows,
    placements,
    totalWidth: Math.max(0, ...boxes.map(b => b.width)),
    totalHeight: boxes.length > 0 ? y - m.gapY : 0,
    fits: false,
  }
}
