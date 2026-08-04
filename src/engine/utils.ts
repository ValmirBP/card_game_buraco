import { Card, Rank } from './card'

export function scoreCard(rank: Rank): number {
  if (rank === 'A') return 15
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10
  if (rank === '2') return 20 // Curinga
  const num = parseInt(rank, 10)
  return isNaN(num) ? 0 : num
}

export function rankToNumber(rank: Rank): number {
  if (rank === 'A') return 14
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  const num = parseInt(rank, 10)
  return isNaN(num) ? 0 : num
}

export function isConsecutive(r1: Rank, r2: Rank): boolean {
  return Math.abs(rankToNumber(r1) - rankToNumber(r2)) === 1
}

export function isValidCanasta(cards: Card[]): boolean {
  if (cards.length < 3) return false

  // Se tem wild cards, é válido se há pelo menos 1 real e resto é wild/2s
  const realCards = cards.filter(c => !c.isWild)
  const wilds = cards.filter(c => c.isWild)

  // Deve ter pelo menos 1 carta real
  if (realCards.length === 0) return false

  // Todas as cartas reais devem ser do mesmo naipe
  const suit = realCards[0].suit
  if (!realCards.every(c => c.suit === suit)) return false

  // Cartas reais devem ser consecutivas (ignorando wilds por enquanto)
  const sortedReals = realCards.sort((a, b) => rankToNumber(a.rank) - rankToNumber(b.rank))
  for (let i = 1; i < sortedReals.length; i++) {
    if (!isConsecutive(sortedReals[i - 1].rank, sortedReals[i].rank)) {
      return false
    }
  }

  return true
}

export function canastaPoints(isClean: boolean): number {
  return isClean ? 500 : 300
}
