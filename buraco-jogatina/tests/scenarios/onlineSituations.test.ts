import { GameSession } from '../../src/session/GameSession'
import { Intent, PlainCard, SeatConfig, SeatView } from '../../src/session/types'
import { Card, Rank, Suit } from '../../src/engine/card'
import { Hand } from '../../src/engine/hand'
import { Canasta } from '../../src/engine/canasta'
import { STALEMATE_RECYCLES, VU_OPENING_MINIMUM } from '../../src/engine/game'
import { TeamId, teamIdOfSeat } from '../../src/engine/gameState'

function humanos(): SeatConfig[] {
  return [
    { kind: 'human', name: 'P0' },
    { kind: 'human', name: 'P1' },
    { kind: 'human', name: 'P2' },
    { kind: 'human', name: 'P3' },
  ]
}

function motor(s: GameSession): any {
  return (s as any).game
}

function c(rank: Rank, suit: Suit = 'hearts'): Card {
  return new Card(suit, rank, false)
}

function coringa(): Card {
  return new Card('hearts', '2', true)
}

function plano(card: Card): PlainCard {
  return { suit: card.suit, rank: card.rank, isWild: card.isWild }
}

function dupla(s: GameSession, id: TeamId): any {
  return motor(s).state.teams.find((t: any) => t.id === id)
}

function darMao(s: GameSession, seat: number, cards: Card[]): void {
  motor(s).state.players[seat].hand = new Hand(cards)
}

function maoDe(s: GameSession, seat: number): Card[] {
  return motor(s).state.players[seat].hand.getCards()
}

function sequencia(suit: Suit, ranks: Rank[]): Card[] {
  return ranks.map(r => c(r, suit))
}

function limpa7(suit: Suit = 'spades'): Canasta {
  return new Canasta(sequencia(suit, ['4', '5', '6', '7', '8', '9', '10']))
}

function suja7(): Canasta {
  return new Canasta([...sequencia('clubs', ['4', '5', '6', '7', '8', '9']), coringa()])
}

function tamanhoLog(s: GameSession): number {
  return s.getViewFor(0).log.length
}

function logDesde(s: GameSession, inicio: number): string[] {
  return s.getViewFor(0).log.slice(inicio)
}

function ok(s: GameSession, seat: number, intent: Intent): void {
  const r = s.applyIntent(seat, intent)
  if (!r.ok) throw new Error(`intent ${intent.type} do assento ${seat} falhou: ${r.error}`)
}

function compraEDescarta(s: GameSession, seat: number): void {
  ok(s, seat, { type: 'draw' })
  ok(s, seat, { type: 'discard', cardIndex: 0 })
}

function marcarMortoPego(s: GameSession, id: TeamId, seat: number): void {
  const t = dupla(s, id)
  t.hasTakenMorto = true
  t.mortoTakenBySeat = seat
  t.mortoUsed = true
  motor(s).state.mortos.shift()
}

function prepararBatida(s: GameSession, id: TeamId): void {
  marcarMortoPego(s, id, id === 'A' ? 0 : 1)
  const meld = limpa7()
  dupla(s, id).melds.push(meld)
  dupla(s, id).score += meld.getScore()
}

function maosFixas(s: GameSession): void {
  darMao(s, 1, [c('5', 'clubs'), c('6', 'clubs')])
  darMao(s, 2, [c('A', 'diamonds')])
  darMao(s, 3, [coringa()])
}

function baterDescartando(s: GameSession): void {
  const seat = s.currentSeat
  ok(s, seat, { type: 'draw' })
  prepararBatida(s, teamIdOfSeat(seat))
  darMao(s, seat, [c('9', 'clubs')])
  ok(s, seat, { type: 'discard', cardIndex: 0 })
}

function contarCartas(view: SeatView): number {
  return (JSON.stringify(view).match(/"suit":/g) ?? []).length
}

function cartasPublicas(view: SeatView): number {
  return (
    view.discardPile.length +
    view.teams.reduce((n, t) => n + t.melds.reduce((m, meld) => m + meld.layout.length, 0), 0)
  )
}

function breakdown(view: SeatView, id: TeamId) {
  return view.scoreBreakdowns!.find(b => b.teamId === id)!
}

const FIM_DE_JOGO = 'a partida nao esta em andamento'
const FORA_DA_VEZ = 'nao e a vez deste assento'
const PRECISA_COMPRAR = 'fase invalida: e preciso comprar antes'
const JA_COMPROU = 'fase invalida: e preciso descartar antes de comprar de novo'
const CARTA_TRAVADA = 'voce pegou essa carta do descarte agora - nao pode devolve-la neste turno'
const RECICLOU = '🔀 O lixo foi embaralhado e virou o novo monte!'
const MORTO_VIROU_MONTE = 'O monte acabou — o morto virou o novo monte!'

