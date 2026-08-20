# Fase 2 — Store Zustand — Migração para o motor de 4 jogadores/2 duplas/morto — Relatório

**Worktree:** `.worktrees/buraco-impl` (branch `buraco-impl`). Só `src/store/gameStore.ts` e `tests/store/gameStore.test.ts` foram tocados, conforme instruído.

## Status

- `npx jest tests/store tests/engine`: **116 passed / 116 total** (7 suites).
- `npx jest` (suíte inteira, incluindo componentes): **120 passed / 120 total** (8 suites).
- `npx tsc --noEmit 2>&1 | grep "src/store"`: **vazio** (0 erros em `src/store/**`).
- Erros de `tsc` remanescentes (fora de escopo, pré-existentes, todos em `src/components/**`, API antiga `GameState.melds`/`winner`/`Gameplay.draw`): `GameBoard.tsx` (5 erros) e `Result.tsx` (1 erro). Não foram tocados.

## Commit

`ac77519` — `feat(store): migrate to 4-player teams engine (draw/take-discard/extend/morto/team-scoring)`

## Assinatura final da `GameStore`

```ts
export interface GameStore {
  game: Game | null
  version: number
  selectedCardIndices: number[]
  gameLog: string[]

  initGame: (playerName: string, aiDifficulty: AIDifficulty) => void
  drawFromDeck: () => void
  takeDiscardPile: () => void
  discard: (cardIndex: number) => void
  playCanasta: (cardIndices: number[]) => void
  extendMeld: (meldIndex: number, cardIndices: number[]) => void
  aiTurn: () => void
  toggleCardSelection: (index: number) => void
  clearSelection: () => void
  resetGame: () => void
}
```

`initGame` monta 4 jogadores: assento 0 = `HumanPlayer(playerName)`, assento 1 = `AIPlayer('Adversário 1', aiDifficulty)`, assento 2 = `AIPlayer('Parceiro', aiDifficulty)`, assento 3 = `AIPlayer('Adversário 2', aiDifficulty)`. Time A = seats `[0,2]` (humano + parceiro), Time B = seats `[1,3]` (os dois adversários) — bate com o mapeamento fixo `teamIdOfSeat` do motor (par=A, ímpar=B). `new Game([...]).setup()` e log inicial em PT-BR.

A reatividade por `version` foi mantida: toda action que muta `game` incrementa `version`; `toggleCardSelection`/`clearSelection` não tocam `version` (são só seleção de UI local, igual antes).

## Como o morto foi tratado

O motor (`Game.discard`/`playCanasta`/`extendMeld`) já chama `maybeAutoPickUpMorto()` internamente sempre que a mão do jogador atual esvazia após essas três ações — ou seja, o **pickup em si é automático no motor**, a store não precisa (nem deve) chamar `game.pickUpMorto()` manualmente nesse fluxo. O trabalho da store é:

1. Capturar `hadMorto = game.getTeamOfCurrentPlayer().hasTakenMorto` **antes** de chamar a ação do motor.
2. Depois da ação, comparar com o valor atual via o helper `checkMortoTransition(game, player, log, hadMorto)`: se virou `true` agora e antes era `false`, loga `"${player.name} pegou o morto!"`.
3. Em seguida, `checkGameOver(game, log)` chama `game.isGameOver()` — que só é `true` na **segunda** vez que a mão zera com o time já tendo morto (a primeira vez só dispara o pickup, o motor já distingue isso) — e, se for `true`, chama `game.finish()` e loga `"Fim de jogo — Time ${winnerTeam} venceu!"`.

Esses dois helpers (`checkMortoTransition`, `checkGameOver`) são usados de forma idêntica em `discard`, `playCanasta`, `extendMeld` e dentro do loop de `aiTurn`, para que qualquer ponto onde a mão possa esvaziar (baixar a última canastra, estender com a última carta, ou descartar a última) dispare a mesma checagem.

