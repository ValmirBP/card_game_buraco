import { Card } from './card'
import { analyzeMeld, canExtendMeld, canastaPoints, scoreCard, MeldLayoutEntry } from './utils'

export type CanastaType = 'sequence' | 'aces'

export interface CanastaOptions {
  /**
   * When true, forces this meld to be treated as dirty regardless of what
   * the fresh analysis of `cards` says. Used to persist "sujeira
   * permanente" (Part A.4/A.3 - regra do 9): once a meld has gone dirty
   * (e.g. a same-suit-2 curinga plus a real 9), it must never look clean
   * again, even if a later card composition would re-analyze as clean.
   * Optional and defaults to false for backward compatibility with
   * existing callers (store/UI) that construct Canasta with just `cards`.
   */
  wasDirty?: boolean
}

export class Canasta {
  readonly cards: Card[]
  readonly isClean: boolean
  readonly isCanastra: boolean
  readonly points: number
  readonly type: CanastaType
  readonly layout: MeldLayoutEntry[]
  /** Whether this meld (or any earlier version it was extended from) has ever been dirty - see CanastaOptions.wasDirty. */
  readonly wasDirty: boolean

  constructor(cards: Card[], options: CanastaOptions = {}) {
    const analysis = analyzeMeld(cards)
    if (!analysis) {
      throw new Error(
        'Invalid canasta: must have 3+ cards, same suit consecutive sequence (ace high or low), or a trio of aces, with at most 1 curinga (joker or non-natural 2)'
      )
    }
    this.cards = [...cards]
    this.type = analysis.type
    this.layout = analysis.layout

    const forcedDirty = options.wasDirty ?? false
    this.isClean = !forcedDirty && analysis.isClean
    this.wasDirty = forcedDirty || !analysis.isClean

    this.isCanastra = this.cards.length >= 7

    const cardSum = this.cards.reduce((sum, c) => sum + scoreCard(c.rank), 0)
    const bonus = canastaPoints(this.isClean, this.cards.length)
    this.points = cardSum + bonus
  }

  getScore(): number {
    // points já inclui o valor das cartas + bônus de canastra (200/100 a
    // partir de 7 cartas; 0 abaixo disso).
    return this.points
  }

  /**
   * Returns a new Canasta with `added` cards merged in, validating that the
   * combination is still a legal meld (extended sequence, or an ace trio
   * with more aces). Throws if the extension would be invalid. Does not
   * mutate this instance. A dirty (unclean) meld stays dirty when extended -
   * its curinga is never removed, only recomputed from the full card set -
   * and, per "sujeira permanente" (Part A.4), stays dirty even if a fresh
   * analysis of the extended card set would otherwise look clean (e.g. the
   * regra-do-9 case where the same-suit curinga would later appear natural).
   */
  withExtraCards(added: Card[]): Canasta {
    if (!canExtendMeld(this.cards, added)) {
      throw new Error('Invalid meld extension')
    }
    return new Canasta([...this.cards, ...added], { wasDirty: this.wasDirty })
  }

  clone(): Canasta {
    return new Canasta([...this.cards], { wasDirty: this.wasDirty })
  }
}
