# Fase 6 — Partida por pontos (até 3000)

## Status

Concluído. `npx tsc --noEmit` limpo, `npm run build` ok, `npx jest` 243/243 verde (233 anteriores + 10 novos, sendo 5 unitários puros de `accumulateMatchRound` e 5 de integração via store).

## Commits

- `d55e80f` — `feat(store): match play up to 3000 points across multiple rounds`
  (worktree `/Users/valmirdebarros/Desktop/proj pessoal/.worktrees/buraco-impl`, branch `buraco-impl`)

## Arquivos alterados

- `src/store/gameStore.ts` — camada de partida
- `src/components/Result/Result.tsx` — placar de partida + botões condicionais
- `src/App.tsx` — `handleNextRound` / `handleNewMatch`
- `tests/store/matchScore.test.ts` (novo) — TDD da camada de partida
- `src/components/Gameplay/Gameplay.tsx` — **não precisou de alteração** (já dispara `onGameEnd()` sempre que `status === 'finished'`, o que cobre tanto fim de rodada quanto fim de partida)

## Forma final do estado de partida no store

```ts
export const MATCH_TARGET = 3000

interface GameStore {
  // ...campos existentes...
  matchScores: Record<'A' | 'B', number>
  matchCanastras: Record<'A' | 'B', { clean: number; dirty: number }>
  round: number                 // 1-based, rodada atual da partida
  matchWinner?: 'A' | 'B'       // definido só quando a partida termina
  matchConfig?: {
    playerName: string
    aiDifficulty: AIDifficulty
    names?: { partner?: string; opponent1?: string; opponent2?: string }
  }
  roundFinalized: boolean       // guarda contra dupla contagem da mesma rodada

  startNextRound: () => void
}
```

## Decisões de design

1. **Função pura `accumulateMatchRound(matchScores, matchCanastras, teams)`** foi extraída e exportada de `gameStore.ts` especificamente para permitir testar de forma determinística os casos de fronteira (cruzar 3000, empate em 3000 → Time A) sem depender da pontuação real calculada pelo engine (`Game.finish()` recalcula `team.score` a partir de mãos/melds reais, então não dá para forçar um valor exato de rodada num teste de integração). A store usa essa mesma função internamente.

2. **`roundFinalized`** é setado exatamente uma vez por rodada, dentro de `finalizeRoundIfNeeded()` (helper interno fechado sobre `get`/`set`, chamado logo após `checkGameOver(game, log)` retornar `true` em `discard`, `playCanasta`, `extendMeld` e `aiTurn`). Isso protege contra dupla contagem mesmo que uma ação seja disparada novamente após o fim da rodada — coberto pelo teste "does not double-accumulate if store actions run again after the round is finished".

3. **Mensagens de log**: `checkGameOver` continua logando "Fim de jogo — Time X venceu!" (mantendo os testes antigos que checavam essa string). `finalizeRoundIfNeeded` adiciona uma linha extra: "Fim da rodada N." (partida em andamento) ou "Fim da partida — Time X venceu!" (partida encerrada).

4. **`startNextRound()`** é no-op se `matchWinner` já estiver definido ou se não houver `matchConfig` salvo. Caso contrário, recria os 4 jogadores (mesmos nomes/dificuldade) via `matchConfig`, roda `setup()`, incrementa `round`, zera `selectedCardIndices` e `roundFinalized`, e mantém `matchScores`/`matchCanastras`.

5. **Result.tsx**: cabeçalho mostra "Fim da rodada N" durante a partida, ou "🎉 Vocês venceram a partida!" / "A dupla adversária venceu a partida" quando `matchWinner` está definido. Cada card de time ganhou uma seção extra abaixo do detalhamento da rodada: "Total da partida: X / 3000" com barra de progresso, e "canastras: X limpas · Y sujas" (acumulado de `matchCanastras`). O botão primário alterna entre "Próxima Rodada" (chama `onNextRound` → `startNextRound()`) e "Nova Partida" (chama `onNewMatch` → `initGame()` com a config salva em `App.tsx`), conforme `matchWinner`.

## Testes (243/243)

Novo arquivo `tests/store/matchScore.test.ts` (10 testes):
- 5 testes puros de `accumulateMatchRound`: soma simples, contagem de canastras limpas/sujas (ignorando melds < 7 cartas), cruzar `MATCH_TARGET`, empate em `MATCH_TARGET` → Time A, e não definir vencedor quando ambos ficam abaixo do alvo.
- 5 testes de integração via store: `initGame` zera o estado de partida; finalizar uma rodada acumula `matchScores`/`matchCanastras` uma única vez; ações repetidas após o fim da rodada não duplicam a contagem; `startNextRound` recria a rodada mantendo o acumulado e incrementando `round`; cruzar 3000 define `matchWinner` e torna `startNextRound` um no-op (mesma referência de `game`, mesmo `round`).

Suíte completa: `Test Suites: 10 passed, 10 total` / `Tests: 243 passed, 243 total`.