describe('online: fases do turno (comprar e depois jogar)', () => {
  it('na fase de compra, descartar, baixar, baixar vários jogos e estender são recusados sem mexer na mesa', () => {
    const s = new GameSession(humanos())
    const antes = s.getViewFor(0)
    const intents: Intent[] = [
      { type: 'discard', cardIndex: 0 },
      { type: 'playCanasta', cardIndices: [0, 1, 2] },
      { type: 'playMelds', groups: [[0, 1, 2]] },
      { type: 'extendMeld', meldIndex: 0, cardIndices: [0] },
    ]
    for (const intent of intents) {
      expect(s.applyIntent(0, intent)).toEqual({ ok: false, error: PRECISA_COMPRAR })
    }
    const depois = s.getViewFor(0)
    expect(depois.yourHand).toEqual(antes.yourHand)
    expect(depois.discardPile).toEqual([])
    expect(depois.deckCount).toBe(antes.deckCount)
    expect(depois.log).toEqual(antes.log)
    expect(depois.phase).toBe('draw')
    expect(depois.currentSeat).toBe(0)
  })

  it('depois de comprar do monte, comprar de novo ou pegar o lixo é recusado', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    motor(s).state.discardPile = [c('9', 'spades')]
    const deckAntes = s.getViewFor(0).deckCount

    expect(s.applyIntent(0, { type: 'draw' })).toEqual({ ok: false, error: JA_COMPROU })
    expect(s.applyIntent(0, { type: 'takeDiscard' })).toEqual({ ok: false, error: JA_COMPROU })

    const view = s.getViewFor(0)
    expect(view.yourHand).toHaveLength(12)
    expect(view.discardPile).toEqual([plano(c('9', 'spades'))])
    expect(view.deckCount).toBe(deckAntes)
    expect(view.phase).toBe('play')
  })

  it('depois de pegar o lixo, comprar do monte é recusado', () => {
    const s = new GameSession(humanos())
    motor(s).state.discardPile = [c('9', 'spades'), c('J', 'clubs')]
    ok(s, 0, { type: 'takeDiscard' })
    const deckAntes = s.getViewFor(0).deckCount

    expect(s.applyIntent(0, { type: 'draw' })).toEqual({ ok: false, error: JA_COMPROU })
    expect(s.applyIntent(0, { type: 'takeDiscard' })).toEqual({ ok: false, error: JA_COMPROU })
    expect(s.getViewFor(0).yourHand).toHaveLength(13)
    expect(s.getViewFor(0).deckCount).toBe(deckAntes)
  })

  it('assento fora da vez não age em nenhuma fase, nem mesmo o parceiro, e assentos inexistentes também não', () => {
    const s = new GameSession(humanos())
    for (const seat of [1, 2, 3, 4, -1]) {
      expect(s.applyIntent(seat, { type: 'draw' })).toEqual({ ok: false, error: FORA_DA_VEZ })
      expect(s.applyIntent(seat, { type: 'takeDiscard' })).toEqual({ ok: false, error: FORA_DA_VEZ })
    }
    ok(s, 0, { type: 'draw' })
    const jogadas: Intent[] = [
      { type: 'discard', cardIndex: 0 },
      { type: 'playCanasta', cardIndices: [0, 1, 2] },
      { type: 'playMelds', groups: [[0, 1, 2]] },
      { type: 'extendMeld', meldIndex: 0, cardIndices: [0] },
    ]
    for (const seat of [2, 1, 3]) {
      for (const intent of jogadas) {
        expect(s.applyIntent(seat, intent)).toEqual({ ok: false, error: FORA_DA_VEZ })
      }
    }
    for (let seat = 1; seat < 4; seat++) expect(maoDe(s, seat)).toHaveLength(11)
    expect(maoDe(s, 0)).toHaveLength(12)
    expect(s.currentSeat).toBe(0)
    expect(s.phase).toBe('play')
  })

  it('comprar tira a carta do topo do monte, coloca na mão do jogador e registra no log', () => {
    const s = new GameSession(humanos())
    const deck = motor(s).state.deck
    const topo = deck[deck.length - 1]
    const deckAntes = s.getViewFor(0).deckCount
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'draw' })

    expect(maoDe(s, 0)[11]).toBe(topo)
    expect(s.getViewFor(0).yourHand[11]).toEqual(plano(topo))
    expect(s.getViewFor(0).deckCount).toBe(deckAntes - 1)
    expect(logDesde(s, inicio)).toEqual(['P0 comprou uma carta.'])
    expect(s.phase).toBe('play')
    expect(s.currentSeat).toBe(0)
  })

  it('descartar põe a carta no topo do lixo, passa a vez em ordem e volta à fase de compra', () => {
    const s = new GameSession(humanos())
    for (const seat of [0, 1, 2, 3]) {
      expect(s.currentSeat).toBe(seat)
      ok(s, seat, { type: 'draw' })
      const carta = maoDe(s, seat)[0]
      const inicio = tamanhoLog(s)
      ok(s, seat, { type: 'discard', cardIndex: 0 })
      const view = s.getViewFor((seat + 1) % 4)
      expect(view.discardPile[view.discardPile.length - 1]).toEqual(plano(carta))
      expect(view.discardPile).toHaveLength(seat + 1)
      expect(view.players[seat].handCount).toBe(11)
      expect(logDesde(s, inicio)).toEqual([`P${seat} descartou uma carta.`])
      expect(s.phase).toBe('draw')
    }
    expect(s.currentSeat).toBe(0)
  })
})

describe('online: pegar o lixo', () => {
  it('pegar o lixo com várias cartas leva todas para a mão e permite devolver a carta do topo', () => {
    const s = new GameSession(humanos())
    compraEDescarta(s, 0)
    compraEDescarta(s, 1)
    const lixo = [...motor(s).state.discardPile]
    const inicio = tamanhoLog(s)

    ok(s, 2, { type: 'takeDiscard' })

    expect(logDesde(s, inicio)).toEqual(['P2 pegou a pilha de descarte (2 cartas).'])
    expect(s.getViewFor(2).discardPile).toEqual([])
    expect(maoDe(s, 2)).toHaveLength(13)
    expect(maoDe(s, 2).slice(11)).toEqual(lixo)
    expect(s.phase).toBe('play')

    ok(s, 2, { type: 'discard', cardIndex: 12 })
    expect(motor(s).state.discardPile).toEqual([lixo[1]])
    expect(s.currentSeat).toBe(3)
  })

  it('pegar o lixo com uma única carta bloqueia devolver essa carta no mesmo turno, com mensagem própria', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    const unica = maoDe(s, 0)[0]
    ok(s, 0, { type: 'discard', cardIndex: 0 })
    const inicio = tamanhoLog(s)

    ok(s, 1, { type: 'takeDiscard' })
    expect(logDesde(s, inicio)).toEqual(['P1 pegou a pilha de descarte (1 cartas).'])
    expect(maoDe(s, 1)[11]).toBe(unica)

    expect(s.applyIntent(1, { type: 'discard', cardIndex: 11 })).toEqual({ ok: false, error: CARTA_TRAVADA })
    expect(maoDe(s, 1)).toHaveLength(12)
    expect(s.getViewFor(1).discardPile).toEqual([])
    expect(s.currentSeat).toBe(1)
    expect(s.phase).toBe('play')

    ok(s, 1, { type: 'discard', cardIndex: 0 })
    expect(s.currentSeat).toBe(2)
    expect(maoDe(s, 1)).toContain(unica)
  })

  it('a trava vale só para aquela carta: uma cópia idêntica do outro baralho pode ser descartada', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    const reiA = c('K', 'clubs')
    const reiB = c('K', 'clubs')
    darMao(s, 0, [reiA, c('5', 'diamonds')])
    ok(s, 0, { type: 'discard', cardIndex: 0 })
    darMao(s, 1, [reiB, c('7', 'spades')])

    ok(s, 1, { type: 'takeDiscard' })
    expect(maoDe(s, 1)).toEqual([reiB, c('7', 'spades'), reiA])
    expect(s.applyIntent(1, { type: 'discard', cardIndex: 2 })).toEqual({ ok: false, error: CARTA_TRAVADA })

    ok(s, 1, { type: 'discard', cardIndex: 0 })
    expect(motor(s).state.discardPile[0]).toBe(reiB)
    expect(maoDe(s, 1)).toEqual([c('7', 'spades'), reiA])
  })

  it('a trava some no turno seguinte: a mesma carta pode ser descartada depois', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    const unica = maoDe(s, 0)[0]
    ok(s, 0, { type: 'discard', cardIndex: 0 })
    ok(s, 1, { type: 'takeDiscard' })
    ok(s, 1, { type: 'discard', cardIndex: 0 })
    compraEDescarta(s, 2)
    compraEDescarta(s, 3)
    compraEDescarta(s, 0)

    ok(s, 1, { type: 'draw' })
    const indice = maoDe(s, 1).indexOf(unica)
    expect(indice).toBeGreaterThanOrEqual(0)
    ok(s, 1, { type: 'discard', cardIndex: indice })
    const lixo = motor(s).state.discardPile
    expect(lixo[lixo.length - 1]).toBe(unica)
  })

  it('pegar o lixo vazio é recusado, a fase continua de compra e comprar do monte segue possível', () => {
    const s = new GameSession(humanos())
    const inicio = tamanhoLog(s)
    expect(s.applyIntent(0, { type: 'takeDiscard' })).toEqual({ ok: false, error: 'a pilha de descarte esta vazia' })
    expect(s.phase).toBe('draw')
    expect(maoDe(s, 0)).toHaveLength(11)
    expect(logDesde(s, inicio)).toEqual([])
    ok(s, 0, { type: 'draw' })
    expect(maoDe(s, 0)).toHaveLength(12)
  })

  it('pegar o lixo e bater baixando as cartas dele narra tudo no log', () => {
    const s = new GameSession(humanos())
    marcarMortoPego(s, 'A', 0)
    dupla(s, 'A').melds.push(limpa7())
    maosFixas(s)
    darMao(s, 0, [c('Q', 'diamonds'), c('K', 'diamonds')])
    motor(s).state.discardPile = [c('J', 'diamonds')]
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'takeDiscard' })
    ok(s, 0, { type: 'playCanasta', cardIndices: [0, 1, 2] })

    expect(logDesde(s, inicio)).toEqual([
      'P0 pegou a pilha de descarte (1 cartas).',
      'P0 baixou uma canastra!',
      'Fim de jogo — Time A venceu!',
      'Fim da rodada 1.',
    ])
    const view = s.getViewFor(0)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBe(0)
    expect(breakdown(view, 'A').batidaBonus).toBe(100)
  })
})

