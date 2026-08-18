/** Metade do maior footprint de fantasma usado nas animações (carta em
 * sm:, ~80x112px) + uma folga - usado só como raio de segurança pro
 * clamp, não precisa ser exato (a carta real fica centrada no ponto
 * calculado via CSS, não medida em JS). */
const GHOST_HALF_WIDTH = 48
const GHOST_HALF_HEIGHT = 64

/**
 * Garante que um ponto de pouso (centro do fantasma) fique dentro da janela,
 * com uma margem de meio-fantasma - rede de segurança final para qualquer
 * `toRect` inesperado (ex.: um elemento perto da borda da tela). Pura e
 * testável isoladamente das animações do Framer Motion.
 */
export function clampToViewport(
  x: number,
  y: number,
  viewportWidth: number = window.innerWidth,
  viewportHeight: number = window.innerHeight
): { x: number; y: number } {
  const minX = GHOST_HALF_WIDTH
  const maxX = Math.max(minX, viewportWidth - GHOST_HALF_WIDTH)
  const minY = GHOST_HALF_HEIGHT
  const maxY = Math.max(minY, viewportHeight - GHOST_HALF_HEIGHT)
  return {
    x: Math.min(Math.max(x, minX), maxX),
    y: Math.min(Math.max(y, minY), maxY),
  }
}
