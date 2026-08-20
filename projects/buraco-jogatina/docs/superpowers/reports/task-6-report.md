# Task 6 Implementation Report — State Manager (Zustand Store)

**Status:** DONE

**Commit Hash:** `330a4c5`

## Summary

Implementado o Task 6 do plano Buraco Jogatina MVP: `src/store/gameStore.ts`
(Zustand), seguindo TDD (testes escritos primeiro em
`tests/store/gameStore.test.ts`, vistos falhando — `Cannot find module
'../../src/store/gameStore'` — antes da implementação). As 3 falhas de
design do plano original (re-render, aiTurn fake, `setTimeout` na store)
foram corrigidas conforme instruído; nenhum arquivo de `src/engine/` ou
teste existente foi tocado.

## Files Created

- `src/store/gameStore.ts` — `useGameStore` (Zustand store, ~215 LOC)
- `tests/store/gameStore.test.ts` — 9 testes, usando
  `useGameStore.getState()`/`useGameStore.setState()` diretamente (sem
  `renderHook`), com `resetGame()` em `beforeEach`.

## Correções aplicadas sobre o código do plano

### 1. Re-render via `version: number`

`game` continua sendo a instância mutável de `Game` (as actions chamam
`game.discard(...)`, `game.endTurn()`, `game.playCanasta(...)` diretamente
sobre ela — não é substituída por uma cópia a cada action). Isso significa
que um componente que só assina `s.game` nunca vê uma referência nova.
Corrigido adicionando `version: number` ao estado, incrementado via
`set({ version: get().version + 1 })` em **toda** action que muta o jogo
(`initGame`, `draw`, `discard`, `playCanasta`, `aiTurn`). O contrato está
documentado como JSDoc no topo da interface `GameStore`:

```ts
/**
 * ...
 * REACTIVITY CONTRACT: because `game` keeps the SAME object reference
 * across actions, any component that subscribes only to `s.game` will
 * never re-render when the game state changes ... Every action below that
 * mutates the game also increments `version`. UI components MUST subscribe
 * to `version` alongside `game` ...
 */
game: Game | null
version: number
```

Testado em quase todos os testes (`draw`, `discard`, `playCanasta` válido,
`aiTurn`), verificando `state.version` incrementado; e um teste negativo
(`playCanasta` com combinação inválida) verificando que `version` **não**
muda quando a action falha sem efeito.

### 2. `aiTurn()` usa a IA real (Task 4), não mais índice 0 fixo

O plano fazia a IA sempre comprar e descartar o índice `0`, ignorando
`AIPlayer.playTurn()`/estratégias easy/medium/hard inteiramente. Implementado
conforme pedido:

```ts
aiTurn: () => {
  // (a) compra carta
  const drawnCard = game.draw()
  if (drawnCard) aiPlayer.hand.addCard(drawnCard)

  // (b) monta GameStateForAI e chama ai.playTurn(...) em loop;
  //     enquanto vier play_canasta, executa game.playCanasta(move.cards);
  //     se falhar, sai do loop (evita loop infinito)
  let discarded = false
  for (let iteration = 0; iteration < MAX_CANASTAS_PER_AI_TURN; iteration++) {
    const move = (aiPlayer as AIPlayer).playTurn(gameStateForAI)
    if (move?.type === 'play_canasta' && move.cards) {
      const played = game.playCanasta(move.cards)
      if (!played) break
      continue
    }
    if (move?.type === 'discard' && move.cardIndex !== undefined) {
      discarded = game.discard(move.cardIndex)
    }
    break
  }

  // (c) fallback: se não descartou (move era 'draw'/null/índice inválido,
  //     ou o loop bateu no limite de iterações sem nunca descartar),
  //     descarta a carta de menor valor via scoreCard()
  if (!discarded) discarded = discardLowestValueCard(game, aiPlayer)

  // (d) endTurn()
  game.endTurn()

  // (e) cada ação (draw, canasta jogada, discard) é registrada no gameLog
}
```

- `MAX_CANASTAS_PER_AI_TURN = 10` protege contra loop infinito.
- Diferente do rascunho do plano na tarefa, o fallback de "descartar a menor
  carta" também é acionado se `game.discard(move.cardIndex)` falhar (índice
  fora da mão) ou se o loop de canastas atingir o limite de iterações sem
  nunca ter descartado — não só quando `move` é `null`/outro tipo — para
  garantir que a IA **sempre** termina o turno com um discard real, em vez
  de potencialmente não descartar nada.
- Testado em `aiTurn executes a real AI turn and returns control to the
  human player`: dispara `discard(0)` do humano (turno vai pra IA, índice
  1), chama `aiTurn()` e confirma que `currentPlayerIndex` volta a `0` e que
  o log menciona `Bot`.

### 3. Sem `setTimeout` na store

A store não agenda nada; `aiTurn` é uma action pública síncrona na interface
`GameStore`, chamável a qualquer momento por quem consome a store (a Task 9
— componente React — é quem decide o delay/`setTimeout`, fora do escopo
deste Task).