describe('online: índices e jogos inválidos', () => {
  it('descartar com índice -1, 999 ou igual ao tamanho da mão é recusado sem mexer em nada', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    const maoAntes = maoDe(s, 0)
    const inicio = tamanhoLog(s)
    for (const cardIndex of [-1, 999, 12]) {
      expect(s.applyIntent(0, { type: 'discard', cardIndex })).toEqual({ ok: false, error: 'indice de carta invalido' })
    }
    expect(maoDe(s, 0)).toEqual(maoAntes)
    expect(s.getViewFor(0).discardPile).toEqual([])
    expect(logDesde(s, inicio)).toEqual([])
    expect(s.currentSeat).toBe(0)
    expect(s.phase).toBe('play')
  })

  it('baixar jogo sem cartas é recusado, com ou sem grupos', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    expect(s.applyIntent(0, { type: 'playCanasta', cardIndices: [] })).toEqual({
      ok: false,
      error: 'nenhuma carta selecionada',
    })
    expect(s.applyIntent(0, { type: 'playMelds', groups: [] })).toEqual({
      ok: false,
      error: 'nenhuma carta selecionada',
    })
    const vazio = s.applyIntent(0, { type: 'playMelds', groups: [[]] })
    expect(vazio.ok).toBe(false)
    expect(dupla(s, 'A').melds).toHaveLength(0)
    expect(maoDe(s, 0)).toHaveLength(12)
  })

  it('baixar jogo com índices fora da mão é recusado e nada é baixado, nem o grupo válido', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('5'), c('6'), c('7'), c('K', 'spades'), c('Q', 'clubs')])

    for (const cardIndices of [[0, 1, 99], [-1, 0, 1], [0, 1, 5]]) {
      expect(s.applyIntent(0, { type: 'playCanasta', cardIndices })).toEqual({
        ok: false,
        error: 'indices de carta invalidos',
      })
    }
    expect(
      s.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [3, 50, 51]] })
    ).toEqual({ ok: false, error: 'indices de carta invalidos' })

    expect(maoDe(s, 0)).toHaveLength(5)
    expect(dupla(s, 'A').melds).toHaveLength(0)
    expect(dupla(s, 'A').score).toBe(0)
  })

  it('baixar jogo com índices repetidos é recusado', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('5'), c('6'), c('7'), c('8'), c('K', 'spades')])

    expect(s.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 0, 1] }).ok).toBe(false)
    expect(s.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1, 1, 2] }).ok).toBe(false)
    expect(s.applyIntent(0, { type: 'playMelds', groups: [[0, 0, 1]] })).toEqual({
      ok: false,
      error: 'indices de carta invalidos',
    })
    expect(s.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2], [2, 3, 4]] })).toEqual({
      ok: false,
      error: 'indices de carta invalidos',
    })
    expect(maoDe(s, 0)).toHaveLength(5)
    expect(dupla(s, 'A').melds).toHaveLength(0)
  })

  it('cartas que não formam jogo são recusadas com a mensagem de canastra inválida', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('5'), c('6', 'spades'), c('7'), c('K', 'spades'), coringa(), new Card('clubs', '2', false)])
    const erro = { ok: false, error: 'conjunto de cartas nao forma uma canastra valida' }
    expect(s.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1, 2] })).toEqual(erro)
    expect(s.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 2] })).toEqual(erro)
    expect(s.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 2, 4, 5] })).toEqual(erro)
    expect(maoDe(s, 0)).toHaveLength(6)
  })

  it('estender com meldIndex negativo, inexistente ou ausente é recusado; estender certo funciona', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    dupla(s, 'A').melds.push(new Canasta(sequencia('hearts', ['3', '4', '5'])))
    darMao(s, 0, [c('6'), c('K', 'spades'), c('Q', 'clubs')])

    const inexistente = { ok: false, error: 'meld inexistente' }
    expect(s.applyIntent(0, { type: 'extendMeld', meldIndex: -1, cardIndices: [0] })).toEqual(inexistente)
    expect(s.applyIntent(0, { type: 'extendMeld', meldIndex: 1, cardIndices: [0] })).toEqual(inexistente)
    expect(s.applyIntent(0, { type: 'extendMeld', cardIndices: [0] } as unknown as Intent)).toEqual(inexistente)
    expect(s.applyIntent(0, { type: 'extendMeld', meldIndex: 0, cardIndices: [] })).toEqual({
      ok: false,
      error: 'nenhuma carta selecionada',
    })
    expect(s.applyIntent(0, { type: 'extendMeld', meldIndex: 0, cardIndices: [7] })).toEqual({
      ok: false,
      error: 'indices de carta invalidos',
    })
    expect(s.applyIntent(0, { type: 'extendMeld', meldIndex: 0, cardIndices: [1] })).toEqual({
      ok: false,
      error: 'extensao invalida',
    })
    expect(dupla(s, 'A').melds[0].cards).toHaveLength(3)
    expect(maoDe(s, 0)).toHaveLength(3)

    const inicio = tamanhoLog(s)
    ok(s, 0, { type: 'extendMeld', meldIndex: 0, cardIndices: [0] })
    expect(dupla(s, 'A').melds[0].cards).toHaveLength(4)
    expect(logDesde(s, inicio)).toEqual(['P0 estendeu um jogo do time!'])
  })

  it('não dá para estender o jogo da dupla adversária: o índice só enxerga os jogos da própria dupla', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    dupla(s, 'B').melds.push(new Canasta(sequencia('hearts', ['3', '4', '5'])))
    darMao(s, 0, [c('6'), c('K', 'spades'), c('Q', 'clubs')])

    expect(s.applyIntent(0, { type: 'extendMeld', meldIndex: 0, cardIndices: [0] })).toEqual({
      ok: false,
      error: 'meld inexistente',
    })
    expect(dupla(s, 'B').melds[0].cards).toHaveLength(3)
  })
})

