import { useGameStore } from '../../src/store/gameStore'
import { Card } from '../../src/engine/card'

describe('probe: morto vira monte no fluxo real da store', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame()
  })

  test('humano compra com monte vazio e 1 morto na mesa', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    game.state.deck = []
    game.state.mortos = [Array.from({ length: 11 }, () => new Card('hearts', '4', false))]
    const handBefore = game.getCurrentPlayer().hand.getSize()

    useGameStore.getState().drawFromDeck()

    expect(game.getCurrentPlayer().hand.getSize()).toBe(handBefore + 1)
    expect(game.state.mortos.length).toBe(0)
    expect(game.state.deck.length).toBe(10)
    expect(game.state.status).toBe('playing')
  })

  test('IA compra com monte vazio e 1 morto na mesa (aiTurn completo)', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    useGameStore.getState().discard(0) // passa pro assento 1 (IA)
    game.state.deck = []
    game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '6', false))]
    // Esvazia o descarte para forçar a IA a comprar do monte (com pilha de
    // descarte útil ela poderia optar por "pegar o descarte" e não promover o
    // morto — o que tornava este teste intermitente).
    game.state.discardPile = []

    useGameStore.getState().aiTurn()

    expect(game.state.mortos.length).toBe(0)
    expect(game.state.deck.length).toBeGreaterThan(0)
    expect(game.state.status).toBe('playing')
    expect(game.state.currentPlayerIndex).toBe(2)
  })

  test('conversão IMEDIATA: comprar a última carta do monte já promove o morto na hora', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    game.state.deck = [new Card('diamonds', '9', false)] // última carta
    game.state.mortos = [Array.from({ length: 11 }, () => new Card('hearts', '3', false))]

    useGameStore.getState().drawFromDeck()

    // O morto já virou monte no mesmo instante — a mesa nunca mostra
    // "monte vazio" com morto parado.
    expect(game.state.mortos.length).toBe(0)
    expect(game.state.deck.length).toBe(11)
    expect(useGameStore.getState().gameLog.some(l => l.includes('virou o novo monte'))).toBe(true)
  })

  test('parceiro pegou o morto e monte esvazia: morto restante vira monte no próximo turno', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    const game = useGameStore.getState().game!
    game.state.teams.find(t => t.id === 'A')!.hasTakenMorto = true
    game.state.mortos = [Array.from({ length: 11 }, () => new Card('spades', '8', false))]
    game.state.deck = []

    const handBefore = game.getCurrentPlayer().hand.getSize()
    useGameStore.getState().drawFromDeck()

    expect(game.getCurrentPlayer().hand.getSize()).toBe(handBefore + 1)
    expect(game.state.mortos.length).toBe(0)
    expect(game.state.deck.length).toBe(10)
    expect(game.isGameOver()).toBe(false)
  })
})
