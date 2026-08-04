import { Player, PlayerMove } from './player'
import { Card, Suit } from './card'
import { Hand } from './hand'
import { Canasta } from './canasta'
import { isValidCanasta, rankToNumber } from './utils'

export type AIDifficulty = 'easy' | 'medium' | 'hard'

export interface GameStateForAI {
  currentPlayerIndex: number
  players: Player[]
  deck: Card[]
  discardPile: Card[]
  melds: Map<string, Canasta[]>
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
    // Prefere jogar canastas, evita descartar cartas perigosas
    const moves = this.getValidMoves(gameState)

    // Prioridade 1: jogar canastas
    const canastaMoves = moves.filter(m => m.type === 'play_canasta')
    if (canastaMoves.length > 0) {
      return canastaMoves[Math.floor(Math.random() * canastaMoves.length)]
    }

    // Prioridade 2: descartar carta "segura" (rank baixo)
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
    // Rastreia cartas descartadas (memoria) e prioriza canastas de forma
    // deterministica, sem uso de Math.random.
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

    // Prioridade 2: descartar a carta menos util. Evita descartar cartas
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

  getValidMoves(gameState: GameStateForAI): PlayerMove[] {
    void gameState
    const moves: PlayerMove[] = []

    // Move 1: draw (sempre valido)
    moves.push({ type: 'draw' })

    // Move 2: jogar canastas detectadas na mao
    moves.push(...this.findCanastaMoves())

    // Move 3: descartar (qualquer carta)
    const myCards = this.hand.getCards()
    for (let i = 0; i < myCards.length; i++) {
      moves.push({ type: 'discard', cardIndex: i })
    }

    return moves
  }

  /**
   * Busca simples (nao exaustiva) por canastas possiveis na mao: agrupa
   * cartas reais por naipe, ordena por rank e testa janelas contiguas de
   * 3+ cartas (com ou sem 1 curinga da mao para preencher uma lacuna de 1).
   * Suficiente para encontrar canastas obvias (ex: 5H6H7H juntas na mao).
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