describe('online: morto', () => {
  it('descartar a última carta pega o morto, passa a vez e o morto aparece só para quem pegou', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('K', 'spades')])
    const morto = [...motor(s).state.mortos[0]]
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'discard', cardIndex: 0 })

    expect(logDesde(s, inicio)).toEqual(['P0 descartou uma carta.', 'P0 pegou o morto!'])
    expect(maoDe(s, 0)).toEqual(morto)
    expect(s.getViewFor(0).yourHand).toEqual(morto.map(plano))
    expect(s.getViewFor(1).players[0].handCount).toBe(11)
    expect(s.getViewFor(1).mortos).toEqual([{ count: 11 }])
    expect(s.getViewFor(1).teams.find(t => t.id === 'A')!.hasTakenMorto).toBe(true)
    expect(s.getViewFor(1).discardPile).toEqual([plano(c('K', 'spades'))])
    expect(s.currentSeat).toBe(1)
    expect(s.phase).toBe('draw')
    expect(s.status).toBe('playing')
    const v1 = s.getViewFor(1)
    expect(contarCartas(v1)).toBe(v1.yourHand.length + cartasPublicas(v1))
  })

  it('baixar as últimas cartas em jogo pega o morto e o jogador continua jogando com a mão nova', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('5'), c('6'), c('7')])
    const morto = [...motor(s).state.mortos[0]]
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'playCanasta', cardIndices: [0, 1, 2] })

    expect(logDesde(s, inicio)).toEqual(['P0 baixou uma canastra!', 'P0 pegou o morto!'])
    expect(maoDe(s, 0)).toEqual(morto)
    expect(s.currentSeat).toBe(0)
    expect(s.phase).toBe('play')
    expect(dupla(s, 'A').mortoTakenBySeat).toBe(0)
    expect(dupla(s, 'A').mortoUsed).toBe(false)

    ok(s, 0, { type: 'discard', cardIndex: 0 })
    expect(dupla(s, 'A').mortoUsed).toBe(true)
    expect(s.currentSeat).toBe(1)
  })

  it('estender um jogo com as últimas cartas pega o morto', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    dupla(s, 'A').melds.push(new Canasta(sequencia('hearts', ['3', '4', '5'])))
    darMao(s, 0, [c('6'), c('7')])
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'extendMeld', meldIndex: 0, cardIndices: [0, 1] })

    expect(logDesde(s, inicio)).toEqual(['P0 estendeu um jogo do time!', 'P0 pegou o morto!'])
    expect(dupla(s, 'A').melds[0].cards).toHaveLength(5)
    expect(maoDe(s, 0)).toHaveLength(11)
    expect(s.getViewFor(0).mortos).toEqual([{ count: 11 }])
    expect(s.phase).toBe('play')
  })

  it('baixar vários jogos de uma vez esvaziando a mão também pega o morto', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('5'), c('6'), c('7'), c('8', 'spades'), c('9', 'spades'), c('10', 'spades')])
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5]] })

    expect(logDesde(s, inicio)).toEqual(['P0 baixou 2 jogo(s)!', 'P0 pegou o morto!'])
    expect(dupla(s, 'A').melds).toHaveLength(2)
    expect(dupla(s, 'A').score).toBe(15 + 30)
    expect(maoDe(s, 0)).toHaveLength(11)
  })

  it('esvaziar a mão sem ter pego o morto não bate, mesmo com canastra limpa: pega o morto e segue', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    dupla(s, 'A').melds.push(limpa7())
    darMao(s, 0, [c('J', 'diamonds')])

    ok(s, 0, { type: 'discard', cardIndex: 0 })

    expect(s.status).toBe('playing')
    expect(s.getViewFor(0).closerSeat).toBeUndefined()
    expect(maoDe(s, 0)).toHaveLength(11)
    expect(s.currentSeat).toBe(1)
  })

  it('o parceiro não pega um segundo morto: sem canastra limpa não pode esvaziar a mão', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('K', 'spades')])
    ok(s, 0, { type: 'discard', cardIndex: 0 })
    compraEDescarta(s, 1)
    ok(s, 2, { type: 'draw' })

    darMao(s, 2, [c('Q', 'clubs')])
    expect(s.applyIntent(2, { type: 'discard', cardIndex: 0 })).toEqual({
      ok: false,
      error: 'voce nao pode descartar a ultima carta sem poder bater',
    })
    darMao(s, 2, [c('5'), c('6'), c('7')])
    expect(s.applyIntent(2, { type: 'playCanasta', cardIndices: [0, 1, 2] })).toEqual({
      ok: false,
      error: 'essa jogada esvaziaria a mao sem poder bater',
    })
    expect(maoDe(s, 2)).toHaveLength(3)
    expect(s.getViewFor(2).mortos).toEqual([{ count: 11 }])
    expect(dupla(s, 'A').mortoTakenBySeat).toBe(0)
  })

  it('cada dupla pega o seu morto: depois das duas, não sobra morto na mesa', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('K', 'spades')])
    ok(s, 0, { type: 'discard', cardIndex: 0 })
    ok(s, 1, { type: 'draw' })
    darMao(s, 1, [c('Q', 'clubs')])
    const inicio = tamanhoLog(s)

    ok(s, 1, { type: 'discard', cardIndex: 0 })

    expect(logDesde(s, inicio)).toEqual(['P1 descartou uma carta.', 'P1 pegou o morto!'])
    const view = s.getViewFor(3)
    expect(view.mortos).toEqual([])
    expect(view.teams.map(t => t.hasTakenMorto)).toEqual([true, true])
    expect(dupla(s, 'B').mortoTakenBySeat).toBe(1)
    expect(view.players[1].handCount).toBe(11)
  })

  it('morto pego e não jogado: a dupla perde 100 e a mão do morto não é descontada', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('K', 'spades')])
    ok(s, 0, { type: 'discard', cardIndex: 0 })
    dupla(s, 'A').melds.push(limpa7())
    compraEDescarta(s, 1)
    ok(s, 2, { type: 'draw' })
    darMao(s, 2, [c('9', 'clubs')])

    ok(s, 2, { type: 'discard', cardIndex: 0 })

    const view = s.getViewFor(0)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBe(2)
    const a = breakdown(view, 'A')
    expect(a.mortoPenalty).toBe(-100)
    expect(a.batidaBonus).toBe(100)
    expect(a.handBySeat.find(h => h.seat === 0)!.counted).toBe(false)
    expect(a.handBySeat.find(h => h.seat === 0)!.points).toBeGreaterThan(0)
    expect(a.handPenalty).toBe(0)
    expect(a.total).toBe(250)
  })
})

