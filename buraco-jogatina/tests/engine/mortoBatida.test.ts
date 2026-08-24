import { Game } from '../../src/engine/game'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer } from '../../src/engine/ai'
import { Card, Rank } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

/**
 * Esvaziar a mão baixando um jogo: quando é permitido, e por quê. Motivado
 * pelo relato de não conseguir baixar o trio 3-5-2 (do mesmo naipe) para
 * esvaziar a mão.
 *
 * A regra que o motor implementa (e que estes testes travam):
 *   - Se AINDA HÁ MORTO na mesa e o time não pegou nenhum, esvaziar a mão é
 *     SEMPRE permitido — o jogador pega o morto (batida direta). NÃO precisa
 *     de canastra limpa.
 *   - Se o morto já foi pego (ou não há mais morto), esvaziar a mão é uma
 *     BATIDA, e aí sim exige canastra limpa.
 */

function jogoReal(): Game {
  const g = new Game([
    new HumanPlayer('Você'),
    new AIPlayer('B1', 'easy'),
    new AIPlayer('B2', 'easy'),
    new AIPlayer('B3', 'easy'),
  ])
  g.setup() // cria os 2 mortos, distribui as mãos, monta o baço
  return g
}

const H = (r: string) => new Card('hearts', r as Rank, false)

/** O trio relatado: 3, 5 e 2 do mesmo naipe (o 2 vira o 4 -> 3-4-5, limpa). */
function trio352(): Card[] {
  return [H('3'), H('5'), new Card('hearts', '2', false)]
}

function canastraLimpa(): Canasta {
  return new Canasta(['5', '6', '7', '8', '9', '10', 'J'].map(r => new Card('spades', r as Rank, false)))
}

/** Deixa a mão do humano exatamente com `cards` (sem tocar em mortos/deck). */
function setHand(g: Game, cards: Card[]): void {
  const p = g.state.players[0]
  while (p.hand.getCards().length) p.hand.removeCard(0)
  cards.forEach(c => p.hand.addCard(c))
  g.state.currentPlayerIndex = 0
}

describe('esvaziar a mão baixando o trio 3-5-2 (batida direta vs. batida)', () => {
  it('COM morto na mesa e SEM canastra limpa: baixa e PEGA o morto', () => {
    const g = jogoReal()
    const teamA = g.state.teams.find(t => t.id === 'A')!
    expect(g.state.mortos.length).toBe(2) // morto disponível
    expect(teamA.hasTakenMorto).toBe(false)
    teamA.melds = [] // nenhuma canastra
    setHand(g, trio352())

    expect(g.playCanasta(trio352())).toBe(true)
    expect(teamA.hasTakenMorto).toBe(true) // pegou o morto
    expect(g.state.players[0].hand.getCards().length).toBe(11) // mão nova do morto
  })

  it('COM morto na mesa e COM canastra limpa: também baixa e pega o morto', () => {
    const g = jogoReal()
    const teamA = g.state.teams.find(t => t.id === 'A')!
    teamA.melds = [canastraLimpa()]
    setHand(g, trio352())

    expect(g.playCanasta(trio352())).toBe(true)
    expect(teamA.hasTakenMorto).toBe(true)
  })

  it('morto JÁ pego e SEM canastra limpa: recusa (não dá pra bater)', () => {
    const g = jogoReal()
    const teamA = g.state.teams.find(t => t.id === 'A')!
    teamA.hasTakenMorto = true
    teamA.melds = []
    setHand(g, trio352())

    expect(g.playCanasta(trio352())).toBe(false)
    expect(g.state.players[0].hand.getCards().length).toBe(3) // nada removido
  })

  it('morto JÁ pego e COM canastra limpa: baixa e BATE (mão fica em 0)', () => {
    const g = jogoReal()
    const teamA = g.state.teams.find(t => t.id === 'A')!
    teamA.hasTakenMorto = true
    teamA.melds = [canastraLimpa()]
    setHand(g, trio352())

    expect(g.playCanasta(trio352())).toBe(true)
    expect(g.state.players[0].hand.getCards().length).toBe(0) // bateu
  })

  it('SEM morto na mesa e SEM canastra limpa: recusa', () => {
    const g = jogoReal()
    const teamA = g.state.teams.find(t => t.id === 'A')!
    g.state.mortos = [] // ninguém mais pode pegar morto
    teamA.hasTakenMorto = false
    teamA.melds = []
    setHand(g, trio352())

    expect(g.playCanasta(trio352())).toBe(false)
  })

  it('com muitas cartas na mão, baixar o trio nunca é bloqueado (não esvazia a mão)', () => {
    const g = jogoReal()
    const teamA = g.state.teams.find(t => t.id === 'A')!
    teamA.hasTakenMorto = true // mesmo sem poder pegar morto
    teamA.melds = [] // e sem canastra limpa
    const filler = ['K', '9', 'J', 'Q', '7'].map(
      (r, i) => new Card((['clubs', 'spades', 'diamonds'] as const)[i % 3], r as Rank, false)
    )
    setHand(g, [...trio352(), ...filler]) // 8 cartas: sobra 5 depois de baixar

    expect(g.playCanasta(trio352())).toBe(true)
    expect(g.state.players[0].hand.getCards().length).toBe(5)
  })
})
