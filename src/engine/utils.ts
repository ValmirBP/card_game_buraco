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

  const realCards = cards.filter(c => !c.isWild)
  const wilds = cards.filter(c => c.isWild)

  // Regra padrão do Buraco: no máximo 1 curinga por canasta na criação
  if (wilds.length > 1) return false

  // Precisa de pelo menos 2 cartas reais (1 real + wilds não é suficiente)
  if (realCards.length < 2) return false

  // Todas as cartas reais devem ser do mesmo naipe
  const suit = realCards[0].suit
  if (!realCards.every(c => c.suit === suit)) return false

  // Sem ranks duplicados entre as cartas reais
  const sortedReals = [...realCards].sort((a, b) => rankToNumber(a.rank) - rankToNumber(b.rank))
  for (let i = 1; i < sortedReals.length; i++) {
    if (rankToNumber(sortedReals[i - 1].rank) === rankToNumber(sortedReals[i].rank)) {
      return false
    }
  }

  // As lacunas totais entre as cartas reais consecutivas devem caber nos wilds disponíveis
  let gaps = 0
  for (let i = 1; i < sortedReals.length; i++) {
    const diff = rankToNumber(sortedReals[i].rank) - rankToNumber(sortedReals[i - 1].rank)
    gaps += diff - 1
  }

  return gaps <= wilds.length
}

export function canastaPoints(isClean: boolean): number {
  return isClean ? 500 : 300
}
