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
      const game = new Game(players)
      const success = game.discard(0)
      expect(success).toBe(true)
      expect(players[0].hand.getSize()).toBe(0)
      expect(game.state.discardPile.length).toBe(1)
    })

    test('returns false for out-of-range index', () => {
      const game = new Game(makeFourPlayers())
      expect(game.discard(0)).toBe(false)
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
      const players = makeFourPlayers()
      players[0].hand.addCard(canastaCards[0])
      players[0].hand.addCard(canastaCards[1])
      players[0].hand.addCard(canastaCards[2])
      players[0].hand.addCard(keeper)
      const game = new Game(players)

      const teamA = game.state.teams.find(t => t.id === 'A')!
      expect(teamA.score).toBe(0)

      const success = game.playCanasta(canastaCards)
      expect(success).toBe(true)

      expect(players[0].hand.getSize()).toBe(1)
      expect(players[0].hand.getCards()[0].equals(keeper)).toBe(true)

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
      players[2].hand.addCard(new Card('clubs', 'K', false)) // keeper: this meld must not empty the hand
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
      players[0].hand.addCard(new Card('clubs', 'K', false)) // keeper: this extend must not empty the hand
      const success = game.extendMeld(0, [new Card('hearts', '8', false)])

      expect(success).toBe(true)
      expect(teamA.melds[0].cards).toHaveLength(4)
      expect(players[0].hand.getSize()).toBe(1)
      expect(teamA.score).toBeGreaterThan(scoreBeforeExtend)
    })

    test('returns false for invalid meld index', () => {
      const game = new Game(makeFourPlayers())
      expect(game.extendMeld(0, [new Card('hearts', '8', false)])).toBe(false)
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
      players[2].hand.addCard(new Card('clubs', 'K', false)) // keeper: this extend must not empty the hand
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
      teamA.score = 100
      game.finish()
      // 100 - (15+10+10) = 65
      expect(teamA.score).toBe(65)
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
      teamA.score = 100
      teamB.score = 50
      game.finish()
      expect(teamA.score).toBe(200) // 100 - 0 + 100
      expect(teamB.score).toBe(40) // 50 - 10, no bonus
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
      teamA.score = 100
      teamB.score = 50
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
      teamA.score = 100
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
      teamA.score = 100
      teamB.score = 50
      game.finish()
      expect(teamA.score).toBe(85) // 100 - 15
      expect(teamB.score).toBe(40) // 50 - 10
    })

    describe('morto penalty (-100 for a team that never took a morto)', () => {
      test('a team with hasTakenMorto === false loses an extra 100 points', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        const teamA = game.state.teams.find(t => t.id === 'A')!
        const teamB = game.state.teams.find(t => t.id === 'B')!
        teamA.hasTakenMorto = true
        teamB.hasTakenMorto = false
        teamA.score = 100
        teamB.score = 100
        game.finish()
        expect(teamA.score).toBe(100) // took the morto, no hand cards -> untouched
        expect(teamB.score).toBe(0) // 100 - 100 (no morto), no hand cards
      })

      test('the penalty stacks with the remaining-hand penalty', () => {
        const players = makeFourPlayers()
        players[1].hand.addCard(new Card('clubs', '9', false)) // 10
        const game = new Game(players)
        const teamB = game.state.teams.find(t => t.id === 'B')!
        teamB.hasTakenMorto = false
        teamB.score = 200
        game.finish()
        expect(teamB.score).toBe(90) // 200 - 10 (hand) - 100 (no morto)
      })

      test('a team that took the morto is never charged the -100', () => {
        const players = makeFourPlayers()
        const game = new Game(players)
        const teamA = game.state.teams.find(t => t.id === 'A')!
        teamA.hasTakenMorto = true
        teamA.score = 50
        game.finish()
        expect(teamA.score).toBe(50)
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

    test('wouldPlayCanastaEmptyHandIllegally: false when the meld would NOT empty the hand', () => {
      const players = makeFourPlayers()
      const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false), new Card('hearts', '7', false)]
      for (const c of cards) players[0].hand.addCard(c)
      players[0].hand.addCard(new Card('clubs', 'K', false)) // keeper
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
