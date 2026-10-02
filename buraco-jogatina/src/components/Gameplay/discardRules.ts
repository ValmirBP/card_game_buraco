import { Game } from '../../engine/game'

export function canTakeDiscardPile(game: Game): boolean {
  return game.state.discardPile.length > 0
}
