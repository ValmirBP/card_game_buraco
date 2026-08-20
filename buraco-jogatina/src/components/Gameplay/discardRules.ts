import { Game } from '../../engine/game'
import { Card } from '../../engine/card'
import { canExtendMeld, isValidCanasta } from '../../engine/utils'

/**
 * Whether "Pegar descarte" should be enabled.
 *
 * HISTORY / DIAGNOSIS: this used to be a strict best-effort check (see
 * `canFormNewMeldWithTopStrict` below, kept for reference) that only enabled
 * the button when it could prove the top discard card immediately extends a
 * team meld or forms a brand-new valid meld with 2+ cards already in hand.
 * In practice that combinatorial proof rarely succeeds early in a hand (most
 * hands don't yet hold 2 matching cards for whatever happens to be on top of
 * the discard pile), so the button appeared "broken" — disabled almost every
 * turn even though taking the discard pile is a perfectly legal and often
 * useful move (you get every card in the pile, not just the top one, then
 * have the rest of your turn to use it).
 *
 * Fix: simplify to the reliable rule the user asked for — enable whenever
 * there is at least one card in the discard pile. The traditional-Buraco
 * "you must be able to use the top card" constraint is surfaced as a
 * reminder message in the UI (see ActionPanel) instead of a hard gate, since
 * the engine's takeDiscardPile() itself enforces no such rule (see
 * Game.takeDiscardPile doc comment) and a hard gate that's frequently wrong
 * is worse than a soft reminder.
 */
export function canTakeDiscardPile(game: Game): boolean {
  return game.state.discardPile.length > 0
}

/**
 * Best-effort strict check kept for reference/potential future use: true if
 * the top discard card can be used immediately (extends a team meld, or
 * forms a new valid meld with 2+ hand cards). Not used to gate the button
 * anymore (see canTakeDiscardPile doc comment) — exposed so the UI can show
 * the "lembre-se: você deve usar a carta do topo" reminder only when it's
 * NOT obviously satisfiable, without re-blocking the action.
 */
export function canUseTopDiscardCard(game: Game): boolean {
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
