const GHOST_HALF_WIDTH = 48
const GHOST_HALF_HEIGHT = 64

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
