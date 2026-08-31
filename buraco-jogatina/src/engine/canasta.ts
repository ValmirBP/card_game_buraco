import { Card } from './card'
import {
  analyzeMeld,
  canExtendMeld,
  canastaPoints,
  computeCanastaKind,
  scoreCardValue,
  CanastaKind,
  MeldLayoutEntry,
} from './utils'

export type CanastaType = 'sequence' | 'aces'

export class Canasta {
  readonly cards: Card[]
  readonly isClean: boolean
  readonly isCanastra: boolean
  readonly points: number
  readonly type: CanastaType
  readonly layout: MeldLayoutEntry[]
  /**
   * Canastra kind for UI/bonus purposes: 'simples' (below 7 cards, no
   * bonus), 'limpa' (7+ clean), 'suja' (7+ dirty), 'quinhentos' (13-card
   * clean 2-to-Ace run, +500) or 'real' (14-card clean Ace-to-Ace run,
   * +1000). See computeCanastaKind in utils.ts.
   */
  readonly kind: CanastaKind

  constructor(cards: Card[]) {
    const analysis = analyzeMeld(cards)
    if (!analysis) {
      throw new Error(
        'Invalid canasta: must have 3+ cards, same suit consecutive sequence (ace high or low), or a trio of aces, with at most 1 curinga (joker or non-natural 2)'
      )
    }
    this.cards = [...cards]
    this.type = analysis.type
    this.layout = analysis.layout

    // isClean é SEMPRE recalculado do zero a partir da composição atual das
    // cartas - nunca "gruda" suja pra sempre. Regra oficial do Jogatina: se
    // o curinga que suja o jogo é um 2 do MESMO naipe, e a carta que ele
    // substituía é comprada depois (via extendMeld), a canastra pode voltar
    // a ficar limpa - o 2 passa a ocupar sua própria posição natural na
    // sequência. analyzeMeld já decide isso corretamente por si só (ver
    // "Interpretation 1" em analyzeSequence, utils.ts): um 2 de OUTRO naipe
    // ou um joker nunca "viram" carta natural daquele naipe, então uma
    // canastra suja por eles NUNCA reanalisa como limpa - só o 2 do mesmo
    // naipe tem esse caminho de volta.
    this.isClean = analysis.isClean

    this.isCanastra = this.cards.length >= 7
    this.kind = computeCanastaKind(this.cards.length, this.isClean, this.layout)

    const cardSum = this.cards.reduce((sum, c) => sum + scoreCardValue(c), 0)
    const bonus = canastaPoints(this.kind, this.cards.length)
    this.points = cardSum + bonus
  }

  getScore(): number {
    // points já inclui o valor das cartas + bônus de canastra a partir de 7
    // cartas (0 abaixo disso): 200 limpa, 100 suja, 500 quinhentos, 1000 real.
    return this.points
  }

  /**
   * Returns a new Canasta with `added` cards merged in, validating that the
   * combination is still a legal meld (extended sequence, or an ace trio
   * with more aces). Throws if the extension would be invalid. Does not
   * mutate this instance. isClean é recalculado do zero pra composição
   * resultante (ver o construtor) - uma canastra suja por um 2 do MESMO
   * naipe pode voltar a ficar limpa aqui, se a carta que faltava for
   * exatamente o que `added` traz (regra oficial do Jogatina); sujeira por
   * joker ou 2 de outro naipe nunca reanalisa como limpa, então o efeito
   * prático pra esses casos é o mesmo de antes.
   */
  withExtraCards(added: Card[]): Canasta {
    if (!canExtendMeld(this.cards, added)) {
      throw new Error('Invalid meld extension')
    }
    return new Canasta([...this.cards, ...added])
  }

  clone(): Canasta {
    return new Canasta([...this.cards])
  }
}
