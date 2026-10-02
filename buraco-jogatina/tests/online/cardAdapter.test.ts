import { asCard, asCards } from '../../src/online/cardAdapter'
import { canExtendMeld } from '../../src/engine/utils'
import type { PlainCard } from '../../src/session/types'

const plain = (suit: string, rank: string, isWild = false): PlainCard => ({ suit, rank, isWild })

describe('cardAdapter', () => {
  it('asCard e asCards preservam os campos e a identidade (só estreitam o tipo)', () => {
    const p = plain('hearts', '7')
    expect(asCard(p)).toBe(p)
    const list = [p, plain('spades', 'K', false)]
    expect(asCards(list)).toBe(list)
  })

  it('cartas do protocolo funcionam nos helpers do engine', () => {
    const meld = asCards([plain('hearts', '5'), plain('hearts', '6'), plain('hearts', '7')])
    expect(canExtendMeld(meld, asCards([plain('hearts', '8')]))).toBe(true)
    expect(canExtendMeld(meld, asCards([plain('spades', '8')]))).toBe(false)
  })
})
