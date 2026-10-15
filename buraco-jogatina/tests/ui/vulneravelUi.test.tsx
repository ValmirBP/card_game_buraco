import { act, fireEvent, render, screen, within } from '@testing-library/react'
import VuChip from '../../src/components/Gameplay/VuChip'
import Scoreboard from '../../src/components/Gameplay/Scoreboard'
import GameBoard from '../../src/components/Gameplay/GameBoard'
import PlayerHand from '../../src/components/Gameplay/PlayerHand'
import Gameplay from '../../src/components/Gameplay/Gameplay'
import Result from '../../src/components/Result/Result'
import RulesModal from '../../src/components/Menu/RulesModal'
import OnlineGameBoard from '../../src/components/Online/OnlineGameBoard'
import OnlinePlayerHand from '../../src/components/Online/OnlinePlayerHand'
import OnlineGameplay from '../../src/components/Online/OnlineGameplay'
import OnlineResult from '../../src/components/Online/OnlineResult'
import { useGameStore } from '../../src/store/gameStore'
import { useOnlineStore } from '../../src/online/onlineStore'
import { GameSession } from '../../src/session/GameSession'
import { Card, type Rank, type Suit } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'
import { Hand } from '../../src/engine/hand'
import type { TeamId } from '../../src/engine/gameState'
import type { SeatConfig, SeatView, MeldView, PlainCard } from '../../src/session/types'

const run = (suit: Suit, ranks: string[]) => ranks.map(r => new Card(suit, r as Rank))

const standardHand = () => [
  ...run('hearts', ['8', '9', '10']),
  ...run('spades', ['J', 'Q', 'K', 'A']),
  ...run('clubs', ['3', '4', '5']),
  new Card('diamonds', '7'),
  new Card('diamonds', 'K'),
]

const plain = (cards: Card[]): PlainCard[] => cards.map(c => ({ suit: c.suit, rank: c.rank, isWild: c.isWild }))

function noop() {}

function boardHandlers() {
  return {
    onDraw: jest.fn(),
    onPlayCanastaSelected: jest.fn(),
    onPlayOpening: jest.fn(),
    onExtendMeld: jest.fn(),
  }
}

function prepareOffline(
  opts: { scores?: Record<TeamId, number>; hand?: Card[]; teamAMelds?: Canasta[]; current?: number } = {}
) {
  useGameStore.getState().initGame('Alice', 'easy')
  const game = useGameStore.getState().game!
  game.state.currentPlayerIndex = opts.current ?? 0
  game.state.status = 'playing'
  game.setOpeningMinimums(opts.scores ?? { A: 1600, B: 300 })
  game.state.players[0].hand = new Hand(opts.hand ?? standardHand())
  if (opts.teamAMelds) game.state.teams[0].melds = opts.teamAMelds
  return game
}

function renderOffline(phase: 'draw' | 'play' = 'play') {
  const handlers = boardHandlers()
  const utils = render(
    <>
      <GameBoard phase={phase} {...handlers} />
      <PlayerHand phase={phase} />
    </>
  )
  return { handlers, ...utils }
}

function clickCard(index: number) {
  const wrapper = document.querySelector(`[data-hand-index="${index}"]`) as HTMLElement
  fireEvent.click(wrapper.firstElementChild as HTMLElement)
}

function selectCards(indices: number[]) {
  for (const i of indices) clickCard(i)
}

function clickBaixar() {
  fireEvent.click(screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ }))
}

function stagingText(): string {
  return (document.querySelector('[data-opening-staging]') as HTMLElement | null)?.textContent ?? ''
}

const seats: SeatConfig[] = [
  { kind: 'human', name: 'Alice' },
  { kind: 'ai', name: 'Bot1', difficulty: 'easy' },
  { kind: 'human', name: 'Bob' },
  { kind: 'ai', name: 'Bot2', difficulty: 'easy' },
]

function plainMeld(suit: string, ranks: string[]): MeldView {
  return {
    layout: ranks.map(r => ({ card: { suit, rank: r, isWild: false } })),
    isClean: true,
    isCanastra: false,
    kind: 'simples',
    points: 0,
    type: 'sequence',
  }
}

function viewFor(seat: number, patch: (v: SeatView) => void = () => {}): SeatView {
  const session = new GameSession(seats)
  const view = JSON.parse(JSON.stringify(session.getViewFor(seat))) as SeatView
  view.status = 'playing'
  view.currentSeat = seat
  view.phase = 'play'
  view.yourHand = plain(standardHand())
  for (const t of view.teams) {
    t.melds = []
    t.openingMinimum = 0
  }
  patch(view)
  return view
}

function renderOnlineBoard(view: SeatView, selected: number[] = [], staged: number[][] = []) {
  const sendIntent = jest.fn()
  useOnlineStore.setState({ selectedCardIndices: selected, stagedOpening: staged, sendIntent })
  const utils = render(<OnlineGameBoard view={view} />)
  return { sendIntent, ...utils }
}

function pillTotals(): string[] {
  return screen.getAllByTitle('Pontos da partida atual').map(e => e.textContent ?? '')
}

