import { act, fireEvent, render, screen } from '@testing-library/react'
import GameBoard from '../../../src/components/Gameplay/GameBoard'
import { useGameStore } from '../../../src/store/gameStore'
import { Card } from '../../../src/engine/card'
import { Canasta } from '../../../src/engine/canasta'
import { Hand } from '../../../src/engine/hand'

const run = (suit: 'hearts' | 'spades' | 'diamonds', ranks: string[]) =>
  ranks.map(r => new Card(suit, r as never))

function setup() {
  const handlers = {
    onDraw: jest.fn(),
    onPlayCanastaSelected: jest.fn(),
    onExtendMeld: jest.fn(),
  }
  useGameStore.getState().initGame('Alice', 'easy')
  const game = useGameStore.getState().game!
  game.state.currentPlayerIndex = 0
  game.state.status = 'playing'
  return { game, handlers }
}

function renderBoard(phase: 'draw' | 'play', handlers: ReturnType<typeof setup>['handlers']) {
  return render(<GameBoard phase={phase} {...handlers} />)
}

describe('GameBoard', () => {
  afterEach(() => act(() => useGameStore.getState().resetGame()))

  it('sem jogos baixados mostra o aviso nos dois quadros', () => {
    const { handlers } = setup()
    renderBoard('draw', handlers)
    expect(screen.getAllByText('Nenhum jogo baixado ainda')).toHaveLength(2)
  })

  it('cada jogo baixado vira um grupo identificável (tipo, pontos e cartas) em cada dupla', () => {
    const { game, handlers } = setup()
    game.state.teams[0].melds = [new Canasta(run('hearts', ['5', '6', '7', '8', '9', '10', 'J']))]
    game.state.teams[1].melds = [new Canasta(run('spades', ['3', '4', '5']))]
    renderBoard('play', handlers)

    const grupos = screen.getAllByRole('group')
    expect(grupos).toHaveLength(2)
    expect(grupos[0].getAttribute('aria-label')).toMatch(/^Canastra limpa, \d+ pontos: 5 de copas/)
    expect(grupos[0].getAttribute('data-meld-closed')).toBe('true')
    expect(screen.getByText('LIMPA')).toBeInTheDocument()
    expect(grupos[1].getAttribute('aria-label')).toMatch(/^Jogo limpo, \d+ pontos: 3 de espadas/)
    expect(grupos[1].getAttribute('data-meld-closed')).toBeNull()
  })

  it('o placar de cada dupla conta as canastras fechadas', () => {
    const { game, handlers } = setup()
    game.state.teams[0].melds = [
      new Canasta(run('hearts', ['5', '6', '7', '8', '9', '10', 'J'])),
      new Canasta(run('spades', ['3', '4', '5'])),
    ]
    renderBoard('play', handlers)
    expect(screen.getByText(/· 1 can\./)).toBeInTheDocument()
  })

  it('clicar no monte na fase de compra chama onDraw', () => {
    const { handlers } = setup()
    const { container } = renderBoard('draw', handlers)
    const monte = container.querySelector('[data-deck-pile]') as HTMLElement
    fireEvent.click(monte)
    expect(handlers.onDraw).toHaveBeenCalledTimes(1)
  })

  it('clicar no monte fora da fase de compra não compra e avisa', () => {
    const { handlers } = setup()
    const { container } = renderBoard('play', handlers)
    fireEvent.click(container.querySelector('[data-deck-pile]') as HTMLElement)
    expect(handlers.onDraw).not.toHaveBeenCalled()
    expect(screen.getByText('Descarte uma carta antes de comprar de novo.')).toBeInTheDocument()
  })

  it('o slot "Baixar" só baixa com 3+ cartas selecionadas formando jogo válido', () => {
    const { game, handlers } = setup()
    game.state.teams[0].melds = [new Canasta(run('spades', ['3', '4', '5']))]
    game.state.players[0].hand = new Hand(run('hearts', ['4', '5', '6', 'K']))
    useGameStore.setState({ selectedCardIndices: [0, 1] })
    renderBoard('play', handlers)
    fireEvent.click(screen.getByLabelText('Baixar jogo novo'))
    expect(handlers.onPlayCanastaSelected).not.toHaveBeenCalled()
    expect(screen.getByText('Selecione 3 ou mais cartas para baixar uma canastra.')).toBeInTheDocument()
  })

  it('com seleção válida o slot "Baixar" chama onPlayCanastaSelected', () => {
    const { game, handlers } = setup()
    game.state.teams[0].melds = [new Canasta(run('spades', ['3', '4', '5']))]
    game.state.players[0].hand = new Hand(run('hearts', ['4', '5', '6', 'K']))
    useGameStore.setState({ selectedCardIndices: [0, 1, 2] })
    renderBoard('play', handlers)
    fireEvent.click(screen.getByLabelText('Baixar jogo novo'))
    expect(handlers.onPlayCanastaSelected).toHaveBeenCalledTimes(1)
  })

  it('clicar num jogo seu com cartas que o estendem chama onExtendMeld com o índice do jogo', () => {
    const { game, handlers } = setup()
    game.state.teams[0].melds = [new Canasta(run('spades', ['3', '4', '5'])), new Canasta(run('hearts', ['5', '6', '7']))]
    game.state.players[0].hand = new Hand(run('hearts', ['8', 'K', 'Q', 'J', '9', '10']))
    useGameStore.setState({ selectedCardIndices: [0] })
    renderBoard('play', handlers)

    const alvo = screen.getAllByRole('group').find(g => g.getAttribute('aria-label')!.includes('5 de copas'))!
    fireEvent.click(alvo)
    expect(handlers.onExtendMeld).toHaveBeenCalledTimes(1)
    expect(handlers.onExtendMeld.mock.calls[0][0]).toBe(1)
    expect(handlers.onExtendMeld.mock.calls[0][1]).toEqual([0])
  })

  it('cartas que não estendem o jogo: não chama onExtendMeld e mostra o motivo', () => {
    const { game, handlers } = setup()
    game.state.teams[0].melds = [new Canasta(run('hearts', ['5', '6', '7']))]
    game.state.players[0].hand = new Hand(run('spades', ['K', 'Q', 'J']))
    useGameStore.setState({ selectedCardIndices: [0] })
    renderBoard('play', handlers)
    fireEvent.click(screen.getByRole('group'))
    expect(handlers.onExtendMeld).not.toHaveBeenCalled()
    expect(screen.getByText(/não estende esse jogo/i)).toBeInTheDocument()
  })

  it('jogos da dupla adversária não são clicáveis para estender', () => {
    const { game, handlers } = setup()
    game.state.teams[1].melds = [new Canasta(run('hearts', ['5', '6', '7']))]
    game.state.players[0].hand = new Hand(run('hearts', ['8', 'K', 'Q']))
    useGameStore.setState({ selectedCardIndices: [0] })
    renderBoard('play', handlers)
    fireEvent.click(screen.getByRole('group'))
    expect(handlers.onExtendMeld).not.toHaveBeenCalled()
  })

  it('fora da vez do jogador nada é clicável', () => {
    const { game, handlers } = setup()
    game.state.currentPlayerIndex = 1
    game.state.teams[0].melds = [new Canasta(run('hearts', ['5', '6', '7']))]
    useGameStore.setState({ selectedCardIndices: [0] })
    const { container } = renderBoard('draw', handlers)
    fireEvent.click(container.querySelector('[data-deck-pile]') as HTMLElement)
    fireEvent.click(screen.getByRole('group'))
    expect(handlers.onDraw).not.toHaveBeenCalled()
    expect(handlers.onExtendMeld).not.toHaveBeenCalled()
  })

  it('mostra os três oponentes/parceiro e o número de cartas deles', () => {
    const { game, handlers } = setup()
    renderBoard('draw', handlers)
    for (const i of [1, 2, 3]) {
      expect(screen.getAllByText(game.state.players[i].name).length).toBeGreaterThan(0)
    }
  })
})
