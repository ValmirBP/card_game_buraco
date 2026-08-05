/**
 * Table-relative seat positions so every player always sees themselves at
 * the bottom of their own screen, regardless of their actual seat index.
 * Turn order goes 0 -> 1 -> 2 -> 3 -> 0 around the table; visually we place
 * the acting seat's left-hand opponent on the left, partner (seat+2, same
 * team) opposite at the top, and right-hand opponent on the right.
 */
export type RelativePosition = 'bottom' | 'left' | 'top' | 'right'

const OFFSET_TO_POSITION: RelativePosition[] = ['bottom', 'left', 'top', 'right']

export function relativePosition(seat: number, viewSeat: number): RelativePosition {
  const offset = ((seat - viewSeat) % 4 + 4) % 4
  return OFFSET_TO_POSITION[offset]
}

/** The 3 other seats' indices in bottom-relative viewing order (left, top,
 * right), given the viewer's own seat. */
export function otherSeatsInOrder(viewSeat: number): number[] {
  return [1, 2, 3].map((offset) => (viewSeat + offset) % 4)
}