describe('VuChip', () => {
  it('pendente mostra "VU 75" com o aviso dos 75 pontos', () => {
    const { container } = render(<VuChip minimum={75} />)
    const chip = container.querySelector('[data-vu]') as HTMLElement
    expect(chip).toHaveTextContent('VU 75')
    expect(chip.getAttribute('data-vu')).toBe('pending')
    expect(chip.getAttribute('aria-label')).toMatch(/precisa somar 75 pontos/)
  })

  it('depois que a dupla abriu mostra "VU ✓"', () => {
    const { container } = render(<VuChip minimum={75} opened />)
    const chip = container.querySelector('[data-vu]') as HTMLElement
    expect(chip).toHaveTextContent('VU ✓')
    expect(chip.getAttribute('data-vu')).toBe('opened')
    expect(chip.getAttribute('title')).toMatch(/já abriu/)
  })

  it.each([0, -10])('com mínimo %p não renderiza nada (mesmo aberto)', minimum => {
    const a = render(<VuChip minimum={minimum} />)
    expect(a.container.firstChild).toBeNull()
    a.unmount()
    const b = render(<VuChip minimum={minimum} opened />)
    expect(b.container.firstChild).toBeNull()
  })

  it('repassa a className extra', () => {
    const { container } = render(<VuChip minimum={75} className="ml-1.5" />)
    expect((container.querySelector('[data-vu]') as HTMLElement).className).toContain('ml-1.5')
  })
})

describe('Scoreboard com VU', () => {
  afterEach(() => act(() => useGameStore.getState().resetGame()))

  it('mostra o selo só na pílula da dupla vulnerável', () => {
    prepareOffline({ scores: { A: 1600, B: 300 } })
    const { container } = render(<Scoreboard />)
    const chips = container.querySelectorAll('[data-vu]')
    expect(chips).toHaveLength(1)
    expect(chips[0]).toHaveTextContent('VU 75')
    expect(within(chips[0].parentElement as HTMLElement).getByText('Nós')).toBeInTheDocument()
  })

  it('dupla adversária vulnerável recebe o selo na pílula "Eles"', () => {
    prepareOffline({ scores: { A: 200, B: 1500 } })
    const { container } = render(<Scoreboard />)
    const chips = container.querySelectorAll('[data-vu]')
    expect(chips).toHaveLength(1)
    expect(within(chips[0].parentElement as HTMLElement).getByText('Eles')).toBeInTheDocument()
  })

  it('as duas duplas vulneráveis mostram dois selos; nenhuma abaixo de 1500', () => {
    prepareOffline({ scores: { A: 1500, B: 2100 } })
    const a = render(<Scoreboard />)
    expect(a.container.querySelectorAll('[data-vu="pending"]')).toHaveLength(2)
    a.unmount()
    act(() => useGameStore.getState().game!.setOpeningMinimums({ A: 1499, B: 1495 }))
    const b = render(<Scoreboard />)
    expect(b.container.querySelectorAll('[data-vu]')).toHaveLength(0)
  })

  it('dupla vulnerável que já abriu mostra "VU ✓"', () => {
    prepareOffline({ scores: { A: 1600, B: 0 }, teamAMelds: [new Canasta(run('hearts', ['5', '6', '7']))] })
    const { container } = render(<Scoreboard />)
    const chip = container.querySelector('[data-vu]') as HTMLElement
    expect(chip).toHaveTextContent('VU ✓')
    expect(chip.getAttribute('data-vu')).toBe('opened')
  })
})

