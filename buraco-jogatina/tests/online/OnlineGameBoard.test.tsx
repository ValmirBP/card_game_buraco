import { act, fireEvent, render, screen } from '@testing-library/react'
import OnlineGameBoard from '../../src/components/Online/OnlineGameBoard'
import { useOnlineStore } from '../../src/online/onlineStore'
import { GameSession } from '../../src/session/GameSession'
import type { SeatConfig, SeatView, MeldView } from '../../src/session/types'

const seats: SeatConfig[] = [
  { kind: 'human', name: 'Alice' },
  { kind: 'ai', name: 'Bot1', difficulty: 'easy' },
  { kind: 'human', name: 'Bob' },
  { kind: 'ai', name: 'Bot2', difficulty: 'easy' },
]

const card = (suit: string, rank: string) => ({ suit, rank, isWild: false })

function meld(suit: string, ranks: string[], kind = 'simples', isCanastra = false): MeldView {
  return {
    layout: ranks.map(r => ({ card: card(suit, r) })),
    isClean: true,
    isCanastra,
    kind,
    points: 100,
    type: 'sequence',
  }
}

function viewFor(seat: number, patch: (v: SeatView) => void = () => {}): SeatView {
  const session = new GameSession(seats)
  const view = JSON.parse(JSON.stringify(session.getViewFor(seat))) as SeatView
  view.status = 'playing'
  view.currentSeat = seat
  patch(view)
  return view
}

function renderBoard(view: SeatView, selected: number[] = []) {
  const sendIntent = jest.fn()
  useOnlineStore.setState({ selectedCardIndices: selected, sendIntent })
  const utils = render(<OnlineGameBoard view={view} />)
  return { sendIntent, ...utils }
}

