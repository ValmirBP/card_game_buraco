import { act } from '@testing-library/react'
import { useGameStore } from '../../src/store/gameStore'
import { GameSession } from '../../src/session/GameSession'
import { Card, Rank } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'
import { Hand } from '../../src/engine/hand'

const KEY = 'buraco-jogatina:saved-game'

beforeEach(() => {
  localStorage.clear()
  act(() => useGameStore.getState().resetGame())
})

describe('carta bloqueada do lixo de 1 carta nunca deixa o jogador travado', () => {
  function pegarLixoDeUmaCarta() {
    useGameStore.getState().initGame('Alice', 'hard')
    const game = useGameStore.getState().game!
    game.state.players[0].hand = new Hand([new Card('spades', '3'), new Card('spades', '4'), new Card('spades', '5')])
    game.state.discardPile = [new Card('diamonds', 'K')]
    useGameStore.getState().takeDiscardPile()
    return game
  }

  it('baixar tudo menos a carta bloqueada é recusado, e o turno pode terminar normalmente', () => {
    const game = pegarLixoDeUmaCarta()
    expect(game.wouldLeaveOnlyBlockedCard(game.state.players[0].hand.getCards().slice(0, 3))).toBe(true)
    useGameStore.getState().playCanasta([0, 1, 2])
    expect(game.state.teams[0].melds).toHaveLength(0)
    expect(game.state.players[0].hand.getSize()).toBe(4)
    useGameStore.getState().discard(0)
    expect(game.state.currentPlayerIndex).toBe(1)
  })

  it('o mesmo vale para playMelds e para estender um jogo', () => {
    const game = pegarLixoDeUmaCarta()
    expect(useGameStore.getState().playMelds([[0, 1, 2]])).toBe(false)
    game.state.teams[0].melds = [new Canasta([new Card('spades', '6'), new Card('spades', '7'), new Card('spades', '8')])]
    game.state.players[0].hand = new Hand([new Card('spades', '5'), game.state.blockedDiscardCard!])
    expect(game.extendMeld(0, [game.state.players[0].hand.getCards()[0]])).toBe(false)
  })

  it('online: a jogada é recusada com a explicação', () => {
    const s = new GameSession([0, 1, 2, 3].map(i => ({ kind: 'human' as const, name: `P${i}` })))
    const g = (s as any).game
    g.state.players[0].hand = new Hand([new Card('spades', '3'), new Card('spades', '4'), new Card('spades', '5')])
    g.state.discardPile = [new Card('diamonds', 'K')]
    expect(s.applyIntent(0, { type: 'takeDiscard' }).ok).toBe(true)
    const result = s.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1, 2] })
    expect(result.ok).toBe(false)
    expect(result.error).toMatch(/carta que pegou do lixo/)
    expect(s.applyIntent(0, { type: 'discard', cardIndex: 0 }).ok).toBe(true)
  })
})

describe('IA offline sempre descarta, mesmo quando a única carta comum é a bloqueada', () => {
  it('descarta o coringa e o lixo fica com 1 carta', () => {
    useGameStore.getState().initGame('Alice', 'hard')
    const game = useGameStore.getState().game!
    game.state.players[1].hand = new Hand([
      new Card('diamonds', '6'),
      new Card('diamonds', '7'),
      new Card('diamonds', '8'),
      new Card('hearts', '2', true),
    ])
    game.state.discardPile = [new Card('diamonds', '10')]
    game.state.currentPlayerIndex = 1
    useGameStore.getState().aiTurn()
    expect(game.state.discardPile).toHaveLength(1)
    expect(game.state.currentPlayerIndex).toBe(2)
  })
})

describe('salvar e retomar preserva os contadores do impasse', () => {
  function montar() {
    useGameStore.getState().initGame('Alice', 'hard')
    const g = useGameStore.getState().game!
    g.state.teams[0].melds = [new Canasta([new Card('clubs', '3'), new Card('clubs', '4'), new Card('clubs', '5')])]
    g.state.mortos = []
    g.state.deck = [new Card('hearts', 'K')]
    g.state.discardPile = [new Card('spades', '9')]
    g.state.players.forEach((p, i) => {
      p.hand = new Hand([new Card('diamonds', (['3', '5', '4', 'K'] as Rank[])[i])])
    })
  }
  function ciclo() {
    const g = useGameStore.getState().game!
    g.state.currentPlayerIndex = 0
    useGameStore.getState().drawFromDeck()
    useGameStore.getState().discard(g.state.players[0].hand.getSize() - 1)
  }

  it('o impasse termina no mesmo ciclo com ou sem recarregar no meio', () => {
    montar()
    let semRecarregar = 0
    while (useGameStore.getState().game!.state.status === 'playing' && semRecarregar < 60) {
      ciclo()
      semRecarregar++
    }
    expect(semRecarregar).toBeLessThan(60)

    act(() => useGameStore.getState().resetGame())
    localStorage.clear()
    montar()
    let comRecarregar = 0
    for (; comRecarregar < 6; comRecarregar++) ciclo()
    const salvo = localStorage.getItem(KEY)!
    expect(JSON.parse(salvo).gameState.stalemate).toBeDefined()
    act(() => useGameStore.getState().resetGame())
    localStorage.setItem(KEY, salvo)
    expect(useGameStore.getState().resumeSavedGame()).toBe(true)
    while (useGameStore.getState().game!.state.status === 'playing' && comRecarregar < 60) {
      ciclo()
      comRecarregar++
    }
    expect(comRecarregar).toBe(semRecarregar)
  })
})

describe('índices de carta não inteiros são sempre recusados', () => {
  it('online: descarte com índice fracionário ou NaN', () => {
    const s = new GameSession([0, 1, 2, 3].map(i => ({ kind: 'human' as const, name: `P${i}` })))
    s.applyIntent(0, { type: 'draw' })
    const g = (s as any).game
    g.state.players[0].hand = new Hand([new Card('clubs', 'K'), new Card('diamonds', '5'), new Card('spades', '7')])
    expect(s.applyIntent(0, { type: 'discard', cardIndex: 1.5 })).toEqual({ ok: false, error: 'indice de carta invalido' })
    expect(s.applyIntent(0, { type: 'discard', cardIndex: NaN })).toEqual({ ok: false, error: 'indice de carta invalido' })
    expect(g.state.players[0].hand.getSize()).toBe(3)
  })

  it('engine: discard, wouldDiscardEmptyHandIllegally e Hand.removeCard', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    const antes = game.state.players[0].hand.getSize()
    expect(game.discard(0.5)).toBe(false)
    expect(game.discard(NaN)).toBe(false)
    expect(game.wouldDiscardEmptyHandIllegally(0.5)).toBe(false)
    expect(game.state.players[0].hand.removeCard(1.2)).toBeNull()
    expect(game.state.players[0].hand.getSize()).toBe(antes)
  })
})