describe('GameBoard offline — abertura vulnerável', () => {
  afterEach(() => act(() => useGameStore.getState().resetGame()))

  it('mostra o selo VU no quadro "Nós" e a área de abertura com 0/75', () => {
    prepareOffline()
    const { container } = renderOffline()
    const chip = container.querySelector('[data-vu]') as HTMLElement
    expect(chip).toHaveTextContent('VU 75')
    expect(document.getElementById('meld-drop-zone')).toContainElement(chip)
    expect(stagingText()).toContain('Abertura (VU): 0/75 pontos')
    expect(stagingText()).toContain('Vulneráveis: junte jogos que somem 75 pontos na 1ª descida.')
  })

  it('com seleção de 3+ cartas a área de abertura convida a tocar', () => {
    prepareOffline()
    renderOffline()
    selectCards([7, 8, 9])
    expect(stagingText()).toContain('Toque aqui para usar estas cartas na abertura (mínimo 75 pontos).')
  })

  it('jogo válido abaixo de 75 fica reservado, não desce, e o aviso cita os 75', () => {
    prepareOffline()
    const { handlers } = renderOffline()
    selectCards([7, 8, 9])
    clickBaixar()
    expect(handlers.onPlayOpening).not.toHaveBeenCalled()
    expect(handlers.onPlayCanastaSelected).not.toHaveBeenCalled()
    expect(useGameStore.getState().stagedOpening).toEqual([[7, 8, 9]])
    expect(useGameStore.getState().selectedCardIndices).toEqual([])
    expect(screen.getByText(/precisa somar 75 pontos \(até agora 15\)/)).toBeInTheDocument()
    expect(stagingText()).toContain('Abertura (VU): 15/75 pontos')
    expect(stagingText()).toContain('Reservados 1 jogo(s)')
  })

  it('clicar direto no quadro da dupla também reserva o jogo', () => {
    prepareOffline()
    const { handlers } = renderOffline()
    selectCards([0, 1, 2])
    fireEvent.click(document.getElementById('meld-drop-zone')!)
    expect(useGameStore.getState().stagedOpening).toEqual([[0, 1, 2]])
    expect(handlers.onPlayOpening).not.toHaveBeenCalled()
    expect(stagingText()).toContain('Abertura (VU): 30/75 pontos')
  })

  it('o jogo reservado aparece na área de abertura com cartas e pontos', () => {
    prepareOffline()
    renderOffline()
    selectCards([0, 1, 2])
    clickBaixar()
    const area = document.querySelector('[data-opening-staging]') as HTMLElement
    const grupos = within(area).getAllByRole('group')
    expect(grupos).toHaveLength(1)
    expect(grupos[0].getAttribute('aria-label')).toBe('Jogo limpo, 30 pontos: 8 de copas, 9 de copas, 10 de copas')
  })

  it('segunda seleção que completa exatamente 75 chama onPlayOpening com os dois jogos', () => {
    prepareOffline()
    const { handlers } = renderOffline()
    selectCards([0, 1, 2])
    clickBaixar()
    selectCards([3, 4, 5, 6])
    clickBaixar()
    expect(handlers.onPlayOpening).toHaveBeenCalledTimes(1)
    expect(handlers.onPlayOpening).toHaveBeenCalledWith([
      [0, 1, 2],
      [3, 4, 5, 6],
    ])
    expect(handlers.onPlayCanastaSelected).not.toHaveBeenCalled()
  })

  it('70 pontos ainda não abrem: os dois jogos ficam reservados', () => {
    prepareOffline({
      hand: [...run('hearts', ['8', '9', '10']), ...run('spades', ['10', 'J', 'Q', 'K']), new Card('clubs', '5'), new Card('diamonds', '6')],
    })
    const { handlers } = renderOffline()
    selectCards([0, 1, 2])
    clickBaixar()
    selectCards([3, 4, 5, 6])
    clickBaixar()
    expect(handlers.onPlayOpening).not.toHaveBeenCalled()
    expect(useGameStore.getState().stagedOpening).toEqual([
      [0, 1, 2],
      [3, 4, 5, 6],
    ])
    expect(stagingText()).toContain('Abertura (VU): 70/75 pontos')
    expect(screen.getByText(/até agora 70/)).toBeInTheDocument()
  })

  it('três jogos somados (15 + 45 + 30) abrem juntos na terceira seleção', () => {
    prepareOffline()
    const { handlers } = renderOffline()
    selectCards([7, 8, 9])
    clickBaixar()
    selectCards([3, 4, 5, 6])
    clickBaixar()
    expect(handlers.onPlayOpening).not.toHaveBeenCalled()
    expect(stagingText()).toContain('Abertura (VU): 60/75 pontos')
    selectCards([0, 1, 2])
    clickBaixar()
    expect(handlers.onPlayOpening).toHaveBeenCalledWith([
      [7, 8, 9],
      [3, 4, 5, 6],
      [0, 1, 2],
    ])
  })

  it('um único jogo de 75 pontos abre direto, sem reservar', () => {
    prepareOffline({ hand: [...run('hearts', ['8', '9', '10', 'J', 'Q', 'K', 'A']), ...run('clubs', ['3', '6', '9'])] })
    const { handlers } = renderOffline()
    selectCards([0, 1, 2, 3, 4, 5, 6])
    clickBaixar()
    expect(handlers.onPlayOpening).toHaveBeenCalledWith([[0, 1, 2, 3, 4, 5, 6]])
    expect(useGameStore.getState().stagedOpening).toEqual([])
  })

  it('o coringa vale 20 e a trinca de Áses 45 na soma da abertura', () => {
    prepareOffline({
      hand: [
        new Card('hearts', '8'),
        new Card('hearts', '2', true),
        new Card('hearts', '10'),
        new Card('hearts', 'J'),
        new Card('spades', 'A'),
        new Card('hearts', 'A'),
        new Card('clubs', 'A'),
        new Card('diamonds', '4'),
        new Card('diamonds', '9'),
      ],
    })
    const { handlers } = renderOffline()
    selectCards([0, 1, 2, 3])
    clickBaixar()
    expect(stagingText()).toContain('Abertura (VU): 50/75 pontos')
    selectCards([4, 5, 6])
    clickBaixar()
    expect(handlers.onPlayOpening).toHaveBeenCalledWith([
      [0, 1, 2, 3],
      [4, 5, 6],
    ])
  })

  it('"Desfazer" limpa a reserva e não baixa nada', () => {
    prepareOffline()
    const { handlers } = renderOffline()
    selectCards([0, 1, 2])
    clickBaixar()
    expect(useGameStore.getState().stagedOpening).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(useGameStore.getState().stagedOpening).toEqual([])
    expect(handlers.onPlayOpening).not.toHaveBeenCalled()
    expect(stagingText()).toContain('Abertura (VU): 0/75 pontos')
    expect(screen.queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument()
    expect(document.querySelectorAll('[data-reserved]')).toHaveLength(0)
  })

  it('seleção inválida com VU não reserva e explica', () => {
    prepareOffline()
    const { handlers } = renderOffline()
    selectCards([0, 3, 7])
    clickBaixar()
    expect(useGameStore.getState().stagedOpening).toEqual([])
    expect(handlers.onPlayOpening).not.toHaveBeenCalled()
    expect(screen.getByText(/não forma um jogo válido/i)).toBeInTheDocument()
  })

  it('menos de 3 cartas com VU avisa e não reserva', () => {
    prepareOffline()
    renderOffline()
    selectCards([0, 1])
    fireEvent.click(document.getElementById('meld-drop-zone')!)
    expect(useGameStore.getState().stagedOpening).toEqual([])
    expect(screen.getByText('Selecione 3 ou mais cartas para baixar uma canastra.')).toBeInTheDocument()
  })

  it('abertura que esvaziaria a mão sem poder bater é bloqueada mesmo com 75 pontos', () => {
    const game = prepareOffline({
      hand: [...run('hearts', ['8', '9', '10']), ...run('spades', ['J', 'Q', 'K', 'A']), new Card('clubs', '5')],
    })
    game.state.teams[0].hasTakenMorto = true
    const { handlers } = renderOffline()
    selectCards([0, 1, 2])
    clickBaixar()
    selectCards([3, 4, 5, 6])
    clickBaixar()
    expect(handlers.onPlayOpening).not.toHaveBeenCalled()
    expect(screen.getByText('Você não pode baixar todas as cartas sem poder bater.')).toBeInTheDocument()
  })

  it('fora da vez ou na fase de compra nada é reservado', () => {
    prepareOffline()
    useGameStore.setState({ selectedCardIndices: [0, 1, 2] })
    const draw = renderOffline('draw')
    fireEvent.click(document.getElementById('meld-drop-zone')!)
    expect(useGameStore.getState().stagedOpening).toEqual([])
    draw.unmount()

    act(() => {
      useGameStore.getState().game!.state.currentPlayerIndex = 1
      useGameStore.setState({ selectedCardIndices: [0, 1, 2] })
    })
    const vez = renderOffline('play')
    fireEvent.click(document.getElementById('meld-drop-zone')!)
    expect(useGameStore.getState().stagedOpening).toEqual([])
    expect(vez.handlers.onPlayOpening).not.toHaveBeenCalled()
  })

  it('dupla não vulnerável baixa jogo de 15 pontos normalmente', () => {
    prepareOffline({ scores: { A: 1499, B: 0 } })
    const { handlers, container } = renderOffline()
    expect(container.querySelector('[data-vu]')).toBeNull()
    expect(document.querySelector('[data-opening-staging]')).toBeNull()
    selectCards([7, 8, 9])
    clickBaixar()
    expect(handlers.onPlayCanastaSelected).toHaveBeenCalledTimes(1)
    expect(handlers.onPlayOpening).not.toHaveBeenCalled()
    expect(useGameStore.getState().stagedOpening).toEqual([])
  })

  it('dupla vulnerável que já tem jogo na mesa baixa normalmente e mostra "VU ✓"', () => {
    prepareOffline({ teamAMelds: [new Canasta(run('diamonds', ['3', '4', '5']))] })
    const { handlers, container } = renderOffline()
    expect(container.querySelector('[data-vu]')).toHaveTextContent('VU ✓')
    expect(document.querySelector('[data-opening-staging]')).toBeNull()
    selectCards([7, 8, 9])
    fireEvent.click(screen.getByLabelText('Baixar jogo novo'))
    expect(handlers.onPlayCanastaSelected).toHaveBeenCalledTimes(1)
    expect(handlers.onPlayOpening).not.toHaveBeenCalled()
  })

  it('só a dupla adversária vulnerável: o aviso fica no quadro "Eles" e nós baixamos livre', () => {
    prepareOffline({ scores: { A: 0, B: 1800 } })
    const { handlers } = renderOffline()
    expect(screen.getByText('Vulneráveis: a 1ª descida precisa somar 75 pontos')).toBeInTheDocument()
    expect(document.getElementById('meld-drop-zone')).not.toHaveTextContent('Vulneráveis')
    selectCards([7, 8, 9])
    clickBaixar()
    expect(handlers.onPlayCanastaSelected).toHaveBeenCalledTimes(1)
    expect(useGameStore.getState().stagedOpening).toEqual([])
  })
})

describe('PlayerHand offline com VU', () => {
  afterEach(() => act(() => useGameStore.getState().resetGame()))

  it('cartas reservadas ficam marcadas, apagadas e não podem ser selecionadas', () => {
    prepareOffline()
    useGameStore.setState({ stagedOpening: [[7, 8, 9]] })
    render(<PlayerHand phase="play" />)
    const reservadas = Array.from(document.querySelectorAll('[data-reserved="true"]')).map(el =>
      Number(el.getAttribute('data-hand-index'))
    )
    expect(reservadas.sort((a, b) => a - b)).toEqual([7, 8, 9])
    expect(document.querySelector('[data-hand-index="7"]')!.className).toContain('opacity-35')
    expect(document.querySelector('[data-hand-index="0"]')!.getAttribute('data-reserved')).toBeNull()
    clickCard(7)
    expect(useGameStore.getState().selectedCardIndices).toEqual([])
    clickCard(0)
    expect(useGameStore.getState().selectedCardIndices).toEqual([0])
  })

  it('mostra a dica VU na fase de jogo quando a dupla precisa abrir', () => {
    prepareOffline()
    render(<PlayerHand phase="play" />)
    expect(screen.getByText('Vulneráveis (VU): a 1ª descida precisa somar 75 pontos.')).toBeInTheDocument()
  })

  it('a dica VU não aparece na compra, com 1 carta selecionada, nem depois de abrir', () => {
    prepareOffline()
    const compra = render(<PlayerHand phase="draw" />)
    expect(screen.queryByText(/Vulneráveis \(VU\)/)).not.toBeInTheDocument()
    expect(screen.getByText(/Clique no monte para comprar/)).toBeInTheDocument()
    compra.unmount()

    useGameStore.setState({ selectedCardIndices: [0] })
    const uma = render(<PlayerHand phase="play" />)
    expect(screen.queryByText(/Vulneráveis \(VU\)/)).not.toBeInTheDocument()
    uma.unmount()

    act(() => {
      useGameStore.getState().game!.state.teams[0].melds = [new Canasta(run('diamonds', ['3', '4', '5']))]
      useGameStore.setState({ selectedCardIndices: [] })
    })
    render(<PlayerHand phase="play" />)
    expect(screen.queryByText(/Vulneráveis \(VU\)/)).not.toBeInTheDocument()
    expect(screen.getByText('Selecione cartas: 1 para descartar, 3+ para baixar um jogo.')).toBeInTheDocument()
  })

  it('dupla não vulnerável não vê a dica VU', () => {
    prepareOffline({ scores: { A: 1400, B: 1600 } })
    render(<PlayerHand phase="play" />)
    expect(screen.queryByText(/Vulneráveis \(VU\)/)).not.toBeInTheDocument()
  })
})

describe('Gameplay offline — fluxo completo da rodada vulnerável', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers())
    jest.useRealTimers()
    act(() => useGameStore.getState().resetGame())
  })

  function startVulnerableRound(scores: Record<TeamId, number>) {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.setState({ matchScores: scores })
    useGameStore.getState().startNextRound()
    return useGameStore.getState().game!
  }

  it('aviso no início da rodada, selo no placar e registro do VU', () => {
    startVulnerableRound({ A: 1600, B: 300 })
    const { container } = render(<Gameplay onGameEnd={noop} onExit={noop} />)
    expect(container.querySelector('[data-vu-banner]')).toHaveTextContent(
      '⚠️ Nós estamos vulneráveis (VU): a 1ª descida da rodada precisa somar 75 pontos'
    )
    expect(container.querySelectorAll('[data-vu="pending"]').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/Time A \(Nós\) está vulnerável \(VU\)/)).toBeInTheDocument()
  })

  it('as duas duplas vulneráveis: aviso no plural', () => {
    startVulnerableRound({ A: 1500, B: 2000 })
    const { container } = render(<Gameplay onGameEnd={noop} onExit={noop} />)
    expect(container.querySelector('[data-vu-banner]')).toHaveTextContent('As duas duplas estão vulneráveis (VU)')
  })

  it('só os adversários vulneráveis: aviso "Eles estão"', () => {
    startVulnerableRound({ A: 100, B: 1500 })
    const { container } = render(<Gameplay onGameEnd={noop} onExit={noop} />)
    expect(container.querySelector('[data-vu-banner]')).toHaveTextContent('Eles estão vulneráveis (VU)')
  })

  it('sem dupla vulnerável não há aviso nem selo', () => {
    startVulnerableRound({ A: 1499, B: 1499 })
    const { container } = render(<Gameplay onGameEnd={noop} onExit={noop} />)
    expect(container.querySelector('[data-vu-banner]')).toBeNull()
    expect(container.querySelectorAll('[data-vu]')).toHaveLength(0)
  })

  it('reservar, completar 75+ e abrir: os jogos vão para a mesa e o selo vira "VU ✓"', () => {
    const game = startVulnerableRound({ A: 1600, B: 300 })
    expect(game.state.currentPlayerIndex).toBe(0)
    const { container } = render(<Gameplay onGameEnd={noop} onExit={noop} />)

    fireEvent.click(container.querySelector('[data-deck-pile]')!)
    act(() => {
      game.state.players[0].hand = new Hand(standardHand())
      useGameStore.setState({ version: useGameStore.getState().version + 1 })
    })

    selectCards([7, 8, 9])
    clickBaixar()
    selectCards([0, 1, 2])
    clickBaixar()
    expect(game.state.teams[0].melds).toHaveLength(0)
    expect(useGameStore.getState().stagedOpening).toEqual([
      [7, 8, 9],
      [0, 1, 2],
    ])
    expect(stagingText()).toContain('Abertura (VU): 45/75 pontos')

    selectCards([3, 4, 5, 6])
    clickBaixar()

    expect(game.state.teams[0].melds).toHaveLength(3)
    expect(game.state.players[0].hand.getSize()).toBe(2)
    expect(useGameStore.getState().stagedOpening).toEqual([])
    expect(useGameStore.getState().gameLog).toContain('Alice abriu o jogo da dupla com 90 pontos (vulnerável).')
    expect(screen.getByText(/Alice abriu o jogo da dupla com 90 pontos/)).toBeInTheDocument()
    const chips = Array.from(container.querySelectorAll('[data-vu]'))
    expect(chips.length).toBeGreaterThanOrEqual(2)
    expect(chips.every(c => c.getAttribute('data-vu') === 'opened')).toBe(true)
    expect(document.querySelector('[data-opening-staging]')).toBeNull()
  })
})