describe('OnlineGameBoard', () => {
  afterEach(() => act(() => useOnlineStore.setState({ selectedCardIndices: [] })))

  it('mostra os outros três assentos relativos ao próprio e os dois quadros', () => {
    renderBoard(viewFor(0))
    for (const nome of ['Bot1', 'Bob', 'Bot2']) {
      expect(screen.getAllByText(nome).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('Nós')).toBeInTheDocument()
    expect(screen.getByText('Eles')).toBeInTheDocument()
  })

  it('"Nós" é sempre a dupla de quem vê, mesmo sentando na dupla B', () => {
    const view = viewFor(1, v => {
      v.teams[1].melds = [meld('hearts', ['5', '6', '7'])]
    })
    renderBoard(view)
    const grupo = screen.getByRole('group')
    expect(grupo.getAttribute('aria-label')).toMatch(/5 de copas/)
    expect(view.players[1].teamId).toBe('B')
    const painelNos = document.getElementById('meld-drop-zone')!
    expect(painelNos).toContainElement(grupo)
  })

  it('canastra fechada mostra a faixa com o tipo; jogo aberto não', () => {
    renderBoard(
      viewFor(0, v => {
        v.teams[0].melds = [
          meld('hearts', ['5', '6', '7', '8', '9', '10', 'J'], 'limpa', true),
          meld('spades', ['3', '4', '5']),
        ]
      })
    )
    expect(screen.getByText('LIMPA')).toBeInTheDocument()
    const grupos = screen.getAllByRole('group')
    expect(grupos[0].getAttribute('data-meld-closed')).toBe('true')
    expect(grupos[1].getAttribute('data-meld-closed')).toBeNull()
  })

  it('compra: clicar no monte na fase de compra envia o intent draw', () => {
    const { sendIntent, container } = renderBoard(viewFor(0, v => (v.phase = 'draw')))
    fireEvent.click(container.querySelector('[data-deck-pile]')!)
    expect(sendIntent).toHaveBeenCalledWith({ type: 'draw' })
  })

  it('clicar no monte fora da fase de compra não envia nada e avisa', () => {
    const { sendIntent, container } = renderBoard(viewFor(0, v => (v.phase = 'play')))
    fireEvent.click(container.querySelector('[data-deck-pile]')!)
    expect(sendIntent).not.toHaveBeenCalled()
    expect(screen.getByText('Descarte uma carta antes de comprar de novo.')).toBeInTheDocument()
  })

  it('fora da minha vez não envia nada', () => {
    const { sendIntent, container } = renderBoard(
      viewFor(0, v => {
        v.phase = 'draw'
        v.currentSeat = 1
      })
    )
    fireEvent.click(container.querySelector('[data-deck-pile]')!)
    expect(sendIntent).not.toHaveBeenCalled()
  })

  it('baixar: menos de 3 cartas selecionadas avisa; 3 válidas enviam playCanasta', () => {
    const patch = (v: SeatView) => {
      v.phase = 'play'
      v.yourHand = [card('hearts', '4'), card('hearts', '5'), card('hearts', '6'), card('spades', 'K')]
      v.teams[0].melds = [meld('spades', ['3', '4', '5'])]
    }
    const curto = renderBoard(viewFor(0, patch), [0, 1])
    fireEvent.click(screen.getByLabelText('Baixar jogo novo'))
    expect(curto.sendIntent).not.toHaveBeenCalled()
    expect(screen.getByText('Selecione 3 ou mais cartas para baixar uma canastra.')).toBeInTheDocument()
    curto.unmount()

    const valido = renderBoard(viewFor(0, patch), [0, 1, 2])
    fireEvent.click(screen.getByLabelText('Baixar jogo novo'))
    expect(valido.sendIntent).toHaveBeenCalledWith({ type: 'playCanasta', cardIndices: [0, 1, 2] })
  })

  it('seleção inválida para baixar não envia e explica', () => {
    const { sendIntent } = renderBoard(
      viewFor(0, v => {
        v.phase = 'play'
        v.yourHand = [card('hearts', '4'), card('spades', '9'), card('clubs', 'K')]
        v.teams[0].melds = [meld('spades', ['3', '4', '5'])]
      }),
      [0, 1, 2]
    )
    fireEvent.click(screen.getByLabelText('Baixar jogo novo'))
    expect(sendIntent).not.toHaveBeenCalled()
    expect(screen.getByText(/não forma um jogo válido/i)).toBeInTheDocument()
  })

  it('estender: clicar num jogo compatível envia extendMeld com o índice certo', () => {
    const { sendIntent } = renderBoard(
      viewFor(0, v => {
        v.phase = 'play'
        v.yourHand = [card('hearts', '8'), card('spades', 'K')]
        v.teams[0].melds = [meld('spades', ['3', '4', '5']), meld('hearts', ['5', '6', '7'])]
      }),
      [0]
    )
    const alvo = screen.getAllByRole('group').find(g => g.getAttribute('aria-label')!.includes('5 de copas'))!
    fireEvent.click(alvo)
    expect(sendIntent).toHaveBeenCalledWith({ type: 'extendMeld', meldIndex: 1, cardIndices: [0] })
  })

  it('estender com carta incompatível não envia e avisa', () => {
    const { sendIntent } = renderBoard(
      viewFor(0, v => {
        v.phase = 'play'
        v.yourHand = [card('spades', 'K'), card('spades', 'Q')]
        v.teams[0].melds = [meld('hearts', ['5', '6', '7'])]
      }),
      [0]
    )
    fireEvent.click(screen.getByRole('group'))
    expect(sendIntent).not.toHaveBeenCalled()
    expect(screen.getByText(/não estende esse jogo/i)).toBeInTheDocument()
  })

  it('jogos da dupla adversária não são clicáveis', () => {
    const { sendIntent } = renderBoard(
      viewFor(0, v => {
        v.phase = 'play'
        v.yourHand = [card('hearts', '8')]
        v.teams[1].melds = [meld('hearts', ['5', '6', '7'])]
      }),
      [0]
    )
    fireEvent.click(screen.getByRole('group'))
    expect(sendIntent).not.toHaveBeenCalled()
  })
})
