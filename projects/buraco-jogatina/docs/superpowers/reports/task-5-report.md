# Task 5 Implementation Report — Game (Maestro) & GameState

**Status:** DONE

**Commit Hash:** `010406a`

## Summary

Implementado o Task 5 do plano Buraco Jogatina MVP: `GameState` e a classe
`Game` (maestro), seguindo TDD (testes escritos primeiro e vistos falhando —
`Cannot find module '../../src/engine/game'` — antes da implementacao).

## Files Created

- `src/engine/gameState.ts` — `GameStatus`, `GameState`, `createGameState(players)`
  (identico ao codigo-base do plano, sem alteracoes)
- `src/engine/game.ts` — classe `Game` (~175 LOC)
- `tests/engine/game.test.ts` — 17 testes unitarios

Nenhum arquivo das Tasks 1-4 (`card.ts`, `hand.ts`, `canasta.ts`, `utils.ts`,
`player.ts`, `ai.ts`) foi modificado.

## Implementation Details

### Game

- Construtor valida `2 <= players.length <= 4`, lanca erro caso contrario.
- `setup()` — cria o deck (`createDeck()`), distribui 14 cartas por jogador,
  seta `status = 'playing'`.
- `draw()` — `pop()` do deck; retorna `null` se vazio (baralho esgotado).
- `discard(cardIndex)` — remove da mao do jogador atual e empilha no
  `discardPile`; retorna `false` se o indice for invalido.
- `endTurn()` — avanca `currentPlayerIndex` de forma circular.
- `getCurrentPlayer()`, `getValidMoves()`, `getGameState()` — identicos ao
  plano.
- `finish()` — seta `status = 'finished'` e calcula o vencedor pelo maior
  `score`.
- `clone()` — clona jogadores (via `clone()` de cada `Player` concreto),
  `deck`, `discardPile` e faz deep-copy do `Map` de `melds` (clonando cada
  `Canasta`); o plano original fazia apenas um shallow spread do `melds`
  (mesma referencia de `Map` entre original e clone) — corrigido para
  garantir independencia real entre `game` e `game.clone()`.

### Duas correcoes pedidas explicitamente (desvios do plano)

**a) `isGameOver()` — ambiguidade `status === 'setup'` vs mao vazia**

O teste original do plano criava um jogador com mao vazia e chamava
`isGameOver()` **antes** de `setup()`. Como o codigo do plano tambem retorna
`true` quando `deck.length === 0`, e antes do `setup()` o deck sempre esta
vazio (só é populado por `setup()`), o teste passava — mas por um motivo
ambiguo: nao dava para saber se estava testando "mao vazia" ou "baralho
vazio", e alem disso fazia `isGameOver()` retornar `true` durante o status
`'setup'`, o que nao faz sentido semantico (o jogo nem comecou).

Contrato corrigido, implementado em `src/engine/game.ts`:

```ts
isGameOver(): boolean {
  if (this.state.status !== 'playing') return false
  const someHandEmpty = this.state.players.some(p => p.hand.isEmpty())
  const deckEmpty = this.state.deck.length === 0
  return someHandEmpty || deckEmpty
}
```

Testes ajustados/adicionados em `tests/engine/game.test.ts` (bloco
`describe('isGameOver', ...)`):
1. `returns false before setup even if a player hand is empty` — prova
   diretamente que o cenario ambiguo do plano agora retorna `false`.
2. `returns false right after setup` — baseline com maos e deck cheios.
3. `returns true when a player hand becomes empty during play` — faz
   `setup()`, depois esvazia a mao de `Alice` explicitamente via
   `hand.removeCard(0)` em loop, so entao verifica `true`.
4. `returns true when the deck becomes empty during play` — faz `setup()`,
   drena o deck chamando `draw()` ate retornar `null`, verifica `true`.

**b) `playCanasta(cards)` — nao removia cartas da mao nem somava score**

O `playCanasta` do plano so adicionava a `Canasta` em `state.melds`; a mao do
jogador ficava intacta e o score nunca era creditado (nao chamava
`addCanasta`). Implementacao corrigida:

```ts
playCanasta(cards: Card[]): boolean {
  if (!isValidCanasta(cards)) return false
  let canasta: Canasta
  try { canasta = new Canasta(cards) } catch { return false }

  const player = this.getCurrentPlayer()
  // localiza os indices das cartas na mao (por referencia, com fallback
  // para equals()) — aborta sem efeito colateral se alguma carta nao
  // estiver realmente na mao
  ...
  // remove da mao (indices decrescentes)
  // adiciona a Canasta em state.melds
  ;(player as unknown as { addCanasta(c: Canasta): void }).addCanasta(canasta)
  return true
}
```

`state.melds` guarda apenas a lista de `Canasta[]` por jogador (sem pontuar
por si só); quem credita o score é exclusivamente `player.addCanasta()`
(que ja soma `canasta.getScore()` — codigo existente de `HumanPlayer`/
`AIPlayer`, Task 3/4). Logo nao ha soma duplicada.

Nota tecnica: a interface `Player` (Task 3) nao declara `addCanasta` nem
`clone` (apenas `HumanPlayer`/`AIPlayer` os implementam). Como nao posso
alterar `player.ts`, usei type assertions via `unknown` em `game.ts`
(`(player as unknown as { addCanasta(c: Canasta): void })...` e o analogo
para `clone()` dentro de `Game.clone()`) para manter `npx tsc --noEmit`
limpo sem tocar em arquivos de Tasks anteriores.

Testes cobrindo o comportamento corrigido
(`describe('playCanasta', ...)`):
1. `valid canasta removes the cards from hand, adds to melds, and increases
   score` — mao com `5H,6H,7H` + uma carta extra (`KC`); apos
   `game.playCanasta([5H,6H,7H])`: mao fica só com `KC`
   (`hand.getSize() === 1`), `state.melds.get('Alice')` tem 1 `Canasta` de 3
   cartas, `p1.canastas.length === 1` e `p1.score === melds[0].getScore()`.
2. `returns false and has no side effects for invalid cards` — 2 cartas de
   naipes diferentes (invalido); `playCanasta` retorna `false`, mao continua
   com 2 cartas, `melds.get('Alice')` continua `[]`, `score` continua `0`.

## Test Results

**Todos os testes passam: 51/51** (34 existentes + 17 novos)

```
Test Suites: 6 passed, 6 total
Tests:       51 passed, 51 total
```

Testes em `game.test.ts`:
1. creates game with 2 players
2. throws error with invalid player count
3. setup deals 14 cards to each player
4. draw returns a card from deck
5. discard removes card from hand
6. endTurn cycles to next player
7. getCurrentPlayer returns active player
8. getValidMoves includes draw and a discard move per card in hand
9-12. `isGameOver` (4 testes, ver secao a acima)
13. finish sets status to finished and picks the highest-score player as winner
14. getGameState returns the current state
15. clone produces an independent game with equivalent state
16-17. `playCanasta` (2 testes, ver secao b acima)

## TypeScript Compilation

`npx tsc --noEmit` — **PASS** (sem erros)

## Deviations from Plan

1. `isGameOver()` — contrato restrito a `status === 'playing'` (ver secao a).
   Teste original do plano reescrito/expandido para 4 testes explicitos.
2. `playCanasta()` — agora remove as cartas jogadas da mao do jogador atual e
   chama `player.addCanasta(canasta)` para creditar o score uma unica vez
   (ver secao b). Dois testes novos cobrindo caso valido e invalido.