describe('Result offline — aviso de VU na próxima rodada', () => {
  afterEach(() => act(() => useGameStore.getState().resetGame()))

  function renderResult() {
    return render(<Result onBackToMenu={noop} onNextRound={noop} onNewMatch={noop} />)
  }

  it('aparece só no cartão da dupla com 1500+ quando a partida continua', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.setState({ matchScores: { A: 1600, B: 200 } })
    const { container } = renderResult()
    const notes = container.querySelectorAll('[data-vu-next]')
    expect(notes).toHaveLength(1)
    expect(notes[0]).toHaveTextContent('VU na próxima rodada: abrir com 75+')
    expect(notes[0].getAttribute('title')).toBe('Vulnerável na próxima rodada (1500+ pontos): abertura mínima de 75 pontos')
    expect((notes[0].closest('.rounded-2xl') as HTMLElement).textContent).toMatch(/Nós · /)
  })

  it('exatamente 1500 já é vulnerável; 1499 não', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.setState({ matchScores: { A: 1499, B: 1500 } })
    const { container } = renderResult()
    const notes = container.querySelectorAll('[data-vu-next]')
    expect(notes).toHaveLength(1)
    expect((notes[0].closest('.rounded-2xl') as HTMLElement).textContent).toMatch(/Eles · /)
  })

  it('as duas duplas com 1500+ recebem o aviso', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.setState({ matchScores: { A: 2500, B: 1750 } })
    const { container } = renderResult()
    expect(container.querySelectorAll('[data-vu-next]')).toHaveLength(2)
  })

  it('com a partida encerrada não mostra o aviso', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.setState({ matchScores: { A: 1700, B: 3100 }, matchWinner: 'B' })
    const { container } = renderResult()
    expect(container.querySelectorAll('[data-vu-next]')).toHaveLength(0)
    expect(screen.getByText('A dupla adversária venceu a partida')).toBeInTheDocument()
  })
})