### 4. Game over após `discard()`/`aiTurn()`

Helper interno `appendGameOverLog(game, log)` chamado ao final de `discard()`
e `aiTurn()` (após o `endTurn()`): se `game.isGameOver()`, chama
`game.finish()` e empurra `` `Game over — ${winnerName} venceu.` `` no log.
Não foi adicionado um `isFinished()` dedicado à interface — o plano deixava
essa parte opcional ("ou deixe a UI ler `game.state.status`"), e a interface
`GameStore` fixada na tarefa não lista esse método, então a UI lê
`game.state.status === 'finished'` diretamente.

Testado em `game finishes (status finished) once a player empties their
hand via discard`: esvazia a mão do jogador atual até restar 1 carta,
descarta, e confirma `status === 'finished'`, `winner` definido e log
contendo "game over".

## Outras notas de implementação

- `playCanasta(cardIndices)` mapeia índices → cartas da mão atual e chama
  `game.playCanasta(cards)` uma única vez; a store **não** remove cartas da
  mão manualmente (o motor já faz isso em `Game.playCanasta` — evitando o
  bug do plano de remover em dobro).
- `selectedCardIndices: number[]` (array, não mais índice único), com
  `toggleCardSelection(index)` (adiciona/remove) e `clearSelection()`.
- `resetGame()` zera `game`, `version`, `selectedCardIndices` e `gameLog`.

## Test Results

**Todos os testes passam: 65/65** (56 existentes + 9 novos)

```
Test Suites: 7 passed, 7 total
Tests:       65 passed, 65 total
```

Testes em `tests/store/gameStore.test.ts`:
1. `initGame` cria jogo `'playing'` com 14 cartas para cada jogador
2. `draw` incrementa a mão do jogador atual e `version`
3. `discard` remove carta da mão, avança o turno e incrementa `version`
4. `playCanasta` com `5♥6♥7♥` colocadas artificialmente na mão remove 3
   cartas, adiciona 1 meld e aumenta o score
5. `playCanasta` com combinação inválida não altera mão/score/`version`
   (teste extra, não pedido explicitamente mas cobre o caminho de falha)
6. `aiTurn` executa um turno real de IA e devolve o turno ao humano
7. jogo termina (`status: 'finished'`) quando a mão de um jogador esvazia
   via `discard`
8. `toggleCardSelection`/`clearSelection` (teste extra de cobertura da
   interface)
9. `resetGame` limpa a store de volta ao estado inicial

Suite completa rodada 15x em sequência (`for i in 1..15`) para checar
flakiness derivada de aleatoriedade (shuffle do deck, escolhas da IA
`easy`/random): **0 falhas em 15 execuções**.

## TypeScript Compilation

`npx tsc --noEmit` — PASS (sem erros)

## Deviations from Plan

1. **Re-render**: adicionado `version: number` + contrato documentado (não
   existia no plano original). Ver seção 1.
2. **`aiTurn()`**: reescrito para usar `AIPlayer.playTurn()` real em loop
   limitado, em vez de índice `0` fixo. Ver seção 2. Fallback de discard
   acionado em mais cenários do que o texto literal da tarefa sugeria
   (também em falha de índice/loop esgotado), para garantir que a IA sempre
   descarta algo antes de `endTurn()`.
3. **Sem `setTimeout`**: `aiTurn` é uma action pública síncrona; o
   agendamento fica para a Task 9 (UI).
4. **Game over**: sem método `isFinished()` dedicado — UI lê
   `game.state.status` (opção explicitamente permitida pela tarefa).
5. Teste extra (`playCanasta` com combinação inválida) e teste extra de
   `toggleCardSelection`/`clearSelection` adicionados além da lista mínima
   pedida, para cobrir a interface completa da store.

## Concerns / Follow-ups

- `aiTurn()` faz *type assertion* de `Player` para `AIPlayer` (`(aiPlayer as
  AIPlayer).playTurn(...)`) porque a interface `Player` (Task 3) não
  declara `playTurn` com a assinatura de `GameStateForAI` — mesmo padrão de
  assertion via `unknown`/cast já usado em `game.ts` (Task 5) para
  `addCanasta`/`clone`. Não alterei `player.ts` (fora do escopo). Se algum
  dia o jogador atual no índice 1 não for um `AIPlayer` (ex.: 2 humanos),
  essa assertion quebraria silenciosamente em runtime — hoje não é um risco
  real porque `initGame()` sempre cria `[HumanPlayer, AIPlayer]`.
- `.superpowers/` apareceu como diretório não rastreado no worktree (não
  criado por este Task) — deixado de fora do commit.

## Dependencies

- Consumes: `Game`, `HumanPlayer`, `AIPlayer`, `AIDifficulty`,
  `GameStateForAI`, `Card`, `scoreCard`
- Produces: `useGameStore`, `GameStore` (consumidos pelos componentes React
  das Tasks 7-9)

## Next Step

Pronto para Task 7 (UI base — Layout, Card component) e Task 9 (Gameplay,
que deve agendar `aiTurn()` via `setTimeout` a partir do componente React).