3. `Game.clone()` — deep-copia o `Map` de `melds` (clonando cada `Canasta`)
   em vez do shallow spread do plano, para que `clone()` seja de fato
   independente do original (testado em "clone produces an independent game
   with equivalent state").
4. Type assertions via `unknown` em `game.ts` para chamar `addCanasta`/
   `clone` em valores tipados como `Player`, ja que essa interface (Task 3)
   nao declara esses metodos — nenhum arquivo de Tasks 1-4 foi alterado.

## Dependencies

- Consumes: `Player`, `PlayerMove`, `Card`, `createDeck`, `Canasta`,
  `isValidCanasta`, `GameState`, `createGameState`
- Produces: `Game`, `GameState`, `GameStatus`, `createGameState` (consumidos
  pela `gameStore` na Task 6)

## Next Step

Pronto para Task 6: Zustand store (`src/store/gameStore.ts`).

---

## Addendum — Regras de pontuação final em `Game.finish()`

**Status:** DONE

**Commit Hash:** `e61c104`

### Summary

`finish()` só marcava `status = 'finished'` e calculava o vencedor pelo
score bruto, sem aplicar as duas regras de pontuação final exigidas pelo
design doc: penalidade de cartas restantes na mão e bônus de fechamento.
Implementado seguindo TDD (5 testes novos escritos primeiro, vistos
falhando, depois a implementação até todos passarem).

### Implementation

`src/engine/game.ts` — apenas `finish()` foi modificado (mais o import de
`scoreCard` de `./utils`):

```ts
finish(): void {
  if (this.state.status === 'finished') return

  this.state.status = 'finished'

  const closer = this.state.players.find(p => p.hand.isEmpty())

  for (const player of this.state.players) {
    const handPenalty = player.hand
      .getCards()
      .reduce((sum, card) => sum + scoreCard(card.rank), 0)
    player.score -= handPenalty
    if (player === closer) {
      player.score += 100
    }
  }

  const winner = this.calculateWinner()
  this.state.winner = winner
}
```

Pontos-chave:
- **Guarda de idempotência** no topo: se `status` já é `'finished'`, retorna
  imediatamente sem tocar em scores — chamar `finish()` duas vezes não
  penaliza/bonifica duas vezes.
- **Penalidade de mão**: soma `scoreCard(card.rank)` de todas as cartas
  restantes na mão de cada jogador e subtrai do `score`.
- **Bônus de fechamento**: `Array.prototype.find` localiza no máximo um
  jogador com `hand.isEmpty()` (o "fechador"); esse jogador recebe +100. Se
  nenhum jogador tiver mão vazia (fim por baralho esgotado — "buraco"),
  `closer` é `undefined` e ninguém recebe o bônus.
- Ordem: penalidades/bônus aplicados **antes** de `calculateWinner()`, então
  o vencedor é sempre decidido pelos scores já ajustados.

### Tests (TDD)

5 testes novos adicionados em `tests/engine/game.test.ts`, dentro de
`describe('finish - hand penalty and closing bonus', ...)`:

1. `subtracts sum of remaining hand card values from score` — mão `A♥+K♥`
   (15+10=25), score 100 → 75 após `finish()`.
2. `player who closed (empty hand) gets +100 bonus, opponent only penalized`
   — fechador com score 100 e mão vazia → 200; adversário com score 50 e
   `9♣` na mão → 41 (sem bônus).
3. `game ends by empty deck with both players holding cards: both penalized,
   nobody gets bonus` — ambos com cartas na mão → ambos penalizados, nenhum
   recebe +100.
4. `finish is idempotent: calling twice does not double-apply
   penalty/bonus` — chama `finish()` duas vezes, score final igual ao da
   primeira chamada.
5. `winner is calculated after adjustments, not raw score` — p1 com score
   100 bruto e 30 pts em mão (`K♥K♥10♥`) termina em 70; p2 com score 90
   bruto e mão vazia termina em 190 (90+100); vencedor é p2, provando que o
   cálculo do vencedor usa os scores já ajustados.

Antes da implementação, os 5 testes novos falhavam (score permanecia
inalterado, ex. esperado 75 recebido 100). Depois da implementação, todos
passaram sem alterar nenhum dos testes pré-existentes.

### Test Results

```
Test Suites: 6 passed, 6 total
Tests:       56 passed, 56 total
```

56 = 51 testes anteriores + 5 novos (1 arquivo de teste, `game.test.ts`,
subiu de 17 para 22 testes).

### TypeScript Compilation

`npx tsc --noEmit` — PASS (sem erros)

### Files Changed

- `src/engine/game.ts` — só `finish()` e o import de `scoreCard`
- `tests/engine/game.test.ts` — 5 testes novos adicionados, nenhum teste
  existente removido ou alterado

### Deviations from Plan

Nenhuma. Implementação segue exatamente a especificação: penalidade de mão
via `scoreCard`, bônus de +100 para o fechador (no máximo um jogador),
ordem penalidade/bônus antes do cálculo do vencedor, e idempotência via
guarda de `status === 'finished'`.
