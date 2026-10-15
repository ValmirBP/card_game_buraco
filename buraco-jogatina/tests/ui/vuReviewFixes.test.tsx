import { act, fireEvent, render, screen } from '@testing-library/react'
import GameBoard from '../../src/components/Gameplay/GameBoard'
import PlayerHand from '../../src/components/Gameplay/PlayerHand'
import OnlineGameBoard from '../../src/components/Online/OnlineGameBoard'
import { vuBannerText } from '../../src/components/Gameplay/vulnerability'
import { useGameStore } from '../../src/store/gameStore'
import { useOnlineStore } from '../../src/online/onlineStore'
import { GameSession } from '../../src/session/GameSession'
import { Card, type Rank, type Suit } from '../../src/engine/card'
import { Hand } from '../../src/engine/hand'
import type { SeatConfig, SeatView, PlainCard } from '../../src/session/types'

const run = (suit: Suit, ranks: string[]) => ranks.map(r => new Card(suit, r as Rank))
const joker = () => new Card('hearts', '2', true)
const plain = (cards: Card[]): PlainCard[] => cards.map(c => ({ suit: c.suit, rank: c.rank, isWild: c.isWild }))

function prepare(hand: Card[]) {
  useGameStore.getState().initGame('Alice', 'easy')
  const game = useGameStore.getState().game!
  game.state.currentPlayerIndex = 0
  game.setOpeningMinimums({ A: 1600, B: 0 })
  game.state.players[0].hand = new Hand(hand)
  return game
}

function renderOffline() {
  const handlers = { onDraw: jest.fn(), onPlayCanastaSelected: jest.fn(), onPlayOpening: jest.fn(), onExtendMeld: jest.fn() }
  render(
    <>
      <GameBoard phase="play" {...handlers} />
      <PlayerHand phase="play" />
    </>
  )
  return handlers
}

const clickCard = (i: number) =>
  fireEvent.click((document.querySelector(`[data-hand-index="${i}"]`) as HTMLElement).firstElementChild as HTMLElement)
const dropButton = () => screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ })

afterEach(() => {
  act(() => {
    useGameStore.getState().resetGame()
    useOnlineStore.setState({ selectedCardIndices: [], stagedOpening: [] })
  })
})

describe('carta reservada para a abertura', () => {
  it('tocar nela não seleciona nada (nem a carta que estiver por baixo)', () => {
    prepare([...run('hearts', ['3', '4', '5']), ...run('spades', ['Q', 'K', 'A']), new Card('clubs', '9')])
    renderOffline()
    ;[0, 1, 2].forEach(clickCard)
    fireEvent.click(dropButton())
    expect(useGameStore.getState().stagedOpening).toEqual([[0, 1, 2]])
    clickCard(0)
    clickCard(2)
    expect(useGameStore.getState().selectedCardIndices).toEqual([])
    const reserved = document.querySelector('[data-hand-index="0"]') as HTMLElement
    expect(reserved.getAttribute('data-reserved')).toBe('true')
    expect(reserved.className).not.toMatch(/pointer-events-none/)
  })
})

