export function otherSeatsInOrder(viewSeat: number): number[] {
  return [1, 2, 3].map((offset) => (viewSeat + offset) % 4)
}
