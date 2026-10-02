export const MELD_FONT_MAX = 18
export const MELD_FONT_MIN = 3
const FONT_STEP = 0.5
const FOOTER_KEEP_FONT = 10
const MIN_ROWS_WHEN_SPLIT = 4
const PREFERRED_MAX_SUBCOLS = 2
const RELAX_SUBCOLS_BELOW_FONT = 9

export const MELD_FRAME = 2
export const MELD_FRAME_CLOSED = 4
export const MELD_SUBCOL_GAP = 1
const DOCK_ROWS = 3

export interface MeldMetrics {
  fontPx: number
  stripW: number
  stripH: number
  footerH: number
  headerH: number
  gapX: number
  gapY: number
}

export function meldMetrics(fontPx: number, withFooter: boolean): MeldMetrics {
  return {
    fontPx,
    stripW: Math.ceil(fontPx * 2.55 + 3),
    stripH: Math.ceil(fontPx * 1.2 + 1),
    footerH: withFooter ? Math.ceil(fontPx * 1.1) : 0,
    headerH: Math.ceil(fontPx * 1.1),
    gapX: Math.max(3, Math.round(fontPx * 0.35)),
    gapY: Math.max(3, Math.round(fontPx * 0.35)),
  }
}

export interface MeldBox {
  frame: number
  headerH: number
  rows: number
  subCols: number
  width: number
  height: number
}

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
  index: number
  x: number
  y: number
}

export interface MeldLayoutInput {
  width: number
  height: number
  lengths: number[]
  closed?: boolean[]
  dockSlot: boolean
}

export interface MeldLayout {
  metrics: MeldMetrics
  maxRows: number
  placements: MeldPlacement[]
  totalWidth: number
  totalHeight: number
  fits: boolean
}

interface Packing {
  placements: MeldPlacement[]
  totalWidth: number
  totalHeight: number
}

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
    if (withFooter && maxSubColsOf(withFooter) > PREFERRED_MAX_SUBCOLS) {
      const relaxed = largestFittingWith(false, lengths, closed, dockSlot, W, H, Infinity)
      if (relaxed && (!without || relaxed.metrics.fontPx > without.metrics.fontPx)) without = relaxed
    }
    if (
      without &&
      (!withFooter ||
        without.metrics.fontPx > withFooter.metrics.fontPx ||
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