describe('online: monte acabando (log de compra)', () => {
  it('monte vazio: o morto disponível vira o novo monte e o log avisa antes da compra', () => {
    const s = new GameSession(humanos())
    motor(s).state.deck = []
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'draw' })

    expect(logDesde(s, inicio)).toEqual([MORTO_VIROU_MONTE, 'P0 comprou uma carta.'])
    const view = s.getViewFor(0)
    expect(view.mortos).toEqual([{ count: 11 }])
    expect(view.deckCount).toBe(10)
    expect(view.yourHand).toHaveLength(12)
  })

  it('comprar a última carta do monte já promove o morto e avisa no log', () => {
    const s = new GameSession(humanos())
    const ultima = c('Q', 'spades')
    motor(s).state.deck = [ultima]
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'draw' })

    expect(logDesde(s, inicio)).toEqual([MORTO_VIROU_MONTE, 'P0 comprou uma carta.'])
    expect(maoDe(s, 0)[11]).toBe(ultima)
    expect(s.getViewFor(0).deckCount).toBe(11)
    expect(s.getViewFor(0).mortos).toEqual([{ count: 11 }])
  })

  it('morto virando monte livra a dupla da penalidade de morto não pego', () => {
    const s = new GameSession(humanos())
    marcarMortoPego(s, 'A', 0)
    motor(s).state.deck = []
    ok(s, 0, { type: 'draw' })
    expect(s.getViewFor(0).mortos).toEqual([])
    dupla(s, 'A').melds.push(limpa7())
    maosFixas(s)
    darMao(s, 0, [c('9', 'clubs')])

    ok(s, 0, { type: 'discard', cardIndex: 0 })

    const view = s.getViewFor(0)
    expect(view.status).toBe('finished')
    expect(breakdown(view, 'B').mortoPenalty).toBe(0)
    expect(breakdown(view, 'B').total).toBe(-30)
  })

  it('monte e mortos vazios: o lixo é embaralhado e vira o monte, com aviso no log', () => {
    const s = new GameSession(humanos())
    const lixo = [c('3', 'clubs'), c('8', 'diamonds'), c('J', 'spades')]
    motor(s).state.deck = []
    motor(s).state.mortos = []
    motor(s).state.discardPile = [...lixo]
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'draw' })

    expect(logDesde(s, inicio)).toEqual([RECICLOU, 'P0 comprou uma carta.'])
    const view = s.getViewFor(0)
    expect(view.discardPile).toEqual([])
    expect(view.deckCount).toBe(2)
    expect(motor(s).state.discardRecycles).toBe(1)
    const comprada = maoDe(s, 0)[11]
    expect(lixo).toContain(comprada)
    expect(new Set([...motor(s).state.deck, comprada])).toEqual(new Set(lixo))
  })

  it('monte, mortos e lixo vazios: a compra registra que o monte acabou e a mão não muda', () => {
    const s = new GameSession(humanos())
    motor(s).state.deck = []
    motor(s).state.mortos = []
    motor(s).state.discardPile = []
    const inicio = tamanhoLog(s)

    const r = s.applyIntent(0, { type: 'draw' })

    expect(r.ok).toBe(true)
    expect(logDesde(s, inicio)).toEqual(['O monte acabou.'])
    expect(maoDe(s, 0)).toHaveLength(11)
  })
})

describe('online: batida', () => {
  it('bater descartando a última carta: dupla com morto e canastra limpa ganha +100 e a rodada fecha', () => {
    const s = new GameSession(humanos())
    maosFixas(s)
    const inicio = tamanhoLog(s)

    baterDescartando(s)

    const view = s.getViewFor(1)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBe(0)
    expect(view.winnerTeam).toBe('A')
    expect(view.discardPile[view.discardPile.length - 1]).toEqual(plano(c('9', 'clubs')))
    expect(breakdown(view, 'A')).toMatchObject({
      meldPoints: 250,
      batidaBonus: 100,
      mortoPenalty: 0,
      handPenalty: -15,
      total: 335,
    })
    expect(breakdown(view, 'B')).toMatchObject({
      meldPoints: 0,
      batidaBonus: 0,
      mortoPenalty: -100,
      handPenalty: -30,
      total: -130,
    })
    expect(view.matchScores).toEqual({ A: 335, B: -130 })
    expect(view.matchCanastras).toEqual({ A: { clean: 1, dirty: 0 }, B: { clean: 0, dirty: 0 } })
    expect(view.matchWinner).toBeUndefined()
    expect(logDesde(s, inicio)).toEqual([
      'P0 comprou uma carta.',
      'P0 descartou uma carta.',
      'Fim de jogo — Time A venceu!',
      'Fim da rodada 1.',
    ])
  })

  it('bater baixando um jogo: as últimas cartas viram jogo e a rodada fecha na hora', () => {
    const s = new GameSession(humanos())
    maosFixas(s)
    ok(s, 0, { type: 'draw' })
    prepararBatida(s, 'A')
    darMao(s, 0, [c('J', 'diamonds'), c('Q', 'diamonds'), c('K', 'diamonds')])
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'playCanasta', cardIndices: [0, 1, 2] })

    expect(logDesde(s, inicio)).toEqual(['P0 baixou uma canastra!', 'Fim de jogo — Time A venceu!', 'Fim da rodada 1.'])
    const view = s.getViewFor(0)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBe(0)
    expect(view.yourHand).toEqual([])
    expect(breakdown(view, 'A')).toMatchObject({ meldPoints: 280, batidaBonus: 100, handPenalty: -15, total: 365 })
    expect(view.matchScores.A).toBe(365)
  })

  it('bater formando a própria canastra limpa na última descida', () => {
    const s = new GameSession(humanos())
    maosFixas(s)
    ok(s, 0, { type: 'draw' })
    marcarMortoPego(s, 'A', 0)
    darMao(s, 0, sequencia('diamonds', ['4', '5', '6', '7', '8', '9', '10']))

    ok(s, 0, { type: 'playCanasta', cardIndices: [0, 1, 2, 3, 4, 5, 6] })

    const view = s.getViewFor(0)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBe(0)
    const meld = view.teams.find(t => t.id === 'A')!.melds[0]
    expect(meld.isCanastra).toBe(true)
    expect(meld.kind).toBe('limpa')
    expect(breakdown(view, 'A')).toMatchObject({ meldPoints: 250, batidaBonus: 100 })
  })

  it('bater estendendo: completar a canastra limpa com a última carta fecha a rodada', () => {
    const s = new GameSession(humanos())
    maosFixas(s)
    ok(s, 0, { type: 'draw' })
    marcarMortoPego(s, 'A', 0)
    dupla(s, 'A').melds.push(new Canasta(sequencia('hearts', ['4', '5', '6', '7', '8', '9'])))
    darMao(s, 0, [c('10')])
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'extendMeld', meldIndex: 0, cardIndices: [0] })

    expect(logDesde(s, inicio)).toEqual(['P0 estendeu um jogo do time!', 'Fim de jogo — Time A venceu!', 'Fim da rodada 1.'])
    const view = s.getViewFor(2)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBe(0)
    expect(view.teams.find(t => t.id === 'A')!.melds[0].kind).toBe('limpa')
    expect(breakdown(view, 'A')).toMatchObject({ meldPoints: 250, batidaBonus: 100 })
  })

  it('o parceiro também bate pela dupla', () => {
    const s = new GameSession(humanos())
    compraEDescarta(s, 0)
    compraEDescarta(s, 1)
    ok(s, 2, { type: 'draw' })
    prepararBatida(s, 'A')
    darMao(s, 0, [c('K', 'spades')])
    darMao(s, 1, [c('5', 'clubs')])
    darMao(s, 3, [c('5', 'spades')])
    darMao(s, 2, [c('9', 'clubs')])

    ok(s, 2, { type: 'discard', cardIndex: 0 })

    const view = s.getViewFor(0)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBe(2)
    expect(view.winnerTeam).toBe('A')
    expect(breakdown(view, 'A')).toMatchObject({ batidaBonus: 100, handPenalty: -10, total: 340 })
  })

  it('a dupla B também bate e vence a rodada', () => {
    const s = new GameSession(humanos())
    compraEDescarta(s, 0)
    ok(s, 1, { type: 'draw' })
    prepararBatida(s, 'B')
    darMao(s, 0, [c('K', 'spades')])
    darMao(s, 2, [c('Q', 'spades')])
    darMao(s, 3, [c('5', 'spades')])
    darMao(s, 1, [c('9', 'clubs')])

    ok(s, 1, { type: 'discard', cardIndex: 0 })

    const view = s.getViewFor(1)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBe(1)
    expect(view.winnerTeam).toBe('B')
    expect(breakdown(view, 'B')).toMatchObject({ batidaBonus: 100, mortoPenalty: 0, handPenalty: -5, total: 345 })
    expect(breakdown(view, 'A')).toMatchObject({ batidaBonus: 0, mortoPenalty: -100, handPenalty: -20, total: -120 })
    expect(view.log.slice(-2)).toEqual(['Fim de jogo — Time B venceu!', 'Fim da rodada 1.'])
  })

  it('sem canastra limpa não bate: com só canastra suja, nem descarte, nem descida, nem extensão esvaziam a mão', () => {
    const s = new GameSession(humanos())
    ok(s, 0, { type: 'draw' })
    marcarMortoPego(s, 'A', 0)
    dupla(s, 'A').melds.push(suja7())
    dupla(s, 'A').melds.push(new Canasta(sequencia('diamonds', ['3', '4', '5'])))

    darMao(s, 0, [c('K', 'clubs')])
    expect(s.applyIntent(0, { type: 'discard', cardIndex: 0 })).toEqual({
      ok: false,
      error: 'voce nao pode descartar a ultima carta sem poder bater',
    })
    darMao(s, 0, [c('5'), c('6'), c('7')])
    expect(s.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1, 2] })).toEqual({
      ok: false,
      error: 'essa jogada esvaziaria a mao sem poder bater',
    })
    darMao(s, 0, [c('6', 'diamonds')])
    expect(s.applyIntent(0, { type: 'extendMeld', meldIndex: 1, cardIndices: [0] })).toEqual({
      ok: false,
      error: 'essa extensao esvaziaria a mao sem poder bater',
    })
    darMao(s, 0, [c('6', 'diamonds'), c('K', 'clubs')])
    expect(s.applyIntent(0, { type: 'extendMeld', meldIndex: 1, cardIndices: [0] })).toEqual({
      ok: false,
      error: 'essa extensao esvaziaria a mao sem poder bater',
    })
    expect(s.status).toBe('playing')
    expect(dupla(s, 'A').melds[1].cards).toHaveLength(3)
  })
})

