import { Card } from './card'
import { Hand } from './hand'
import { Canasta } from './canasta'

export type PlayerMove = {
  type: 'draw' | 'play_canasta' | 'discard' | 'take_discard' | 'extend_meld'
  cardIndex?: number
  meldIndex?: number
  cards?: Card[]
}

export interface Player {
  name: string
  hand: Hand
  score: number
  canastas: Canasta[]

  playTurn(gameState: any): PlayerMove | null
}

export class HumanPlayer implements Player {
  name: string
  hand: Hand
  score: number = 0
  canastas: Canasta[] = []

  constructor(name: string = 'You', initialCards: Card[] = []) {
    this.name = name
    this.hand = new Hand(initialCards)
  }

  playTurn(): PlayerMove | null {
    return null
  }

  addCanasta(canasta: Canasta): void {
    this.canastas.push(canasta)
    this.score += canasta.getScore()
  }

  clone(): HumanPlayer {
    const clone = new HumanPlayer(this.name, this.hand.getCards())
    clone.score = this.score
    clone.canastas = this.canastas.map(c => c.clone())
    return clone
  }
}
