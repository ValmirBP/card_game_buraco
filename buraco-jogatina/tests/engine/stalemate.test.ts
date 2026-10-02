import { Game, STALEMATE_RECYCLES } from '../../src/engine/game'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer } from '../../src/engine/ai'
import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

function jogo(): Game {
  const g = new Game([
    new HumanPlayer('Você'),
    new AIPlayer('B1', 'easy'),
    new AIPlayer('B2', 'easy'),
    new AIPlayer('B3', 'easy'),
  ])
  g.setup()
  g.state.mortos = []
  g.state.deck = [new Card('hearts', 'K')]
  g.state.discardPile = [new Card('spades', '9')]
  g.state.currentPlayerIndex = 0
  return g
}

function compraEDescarta(g: Game): void {
  const carta = g.drawFromDeck()
  if (!carta) throw new Error('monte vazio: o ciclo do impasse acabou')
  g.state.players[0].hand.addCard(carta)
  g.discard(g.state.players[0].hand.getSize() - 1)
}

describe('impasse: monte de 1 carta + lixo de 1 carta circulando para sempre', () => {
  it('termina a rodada depois de STALEMATE_RECYCLES reembaralhadas sem nenhuma carta nova na mesa', () => {
    const g = jogo()
    while (g.state.discardRecycles < STALEMATE_RECYCLES - 1) {
      compraEDescarta(g)
      expect(g.isGameOver()).toBe(false)
    }
    compraEDescarta(g)
    expect(g.state.discardRecycles).toBe(STALEMATE_RECYCLES)
    expect(g.isGameOver()).toBe(true)
  })

  it('jogar cartas na mesa zera a contagem: o jogo segue', () => {
    const g = jogo()
    g.isGameOver()
    while (g.state.discardRecycles < STALEMATE_RECYCLES - 2) compraEDescarta(g)
    g.state.teams[0].melds.push(
      new Canasta([new Card('clubs', '3'), new Card('clubs', '4'), new Card('clubs', '5')])
    )
    expect(g.isGameOver()).toBe(false)
    const marca = g.state.discardRecycles
    while (g.state.discardRecycles < marca + STALEMATE_RECYCLES - 1) compraEDescarta(g)
    expect(g.isGameOver()).toBe(false)
    compraEDescarta(g)
    expect(g.isGameOver()).toBe(true)
  })

  it('uma rodada com monte grande nunca é considerada impasse', () => {
    const g = new Game([
      new HumanPlayer('Você'),
      new AIPlayer('B1', 'easy'),
      new AIPlayer('B2', 'easy'),
      new AIPlayer('B3', 'easy'),
    ])
    g.setup()
    expect(g.isGameOver()).toBe(false)
    expect(g.state.discardRecycles).toBe(0)
  })

  it('o impasse é preservado ao clonar o jogo', () => {
    const g = jogo()
    g.isGameOver()
    while (g.state.discardRecycles < STALEMATE_RECYCLES) compraEDescarta(g)
    expect(g.clone().isGameOver()).toBe(true)
  })

  it('finish() num impasse fecha a rodada sem bônus de batida', () => {
    const g = jogo()
    g.isGameOver()
    while (g.state.discardRecycles < STALEMATE_RECYCLES) compraEDescarta(g)
    g.finish()
    expect(g.state.status).toBe('finished')
    expect(g.state.scoreBreakdowns!.every(b => b.batidaBonus === 0)).toBe(true)
  })
})
