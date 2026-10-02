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

const SAFE_RANKS = ['3', '4', '5']

function isWildCard(card: Card): boolean {
  return card.isWild || card.rank === '2'
}

export class AIPlayer implements Player {
  name: string
  hand: Hand
  score: number = 0
  canastas: Canasta[] = []
  difficulty: AIDifficulty
  private discardedCards: Set<string> = new Set()

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
    if (this.isDiscardPileUseful(gameState) && Math.random() < 0.5) {
      return { type: 'take_discard' }
    }

    const moves = this.getValidMoves(gameState)
    if (moves.length === 0) return { type: 'draw' }

    const ownTeam = this.getOwnTeam(gameState)
    const meldMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'extend_meld' || m.type === 'play_canasta'),
      ownTeam
    )
    if (meldMoves.length > 0) {
      return meldMoves[Math.floor(Math.random() * meldMoves.length)]
    }

    return moves[Math.floor(Math.random() * moves.length)]
  }

  private decideMedium(gameState: GameStateForAI): PlayerMove {
    if (this.isDiscardPileUseful(gameState)) {
      return { type: 'take_discard' }
    }

    const moves = this.getValidMoves(gameState)
    const ownTeam = this.getOwnTeam(gameState)

    const extendMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'extend_meld'),
      ownTeam
    )
    if (extendMoves.length > 0) {
      return extendMoves[Math.floor(Math.random() * extendMoves.length)]
    }

    const canastaMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'play_canasta'),
      ownTeam
    )
    if (canastaMoves.length > 0) {
      return canastaMoves[Math.floor(Math.random() * canastaMoves.length)]
    }

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
    gameState.discardPile.forEach(card => {
      this.discardedCards.add(card.toString())
    })

    if (this.isDiscardPileUseful(gameState)) {
      return { type: 'take_discard' }
    }

    const moves = this.getValidMoves(gameState)
    const ownTeam = this.getOwnTeam(gameState)

    const extendMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'extend_meld'),
      ownTeam
    )
    if (extendMoves.length > 0) {
      const sorted = [...extendMoves].sort((a, b) => (a.meldIndex ?? 0) - (b.meldIndex ?? 0))
      return sorted[0]
    }

    const canastaMoves = this.preferNaturalMelds(
      moves.filter(m => m.type === 'play_canasta'),
      ownTeam
    )
    if (canastaMoves.length > 0) {
      const sorted = [...canastaMoves].sort((a, b) => (b.cards?.length ?? 0) - (a.cards?.length ?? 0))
      return sorted[0]
    }

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

  private isDiscardPileUseful(gameState: GameStateForAI): boolean {
    if (gameState.discardPile.length === 0) return false
    const top = gameState.discardPile[gameState.discardPile.length - 1]

    const ownTeam = this.getOwnTeam(gameState)
    if (ownTeam && ownTeam.melds.some(meld => canExtendMeld(meld.cards, [top]))) {
      return true
    }

    const cards = this.hand.getCards()
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        if (isValidCanasta([cards[i], cards[j], top])) return true
      }
    }
    return false
  }

  private getOwnTeam(gameState: GameStateForAI): Team | undefined {
    return gameState.teams.find(t => t.seats.includes(gameState.currentPlayerIndex))
  }

  getValidMoves(gameState: GameStateForAI): PlayerMove[] {
    const moves: PlayerMove[] = []

    moves.push({ type: 'draw' })

    moves.push(...this.findCanastaMoves())

    const ownTeam = this.getOwnTeam(gameState)
    if (ownTeam) {
      moves.push(...this.findExtendMeldMoves(ownTeam))
    }

    if (this.isDiscardPileUseful(gameState)) {
      moves.push({ type: 'take_discard' })
    }

    const myCards = this.hand.getCards()
    const hasNonWild = myCards.some(c => !isWildCard(c))
    for (let i = 0; i < myCards.length; i++) {
      if (hasNonWild && isWildCard(myCards[i])) continue
      moves.push({ type: 'discard', cardIndex: i })
    }

    return this.hardGateDirtyMoves(moves, ownTeam)
  }

  private hardGateDirtyMoves(moves: PlayerMove[], ownTeam: Team | undefined): PlayerMove[] {
    if (!ownTeam || this.teamHasCleanCanastra(ownTeam)) return moves
    return moves.filter(m => {
      if (m.type !== 'play_canasta' && m.type !== 'extend_meld') return true
      return !this.isDirtyMeldMove(m, ownTeam)
    })
  }

  private findExtendMeldMoves(ownTeam: Team): PlayerMove[] {
    const moves: PlayerMove[] = []
    const cards = this.hand.getCards()

    ownTeam.melds.forEach((meld, meldIndex) => {
      for (const card of cards) {
        if (!canExtendMeld(meld.cards, [card])) continue
        if (this.wouldDirtyCleanCanastra(meld, [card])) continue
        moves.push({ type: 'extend_meld', meldIndex, cards: [card] })
      }
    })

    return moves
  }

  private wouldDirtyCleanCanastra(meld: Canasta, added: Card[]): boolean {
    if (!meld.isCanastra || !meld.isClean) return false
    try {
      return !meld.withExtraCards(added).isClean
    } catch {
      return false
    }
  }

  private teamHasCleanCanastra(team: Team): boolean {
    return team.melds.some(m => m.isCanastra && m.isClean)
  }

  private isDirtyMeldMove(move: PlayerMove, ownTeam: Team | undefined): boolean {
    if (!move.cards || move.cards.length === 0) return false

    if (move.type === 'play_canasta') {
      try {
        return !new Canasta(move.cards).isClean
      } catch {
        return false
      }
    }

    if (move.type === 'extend_meld' && ownTeam) {
      const meld = ownTeam.melds[move.meldIndex ?? -1]
      if (!meld) return false
      try {
        return !meld.withExtraCards(move.cards).isClean
      } catch {
        return false
      }
    }

    return false
  }

  private preferNaturalMelds(moves: PlayerMove[], ownTeam: Team | undefined): PlayerMove[] {
    if (moves.length === 0 || !ownTeam) return moves
    if (this.teamHasCleanCanastra(ownTeam)) return moves
    const natural = moves.filter(m => !this.isDirtyMeldMove(m, ownTeam))
    return natural.length > 0 ? natural : moves
  }

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
      const byRank = new Map<number, Card>()
      for (const c of suitCards) {
        const r = rankToNumber(c.rank)
        if (!byRank.has(r)) byRank.set(r, c)
      }
      const sorted = [...byRank.entries()].sort((a, b) => a[0] - b[0]).map(([, c]) => c)

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