describe('RulesModal — seção Vulnerável (VU)', () => {
  it('explica o VU com 1500 pontos e abertura de 75', () => {
    render(<RulesModal onClose={noop} />)
    const heading = screen.getByRole('heading', { name: 'Vulnerável (VU)' })
    const text = (heading.parentElement as HTMLElement).textContent ?? ''
    expect(text).toContain('1500')
    expect(text).toContain('75')
    expect(text).toMatch(/coringa 20, Ás 15/)
    expect(text).toMatch(/juntar\s+vários jogos/)
  })
})

describe('OnlineGameBoard — abertura vulnerável', () => {
  afterEach(() => act(() => useOnlineStore.setState({ selectedCardIndices: [], stagedOpening: [] })))

  it('seleção válida abaixo de 75 é reservada e não envia intent', () => {
    const view = viewFor(0, v => (v.teams[0].openingMinimum = 75))
    const { sendIntent, container } = renderOnlineBoard(view, [7, 8, 9])
    expect(container.querySelector('[data-vu]')).toHaveTextContent('VU 75')
    fireEvent.click(screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ }))
    expect(sendIntent).not.toHaveBeenCalled()
    expect(useOnlineStore.getState().stagedOpening).toEqual([[7, 8, 9]])
    expect(useOnlineStore.getState().selectedCardIndices).toEqual([])
    expect(screen.getByText(/precisa somar 75 pontos \(até agora 15\)/)).toBeInTheDocument()
    expect(stagingText()).toContain('Abertura (VU): 15/75 pontos')
  })

  it('reserva + seleção somando 75 envia playMelds com os grupos', () => {
    const view = viewFor(0, v => (v.teams[0].openingMinimum = 75))
    const { sendIntent } = renderOnlineBoard(view, [3, 4, 5, 6], [[0, 1, 2]])
    expect(stagingText()).toContain('Abertura (VU): 75/75 pontos')
    expect(screen.getByRole('button', { name: 'Abrir (75)'.replace('Abrir', '⬇ Abrir') })).toBeInTheDocument()
    fireEvent.click(document.getElementById('meld-drop-zone')!)
    expect(sendIntent).toHaveBeenCalledTimes(1)
    expect(sendIntent).toHaveBeenCalledWith({
      type: 'playMelds',
      groups: [
        [0, 1, 2],
        [3, 4, 5, 6],
      ],
    })
  })

  it('reserva + seleção somando 60 reserva de novo sem enviar', () => {
    const view = viewFor(0, v => (v.teams[0].openingMinimum = 75))
    const { sendIntent } = renderOnlineBoard(view, [3, 4, 5, 6], [[7, 8, 9]])
    fireEvent.click(screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ }))
    expect(sendIntent).not.toHaveBeenCalled()
    expect(useOnlineStore.getState().stagedOpening).toEqual([
      [7, 8, 9],
      [3, 4, 5, 6],
    ])
    expect(stagingText()).toContain('Abertura (VU): 60/75 pontos')
  })

  it('um jogo único de 75 envia playMelds com um grupo', () => {
    const view = viewFor(0, v => {
      v.teams[0].openingMinimum = 75
      v.yourHand = plain([...run('hearts', ['8', '9', '10', 'J', 'Q', 'K', 'A']), new Card('clubs', '4')])
    })
    const { sendIntent } = renderOnlineBoard(view, [0, 1, 2, 3, 4, 5, 6])
    fireEvent.click(screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ }))
    expect(sendIntent).toHaveBeenCalledWith({ type: 'playMelds', groups: [[0, 1, 2, 3, 4, 5, 6]] })
  })

  it('"Desfazer" limpa a reserva online', () => {
    const view = viewFor(0, v => (v.teams[0].openingMinimum = 75))
    const { sendIntent } = renderOnlineBoard(view, [], [[7, 8, 9]])
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(useOnlineStore.getState().stagedOpening).toEqual([])
    expect(sendIntent).not.toHaveBeenCalled()
    expect(stagingText()).toContain('Abertura (VU): 0/75 pontos')
  })

  it('seleção inválida com VU não reserva', () => {
    const view = viewFor(0, v => (v.teams[0].openingMinimum = 75))
    const { sendIntent } = renderOnlineBoard(view, [0, 3, 7])
    fireEvent.click(screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ }))
    expect(sendIntent).not.toHaveBeenCalled()
    expect(useOnlineStore.getState().stagedOpening).toEqual([])
    expect(screen.getByText(/não forma um jogo válido/i)).toBeInTheDocument()
  })

  it('sem VU (ou servidor antigo sem openingMinimum) envia playCanasta', () => {
    const semVu = renderOnlineBoard(viewFor(0), [7, 8, 9])
    fireEvent.click(screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ }))
    expect(semVu.sendIntent).toHaveBeenCalledWith({ type: 'playCanasta', cardIndices: [7, 8, 9] })
    semVu.unmount()

    const antigo = renderOnlineBoard(
      viewFor(0, v => {
        delete (v.teams[0] as Partial<SeatView['teams'][number]>).openingMinimum
      }),
      [7, 8, 9]
    )
    expect(antigo.container.querySelector('[data-vu]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ }))
    expect(antigo.sendIntent).toHaveBeenCalledWith({ type: 'playCanasta', cardIndices: [7, 8, 9] })
  })

  it('dupla vulnerável que já abriu mostra "VU ✓" e baixa com playCanasta', () => {
    const view = viewFor(0, v => {
      v.teams[0].openingMinimum = 75
      v.teams[0].melds = [plainMeld('diamonds', ['3', '4', '5'])]
    })
    const { sendIntent, container } = renderOnlineBoard(view, [7, 8, 9])
    expect(container.querySelector('[data-vu]')).toHaveTextContent('VU ✓')
    fireEvent.click(screen.getByLabelText('Baixar jogo novo'))
    expect(sendIntent).toHaveBeenCalledWith({ type: 'playCanasta', cardIndices: [7, 8, 9] })
  })

  it('sentado na dupla B: a regra vale para a própria dupla (B)', () => {
    const view = viewFor(1, v => (v.teams[1].openingMinimum = 75))
    const { sendIntent } = renderOnlineBoard(view, [7, 8, 9])
    expect(document.getElementById('meld-drop-zone')).toContainElement(document.querySelector('[data-vu]') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ }))
    expect(sendIntent).not.toHaveBeenCalled()
    expect(useOnlineStore.getState().stagedOpening).toEqual([[7, 8, 9]])
  })

  it('só os adversários vulneráveis: aviso no quadro "Eles" e envio normal', () => {
    const view = viewFor(0, v => (v.teams[1].openingMinimum = 75))
    const { sendIntent } = renderOnlineBoard(view, [7, 8, 9])
    expect(screen.getByText('Vulneráveis: a 1ª descida precisa somar 75 pontos')).toBeInTheDocument()
    expect(document.getElementById('meld-drop-zone')).not.toHaveTextContent('Vulneráveis')
    fireEvent.click(screen.getByRole('button', { name: /Baixar jogo|Reservar \(|Abrir \(/ }))
    expect(sendIntent).toHaveBeenCalledWith({ type: 'playCanasta', cardIndices: [7, 8, 9] })
  })

  it('fora da vez nada é reservado nem enviado', () => {
    const view = viewFor(0, v => {
      v.teams[0].openingMinimum = 75
      v.currentSeat = 1
    })
    const { sendIntent } = renderOnlineBoard(view, [0, 1, 2])
    fireEvent.click(document.getElementById('meld-drop-zone')!)
    expect(sendIntent).not.toHaveBeenCalled()
    expect(useOnlineStore.getState().stagedOpening).toEqual([])
  })
})

