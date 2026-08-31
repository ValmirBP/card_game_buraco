import { useGameStore } from '../../src/store/gameStore'
import {
  serializeGame,
  deserializeGame,
  saveGame,
  loadSavedGame,
  hasSavedGame,
  clearSavedGame,
  type SavedGame,
} from '../../src/store/gamePersistence'
import { Game } from '../../src/engine/game'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer } from '../../src/engine/ai'
import { Card, Rank } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

const STORAGE_KEY = 'buraco-jogatina:saved-game'

function emptyStoreFields(): SavedGame['store'] {
  return {
    matchScores: { A: 0, B: 0 },
    matchCanastras: { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } },
    round: 1,
    matchWinner: undefined,
    previousMatchScores: undefined,
    matchConfig: { playerName: 'Alice', aiDifficulty: 'medium' },
    gameLog: ['Partida iniciada.'],
    roundFinalized: false,
  }
}

function freshGame(): Game {
  const game = new Game([
    new HumanPlayer('Alice'),
    new AIPlayer('Ana', 'hard'),
    new AIPlayer('Bruno', 'easy'),
    new AIPlayer('Carlos', 'medium'),
  ])
  game.setup()
  return game
}

describe('gamePersistence: serializeGame / deserializeGame round-trip', () => {
  test('preserves players, hands, current player and status', () => {
    const game = freshGame()
    game.state.currentPlayerIndex = 2

    const saved = serializeGame(game, emptyStoreFields())
    const { game: restored } = deserializeGame(saved)

    expect(restored.state.players).toHaveLength(4)
    expect(restored.state.players.map(p => p.name)).toEqual(['Alice', 'Ana', 'Bruno', 'Carlos'])
    expect(restored.state.players[1]).toBeInstanceOf(AIPlayer)
    expect((restored.state.players[1] as AIPlayer).difficulty).toBe('hard')
    expect(restored.state.players[0]).toBeInstanceOf(HumanPlayer)
    restored.state.players.forEach((p, i) => {
      expect(p.hand.getSize()).toBe(game.state.players[i].hand.getSize())
    })
    expect(restored.state.currentPlayerIndex).toBe(2)
    expect(restored.state.status).toBe('playing')
    expect(restored.state.deck.length).toBe(game.state.deck.length)
    expect(restored.state.mortos).toHaveLength(2)
    expect(restored.state.mortos[0]).toHaveLength(11)
  })

  test('preserves melds on the table, including a clean canastra isClean/kind recomputed correctly', () => {
    const game = freshGame()
    const cleanRun = (['4', '5', '6', '7', '8', '9', '10'] as Rank[]).map(r => new Card('hearts', r, false))
    game.state.teams[0].melds.push(new Canasta(cleanRun))
    game.state.teams[0].score = 250

    const saved = serializeGame(game, emptyStoreFields())
    const { game: restored } = deserializeGame(saved)

    const teamA = restored.state.teams.find(t => t.id === 'A')!
    expect(teamA.melds).toHaveLength(1)
    expect(teamA.melds[0].isClean).toBe(true)
    expect(teamA.melds[0].kind).toBe('limpa')
    expect(teamA.melds[0].cards).toHaveLength(7)
    expect(teamA.score).toBe(250)
  })

  test('blockedDiscardCard survives round-trip by reference (still blocks the same hand index)', () => {
    const game = freshGame()
    // Simula um lixo de carta única pego pelo jogador da vez.
    game.state.discardPile = [new Card('clubs', '5', false)]
    const taken = game.takeDiscardPile()!
    const player = game.getCurrentPlayer()
    for (const c of taken) player.hand.addCard(c)
    const blockedIndex = player.hand.getCards().length - 1
    expect(game.isDiscardBlockedCard(blockedIndex)).toBe(true)

    const saved = serializeGame(game, emptyStoreFields())
    const { game: restored } = deserializeGame(saved)

    expect(restored.isDiscardBlockedCard(blockedIndex)).toBe(true)
    // Nenhum outro índice deveria estar bloqueado.
    expect(restored.isDiscardBlockedCard(0)).toBe(blockedIndex === 0)
  })

  test('deserializeGame throws on an incompatible schema version', () => {
    const game = freshGame()
    const saved = serializeGame(game, emptyStoreFields())
    saved.schemaVersion = 999
    expect(() => deserializeGame(saved)).toThrow()
  })
})

describe('gamePersistence: localStorage plumbing', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  test('hasSavedGame/loadSavedGame reflect what saveGame wrote', () => {
    expect(hasSavedGame()).toBe(false)
    expect(loadSavedGame()).toBeNull()

    const game = freshGame()
    saveGame(game, emptyStoreFields())

    expect(hasSavedGame()).toBe(true)
    const loaded = loadSavedGame()
    expect(loaded).not.toBeNull()
    expect(loaded!.game.state.players).toHaveLength(4)
    expect(loaded!.store.matchConfig?.playerName).toBe('Alice')
  })

  test('clearSavedGame removes the entry', () => {
    const game = freshGame()
    saveGame(game, emptyStoreFields())
    expect(hasSavedGame()).toBe(true)

    clearSavedGame()
    expect(hasSavedGame()).toBe(false)
    expect(loadSavedGame()).toBeNull()
  })

  test('a corrupted entry is treated as "nothing to resume" and is wiped', () => {
    window.localStorage.setItem(STORAGE_KEY, '{ not valid json')
    expect(hasSavedGame()).toBe(true) // presence check doesn't parse

    expect(loadSavedGame()).toBeNull()
    expect(hasSavedGame()).toBe(false) // loadSavedGame cleaned it up
  })
})

describe('gameStore.resumeSavedGame integration', () => {
  beforeEach(() => {
    useGameStore.getState().resetGame()
    window.localStorage.clear()
  })

  test('returns false when there is nothing saved', () => {
    expect(useGameStore.getState().resumeSavedGame()).toBe(false)
  })

  test('every mutating action persists the game, and resumeSavedGame restores it into a fresh store', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    useGameStore.getState().drawFromDeck()
    expect(hasSavedGame()).toBe(true)

    const before = useGameStore.getState().game!
    const currentPlayerIndex = before.state.currentPlayerIndex
    const handSize = before.getCurrentPlayer().hand.getSize()
    const gameLogBefore = useGameStore.getState().gameLog

    // Não zeramos o store aqui pra simular "reabrir o app": um app novo é
    // um contexto JS novo, então o listener do subscribe (que limpa o
    // localStorage quando `game` vira null) nunca dispara nesse cenário
    // real. Zerar o store manualmente NESTA sessão dispararia esse mesmo
    // listener e apagaria o save que acabamos de fazer, invalidando o
    // teste. resumeSavedGame() já sobrescreve `game`/`version`/etc. via
    // set(), então basta chamá-lo direto contra o que está no
    // localStorage.
    const resumed = useGameStore.getState().resumeSavedGame()
    expect(resumed).toBe(true)

    const after = useGameStore.getState()
    expect(after.game).not.toBeNull()
    expect(after.game!.state.currentPlayerIndex).toBe(currentPlayerIndex)
    expect(after.game!.getCurrentPlayer().hand.getSize()).toBe(handSize)
    expect(after.gameLog).toEqual(gameLogBefore)
  })

  test('resetGame (sair da partida) clears the saved game so resumeSavedGame returns false afterwards', () => {
    useGameStore.getState().initGame('Alice', 'easy')
    expect(hasSavedGame()).toBe(true)

    useGameStore.getState().resetGame()
    expect(hasSavedGame()).toBe(false)
    expect(useGameStore.getState().resumeSavedGame()).toBe(false)
  })
})