describe('aumentar um jogo reservado', () => {
  it('tocar no jogo reservado com cartas que o continuam aumenta a reserva', () => {
    prepare([...run('hearts', ['3', '4', '5', '6', '7']), new Card('clubs', '9'), new Card('clubs', 'K')])
    renderOffline()
    ;[0, 1, 2].forEach(clickCard)
    fireEvent.click(dropButton())
    ;[3, 4].forEach(clickCard)
    fireEvent.click(screen.getByRole('group'))
    expect(useGameStore.getState().stagedOpening).toEqual([[0, 1, 2, 3, 4]])
    expect(useGameStore.getState().selectedCardIndices).toEqual([])
  })

  it('quando o aumento completa 75, tudo desce junto', () => {
    prepare([...run('spades', ['8', '9', '10', 'J', 'Q', 'K', 'A']), new Card('clubs', '3'), new Card('clubs', '4'), new Card('clubs', '6')])
    const handlers = renderOffline()
    ;[0, 1, 2, 3].forEach(clickCard)
    fireEvent.click(dropButton())
    expect(useGameStore.getState().stagedOpening).toEqual([[0, 1, 2, 3]])
    ;[4, 5, 6].forEach(clickCard)
    fireEvent.click(screen.getByRole('group'))
    expect(handlers.onPlayOpening).toHaveBeenCalledWith([[0, 1, 2, 3, 4, 5, 6]])
  })

  it('cartas que não continuam o jogo reservado não mudam nada e explicam', () => {
    prepare([...run('hearts', ['3', '4', '5']), new Card('clubs', '9'), new Card('clubs', 'K')])
    renderOffline()
    ;[0, 1, 2].forEach(clickCard)
    fireEvent.click(dropButton())
    clickCard(3)
    fireEvent.click(screen.getByRole('group'))
    expect(useGameStore.getState().stagedOpening).toEqual([[0, 1, 2]])
    expect(screen.getByText('Essa seleção não aumenta esse jogo reservado.')).toBeInTheDocument()
  })

  it('tocar no jogo reservado sem nada selecionado orienta a usar Desfazer', () => {
    prepare([...run('hearts', ['3', '4', '5']), new Card('clubs', '9')])
    renderOffline()
    ;[0, 1, 2].forEach(clickCard)
    fireEvent.click(dropButton())
    fireEvent.click(screen.getByRole('group'))
    expect(screen.getByText('Para mudar um jogo reservado, toque em Desfazer.')).toBeInTheDocument()
  })
})

describe('prévia da abertura', () => {
  it('mostra as cartas em ordem de sequência e marca jogo com curinga como sujo', () => {
    prepare([new Card('clubs', 'J'), joker(), new Card('clubs', '8'), new Card('clubs', '10'), new Card('hearts', '3')])
    renderOffline()
    ;[0, 1, 2, 3].forEach(clickCard)
    fireEvent.click(dropButton())
    const label = screen.getByRole('group').getAttribute('aria-label')!
    expect(label).toMatch(/^Jogo sujo, 50 pontos: 8 de paus, coringa, 10 de paus, J de paus$/)
  })
})

describe('banner de vulnerável', () => {
  it('não avisa sobre a dupla que já abriu (retomar partida/reconectar)', () => {
    expect(vuBannerText([{ id: 'A', openingMinimum: 75, melds: [1] }, { id: 'B', openingMinimum: 75, melds: [] }], 'A')).toMatch(
      /^⚠️ Eles estão vulneráveis/
    )
    expect(vuBannerText([{ id: 'A', openingMinimum: 75, melds: [1] }, { id: 'B', openingMinimum: 0, melds: [] }], 'A')).toBeNull()
  })
})

describe('online: não envia abertura que esvaziaria a mão sem poder bater', () => {
  const seats: SeatConfig[] = [0, 1, 2, 3].map(i => ({ kind: 'human' as const, name: `P${i}` }))

  it('avisa no próprio aparelho, sem animar nem enviar', () => {
    const session = new GameSession(seats)
    const view = JSON.parse(JSON.stringify(session.getViewFor(0))) as SeatView
    view.status = 'playing'
    view.currentSeat = 0
    view.phase = 'play'
    view.mortos = []
    view.teams[0].openingMinimum = 75
    view.yourHand = plain([
      ...run('spades', ['Q', 'K', 'A']),
      ...run('hearts', ['Q', 'K', 'A']),
      new Card('clubs', 'A'),
      new Card('diamonds', 'A'),
      new Card('spades', 'A'),
      new Card('hearts', '3'),
    ])
    const sendIntent = jest.fn()
    useOnlineStore.setState({ selectedCardIndices: [6, 7, 8], stagedOpening: [[0, 1, 2], [3, 4, 5]], sendIntent })
    render(<OnlineGameBoard view={view} />)
    fireEvent.click(document.getElementById('meld-drop-zone')!)
    expect(sendIntent).not.toHaveBeenCalled()
    expect(screen.getByText('Você não pode baixar todas as cartas sem poder bater.')).toBeInTheDocument()
  })
})