describe('OnlinePlayerHand com VU', () => {
  afterEach(() => act(() => useOnlineStore.setState({ selectedCardIndices: [], stagedOpening: [] })))

  it('cartas reservadas ficam marcadas e não podem ser selecionadas', () => {
    useOnlineStore.setState({ selectedCardIndices: [], stagedOpening: [[7, 8, 9]] })
    render(<OnlinePlayerHand view={viewFor(0, v => (v.teams[0].openingMinimum = 75))} />)
    const reservadas = Array.from(document.querySelectorAll('[data-reserved="true"]')).map(el =>
      Number(el.getAttribute('data-hand-index'))
    )
    expect(reservadas.sort((a, b) => a - b)).toEqual([7, 8, 9])
    clickCard(8)
    expect(useOnlineStore.getState().selectedCardIndices).toEqual([])
    clickCard(3)
    expect(useOnlineStore.getState().selectedCardIndices).toEqual([3])
  })

  it('mostra a dica VU quando a própria dupla precisa abrir', () => {
    useOnlineStore.setState({ selectedCardIndices: [], stagedOpening: [] })
    render(<OnlinePlayerHand view={viewFor(0, v => (v.teams[0].openingMinimum = 75))} />)
    expect(screen.getByText('Vulneráveis (VU): a 1ª descida precisa somar 75 pontos.')).toBeInTheDocument()
  })

  it('sem VU, com servidor antigo, fora da vez ou já aberta não há dica VU', () => {
    useOnlineStore.setState({ selectedCardIndices: [], stagedOpening: [] })
    const casos: SeatView[] = [
      viewFor(0),
      viewFor(0, v => {
        delete (v.teams[0] as Partial<SeatView['teams'][number]>).openingMinimum
      }),
      viewFor(0, v => {
        v.teams[0].openingMinimum = 75
        v.currentSeat = 1
      }),
      viewFor(0, v => {
        v.teams[0].openingMinimum = 75
        v.teams[0].melds = [plainMeld('diamonds', ['3', '4', '5'])]
      }),
      viewFor(0, v => (v.teams[1].openingMinimum = 75)),
    ]
    for (const v of casos) {
      const r = render(<OnlinePlayerHand view={v} />)
      expect(screen.queryByText(/Vulneráveis \(VU\)/)).not.toBeInTheDocument()
      r.unmount()
    }
  })
})