describe('online: depois que a rodada ou a partida acaba', () => {
  it('com a rodada encerrada, nenhuma jogada é aceita de nenhum assento e o placar não muda', () => {
    const s = new GameSession(humanos())
    maosFixas(s)
    baterDescartando(s)
    expect(s.status).toBe('finished')
    const antes = s.getViewFor(0)
    const intents: Intent[] = [
      { type: 'draw' },
      { type: 'takeDiscard' },
      { type: 'discard', cardIndex: 0 },
      { type: 'playCanasta', cardIndices: [0, 1, 2] },
      { type: 'playMelds', groups: [[0, 1, 2]] },
      { type: 'extendMeld', meldIndex: 0, cardIndices: [0] },
    ]
    for (const seat of [0, 1, 2, 3]) {
      for (const intent of intents) {
        expect(s.applyIntent(seat, intent)).toEqual({ ok: false, error: FIM_DE_JOGO })
      }
    }
    const depois = s.getViewFor(0)
    expect(depois.matchScores).toEqual(antes.matchScores)
    expect(depois.log).toEqual(antes.log)
    expect(depois.discardPile).toEqual(antes.discardPile)
    expect(depois.teams).toEqual(antes.teams)
    expect(depois.players).toEqual(antes.players)
  })

  it('próxima rodada antes do fim é recusada, tanto na fase de compra quanto na de jogo', () => {
    const s = new GameSession(humanos())
    const erro = { ok: false, error: 'a rodada atual ainda nao terminou' }
    expect(s.applyIntent(0, { type: 'nextRound' })).toEqual(erro)
    ok(s, 0, { type: 'draw' })
    const mao = maoDe(s, 0)
    expect(s.applyIntent(0, { type: 'nextRound' })).toEqual(erro)
    expect(s.applyIntent(3, { type: 'nextRound' })).toEqual(erro)
    expect(s.getViewFor(0).round).toBe(1)
    expect(maoDe(s, 0)).toEqual(mao)
    expect(s.phase).toBe('play')
  })

  it('próxima rodada reinicia a mesa: mãos de 11, mortos cheios, monte de 42, lixo vazio e vez do assento 0', () => {
    const s = new GameSession(humanos())
    maosFixas(s)
    baterDescartando(s)
    const inicio = tamanhoLog(s)

    ok(s, 2, { type: 'nextRound' })

    expect(logDesde(s, inicio)).toEqual(['Rodada 2 iniciada.'])
    for (let seat = 0; seat < 4; seat++) {
      const view = s.getViewFor(seat)
      expect(view.yourHand).toHaveLength(11)
      expect(view.round).toBe(2)
    }
    const view = s.getViewFor(0)
    expect(view.status).toBe('playing')
    expect(view.mortos).toEqual([{ count: 11 }, { count: 11 }])
    expect(view.deckCount).toBe(42)
    expect(view.discardPile).toEqual([])
    expect(view.teams.every(t => t.melds.length === 0 && t.score === 0 && !t.hasTakenMorto)).toBe(true)
    expect(view.winnerTeam).toBeUndefined()
    expect(view.closerSeat).toBeUndefined()
    expect(view.scoreBreakdowns).toBeUndefined()
    expect(view.matchScores).toEqual({ A: 335, B: -130 })
    expect(view.currentSeat).toBe(0)
    expect(view.phase).toBe('draw')

    expect(s.applyIntent(0, { type: 'nextRound' })).toEqual({ ok: false, error: 'a rodada atual ainda nao terminou' })
    expect(s.getViewFor(0).round).toBe(2)
  })

  it('a pontuação de várias rodadas acumula na partida', () => {
    const s = new GameSession(humanos())
    maosFixas(s)
    baterDescartando(s)
    ok(s, 0, { type: 'nextRound' })
    maosFixas(s)
    baterDescartando(s)

    const view = s.getViewFor(0)
    expect(view.round).toBe(2)
    expect(view.matchScores).toEqual({ A: 670, B: -260 })
    expect(view.matchCanastras.A.clean).toBe(2)
    expect(view.log.slice(-1)).toEqual(['Fim da rodada 2.'])
  })

  it('quando a partida acaba, próxima rodada é recusada e o log anuncia o fim da partida', () => {
    const s = new GameSession(humanos())
    ;(s as any).matchScores = { A: 2950, B: 0 }
    maosFixas(s)

    baterDescartando(s)

    const view = s.getViewFor(0)
    expect(view.matchScores).toEqual({ A: 3285, B: -130 })
    expect(view.matchWinner).toBe('A')
    expect(view.log.slice(-2)).toEqual(['Fim de jogo — Time A venceu!', 'Fim da partida — Time A venceu!'])
    expect(view.log).not.toContain('Fim da rodada 1.')

    expect(s.applyIntent(0, { type: 'nextRound' })).toEqual({ ok: false, error: 'a partida ja foi encerrada' })
    expect(s.applyIntent(0, { type: 'draw' })).toEqual({ ok: false, error: FIM_DE_JOGO })
    expect(s.getViewFor(0).round).toBe(1)
    expect(s.status).toBe('finished')
  })
})

