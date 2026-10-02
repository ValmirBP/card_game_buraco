import { otherSeatsInOrder } from '../../src/online/seatLayout'

describe('otherSeatsInOrder', () => {
  it('devolve [esquerda, topo, direita] na ordem de turno, dando a volta na mesa', () => {
    expect(otherSeatsInOrder(0)).toEqual([1, 2, 3])
    expect(otherSeatsInOrder(1)).toEqual([2, 3, 0])
    expect(otherSeatsInOrder(2)).toEqual([3, 0, 1])
    expect(otherSeatsInOrder(3)).toEqual([0, 1, 2])
  })

  it('o do meio é sempre o parceiro (assento + 2) e nunca inclui o próprio assento', () => {
    for (let seat = 0; seat < 4; seat++) {
      const others = otherSeatsInOrder(seat)
      expect(others[1]).toBe((seat + 2) % 4)
      expect(others).not.toContain(seat)
      expect(new Set(others).size).toBe(3)
    }
  })
})