`discard` só chama `game.endTurn()` se o jogo **não** tiver terminado nessa ação (evita avançar `currentPlayerIndex` depois que a rodada já fechou). `playCanasta`/`extendMeld` nunca chamam `endTurn` (o jogador pode baixar/estender várias vezes antes de descartar).

## Como o loop de IA (3 assentos) foi tratado

`aiTurn()` roda o turno completo de **um** assento por chamada, e é no-op se o assento atual não for uma instância de `AIPlayer` (guarda `if (!(player instanceof AIPlayer)) return`, sem incrementar `version`) — a UI decide quando chamar (ela chama repetidamente enquanto `currentPlayerIndex !== 0`, cobrindo os assentos 1, 2 e 3 em sequência).

Fluxo dentro de uma chamada:

1. **Compra**: chama `player.playTurn(buildAIState(game))` uma vez para decidir a fase de compra. Se vier `take_discard`, tenta `game.takeDiscardPile()` (com fallback para `drawFromDeck()` se a pilha estiver vazia); caso contrário, `drawFromDeck()` direto. (Nota: as estratégias atuais de `AIPlayer` em `ai.ts` nunca retornam `take_discard` — `getValidMoves` não o inclui — então esse ramo é defensivo/contratual, não exercitado pelas heurísticas de hoje.)
2. **Melds**: loop de até `MAX_AI_MELD_ACTIONS_PER_TURN = 12` iterações chamando `player.playTurn(...)` de novo a cada volta (o `GameStateForAI` é reconstruído a cada iteração via `buildAIState`, refletindo o estado atualizado). Enquanto vier `play_canasta` (chama `game.playCanasta`) ou `extend_meld` (chama `game.extendMeld`, usando `move.meldIndex`/`move.cards`), continua; após cada uma dessas, roda `checkMortoTransition` + `checkGameOver` e interrompe o loop (`gameEnded = true`) se a rodada acabou. Se o motor rejeitar a jogada proposta (`false`), interrompe o loop (evita loop infinito numa jogada inválida).
3. **Descarte**: se o `playTurn` da última iteração veio como `discard`, tenta `game.discard(cardIndex)`; se por qualquer motivo nada foi descartado ainda (jogada não descartável, índice inválido, loop estourou o limite), cai no fallback `discardLowestValueCard` (descarta a carta de menor `scoreCard()` na mão).
4. Só chama `game.endTurn()` se `gameEnded` continuar `false` no fim.

`GameStateForAI` passado para `player.playTurn` usa o campo `teams` (não mais `melds: Map`), batendo com a nova API do motor.

## Concerns

- **`take_discard` da IA nunca é exercitado por teste real de heurística** (só defensivamente coberto no código) porque `AIPlayer.getValidMoves()` em `ai.ts` não gera esse move hoje. Se uma fase futura adicionar essa heurística à IA, o código da store já está pronto para ela, mas vale um teste dedicado nessa hora.
- **`extendMeld` na store não valida se `meldIndex` pertence ao time do jogador atual antes de chamar o motor** — delega inteiramente a validação para `Game.extendMeld` (que já falha silenciosamente com `false` se o índice não existir). Isso é intencional (a mesma filosofia de "motor valida, store só orquestra" usada em `playCanasta`/`discard`), mas a UI vai precisar filtrar/mostrar só os melds do time do jogador atual antes de deixar o humano escolher um `meldIndex`.
- **Mensagens de log da dupla vencedora usam o `TeamId` cru** (`"Fim de jogo — Time A venceu!"`), não o nome de exibição da dupla (ex. "sua dupla"). Ficou assim para bater literalmente com o texto pedido no spec ("Fim de jogo — Time X venceu"); se a UI quiser humanizar (ex. "Vocês venceram!"), pode mapear `winnerTeam` para os nomes dos assentos usando `team.seats` e `game.state.players`.
- Os 11 erros de `tsc` fora de `src/store` mencionados no relatório da Fase 2 (engine) já caíram para 6, todos agora só em `src/components/**` (a store deixou de contribuir com erros) — ficam para a fase de UI, como planejado.