describe('OnlineGameplay — placar, selo e aviso de VU', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    act(() => jest.runOnlyPendingTimers())
    jest.useRealTimers()
    act(() =>
      useOnlineStore.setState({ view: null, log: [], selectedCardIndices: [], stagedOpening: [], errorMsg: null })
    )
  })

  function renderOnlineGameplay(view: SeatView) {
    useOnlineStore.setState({ view, connection: 'open', log: [], errorMsg: null, sendIntent: jest.fn() })
    return render(<OnlineGameplay onBackToMenu={noop} />)
  }

  it('pílula da própria dupla mostra o selo VU e o total somando a rodada em andamento', () => {
    renderOnlineGameplay(
      viewFor(0, v => {
        v.teams[0].openingMinimum = 75
        v.teams[0].score = 120
        v.teams[1].score = 40
        v.matchScores = { A: 1600, B: 200 }
      })
    )
    expect(pillTotals()).toEqual(['1720', '240'])
    const pill = screen.getAllByTitle('Pontos da partida atual')[0].parentElement as HTMLElement
    expect(within(pill).getByText('Nós')).toBeInTheDocument()
    expect(pill.querySelector('[data-vu]')).toHaveTextContent('VU 75')
    const otherPill = screen.getAllByTitle('Pontos da partida atual')[1].parentElement as HTMLElement
    expect(otherPill.querySelector('[data-vu]')).toBeNull()
  })

  it('com a rodada encerrada não soma de novo os pontos da rodada', () => {
    renderOnlineGameplay(
      viewFor(0, v => {
        v.status = 'finished'
        v.teams[0].openingMinimum = 75
        v.teams[0].score = 120
        v.teams[1].score = 40
        v.matchScores = { A: 1720, B: 240 }
      })
    )
    expect(pillTotals()).toEqual(['1720', '240'])
  })

  it('sentado na dupla B, a pílula "Nós" é a da dupla B com o selo dela', () => {
    renderOnlineGameplay(
      viewFor(1, v => {
        v.teams[1].openingMinimum = 75
        v.matchScores = { A: 300, B: 1550 }
      })
    )
    const pill = screen.getAllByTitle('Pontos da partida atual')[0].parentElement as HTMLElement
    expect(within(pill).getByText('Nós')).toBeInTheDocument()
    expect(within(pill).getByText('1550')).toBeInTheDocument()
    expect(pill.querySelector('[data-vu]')).toHaveTextContent('VU 75')
  })

  it('mostra o aviso VU no início da rodada conforme quem está vulnerável', () => {
    const nos = renderOnlineGameplay(viewFor(0, v => (v.teams[0].openingMinimum = 75)))
    expect(nos.container.querySelector('[data-vu-banner]')).toHaveTextContent('Nós estamos vulneráveis (VU)')
    nos.unmount()

    const eles = renderOnlineGameplay(viewFor(1, v => (v.teams[0].openingMinimum = 75)))
    expect(eles.container.querySelector('[data-vu-banner]')).toHaveTextContent('Eles estão vulneráveis (VU)')
    eles.unmount()

    const ambas = renderOnlineGameplay(
      viewFor(0, v => {
        v.teams[0].openingMinimum = 75
        v.teams[1].openingMinimum = 75
      })
    )
    expect(ambas.container.querySelector('[data-vu-banner]')).toHaveTextContent('As duas duplas estão vulneráveis (VU)')
  })

  it('sem VU não há aviso nem selo', () => {
    const { container } = renderOnlineGameplay(viewFor(0))
    expect(container.querySelector('[data-vu-banner]')).toBeNull()
    expect(container.querySelectorAll('[data-vu]')).toHaveLength(0)
  })

  it('fim de rodada leva ao resultado com o aviso de VU da próxima rodada', () => {
    const { container } = renderOnlineGameplay(
      viewFor(0, v => {
        v.status = 'finished'
        v.matchScores = { A: 1650, B: 900 }
      })
    )
    expect(container.querySelector('[data-vu-next]')).toBeNull()
    act(() => jest.advanceTimersByTime(2100))
    const notes = container.querySelectorAll('[data-vu-next]')
    expect(notes).toHaveLength(1)
    expect((notes[0].closest('.rounded-2xl') as HTMLElement).textContent).toMatch(/Nós · /)
  })
})

