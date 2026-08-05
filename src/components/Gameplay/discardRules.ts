import { Game } from '../../engine/game'
import { Card } from '../../engine/card'
import { canExtendMeld, isValidCanasta } from '../../engine/utils'

/**
 * Best-effort check for whether "Pegar descarte" should be enabled: the
 * engine's takeDiscardPile() is a raw mechanism with no rule enforcement (see
 * Game.takeDiscardPile doc comment), so the UI is responsible for only
 * offering the action when the traditional Buraco condition holds — the top
 * discard card can be used immediately, either to extend one of the current
 * player's TEAM melds, or to form a brand-new valid meld together with 2+
 * cards already in the current player's hand (including an ace-trio, since
 * isValidCanasta accepts that too).
 *
 * This is intentionally best-effort: it searches pairs/triples of
 * same-suit-or-wild-or-ace hand cards combined with the top card rather than
 * every possible subset, which is enough to catch the realistic cases (a
 * meld needs at most 1 wild and the ace-trio exception only cares about rank)
 * without a combinatorial blow-up over an 11-22 card hand.
 */
export function canTakeDiscardPile(game: Game): boolean {
  const { discardPile } = game.state
  if (discardPile.length === 0) return false

  const top = discardPile[discardPile.length - 1]
  const team = game.getTeamOfCurrentPlayer()
  const hand = game.getCurrentPlayer().hand.getCards()

  for (const meld of team.melds) {
    if (canExtendMeld(meld.cards, [top])) return true
  }

  return canFormNewMeldWithTop(hand, top)
}

function canFormNewMeldWithTop(hand: Card[], top: Card): boolean {
  const candidates = hand.filter(c => c.suit === top.suit || c.isWild || c.rank === 'A')
  const n = candidates.length

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (isValidCanasta([top, candidates[i], candidates[j]])) return true
    }
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        if (isValidCanasta([top, candidates[i], candidates[j], candidates[k]])) return true
      }
    }
  }

  return false
}
