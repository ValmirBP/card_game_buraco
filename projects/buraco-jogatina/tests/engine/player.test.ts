import { HumanPlayer } from '../../src/engine/player'
import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

describe('HumanPlayer', () => {
  test('creates player with name and initial hand', () => {
    const cards = [new Card('hearts', '5', false)]
    const player = new HumanPlayer('Alice', cards)
    expect(player.name).toBe('Alice')
    expect(player.hand.getSize()).toBe(1)
  })

  test('adds canasta and updates score', () => {
    const player = new HumanPlayer('Alice')
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '7', false),
    ]
    const canasta = new Canasta(cards)
    player.addCanasta(canasta)
    expect(player.canastas.length).toBe(1)
    expect(player.score).toBeGreaterThan(0)
  })

  test('clone copies all properties', () => {
    const player = new HumanPlayer('Alice', [new Card('hearts', '5', false)])
    player.score = 100
    const clone = player.clone()
    expect(clone.name).toBe('Alice')
    expect(clone.score).toBe(100)
  })
})
