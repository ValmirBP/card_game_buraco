import { Game } from '../../src/engine/game'
import { HumanPlayer, Player } from '../../src/engine/player'
import { AIPlayer } from '../../src/engine/ai'
import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

function fourPlayers(): Player[] {
  return [
    new HumanPlayer('Você'),
    new AIPlayer('Adv1', 'easy'),
    new AIPlayer('Parceiro', 'easy'),
    new AIPlayer('Adv2', 'easy'),
  ]
}

function cleanCanastra(): Canasta {
  return new Canasta([
    new Card('hearts', '4', false),
    new Card('hearts', '5', false),
    new Card('hearts', '6', false),
    new Card('hearts', '7', false),
    new Card('hearts', '8', false),
    new Card('hearts', '9', false),
    new Card('hearts', '10', false),
  ])
}

describe('REPRO: zerar a mão com morto ainda disponível deve PEGAR o morto, não bater', () => {
  test('discard da última carta: time sem morto + 1 morto na mesa → pega o morto, jogo continua', () => {
    const game = new Game(fourPlayers())
    game.setup()
    const teamA = game.state.teams.find(t => t.id === 'A')!
    teamA.hasTakenMorto = false
    teamA.melds = [cleanCanastra()] // já tem canastra limpa (canClose seria true SE tivesse morto)
    game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '3', false))] // 1 morto disponível
    game.state.currentPlayerIndex = 0

    // seat 0 com 1 carta na mão
    const p0 = game.state.players[0]
    while (p0.hand.getSize() > 0) p0.hand.removeCard(0)
    p0.hand.addCard(new Card('spades', 'K', false))

    game.discard(0) // descarta a última carta

    expect(game.state.mortos.length).toBe(0)          // morto foi consumido
    expect(teamA.hasTakenMorto).toBe(true)            // time pegou o morto
    expect(p0.hand.getSize()).toBe(11)                // mão reabastecida
    expect(game.isGameOver()).toBe(false)             // NÃO acabou
  })

  test('playCanasta que zera a mão: time sem morto + morto disponível → pega o morto, não bate', () => {
    const game = new Game(fourPlayers())
    game.setup()
    const teamA = game.state.teams.find(t => t.id === 'A')!
    teamA.hasTakenMorto = false
    teamA.melds = []
    game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '3', false))]
    game.state.currentPlayerIndex = 0

    const p0 = game.state.players[0]
    while (p0.hand.getSize() > 0) p0.hand.removeCard(0)
    // mão = exatamente uma sequência limpa de 7 (baixar zera a mão)
    const seq = ['4', '5', '6', '7', '8', '9', '10'].map(r => new Card('spades', r as never, false))
    seq.forEach(c => p0.hand.addCard(c))

    const ok = game.playCanasta(seq)
    expect(ok).toBe(true)
    expect(game.state.mortos.length).toBe(0)
    expect(teamA.hasTakenMorto).toBe(true)
    expect(p0.hand.getSize()).toBe(11)
    expect(game.isGameOver()).toBe(false)
  })
})
