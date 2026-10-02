import { Game } from '../../../src/engine/game'
import { HumanPlayer } from '../../../src/engine/player'
import { AIPlayer } from '../../../src/engine/ai'
import { Card } from '../../../src/engine/card'
import { canTakeDiscardPile } from '../../../src/components/Gameplay/discardRules'

function newGame(): Game {
  return new Game([
    new HumanPlayer('Você'),
    new AIPlayer('A', 'easy'),
    new AIPlayer('B', 'easy'),
    new AIPlayer('C', 'easy'),
  ])
}

describe('canTakeDiscardPile', () => {
  it('é falso com o descarte vazio', () => {
    const game = newGame()
    game.state.discardPile.length = 0
    expect(canTakeDiscardPile(game)).toBe(false)
  })

  it('é verdadeiro com 1 ou mais cartas no descarte', () => {
    const game = newGame()
    game.state.discardPile.length = 0
    game.state.discardPile.push(new Card('hearts', '5'))
    expect(canTakeDiscardPile(game)).toBe(true)
    game.state.discardPile.push(new Card('spades', 'K'))
    expect(canTakeDiscardPile(game)).toBe(true)
  })
})
