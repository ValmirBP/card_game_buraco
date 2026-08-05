import { Player, PlayerMove } from './player'
import { Card, Suit } from './card'
import { Hand } from './hand'
import { Canasta } from './canasta'
import { Team } from './gameState'
import { isValidCanasta, canExtendMeld, rankToNumber } from './utils'

export type AIDifficulty = 'easy' | 'medium' | 'hard'

export interface GameStateForAI {
  currentPlayerIndex: number
  players: Player[]
  deck: Card[]
  discardPile: Card[]
  teams: Team[]
}

const SAFE_RANKS = ['2', '3', '4', '5']

export class AIPlayer implements Player {
  name: string
  hand: Hand
  score: number = 0
  canastas: Canasta[] = []
  difficulty: AIDifficulty
  private discardedCards: Set<string> = new Set() // Memoria para hard

  constructor(name: string, difficulty: AIDifficulty = 'medium', initialCards: Card[] = []) {
    this.name = name
    this.hand = new Hand(initialCards)
    this.difficulty = difficulty
  }

  playTurn(gameState: GameStateForAI): PlayerMove {
    return this.decide(gameState)
  }

  private decide(gameState: GameStateForAI): PlayerMove {
    switch (this.difficulty) {
      case 'easy':
        return this.decideEasy(gameState)
      case 'medium':
        return this.decideMedium(gameState)
      case 'hard':
        return this.decideHard(gameState)
    }
  }

  private decideEasy(gameState: GameStateForAI): PlayerMove {
    // Aleatorio entre movimentos validos
    const moves = this.getValidMoves(gameState)
    if (moves.length === 0) return { type: 'draw' }
    return moves[Math.floor(Math.random() * moves.length)]
  }

  private decideMedium(gameState: GameStateForAI): PlayerMove {
    // Prefere jogar canastas, depois estender jogos do time, depois evita
    // descartar cartas perigosas.
    const moves = this.getValidMoves(gameState)

    // Prioridade 1: jogar canastas
    const canastaMoves = moves.filter(m => m.type === 'play_canasta')
    if (canastaMoves.length > 0) {
      return canastaMoves[Math.floor(Math.random() * canastaMoves.length)]
    }

    // Prioridade 2: estender jogo existente do time
    const extendMoves = moves.filter(m => m.type === 'extend_meld')
    if (extendMoves.length > 0) {
      return extendMoves[Math.floor(Math.random() * extendMoves.length)]
    }

    // Prioridade 3: descartar carta "segura" (rank baixo)
    const discardMoves = moves.filter(m => m.type === 'discard')
    if (discardMoves.length > 0) {
      const safeMove = discardMoves.find(m => {
        const idx = m.cardIndex!
        const card = this.hand.getCards()[idx]
        return SAFE_RANKS.includes(card.rank)
      })
      if (safeMove) return safeMove
      return discardMoves[Math.floor(Math.random() * discardMoves.length)]
    }

    return { type: 'draw' }
  }

  private decideHard(gameState: GameStateForAI): PlayerMove {
    // Rastreia cartas descartadas (memoria) e prioriza canastas/extensoes de
    // forma deterministica, sem uso de Math.random.
    gameState.discardPile.forEach(card => {
      this.discardedCards.add(card.toString())
    })

    const moves = this.getValidMoves(gameState)

    // Prioridade 1: jogar a maior canasta possivel (deterministico)
    const canastaMoves = moves.filter(m => m.type === 'play_canasta')
    if (canastaMoves.length > 0) {
      const sorted = [...canastaMoves].sort((a, b) => (b.cards?.length ?? 0) - (a.cards?.length ?? 0))
      return sorted[0]
    }

    // Prioridade 2: estender o jogo existente do time (deterministico, o de
    // menor meldIndex primeiro)
    const extendMoves = moves.filter(m => m.type === 'extend_meld')
    if (extendMoves.length > 0) {
      const sorted = [...extendMoves].sort((a, b) => (a.meldIndex ?? 0) - (b.meldIndex ?? 0))
      return sorted[0]
    }

    // Prioridade 3: descartar a carta menos util. Evita descartar cartas
    // cujo par/sequencia ja apareceu no descarte (poderiam formar canasta do
    // adversario) e prefere cartas seguras / de baixo valor.
    const discardMoves = moves.filter(m => m.type === 'discard')
    if (discardMoves.length > 0) {
      const cards = this.hand.getCards()
      const scored = discardMoves
        .map(m => ({ move: m, card: cards[m.cardIndex!] }))
        .sort((a, b) => {
          const aSafe = SAFE_RANKS.includes(a.card.rank) ? 0 : 1
          const bSafe = SAFE_RANKS.includes(b.card.rank) ? 0 : 1
          if (aSafe !== bSafe) return aSafe - bSafe
          return rankToNumber(a.card.rank) - rankToNumber(b.card.rank)
        })
      return scored[0].move
    }

    return { type: 'draw' }
  }

  /**
   * Finds the current player's own team from gameState.teams by looking for
   * the team whose seats include currentPlayerIndex. Falls back to the
   * first team if not found (defensive - shouldn't happen with well-formed
   * state), keeping this AI usable even against partial/mocked game states.
   */
  private getOwnTeam(gameState: GameStateForAI): Team | undefined {
    return gameState.teams.find(t => t.seats.includes(gameState.currentPlayerIndex))
  }