describe('online: impasse', () => {
  function montarImpasse(
    s: GameSession,
    placar: Record<TeamId, number>,
    jogosA: Canasta[],
    jogosB: Canasta[]
  ): void {
    ;(s as any).matchScores = { ...placar }
    const g = motor(s)
    g.state.mortos = []
    g.state.deck = [c('K', 'clubs')]
    g.state.discardPile = [c('9', 'spades')]
    darMao(s, 0, [c('K', 'spades')])
    darMao(s, 1, [c('5', 'clubs')])
    darMao(s, 2, [c('A', 'diamonds')])
    darMao(s, 3, [coringa()])
    for (const m of jogosA) {
      dupla(s, 'A').melds.push(m)
      dupla(s, 'A').score += m.getScore()
    }
    for (const m of jogosB) {
      dupla(s, 'B').melds.push(m)
      dupla(s, 'B').score += m.getScore()
    }
    g.isGameOver()
  }

  function rodarAteAcabar(s: GameSession): number {
    let turnos = 0
    while (s.status === 'playing' && turnos < 60) {
      const seat = s.currentSeat
      ok(s, seat, { type: 'draw' })
      ok(s, seat, { type: 'discard', cardIndex: maoDe(s, seat).length - 1 })
      turnos++
    }
    return turnos
  }

  it('12 reembaralhadas sem nada novo na mesa encerram a rodada sem batida e o placar da partida acumula', () => {
    const s = new GameSession(humanos())
    montarImpasse(s, { A: 1000, B: 500 }, [new Canasta(sequencia('hearts', ['3', '4', '5']))], [])
    const inicio = tamanhoLog(s)

    const turnos = rodarAteAcabar(s)

    expect(turnos).toBe(STALEMATE_RECYCLES)
    const view = s.getViewFor(0)
    expect(view.status).toBe('finished')
    expect(view.closerSeat).toBeUndefined()
    expect(breakdown(view, 'A')).toMatchObject({ meldPoints: 15, batidaBonus: 0, mortoPenalty: 0, handPenalty: -25, total: -10 })
    expect(breakdown(view, 'B')).toMatchObject({ meldPoints: 0, batidaBonus: 0, mortoPenalty: 0, handPenalty: -25, total: -25 })
    expect(view.winnerTeam).toBe('A')
    expect(view.matchScores).toEqual({ A: 990, B: 475 })
    expect(view.matchWinner).toBeUndefined()
    const log = logDesde(s, inicio)
    expect(log.filter(l => l === RECICLOU)).toHaveLength(STALEMATE_RECYCLES)
    expect(log.slice(-2)).toEqual(['Fim de jogo — Time A venceu!', 'Fim da rodada 1.'])

    ok(s, 0, { type: 'nextRound' })
    expect(s.getViewFor(0).round).toBe(2)
    expect(s.getViewFor(0).matchScores).toEqual({ A: 990, B: 475 })
  })

  it('antes da 12ª reembaralhada a rodada segue normalmente', () => {
    const s = new GameSession(humanos())
    montarImpasse(s, { A: 0, B: 0 }, [], [])
    for (let i = 0; i < STALEMATE_RECYCLES - 1; i++) {
      const seat = s.currentSeat
      ok(s, seat, { type: 'draw' })
      ok(s, seat, { type: 'discard', cardIndex: maoDe(s, seat).length - 1 })
      expect(s.status).toBe('playing')
    }
    expect(motor(s).state.discardRecycles).toBe(STALEMATE_RECYCLES - 1)
    expect(s.getViewFor(0).matchScores).toEqual({ A: 0, B: 0 })
  })

  it('impasse com VU: o placar acumula e a vulnerabilidade é reavaliada na rodada seguinte (não fica grudada)', () => {
    const s = new GameSession(humanos())
    montarImpasse(
      s,
      { A: 1505, B: 1497 },
      [new Canasta(sequencia('hearts', ['3', '4', '5']))],
      [new Canasta(sequencia('clubs', ['8', '9', '10']))]
    )

    expect(rodarAteAcabar(s)).toBe(STALEMATE_RECYCLES)
    const fim = s.getViewFor(0)
    expect(fim.matchScores).toEqual({ A: 1495, B: 1502 })
    expect(fim.winnerTeam).toBe('B')

    const inicio = tamanhoLog(s)
    ok(s, 0, { type: 'nextRound' })

    expect(logDesde(s, inicio)).toEqual([
      'Rodada 2 iniciada.',
      `⚠️ Time B está vulnerável (VU): a primeira descida da rodada precisa somar ${VU_OPENING_MINIMUM} pontos.`,
    ])
    for (let seat = 0; seat < 4; seat++) {
      const teams = s.getViewFor(seat).teams
      expect(teams.find(t => t.id === 'A')!.openingMinimum).toBe(0)
      expect(teams.find(t => t.id === 'B')!.openingMinimum).toBe(VU_OPENING_MINIMUM)
    }
  })
})