describe('OnlineResult — aviso de VU na próxima rodada', () => {
  afterEach(() => act(() => useOnlineStore.setState({ isHost: false })))

  function finishedView(seat: number, scores: Record<TeamId, number>, matchWinner?: TeamId) {
    return viewFor(seat, v => {
      v.status = 'finished'
      v.matchScores = scores
      v.matchWinner = matchWinner
    })
  }

  it('aparece no cartão "Nós" para quem é da dupla com 1500+', () => {
    const { container } = render(<OnlineResult view={finishedView(0, { A: 1500, B: 1499 })} onBackToMenu={noop} />)
    const notes = container.querySelectorAll('[data-vu-next]')
    expect(notes).toHaveLength(1)
    expect(notes[0]).toHaveTextContent('VU na próxima rodada: abrir com 75+')
    expect(notes[0].getAttribute('title')).toBe('Vulnerável na próxima rodada (1500+ pontos): abertura mínima de 75 pontos')
    expect((notes[0].closest('.rounded-2xl') as HTMLElement).textContent).toMatch(/Nós · /)
  })

  it('para quem está na outra dupla o mesmo aviso fica no cartão "Eles"', () => {
    const { container } = render(<OnlineResult view={finishedView(1, { A: 1500, B: 100 })} onBackToMenu={noop} />)
    const notes = container.querySelectorAll('[data-vu-next]')
    expect(notes).toHaveLength(1)
    expect((notes[0].closest('.rounded-2xl') as HTMLElement).textContent).toMatch(/Eles · /)
  })

  it('as duas duplas com 1500+ recebem o aviso; abaixo disso nenhuma', () => {
    const ambas = render(<OnlineResult view={finishedView(0, { A: 1800, B: 2900 })} onBackToMenu={noop} />)
    expect(ambas.container.querySelectorAll('[data-vu-next]')).toHaveLength(2)
    ambas.unmount()
    const nenhuma = render(<OnlineResult view={finishedView(0, { A: 1495, B: 0 })} onBackToMenu={noop} />)
    expect(nenhuma.container.querySelectorAll('[data-vu-next]')).toHaveLength(0)
  })

  it('com vencedor da partida o aviso não aparece', () => {
    const { container } = render(
      <OnlineResult view={finishedView(0, { A: 3050, B: 1900 }, 'A')} onBackToMenu={noop} />
    )
    expect(container.querySelectorAll('[data-vu-next]')).toHaveLength(0)
    expect(screen.getByText('🎉 Vocês venceram a partida!')).toBeInTheDocument()
  })
})

describe('melhorias da abertura vulnerável apontadas na revisão', () => {
  it('o contador já soma a seleção válida e o botão diz se vai reservar ou abrir', () => {
    const view = viewFor(0, v => (v.teams[0].openingMinimum = 75))
    renderOnlineBoard(view, [3, 4, 5], [[0, 1, 2]])
    const label = screen.getByRole('button', { name: /Reservar \(|Abrir \(/ }).textContent!
    expect(label).toMatch(/^(Reservar \(\d+\/75\)|⬇ Abrir \(\d+\))$/)
  })
})

