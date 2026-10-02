import { clampToViewport } from '../../../src/components/Gameplay/flightMath'

describe('clampToViewport', () => {
  const VIEWPORT_W = 800
  const VIEWPORT_H = 360

  test('a landing point well inside the viewport is left untouched', () => {
    const result = clampToViewport(400, 180, VIEWPORT_W, VIEWPORT_H)
    expect(result).toEqual({ x: 400, y: 180 })
  })

  test('a point derived from a very wide source rect (e.g. #discard-pile, #player-hand-anchor) still lands inside the viewport', () => {
    const wideRowCenterMinusHalfWidth = 824 / 2 - 824 / 2 - 140
    const result = clampToViewport(wideRowCenterMinusHalfWidth, 40, VIEWPORT_W, VIEWPORT_H)
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.x).toBeLessThanOrEqual(VIEWPORT_W)
    expect(result.y).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeLessThanOrEqual(VIEWPORT_H)
  })

  test('clamps a point far to the left of the viewport', () => {
    const result = clampToViewport(-500, 100, VIEWPORT_W, VIEWPORT_H)
    expect(result.x).toBeGreaterThan(0)
    expect(result.x).toBeLessThan(VIEWPORT_W)
  })

  test('clamps a point far to the right of the viewport', () => {
    const result = clampToViewport(5000, 100, VIEWPORT_W, VIEWPORT_H)
    expect(result.x).toBeLessThan(VIEWPORT_W)
  })

  test('clamps a point above the viewport', () => {
    const result = clampToViewport(400, -300, VIEWPORT_W, VIEWPORT_H)
    expect(result.y).toBeGreaterThan(0)
  })

  test('clamps a point below the viewport', () => {
    const result = clampToViewport(400, 2000, VIEWPORT_W, VIEWPORT_H)
    expect(result.y).toBeLessThan(VIEWPORT_H)
  })

  test('never returns NaN or crashes on a tiny/degenerate viewport', () => {
    const result = clampToViewport(50, 50, 10, 10)
    expect(Number.isFinite(result.x)).toBe(true)
    expect(Number.isFinite(result.y)).toBe(true)
  })

  test('defaults to window.innerWidth/innerHeight when not passed explicitly', () => {
    const result = clampToViewport(window.innerWidth + 1000, window.innerHeight + 1000)
    expect(result.x).toBeLessThanOrEqual(window.innerWidth)
    expect(result.y).toBeLessThanOrEqual(window.innerHeight)
  })
})