describe('online: rodada com dupla vulnerável (VU)', () => {
  function rodadaComVu(): GameSession {
    const s = new GameSession(humanos())
    ;(s as any).matchScores = { A: 1265, B: 1629 }
    maosFixas(s)
    baterDescartando(s)
    ok(s, 0, { type: 'nextRound' })
    return s
  }

  it('o placar de 1500+ marca VU na próxima rodada, avisa no log e quem caiu abaixo de 1500 deixa de ser VU', () => {
    const s = new GameSession(humanos())
    ;(s as any).matchScores = { A: 1265, B: 1629 }
    maosFixas(s)
    baterDescartando(s)
    expect(s.getViewFor(0).matchScores).toEqual({ A: 1600, B: 1499 })
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'nextRound' })

    expect(logDesde(s, inicio)).toEqual([
      'Rodada 2 iniciada.',
      '⚠️ Time A está vulnerável (VU): a primeira descida da rodada precisa somar 75 pontos.',
    ])
    for (let seat = 0; seat < 4; seat++) {
      const teams = s.getViewFor(seat).teams
      expect(teams.find(t => t.id === 'A')!.openingMinimum).toBe(75)
      expect(teams.find(t => t.id === 'B')!.openingMinimum).toBe(0)
    }
    expect(s.getPublicView().teams.map(t => t.openingMinimum)).toEqual([75, 0])
  })

  it('dupla VU: descer menos de 75 é recusado com o total das cartas, mesmo que fosse para pegar o morto', () => {
    const s = rodadaComVu()
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('5'), c('6'), c('7'), c('K', 'clubs')])
    const erro = { ok: false, error: 'vulneravel: a abertura precisa somar 75 pontos (estas cartas somam 15)' }

    expect(s.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1, 2] })).toEqual(erro)
    expect(s.applyIntent(0, { type: 'playMelds', groups: [[0, 1, 2]] })).toEqual(erro)

    darMao(s, 0, [c('5'), c('6'), c('7')])
    expect(s.applyIntent(0, { type: 'playCanasta', cardIndices: [0, 1, 2] })).toEqual(erro)
    expect(maoDe(s, 0)).toHaveLength(3)
    expect(s.getViewFor(0).mortos).toEqual([{ count: 11 }, { count: 11 }])
    expect(dupla(s, 'A').melds).toHaveLength(0)
  })

  it('dupla VU ainda pega o morto descartando a última carta e continua precisando abrir com 75', () => {
    const s = rodadaComVu()
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('K', 'spades')])
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'discard', cardIndex: 0 })

    expect(logDesde(s, inicio)).toEqual(['P0 descartou uma carta.', 'P0 pegou o morto!'])
    expect(maoDe(s, 0)).toHaveLength(11)
    const a = s.getViewFor(0).teams.find(t => t.id === 'A')!
    expect(a.hasTakenMorto).toBe(true)
    expect(a.openingMinimum).toBe(75)
    expect(a.melds).toEqual([])
  })

  it('dupla VU abre com dois jogos somando 80, esvazia a mão e pega o morto na mesma ação', () => {
    const s = rodadaComVu()
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('Q'), c('K'), c('A'), c('J', 'diamonds'), c('Q', 'diamonds'), c('K', 'diamonds'), c('A', 'diamonds')])
    const inicio = tamanhoLog(s)

    ok(s, 0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5, 6]] })

    expect(logDesde(s, inicio)).toEqual(['P0 abriu o jogo da dupla com 80 pontos (vulnerável).', 'P0 pegou o morto!'])
    expect(dupla(s, 'A').melds).toHaveLength(2)
    expect(maoDe(s, 0)).toHaveLength(11)
    expect(s.phase).toBe('play')
  })

  it('depois de abrir, a dupla VU desce jogos pequenos normalmente, inclusive o parceiro; a outra dupla nunca foi restringida', () => {
    const s = rodadaComVu()
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [
      c('Q'),
      c('K'),
      c('A'),
      c('J', 'diamonds'),
      c('Q', 'diamonds'),
      c('K', 'diamonds'),
      c('A', 'diamonds'),
      c('4', 'clubs'),
      c('5', 'clubs'),
      c('6', 'clubs'),
      c('K', 'spades'),
    ])
    ok(s, 0, { type: 'playMelds', groups: [[0, 1, 2], [3, 4, 5, 6]] })
    const inicio = tamanhoLog(s)
    ok(s, 0, { type: 'playCanasta', cardIndices: [0, 1, 2] })
    expect(logDesde(s, inicio)).toEqual(['P0 baixou uma canastra!'])
    ok(s, 0, { type: 'discard', cardIndex: 0 })

    ok(s, 1, { type: 'draw' })
    darMao(s, 1, [c('3', 'diamonds'), c('4', 'diamonds'), c('5', 'diamonds'), c('K', 'clubs'), c('Q', 'clubs')])
    ok(s, 1, { type: 'playCanasta', cardIndices: [0, 1, 2] })
    ok(s, 1, { type: 'discard', cardIndex: 0 })

    ok(s, 2, { type: 'draw' })
    darMao(s, 2, [c('7', 'spades'), c('8', 'spades'), c('9', 'spades'), c('K', 'diamonds'), c('Q', 'clubs')])
    ok(s, 2, { type: 'playCanasta', cardIndices: [0, 1, 2] })

    expect(dupla(s, 'A').melds).toHaveLength(4)
    expect(dupla(s, 'B').melds).toHaveLength(1)
  })
})

describe('online: vistas não vazam a mão de ninguém', () => {
  function mesaEmAndamento(): GameSession {
    const s = new GameSession(humanos())
    motor(s).setOpeningMinimums({ A: 0, B: 1600 })
    ok(s, 0, { type: 'draw' })
    darMao(s, 0, [c('5'), c('6'), c('7'), c('K', 'spades'), c('Q', 'clubs')])
    ok(s, 0, { type: 'playCanasta', cardIndices: [0, 1, 2] })
    ok(s, 0, { type: 'discard', cardIndex: 0 })
    compraEDescarta(s, 1)
    ok(s, 2, { type: 'draw' })
    return s
  }

  it('cada assento só recebe as próprias cartas; o resto aparece apenas como contagem', () => {
    const s = mesaEmAndamento()
    for (let seat = 0; seat < 4; seat++) {
      const view = s.getViewFor(seat)
      expect(view.seat).toBe(seat)
      expect(view.yourHand).toEqual(maoDe(s, seat).map(plano))
      expect(contarCartas(view)).toBe(view.yourHand.length + cartasPublicas(view))
      view.players.forEach((p, i) => expect(p.handCount).toBe(maoDe(s, i).length))
      expect(view.mortos).toEqual([{ count: 11 }, { count: 11 }])
    }
  })

  it('a vista pública e assentos inexistentes não recebem mão nenhuma', () => {
    const s = mesaEmAndamento()
    for (const view of [s.getPublicView(), s.getViewFor(4), s.getViewFor(-1)]) {
      expect(view.yourHand).toEqual([])
      expect(contarCartas(view)).toBe(cartasPublicas(view))
    }
  })

  it('o campo openingMinimum é só um número por dupla, igual para todos os assentos, sem dados extras', () => {
    const s = mesaEmAndamento()
    const vistas = [0, 1, 2, 3].map(seat => s.getViewFor(seat))
    for (const view of vistas) {
      for (const team of view.teams) {
        expect(Object.keys(team).sort()).toEqual(['hasTakenMorto', 'id', 'melds', 'openingMinimum', 'score'])
        expect(typeof team.openingMinimum).toBe('number')
      }
      for (const p of view.players) {
        expect(Object.keys(p).sort()).toEqual(['connected', 'handCount', 'kind', 'name', 'seat', 'teamId'])
      }
      expect(view.teams).toEqual(vistas[0].teams)
      expect(view.teams.map(t => [t.id, t.openingMinimum])).toEqual([
        ['A', 0],
        ['B', 75],
      ])
    }
  })

  it('mexer na vista recebida não altera a partida', () => {
    const s = mesaEmAndamento()
    const view = s.getViewFor(2)
    const maoReal = maoDe(s, 2)
    view.yourHand.pop()
    view.yourHand[0].rank = 'A'
    view.teams[1].openingMinimum = 0
    view.matchScores.A = 9999
    view.matchCanastras.A.clean = 9
    view.log.push('forjado')
    view.discardPile.length = 0

    const nova = s.getViewFor(2)
    expect(maoDe(s, 2)).toEqual(maoReal)
    expect(nova.yourHand).toEqual(maoReal.map(plano))
    expect(nova.teams[1].openingMinimum).toBe(75)
    expect(dupla(s, 'B').openingMinimum).toBe(75)
    expect(nova.matchScores.A).toBe(0)
    expect(nova.matchCanastras.A.clean).toBe(0)
    expect(nova.log).not.toContain('forjado')
    expect(nova.discardPile).toHaveLength(2)
  })
})