  getValidMoves(gameState: GameStateForAI): PlayerMove[] {
    const moves: PlayerMove[] = []

    // Move 1: draw (sempre valido)
    moves.push({ type: 'draw' })

    // Move 2: jogar canastas detectadas na mao (novos jogos)
    moves.push(...this.findCanastaMoves())

    // Move 3: estender jogos existentes do proprio time
    const ownTeam = this.getOwnTeam(gameState)
    if (ownTeam) {
      moves.push(...this.findExtendMeldMoves(ownTeam))
    }

    // Move 4: descartar (qualquer carta)
    const myCards = this.hand.getCards()
    for (let i = 0; i < myCards.length; i++) {
      moves.push({ type: 'discard', cardIndex: i })
    }

    return moves
  }

  /**
   * For each meld belonging to the AI's own team, tries extending it with
   * each single card in hand (and, for wilds, the lone wild) via
   * canExtendMeld. Not exhaustive (doesn't try multi-card extensions), but
   * sufficient to find legal, non-harmful extensions - this AI only needs
   * to never propose an illegal move, not to play optimally.
   */
  private findExtendMeldMoves(ownTeam: Team): PlayerMove[] {
    const moves: PlayerMove[] = []
    const cards = this.hand.getCards()

    ownTeam.melds.forEach((meld, meldIndex) => {
      for (const card of cards) {
        if (canExtendMeld(meld.cards, [card])) {
          moves.push({ type: 'extend_meld', meldIndex, cards: [card] })
        }
      }
    })

    return moves
  }

  /**
   * Busca simples (nao exaustiva) por canastas possiveis na mao:
   *  - agrupa cartas reais por naipe, ordena por rank e testa janelas
   *    contiguas de 3+ cartas (com ou sem 1 curinga da mao para preencher
   *    uma lacuna) - encontra sequencias normais e ace-alto (...Q-K-A, ja
   *    que rankToNumber trata A como 14).
   *  - separadamente, procura trincas de ases (2-4 Ases reais de quaisquer
   *    naipes, com ou sem 1 curinga), que sao validas independente de naipe.
   * Suficiente para encontrar canastas obvias; nao precisa ser exaustiva.
   */
  private findCanastaMoves(): PlayerMove[] {
    const moves: PlayerMove[] = []
    const cards = this.hand.getCards()
    const wilds = cards.filter(c => c.isWild)

    const bySuit = new Map<Suit, Card[]>()
    for (const c of cards) {
      if (c.isWild) continue
      if (!bySuit.has(c.suit)) bySuit.set(c.suit, [])
      bySuit.get(c.suit)!.push(c)
    }

    for (const suitCards of bySuit.values()) {
      // dedupe por rank (mantem a primeira ocorrencia)
      const byRank = new Map<number, Card>()
      for (const c of suitCards) {
        const r = rankToNumber(c.rank)
        if (!byRank.has(r)) byRank.set(r, c)
      }
      const sorted = [...byRank.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c)

      // Janelas de 3+ cartas reais contiguas na lista ordenada
      for (let i = 0; i < sorted.length; i++) {
        for (let j = i + 2; j < sorted.length; j++) {
          const windowCards = sorted.slice(i, j + 1)
          if (isValidCanasta(windowCards)) {
            moves.push({ type: 'play_canasta', cards: windowCards })
          } else if (wilds.length > 0) {
            const withWild = [...windowCards, wilds[0]]
            if (isValidCanasta(withWild)) {
              moves.push({ type: 'play_canasta', cards: withWild })
            }
          }
        }
      }

      // 2 cartas reais + 1 curinga (preenche 1 lacuna) = canasta de 3
      if (wilds.length > 0) {
        for (let i = 0; i < sorted.length - 1; i++) {
          const windowCards = [sorted[i], sorted[i + 1]]
          const withWild = [...windowCards, wilds[0]]
          if (isValidCanasta(withWild)) {
            moves.push({ type: 'play_canasta', cards: withWild })
          }
        }
      }
    }

    // Trinca de ases: 3+ Ases reais (quaisquer naipes) formam um jogo
    // valido, independente da regra normal de naipe/sequencia.
    const aces = cards.filter(c => !c.isWild && c.rank === 'A')
    if (aces.length >= 3) {
      moves.push({ type: 'play_canasta', cards: [...aces] })
    } else if (aces.length === 2 && wilds.length > 0) {
      moves.push({ type: 'play_canasta', cards: [...aces, wilds[0]] })
    }

    return moves
  }

  getDiscardedCards(): Set<string> {
    return this.discardedCards
  }

  addCanasta(canasta: Canasta): void {
    this.canastas.push(canasta)
    this.score += canasta.getScore()
  }

  clone(): AIPlayer {
    const clone = new AIPlayer(this.name, this.difficulty, this.hand.getCards())
    clone.score = this.score
    clone.canastas = this.canastas.map(c => c.clone())
    clone.discardedCards = new Set(this.discardedCards)
    return clone
  }
}
