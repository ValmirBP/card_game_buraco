import { Game } from '../../src/engine/game'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer } from '../../src/engine/ai'
import { Card } from '../../src/engine/card'
import { Player } from '../../src/engine/player'
import { Canasta } from '../../src/engine/canasta'

function cleanCanastra(suit: 'hearts' | 'diamonds' | 'clubs' | 'spades' = 'hearts'): Canasta {
  return new Canasta([
    new Card(suit, '5', false),
    new Card(suit, '6', false),
    new Card(suit, '7', false),
    new Card(suit, '8', false),
    new Card(suit, '9', false),
    new Card(suit, '10', false),
    new Card(suit, 'J', false),
  ])
}

function makeFourPlayers(): Player[] {
  return [
    new HumanPlayer('You'), // seat 0, Team A
    new AIPlayer('Bot1', 'easy'), // seat 1, Team B
    new AIPlayer('Bot2', 'easy'), // seat 2, Team A (partner)
    new AIPlayer('Bot3', 'easy'), // seat 3, Team B
  ]
}

describe('Game', () => {
  test('creates game with exactly 4 players', () => {
    const game = new Game(makeFourPlayers())
    expect(game.state.players.length).toBe(4)
    expect(game.state.teams.length).toBe(2)
  })

  test('throws error with invalid player count', () => {
    const p1 = new HumanPlayer('Alice')
    expect(() => new Game([p1])).toThrow()
    expect(() => new Game([p1, p1, p1])).toThrow()
    expect(() => new Game([p1, p1, p1, p1, p1])).toThrow()
  })

  test('teams are seeded with correct seats', () => {
    const game = new Game(makeFourPlayers())
    const teamA = game.state.teams.find(t => t.id === 'A')!
    const teamB = game.state.teams.find(t => t.id === 'B')!
    expect(teamA.seats).toEqual([0, 2])
    expect(teamB.seats).toEqual([1, 3])
    expect(teamA.hasTakenMorto).toBe(false)
    expect(teamB.hasTakenMorto).toBe(false)
  })

  describe('setup', () => {
    test('deals 11 cards to each of the 4 players', () => {
      const game = new Game(makeFourPlayers())
      game.setup()
      for (const p of game.state.players) {
        expect(p.hand.getSize()).toBe(11)
      }
      expect(game.state.status).toBe('playing')
    })

    test('reserves 2 mortos of 11 cards each', () => {
      const game = new Game(makeFourPlayers())
      game.setup()
      expect(game.state.mortos.length).toBe(2)
      expect(game.state.mortos[0].length).toBe(11)
      expect(game.state.mortos[1].length).toBe(11)
    })

    test('discard pile starts empty - no card is flipped at setup', () => {
      const game = new Game(makeFourPlayers())
      game.setup()
      expect(game.state.discardPile.length).toBe(0)
    })

    test('remaining deck (baço) has 42 cards: 108 - 44 - 22', () => {
      const game = new Game(makeFourPlayers())
      game.setup()
      expect(game.state.deck.length).toBe(42)
    })
  })

  test('drawFromDeck returns a card from deck', () => {
    const game = new Game(makeFourPlayers())
    game.setup()
    const deckSize = game.state.deck.length
    const card = game.drawFromDeck()
    expect(card).not.toBeNull()
    expect(game.state.deck.length).toBe(deckSize - 1)
  })

  test('drawFromDeck returns null when deck is empty', () => {
    const game = new Game(makeFourPlayers())
    game.setup()
    while (game.drawFromDeck() !== null) {
      // drain
    }
    expect(game.drawFromDeck()).toBeNull()
  })

  describe('drawFromDeck - morto becomes new deck when baço runs out', () => {
    test('deck empties with a morto still available: draws a card, consumes one morto, deck becomes 10', () => {
      const game = new Game(makeFourPlayers())
      game.setup()
      game.state.deck = []
      game.state.mortos = [
        Array.from({ length: 11 }, () => new Card('hearts', '3', false)),
      ]

      const card = game.drawFromDeck()

      expect(card).not.toBeNull()
      expect(game.state.mortos.length).toBe(0)
      expect(game.state.deck.length).toBe(10)
      expect(game.isGameOver()).toBe(false)
    })

    test('deck empties with no mortos available: returns null and isGameOver is true', () => {
      const game = new Game(makeFourPlayers())
      game.setup()
      game.state.deck = []
      game.state.mortos = []

      const card = game.drawFromDeck()

      expect(card).toBeNull()
      expect(game.isGameOver()).toBe(true)
      expect(game.state.status).toBe('playing')
    })

    test('with two mortos, exhausting the deck twice converts each morto before the game can end by exhaustion', () => {
      const game = new Game(makeFourPlayers())
      game.setup()
      game.state.deck = []
      game.state.mortos = [
        Array.from({ length: 11 }, () => new Card('hearts', '4', false)),
        Array.from({ length: 11 }, () => new Card('clubs', '5', false)),
      ]

      // Drain what becomes the deck after the first morto (morto 2) converts.
      while (game.drawFromDeck() !== null) {
        // drain
      }

      // Both mortos consumed by now; deck and mortos empty -> game over by exhaustion.
      expect(game.state.deck.length).toBe(0)
      expect(game.state.mortos.length).toBe(0)
      expect(game.isGameOver()).toBe(true)
    })
  })

  describe('discard', () => {
    test('removes card from current player hand and adds to discard pile', () => {
      const players = makeFourPlayers()
      players[0].hand.addCard(new Card('hearts', '5', false))
      players[0].hand.addCard(new Card('clubs', 'K', false)) // keeper: discarding down to 0 needs morto/close rights (see A1 tests below); this test is about discard mechanics only
      const game = new Game(players)
      const success = game.discard(0)
      expect(success).toBe(true)
      expect(players[0].hand.getSize()).toBe(1)
      expect(game.state.discardPile.length).toBe(1)
    })

    test('returns false for out-of-range index', () => {
      const game = new Game(makeFourPlayers())
      expect(game.discard(0)).toBe(false)
    })

    describe('A1: refuses to leave the hand at 0 cards without morto/close rights', () => {
      test('returns false when discarding the last card, dirty canastra only (no clean canastra, morto already taken)', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        const teamA = game.state.teams.find(t => t.id === 'A')!
        teamA.hasTakenMorto = true
        game.state.mortos = []
        teamA.melds = [
          new Canasta([
            new Card('spades', '3', false),
            new Card('spades', '4', false),
            new Card('spades', '5', false),
            new Card('spades', '6', false),
            new Card('spades', '7', false),
            new Card('spades', '8', false),
            (() => {
              const joker = new Card('hearts', '5', false)
              ;(joker as unknown as { isWild: boolean }).isWild = true
              return joker
            })(),
          ]),
        ] // 7-card SUJA canastra -> canClose stays false
        players[0].hand.addCard(new Card('diamonds', 'Q', false))

        const success = game.discard(0)

        expect(success).toBe(false)
        expect(players[0].hand.getSize()).toBe(1)
        expect(game.state.discardPile).toHaveLength(0)
      })

      test('returns true when a clean 7+ canastra grants closing rights (legitimate batida)', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        const teamA = game.state.teams.find(t => t.id === 'A')!
        teamA.hasTakenMorto = true
        game.state.mortos = []
        teamA.melds = [
          new Canasta([
            new Card('spades', '3', false),
            new Card('spades', '4', false),
            new Card('spades', '5', false),
            new Card('spades', '6', false),
            new Card('spades', '7', false),
            new Card('spades', '8', false),
            new Card('spades', '9', false),
          ]),
        ] // 7-card LIMPA canastra -> canClose true
        players[0].hand.addCard(new Card('diamonds', 'Q', false))

        const success = game.discard(0)

        expect(success).toBe(true)
        expect(players[0].hand.getSize()).toBe(0)
      })

      test('returns true when a morto is still available to take', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        const teamA = game.state.teams.find(t => t.id === 'A')!
        teamA.hasTakenMorto = false
        game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
        players[0].hand.addCard(new Card('diamonds', 'Q', false))

        const success = game.discard(0)

        expect(success).toBe(true)
        // hand empties then immediately auto-refills from the morto
        expect(players[0].hand.getSize()).toBe(11)
        expect(teamA.hasTakenMorto).toBe(true)
      })

      test('returns true when discarding down to 1 card (2 -> 1 is normal play, not a lockup)', () => {
        // This is the key regression guard: reusing the meld/extend threshold
        // (which requires 2+ REMAINING cards) for discard() too would block
        // this completely ordinary discard forever once a team's hand
        // shrinks to 2 cards with no morto/close rights - a much worse
        // lockup than the bug A1 fixes. discard() must only refuse going
        // all the way to 0, not down to 1.
        const players = makeFourPlayers()
        const game = new Game(players)
        const teamA = game.state.teams.find(t => t.id === 'A')!
        teamA.hasTakenMorto = true
        game.state.mortos = []
        players[0].hand.addCard(new Card('diamonds', 'Q', false))
        players[0].hand.addCard(new Card('diamonds', 'K', false))

        const success = game.discard(0)

        expect(success).toBe(true)
        expect(players[0].hand.getSize()).toBe(1)
      })

      test('the repro scenario never produces a phantom batidaBonus at finish()', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        const teamA = game.state.teams.find(t => t.id === 'A')!
        teamA.hasTakenMorto = true
        game.state.mortos = []
        teamA.melds = [
          new Canasta([
            new Card('spades', '3', false),
            new Card('spades', '4', false),
            new Card('spades', '5', false),
            new Card('spades', '6', false),
            new Card('spades', '7', false),
            new Card('spades', '8', false),
            (() => {
              const joker = new Card('hearts', '5', false)
              ;(joker as unknown as { isWild: boolean }).isWild = true
              return joker
            })(),
          ]),
        ] // dirty only -> no closing rights yet
        players[0].hand.addCard(new Card('diamonds', 'Q', false))
        // Partner (seat 2, Team A) needs a non-empty hand too - makeFourPlayers()
        // gives every seat an EMPTY hand by default, and an empty hand alone
        // already satisfies isGameOver()'s `p.hand.isEmpty()` half once the
        // team gets closing rights below. Without this, the test would
        // spuriously "prove" a phantom-bonus bug caused by the untouched
        // fixture default, not by player 0's refused discard.
        players[2].hand.addCard(new Card('hearts', 'J', false))

        // the illegal discard-to-zero is refused...
        expect(game.discard(0)).toBe(false)
        expect(players[0].hand.getSize()).toBe(1)

        // ...even if the partner later closes a clean canastra, this
        // player's hand was never actually emptied, so no phantom batida:
        teamA.melds.push(
          new Canasta([
            new Card('clubs', '3', false),
            new Card('clubs', '4', false),
            new Card('clubs', '5', false),
            new Card('clubs', '6', false),
            new Card('clubs', '7', false),
            new Card('clubs', '8', false),
            new Card('clubs', '9', false),
          ])
        )
        expect(game.isGameOver()).toBe(false)
        game.finish()
        const breakdown = game.state.scoreBreakdowns!.find(b => b.teamId === 'A')!
        expect(breakdown.batidaBonus).toBe(0)
      })
    })
  })

  describe('takeDiscardPile', () => {
    test('returns and empties the discard pile', () => {
      const game = new Game(makeFourPlayers())
      game.state.discardPile.push(new Card('hearts', '5', false), new Card('clubs', '9', false))
      const taken = game.takeDiscardPile()
      expect(taken).toHaveLength(2)
      expect(game.state.discardPile).toHaveLength(0)
    })

    test('returns null when discard pile is empty', () => {
      const game = new Game(makeFourPlayers())
      expect(game.takeDiscardPile()).toBeNull()
    })
  })

  test('endTurn cycles 0 -> 1 -> 2 -> 3 -> 0', () => {
    const game = new Game(makeFourPlayers())
    expect(game.state.currentPlayerIndex).toBe(0)
    game.endTurn()
    expect(game.state.currentPlayerIndex).toBe(1)
    game.endTurn()
    expect(game.state.currentPlayerIndex).toBe(2)
    game.endTurn()
    expect(game.state.currentPlayerIndex).toBe(3)
    game.endTurn()
    expect(game.state.currentPlayerIndex).toBe(0)
  })

  test('getCurrentPlayer returns active player', () => {
    const game = new Game(makeFourPlayers())
    expect(game.getCurrentPlayer().name).toBe('You')
    game.endTurn()
    expect(game.getCurrentPlayer().name).toBe('Bot1')
  })

  test('getTeamOfCurrentPlayer returns the current player\'s team', () => {
    const game = new Game(makeFourPlayers())
    expect(game.getTeamOfCurrentPlayer().id).toBe('A')
    game.endTurn()
    expect(game.getTeamOfCurrentPlayer().id).toBe('B')
    game.endTurn()
    expect(game.getTeamOfCurrentPlayer().id).toBe('A')
  })

  describe('playCanasta', () => {
    test('valid canasta removes cards from hand, adds to team melds, credits team score', () => {
      const canastaCards = [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
      ]
      const keeper = new Card('clubs', 'K', false)
      // 2nd keeper: a meld must leave 2+ cards without morto/close rights
      // (see A1 tests below) - leaving just 1 would force the same turn's
      // mandatory discard down to 0 with no rights.
      const keeper2 = new Card('clubs', 'Q', false)
      const players = makeFourPlayers()
      players[0].hand.addCard(canastaCards[0])
      players[0].hand.addCard(canastaCards[1])
      players[0].hand.addCard(canastaCards[2])
      players[0].hand.addCard(keeper)
      players[0].hand.addCard(keeper2)
      const game = new Game(players)

      const teamA = game.state.teams.find(t => t.id === 'A')!
      expect(teamA.score).toBe(0)

      const success = game.playCanasta(canastaCards)
      expect(success).toBe(true)

      expect(players[0].hand.getSize()).toBe(2)
      expect(players[0].hand.getCards().some(c => c.equals(keeper))).toBe(true)
      expect(players[0].hand.getCards().some(c => c.equals(keeper2))).toBe(true)

      expect(teamA.melds).toHaveLength(1)
      expect(teamA.melds[0].cards).toHaveLength(3)
      expect(teamA.score).toBe(teamA.melds[0].getScore())
    })

    test('a partner (seat 2) can play into the same team melds as seat 0', () => {
      const players = makeFourPlayers()
      const cards = [
        new Card('spades', '4', false),
        new Card('spades', '5', false),
        new Card('spades', '6', false),
      ]
      players[2].hand.addCard(cards[0])
      players[2].hand.addCard(cards[1])
      players[2].hand.addCard(cards[2])
      // 2 keepers: see the "2 keepers" comment above (A1 - must leave 2+).
      players[2].hand.addCard(new Card('clubs', 'K', false))
      players[2].hand.addCard(new Card('clubs', 'Q', false))
      const game = new Game(players)
      game.endTurn() // -> seat 1
      game.endTurn() // -> seat 2 (Team A partner)
      expect(game.getCurrentPlayer().name).toBe('Bot2')

      const success = game.playCanasta(cards)
      expect(success).toBe(true)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      expect(teamA.melds).toHaveLength(1)
    })

    test('returns false and has no side effects for invalid cards', () => {
      const invalidCards = [new Card('hearts', '5', false), new Card('diamonds', '6', false)]
      const players = makeFourPlayers()
      players[0].hand.addCard(invalidCards[0])
      players[0].hand.addCard(invalidCards[1])
      const game = new Game(players)

      const success = game.playCanasta(invalidCards)
      expect(success).toBe(false)
      expect(players[0].hand.getSize()).toBe(2)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      expect(teamA.melds).toHaveLength(0)
      expect(teamA.score).toBe(0)
    })
  })

  describe('regra do lixo unitário (não devolver a carta pega no mesmo turno)', () => {
    test('a carta pega de um descarte que SÓ tinha ela não pode ser descartada no mesmo turno', () => {
      const players = makeFourPlayers()
      players[0].hand.addCard(new Card('clubs', 'K', false))
      players[0].hand.addCard(new Card('clubs', 'Q', false))
      const game = new Game(players)

      // Lixo com UMA carta.
      const single = new Card('hearts', '7', false)
      game.state.discardPile.push(single)

      const taken = game.takeDiscardPile()!
      expect(taken).toHaveLength(1)
      for (const c of taken) players[0].hand.addCard(c)

      // Descartar a MESMA carta (mesmo objeto) é recusado...
      const idx = players[0].hand.getCards().findIndex(c => c === single)
      expect(game.isDiscardBlockedCard(idx)).toBe(true)
      expect(game.discard(idx)).toBe(false)
      expect(players[0].hand.getSize()).toBe(3) // nada mudou

      // ...mas descartar OUTRA carta é normal.
      const otherIdx = players[0].hand.getCards().findIndex(c => c !== single)
      expect(game.discard(otherIdx)).toBe(true)
    })

    test('a cópia-gêmea (baralho duplo) que JÁ estava na mão continua descartável', () => {
      const players = makeFourPlayers()
      const twin = new Card('hearts', '7', false) // cópia idêntica pré-existente na mão
      players[0].hand.addCard(twin)
      players[0].hand.addCard(new Card('clubs', 'K', false))
      const game = new Game(players)

      game.state.discardPile.push(new Card('hearts', '7', false))
      const taken = game.takeDiscardPile()!
      for (const c of taken) players[0].hand.addCard(c)

      // Bloqueio é por REFERÊNCIA: a cópia antiga da mão não é bloqueada.
      const twinIdx = players[0].hand.getCards().findIndex(c => c === twin)
      expect(game.isDiscardBlockedCard(twinIdx)).toBe(false)
      expect(game.discard(twinIdx)).toBe(true)
    })

    test('o bloqueio dura só o turno: no próximo turno a carta pode ser descartada', () => {
      const players = makeFourPlayers()
      players[0].hand.addCard(new Card('clubs', 'K', false))
      const game = new Game(players)

      const single = new Card('hearts', '7', false)
      game.state.discardPile.push(single)
      const taken = game.takeDiscardPile()!
      for (const c of taken) players[0].hand.addCard(c)

      // Descarta outra carta, turno passa 4 vezes (volta ao seat 0).
      const otherIdx = players[0].hand.getCards().findIndex(c => c !== single)
      expect(game.discard(otherIdx)).toBe(true)
      game.endTurn()
      game.endTurn()
      game.endTurn()
      game.endTurn()

      const idx = players[0].hand.getCards().findIndex(c => c === single)
      expect(game.isDiscardBlockedCard(idx)).toBe(false)
    })

    test('lixo com 2+ cartas: nenhuma carta fica bloqueada', () => {
      const players = makeFourPlayers()
      players[0].hand.addCard(new Card('clubs', 'K', false))
      const game = new Game(players)

      const top = new Card('hearts', '7', false)
      game.state.discardPile.push(new Card('spades', '4', false), top)
      const taken = game.takeDiscardPile()!
      expect(taken).toHaveLength(2)
      for (const c of taken) players[0].hand.addCard(c)

      const idx = players[0].hand.getCards().findIndex(c => c === top)
      expect(game.isDiscardBlockedCard(idx)).toBe(false)
      expect(game.discard(idx)).toBe(true)
    })
  })

  describe('regra do morto pego mas não usado (perde os 100 do morto, não as cartas da mão)', () => {
    /** Monta um jogo em que o seat 0 esvazia a mão descartando e pega o
     * morto automaticamente; retorna o game pronto pra terminar a rodada. */
    function setupMortoTaken() {
      const players = makeFourPlayers()
      // Seat 0: 1 carta (vai descartá-la e pegar o morto).
      players[0].hand.addCard(new Card('clubs', '5', false))
      // Parceiro (seat 2) e adversários com mãos não-vazias.
      players[1].hand.addCard(new Card('hearts', 'K', false))
      players[2].hand.addCard(new Card('spades', 'K', false)) // K = 10 pts
      players[3].hand.addCard(new Card('diamonds', 'K', false))
      const game = new Game(players)
      // Mortos na mesa (2, como no jogo real). Conteúdo conhecido: 11 cartas de 10 pts.
      const morto1: Card[] = []
      for (const rank of ['8', '9', '10', 'J', 'Q', 'K', '8', '9', '10', 'J', 'Q'] as const) {
        morto1.push(new Card('hearts', rank, false))
      }
      game.state.mortos.push(morto1, [new Card('clubs', '3', false)])
      return { game, players }
    }

    test('rodada termina logo após pegar o morto (sem usar): -100 do morto, cartas da mão NÃO descontam', () => {
      const { game, players } = setupMortoTaken()
      // Descarta a única carta -> mão esvazia -> pega o morto automaticamente.
      expect(game.discard(0)).toBe(true)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      expect(teamA.hasTakenMorto).toBe(true)
      expect(teamA.mortoUsed).toBe(false)
      expect(players[0].hand.getSize()).toBe(11)

      game.finish()
      const bA = game.state.scoreBreakdowns!.find(b => b.teamId === 'A')!
      // -100 do morto (pego e não usado)...
      expect(bA.mortoPenalty).toBe(-100)
      // ...e as 11 cartas do morto na mão do seat 0 NÃO contam.
      const seat0 = bA.handBySeat.find(h => h.seat === 0)!
      expect(seat0.counted).toBe(false)
      expect(seat0.points).toBeGreaterThan(0)
      // A mão do PARCEIRO (seat 2, K=10) continua descontando normalmente.
      const seat2 = bA.handBySeat.find(h => h.seat === 2)!
      expect(seat2.counted).toBe(true)
      expect(bA.handPenalty).toBe(-10)
    })

    test('se o jogador que pegou o morto JOGA com ele (descarta no turno seguinte), penalidade normal', () => {
      const { game } = setupMortoTaken()
      expect(game.discard(0)).toBe(true) // pega o morto
      const teamA = game.state.teams.find(t => t.id === 'A')!

      // Turno passa e volta pro seat 0, que agora joga com a mão nova.
      game.endTurn()
      game.endTurn()
      game.endTurn()
      game.endTurn()
      expect(game.state.currentPlayerIndex).toBe(0)
      expect(game.discard(0)).toBe(true) // usou o morto
      expect(teamA.mortoUsed).toBe(true)

      game.finish()
      const bA = game.state.scoreBreakdowns!.find(b => b.teamId === 'A')!
      // Sem penalidade de morto (pegou E usou); as cartas restantes contam.
      expect(bA.mortoPenalty).toBe(0)
      const seat0 = bA.handBySeat.find(h => h.seat === 0)!
      expect(seat0.counted).toBe(true)
      expect(bA.handPenalty).toBeLessThan(0)
    })

    test('time que nunca pegou morto disponível: -100 e mãos contam (regra antiga preservada)', () => {
      const { game } = setupMortoTaken()
      // Ninguém pega o morto; rodada termina direto.
      game.finish()
      const bB = game.state.scoreBreakdowns!.find(b => b.teamId === 'B')!
      expect(bB.mortoPenalty).toBe(-100)
      expect(bB.handBySeat.every(h => h.counted)).toBe(true)
      expect(bB.handPenalty).toBe(-20) // K + K
    })
  })

  describe('extendMeld', () => {
    test('adds a card from hand to an existing team meld and adjusts score', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!

      // seed an existing meld directly on the team (as if played earlier) -
      // pushed straight onto team.melds rather than via playCanasta, so this
      // seeding step is independent of the hand-emptying legality rule under
      // test in the 'extendMeld' describe block below.
      const seedMeld = new Canasta([
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
      ])
      teamA.melds.push(seedMeld)
      teamA.score += seedMeld.getScore()

      const scoreBeforeExtend = teamA.score

      players[0].hand.addCard(new Card('hearts', '8', false))
      // 2 keepers: a meld/extend must leave 2+ cards without morto/close
      // rights (see A1 tests below) - leaving just 1 would force the same
      // turn's mandatory discard down to 0 with no rights.
      players[0].hand.addCard(new Card('clubs', 'K', false))
      players[0].hand.addCard(new Card('clubs', 'Q', false))
      const success = game.extendMeld(0, [new Card('hearts', '8', false)])

      expect(success).toBe(true)
      expect(teamA.melds[0].cards).toHaveLength(4)
      expect(players[0].hand.getSize()).toBe(2)
      expect(teamA.score).toBeGreaterThan(scoreBeforeExtend)
    })

    test('returns false for invalid meld index', () => {
      const game = new Game(makeFourPlayers())
      expect(game.extendMeld(0, [new Card('hearts', '8', false)])).toBe(false)
    })

    // Exemplo exato do usuário (2026-08-19), agora pelo fluxo COMPLETO do
    // jogo (playCanasta + extendMeld - o mesmo caminho usado pelo offline e
    // pelo servidor online): baixa 3-4-5-6-7-[2 no lugar do 8]-9 (nasce
    // suja, pois o 9 entrou com o 2 fora da posição natural) e depois
    // estende com o 8 real. O 2 desliza pra posição natural, mas a canastra
    // CONTINUA suja - sujeira é permanente, naipes iguais não a salvam.
    test('sujeira permanente sobrevive ao extendMeld do fluxo completo (exemplo 3..7+2(=8)+9, depois 8 real)', () => {
      const players = makeFourPlayers()
      const meldCards = [
        new Card('spades', '3', false),
        new Card('spades', '4', false),
        new Card('spades', '5', false),
        new Card('spades', '6', false),
        new Card('spades', '7', false),
        new Card('spades', '2', false),
        new Card('spades', '9', false),
      ]
      for (const c of meldCards) players[0].hand.addCard(c)
      const eight = new Card('spades', '8', false)
      players[0].hand.addCard(eight)
      // keepers: baixar/estender deve deixar 2+ cartas na mão (regra A1)
      players[0].hand.addCard(new Card('clubs', 'K', false))
      players[0].hand.addCard(new Card('clubs', 'Q', false))
      players[0].hand.addCard(new Card('clubs', 'J', false))
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!

      expect(game.playCanasta(meldCards)).toBe(true)
      expect(teamA.melds[0].isClean).toBe(false)
      expect(teamA.melds[0].kind).toBe('suja')

      expect(game.extendMeld(0, [eight])).toBe(true)
      // Análise fresca de 2..9 diria "limpa" - mas a sujeira é permanente.
      expect(teamA.melds[0].isClean).toBe(false)
      expect(teamA.melds[0].kind).toBe('suja')
      expect(teamA.melds[0].cards).toHaveLength(8)
    })

    test('returns false and has no side effects when the extension is invalid', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.melds.push(
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
        ])
      )

      players[0].hand.addCard(new Card('diamonds', '8', false))
      const success = game.extendMeld(0, [new Card('diamonds', '8', false)])

      expect(success).toBe(false)
      expect(teamA.melds[0].cards).toHaveLength(3)
      expect(players[0].hand.getSize()).toBe(1)
    })

    test('partner can extend a meld played by the other partner', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.melds.push(
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
        ])
      )

      game.endTurn()
      game.endTurn() // seat 2, Team A partner
      players[2].hand.addCard(new Card('hearts', '8', false))
      // 2 keepers: see the "2 keepers" comment above (A1 - must leave 2+).
      players[2].hand.addCard(new Card('clubs', 'K', false))
      players[2].hand.addCard(new Card('clubs', 'Q', false))
      const success = game.extendMeld(0, [new Card('hearts', '8', false)])
      expect(success).toBe(true)
      expect(teamA.melds[0].cards).toHaveLength(4)
    })
  })

  describe('morto (pickUpMorto)', () => {
    test('pickUpMorto gives current player 11 new cards and marks team.hasTakenMorto', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      game.state.mortos = [
        Array.from({ length: 11 }, () => new Card('hearts', '3', false)),
        Array.from({ length: 11 }, () => new Card('clubs', '4', false)),
      ]
      const success = game.pickUpMorto()
      expect(success).toBe(true)
      expect(players[0].hand.getSize()).toBe(11)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      expect(teamA.hasTakenMorto).toBe(true)
      expect(game.state.mortos.length).toBe(1)
    })

    test('pickUpMorto fails if team already took a morto', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      game.state.mortos = [Array.from({ length: 11 }, () => new Card('hearts', '3', false))]
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      expect(game.pickUpMorto()).toBe(false)
    })

    test('pickUpMorto fails if no mortos remain', () => {
      const game = new Game(makeFourPlayers())
      game.state.mortos = []
      expect(game.pickUpMorto()).toBe(false)
    })

    test('discarding down to an empty hand auto picks up a morto when team has not taken one', () => {
      const players = makeFourPlayers()
      players[0].hand.addCard(new Card('hearts', '5', false))
      const game = new Game(players)
      game.state.mortos = [
        Array.from({ length: 11 }, () => new Card('hearts', '3', false)),
        Array.from({ length: 11 }, () => new Card('clubs', '4', false)),
      ]
      game.discard(0)
      expect(players[0].hand.getSize()).toBe(11)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      expect(teamA.hasTakenMorto).toBe(true)
    })
  })

  describe('canClose', () => {
    test('team cannot close before taking a morto', () => {
      const game = new Game(makeFourPlayers())
      const teamA = game.state.teams.find(t => t.id === 'A')!
      expect(game.canClose(teamA)).toBe(false)
    })

    test('team cannot close with morto taken but no clean canastra', () => {
      const game = new Game(makeFourPlayers())
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      expect(game.canClose(teamA)).toBe(false)
    })

    test('team cannot close with a dirty canastra (has a curinga)', () => {
      const game = new Game(makeFourPlayers())
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      teamA.melds = [
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('spades', '2', false), // wild, different suit
          new Card('hearts', '8', false),
          new Card('hearts', '9', false),
          new Card('hearts', '10', false),
          new Card('hearts', 'J', false),
        ]),
      ]
      expect(game.canClose(teamA)).toBe(false)
    })

    test('team can close after taking a morto AND having a clean 7+ card canastra', () => {
      const game = new Game(makeFourPlayers())
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      teamA.melds = [
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
          new Card('hearts', '8', false),
          new Card('hearts', '9', false),
          new Card('hearts', '10', false),
          new Card('hearts', 'J', false),
        ]),
      ]
      expect(game.canClose(teamA)).toBe(true)
    })

    test('sem pegar o morto: pode bater se não há mais mortos na mesa (viraram monte), mas não se ainda houver morto disponível', () => {
      const cleanCanastra = () =>
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
          new Card('hearts', '8', false),
          new Card('hearts', '9', false),
          new Card('hearts', '10', false),
          new Card('hearts', 'J', false),
        ])

      const game = new Game(makeFourPlayers())
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = false
      teamA.melds = [cleanCanastra()]

      // Ainda existe um morto na mesa -> não pode bater sem pegá-lo.
      game.state.mortos = [[new Card('clubs', '4', false)]]
      expect(game.canClose(teamA)).toBe(false)

      // Mortos esgotados (ex.: viraram monte) -> exigência do morto é liberada.
      game.state.mortos = []
      expect(game.canClose(teamA)).toBe(true)
    })
  })

  describe('isGameOver', () => {
    test('returns false before setup', () => {
      const game = new Game(makeFourPlayers())
      expect(game.isGameOver()).toBe(false)
    })

    test('returns false right after setup', () => {
      const game = new Game(makeFourPlayers())
      game.setup()
      expect(game.isGameOver()).toBe(false)
    })

    test('returns true when deck is empty during play', () => {
      const game = new Game(makeFourPlayers())
      game.setup()
      while (game.drawFromDeck() !== null) {
        // drain
      }
      expect(game.isGameOver()).toBe(true)
    })

    test('returns false when a player hand is empty and team took the morto but has no clean canastra', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      game.setup()
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      while (!players[0].hand.isEmpty()) {
        players[0].hand.removeCard(0)
      }
      expect(game.isGameOver()).toBe(false)
    })

    test('returns true when a player hand is empty, their team has taken the morto, and has a clean canastra (batida)', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      game.setup()
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      teamA.melds = [cleanCanastra()]
      while (!players[0].hand.isEmpty()) {
        players[0].hand.removeCard(0)
      }
      expect(game.isGameOver()).toBe(true)
    })

    test('returns false when a player hand is empty but their team has NOT taken the morto yet', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      game.setup()
      while (!players[0].hand.isEmpty()) {
        players[0].hand.removeCard(0)
      }
      expect(game.isGameOver()).toBe(false)
    })
  })

  describe('finish - team scoring', () => {
    // NOTE: team.score is now fully DERIVED by finish() from 4 components
    // (meldPoints computed fresh from team.melds via canasta.getScore(),
    // batidaBonus, mortoPenalty, handPenalty - see "Parte B" below), rather
    // than adjusted relative to whatever team.score happened to hold before
    // finish() ran. So these tests no longer pre-seed team.score as a proxy
    // for "already accumulated meld points" - they push real melds when they
    // want meld points to count, and assert the resulting derived total.
    test('subtracts sum of remaining hand values (both partners) from team score', () => {
      const players = makeFourPlayers()
      players[0].hand.addCard(new Card('hearts', 'A', false)) // 15
      players[0].hand.addCard(new Card('hearts', 'K', false)) // 10
      players[2].hand.addCard(new Card('clubs', '9', false)) // 10 (official table: 8,9,10=10)
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      const teamB = game.state.teams.find(t => t.id === 'B')!
      // Both teams took their morto so this test isolates the hand-penalty
      // math from the separate -100 no-morto penalty (covered below).
      teamA.hasTakenMorto = true
      teamB.hasTakenMorto = true
      game.finish()
      // 0 (no melds) - (15+10+10) = -35
      expect(teamA.score).toBe(-35)
    })

    test('team that closed (a player emptied hand with morto taken + clean canastra) gets +100 bonus', () => {
      const players = makeFourPlayers()
      // seat 0 hand empty, team A has taken morto and has a clean canastra -> team A closed
      players[1].hand.addCard(new Card('clubs', '9', false))
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      const teamB = game.state.teams.find(t => t.id === 'B')!
      teamA.hasTakenMorto = true
      teamB.hasTakenMorto = true
      teamA.melds = [cleanCanastra()]
      game.finish()
      // teamA: meldPoints 255 (cleanCanastra) + batida 100 + 0 + 0 hand = 355
      expect(teamA.score).toBe(355)
      // teamB: 0 meld + 0 batida + 0 morto - 10 hand = -10
      expect(teamB.score).toBe(-10)
    })

    test('winnerTeam is set to the team with the higher adjusted score', () => {
      const players = makeFourPlayers()
      players[1].hand.addCard(new Card('clubs', '9', false))
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      const teamB = game.state.teams.find(t => t.id === 'B')!
      teamA.hasTakenMorto = true
      teamB.hasTakenMorto = true
      teamA.melds = [cleanCanastra()]
      game.finish()
      expect(game.state.winnerTeam).toBe('A')
      expect(game.state.status).toBe('finished')
    })

    test('finish is idempotent', () => {
      const players = makeFourPlayers()
      players[0].hand.addCard(new Card('hearts', 'A', false))
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      const teamB = game.state.teams.find(t => t.id === 'B')!
      teamA.hasTakenMorto = true
      teamB.hasTakenMorto = true
      game.finish()
      const scoreAfterFirst = teamA.score
      game.finish()
      expect(teamA.score).toBe(scoreAfterFirst)
    })

    test('no bonus applied when game ends by empty deck (buraco), nobody closed', () => {
      const players = makeFourPlayers()
      players[0].hand.addCard(new Card('hearts', 'A', false))
      players[1].hand.addCard(new Card('clubs', '9', false))
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      const teamB = game.state.teams.find(t => t.id === 'B')!
      teamA.hasTakenMorto = true
      teamB.hasTakenMorto = true
      game.finish()
      expect(teamA.score).toBe(-15) // 0 meld - 15 hand
      expect(teamB.score).toBe(-10) // 0 meld - 10 hand
    })

    describe('morto penalty (-100 for a team that never took a morto, only while a morto remains on the table)', () => {
      test('a team with hasTakenMorto === false loses an extra 100 points when mortos.length > 0', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        // A morto is still sitting on the table (not yet promoted to deck),
        // so failing to take it is what's being penalized.
        game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
        const teamA = game.state.teams.find(t => t.id === 'A')!
        const teamB = game.state.teams.find(t => t.id === 'B')!
        teamA.hasTakenMorto = true
        teamB.hasTakenMorto = false
        game.finish()
        expect(teamA.score).toBe(0) // took the morto, no hand cards, no meld -> untouched
        expect(teamB.score).toBe(-100) // no morto taken, one still available -> penalized
      })

      test('the penalty stacks with the remaining-hand penalty', () => {
        const players = makeFourPlayers()
        players[1].hand.addCard(new Card('clubs', '9', false)) // 10
        const game = new Game(players)
        game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
        const teamB = game.state.teams.find(t => t.id === 'B')!
        teamB.hasTakenMorto = false
        game.finish()
        expect(teamB.score).toBe(-110) // 0 meld - 10 (hand) - 100 (no morto)
      })

      test('a team that took the morto is never charged the -100', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
        const teamA = game.state.teams.find(t => t.id === 'A')!
        teamA.hasTakenMorto = true
        game.finish()
        expect(teamA.score).toBe(0)
      })
    })

    describe('Parte A - morto penalty refined: no penalty once mortos become the deck', () => {
      test('team without morto + a morto still on the table (mortos.length > 0) -> -100', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
        const teamB = game.state.teams.find(t => t.id === 'B')!
        teamB.hasTakenMorto = false
        game.finish()
        expect(teamB.score).toBe(-100)
      })

      test('team without morto but mortos turned into the deck (mortos=[]) -> NO penalty', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        // Both mortos already got promoted to the baço (deck ran dry and
        // was refilled from a morto - see Game.drawFromDeck) - nobody could
        // still take one, so nobody should be charged for not having one.
        game.state.mortos = []
        const teamA = game.state.teams.find(t => t.id === 'A')!
        const teamB = game.state.teams.find(t => t.id === 'B')!
        teamA.hasTakenMorto = false
        teamB.hasTakenMorto = false
        game.finish()
        expect(teamA.score).toBe(0)
        expect(teamB.score).toBe(0)
      })

      test('a team that took the morto is never penalized, regardless of mortos.length', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
        const teamA = game.state.teams.find(t => t.id === 'A')!
        teamA.hasTakenMorto = true
        game.finish()
        expect(teamA.score).toBe(0)
      })
    })

    describe('Parte B - scoreBreakdowns (per-team score detail)', () => {
      test('breakdown with melds + batida + morto penalty + hand penalty sums correctly for each team', () => {
        const players = makeFourPlayers()
        players[1].hand.addCard(new Card('clubs', '9', false)) // 10, team B hand penalty
        const game = new Game(players)
        game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
        const teamA = game.state.teams.find(t => t.id === 'A')!
        const teamB = game.state.teams.find(t => t.id === 'B')!
        teamA.hasTakenMorto = true
        teamB.hasTakenMorto = false
        teamA.melds = [cleanCanastra()] // 255 meld points; seat 0's empty hand -> team A closes
        game.finish()

        const breakdowns = game.state.scoreBreakdowns!
        expect(breakdowns).toHaveLength(2)

        const bA = breakdowns.find(b => b.teamId === 'A')!
        expect(bA.meldPoints).toBe(255)
        expect(bA.batidaBonus).toBe(100)
        expect(bA.mortoPenalty).toBe(0)
        expect(bA.handPenalty).toBe(0)
        expect(bA.total).toBe(355)
        expect(teamA.score).toBe(bA.total)

        const bB = breakdowns.find(b => b.teamId === 'B')!
        expect(bB.meldPoints).toBe(0)
        expect(bB.batidaBonus).toBe(0)
        expect(bB.mortoPenalty).toBe(-100)
        expect(bB.handPenalty).toBe(-10)
        expect(bB.total).toBe(-110)
        expect(teamB.score).toBe(bB.total)
      })

      test('finish() called twice does not duplicate or change scoreBreakdowns', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        const teamA = game.state.teams.find(t => t.id === 'A')!
        teamA.hasTakenMorto = true
        teamA.melds = [cleanCanastra()]
        game.finish()
        const firstBreakdowns = game.state.scoreBreakdowns
        const firstScore = teamA.score
        game.finish()
        expect(game.state.scoreBreakdowns).toBe(firstBreakdowns) // same reference, no-op
        expect(teamA.score).toBe(firstScore)
      })

      test('total always matches team.score for every team', () => {
        const players = makeFourPlayers()
        players[0].hand.addCard(new Card('hearts', 'K', false))
        const game = new Game(players)
        game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
        game.finish()
        for (const team of game.state.teams) {
          const breakdown = game.state.scoreBreakdowns!.find(b => b.teamId === team.id)!
          expect(team.score).toBe(breakdown.total)
        }
      })
    })
  })

  describe('batida direta (hand emptied by a meld, not a discard)', () => {
    test('playCanasta that empties the hand auto-picks up the morto and does NOT end the turn', () => {
      const players = makeFourPlayers()
      const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false), new Card('hearts', '7', false)]
      players[0].hand.addCard(cards[0])
      players[0].hand.addCard(cards[1])
      players[0].hand.addCard(cards[2])
      const game = new Game(players)
      game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]

      expect(players[0].hand.isEmpty()).toBe(false)
      const success = game.playCanasta(cards)
      expect(success).toBe(true)

      // Direct batida: hand emptied by the meld itself -> morto comes in
      // immediately as the new hand, and the turn keeps going (no discard
      // happened, so nothing advances currentPlayerIndex).
      const teamA = game.state.teams.find(t => t.id === 'A')!
      expect(teamA.hasTakenMorto).toBe(true)
      expect(players[0].hand.getSize()).toBe(11)
      expect(game.state.currentPlayerIndex).toBe(0)
    })

    test('extendMeld that empties the hand also auto-picks up the morto without ending the turn', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.melds.push(
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
        ])
      )

      game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
      players[0].hand.addCard(new Card('hearts', '8', false))
      const success = game.extendMeld(0, [new Card('hearts', '8', false)])

      expect(success).toBe(true)
      expect(teamA.hasTakenMorto).toBe(true)
      expect(players[0].hand.getSize()).toBe(11)
      expect(game.state.currentPlayerIndex).toBe(0)
    })
  })

  describe('hand-emptying meld legality (cannot empty hand unless able to take morto or bater)', () => {
    test('playCanasta: team already took morto, no clean canastra -> emptying the hand via a non-canastra meld is ILLEGAL (returns false, no side effects)', () => {
      const players = makeFourPlayers()
      const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false), new Card('hearts', '7', false)]
      players[0].hand.addCard(cards[0])
      players[0].hand.addCard(cards[1])
      players[0].hand.addCard(cards[2])
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true // already took the morto
      game.state.mortos = [] // no morto left to auto-pick-up anyway

      const success = game.playCanasta(cards)

      expect(success).toBe(false)
      expect(players[0].hand.getSize()).toBe(3)
      expect(teamA.melds).toHaveLength(0)
      expect(teamA.score).toBe(0)
    })

    test('playCanasta: same scenario but the meld played IS a clean 7+ canastra -> legal direct batida, isGameOver becomes true', () => {
      const players = makeFourPlayers()
      const cards = [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
        new Card('hearts', '8', false),
        new Card('hearts', '9', false),
        new Card('hearts', '10', false),
        new Card('hearts', 'J', false),
      ]
      for (const c of cards) players[0].hand.addCard(c)
      const game = new Game(players)
      game.state.status = 'playing'
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      game.state.mortos = []

      const success = game.playCanasta(cards)

      expect(success).toBe(true)
      expect(players[0].hand.getSize()).toBe(0)
      expect(teamA.melds).toHaveLength(1)
      expect(game.isGameOver()).toBe(true)
    })

    test('playCanasta: team has NOT taken morto and a morto is available -> legal, auto-picks up morto, game continues', () => {
      const players = makeFourPlayers()
      const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false), new Card('hearts', '7', false)]
      players[0].hand.addCard(cards[0])
      players[0].hand.addCard(cards[1])
      players[0].hand.addCard(cards[2])
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = false
      game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]

      const success = game.playCanasta(cards)

      expect(success).toBe(true)
      expect(teamA.hasTakenMorto).toBe(true)
      expect(players[0].hand.getSize()).toBe(11)
      expect(game.isGameOver()).toBe(false)
    })

    test('extendMeld: team already took morto, no clean canastra -> extending with the last card in hand is ILLEGAL (no side effects)', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.melds.push(
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
        ])
      )

      teamA.hasTakenMorto = true
      game.state.mortos = []
      players[0].hand.addCard(new Card('hearts', '8', false)) // last card in hand

      const success = game.extendMeld(0, [new Card('hearts', '8', false)])

      expect(success).toBe(false)
      expect(players[0].hand.getSize()).toBe(1)
      expect(teamA.melds[0].cards).toHaveLength(3)
    })

    test('extendMeld: same scenario but extension makes the meld a clean 7+ canastra -> legal direct batida', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      game.state.status = 'playing'
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.melds.push(
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
        ])
      )

      teamA.hasTakenMorto = true
      game.state.mortos = []
      const extraCards = [
        new Card('hearts', '8', false),
        new Card('hearts', '9', false),
        new Card('hearts', '10', false),
        new Card('hearts', 'J', false),
      ]
      for (const c of extraCards) players[0].hand.addCard(c) // last cards in hand

      const success = game.extendMeld(0, extraCards)

      expect(success).toBe(true)
      expect(players[0].hand.getSize()).toBe(0)
      expect(teamA.melds[0].cards).toHaveLength(7)
      expect(game.isGameOver()).toBe(true)
    })

    test('extendMeld: team has NOT taken morto and a morto is available -> legal, auto-picks up morto', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.melds.push(
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
        ])
      )

      teamA.hasTakenMorto = false
      game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]
      players[0].hand.addCard(new Card('hearts', '8', false)) // last card in hand

      const success = game.extendMeld(0, [new Card('hearts', '8', false)])

      expect(success).toBe(true)
      expect(teamA.hasTakenMorto).toBe(true)
      expect(players[0].hand.getSize()).toBe(11)
    })
  })

  describe('wouldPlayCanastaEmptyHandIllegally / wouldExtendMeldEmptyHandIllegally (UI helpers)', () => {
    test('wouldPlayCanastaEmptyHandIllegally: true when the meld would empty the hand and the team can neither take morto nor bater', () => {
      const players = makeFourPlayers()
      const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false), new Card('hearts', '7', false)]
      for (const c of cards) players[0].hand.addCard(c)
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      game.state.mortos = []

      expect(game.wouldPlayCanastaEmptyHandIllegally(cards)).toBe(true)
    })

    test('wouldPlayCanastaEmptyHandIllegally: false when the meld is a clean 7+ canastra (direct batida)', () => {
      const players = makeFourPlayers()
      const cards = [
        new Card('hearts', '5', false),
        new Card('hearts', '6', false),
        new Card('hearts', '7', false),
        new Card('hearts', '8', false),
        new Card('hearts', '9', false),
        new Card('hearts', '10', false),
        new Card('hearts', 'J', false),
      ]
      for (const c of cards) players[0].hand.addCard(c)
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      game.state.mortos = []

      expect(game.wouldPlayCanastaEmptyHandIllegally(cards)).toBe(false)
    })

    test('wouldPlayCanastaEmptyHandIllegally: false when a morto is still available to take', () => {
      const players = makeFourPlayers()
      const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false), new Card('hearts', '7', false)]
      for (const c of cards) players[0].hand.addCard(c)
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = false
      game.state.mortos = [Array.from({ length: 11 }, () => new Card('clubs', '4', false))]

      expect(game.wouldPlayCanastaEmptyHandIllegally(cards)).toBe(false)
    })

    test('wouldPlayCanastaEmptyHandIllegally: true when it would leave just 1 card (no morto/close rights)', () => {
      // 1 keeper leaves exactly 1 card after the meld - that commits the
      // player to discarding it this same turn, which would empty the hand
      // to 0 with no closing rights. So this is illegal (A1 fix), even
      // though the meld itself doesn't literally empty the hand to zero.
      const players = makeFourPlayers()
      const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false), new Card('hearts', '7', false)]
      for (const c of cards) players[0].hand.addCard(c)
      players[0].hand.addCard(new Card('clubs', 'K', false)) // 1 keeper -> leaves 1 card
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      game.state.mortos = []

      expect(game.wouldPlayCanastaEmptyHandIllegally(cards)).toBe(true)
    })

    test('wouldPlayCanastaEmptyHandIllegally: false when it would leave 2+ cards', () => {
      const players = makeFourPlayers()
      const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false), new Card('hearts', '7', false)]
      for (const c of cards) players[0].hand.addCard(c)
      players[0].hand.addCard(new Card('clubs', 'K', false)) // 2 keepers -> leaves 2 cards
      players[0].hand.addCard(new Card('clubs', 'Q', false))
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.hasTakenMorto = true
      game.state.mortos = []

      expect(game.wouldPlayCanastaEmptyHandIllegally(cards)).toBe(false)
    })

    test('wouldExtendMeldEmptyHandIllegally: true when extending with the last card in hand and the team can neither take morto nor bater', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.melds.push(
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
        ])
      )
      teamA.hasTakenMorto = true
      game.state.mortos = []
      players[0].hand.addCard(new Card('hearts', '8', false))

      expect(game.wouldExtendMeldEmptyHandIllegally(0, [new Card('hearts', '8', false)])).toBe(true)
    })

    test('wouldExtendMeldEmptyHandIllegally: false when the extension completes a clean 7+ canastra', () => {
      const players = makeFourPlayers()
      const game = new Game(players)
      const teamA = game.state.teams.find(t => t.id === 'A')!
      teamA.melds.push(
        new Canasta([
          new Card('hearts', '5', false),
          new Card('hearts', '6', false),
          new Card('hearts', '7', false),
        ])
      )
      teamA.hasTakenMorto = true
      game.state.mortos = []
      const extraCards = [
        new Card('hearts', '8', false),
        new Card('hearts', '9', false),
        new Card('hearts', '10', false),
        new Card('hearts', 'J', false),
      ]
      for (const c of extraCards) players[0].hand.addCard(c)

      expect(game.wouldExtendMeldEmptyHandIllegally(0, extraCards)).toBe(false)
    })
  })

  test('getGameState returns the current state', () => {
    const game = new Game(makeFourPlayers())
    expect(game.getGameState()).toBe(game.state)
  })

  test('clone produces an independent game with equivalent state', () => {
    const game = new Game(makeFourPlayers())
    game.setup()
    const clone = game.clone()

    expect(clone).not.toBe(game)
    expect(clone.state.players[0].hand.getSize()).toBe(game.state.players[0].hand.getSize())
    expect(clone.state.deck.length).toBe(game.state.deck.length)
    expect(clone.state.teams.length).toBe(2)

    clone.state.deck.pop()
    expect(clone.state.deck.length).not.toBe(game.state.deck.length)
  })
})
