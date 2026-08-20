# Task 4 Implementation Report — AIPlayer (3 Niveis)

**Status:** DONE

**Commit Hash:** `d1d50b4`

## Summary

Implementado o Task 4 do plano Buraco Jogatina MVP: `AIPlayer` com 3 estrategias
(easy/medium/hard) implementando a interface `Player`, seguindo TDD (testes
escritos e vistos falhando antes da implementacao).

## Files Created

- `src/engine/ai.ts` — `AIDifficulty`, `GameStateForAI`, classe `AIPlayer` (~200 LOC)
- `tests/engine/ai.test.ts` — 11 testes unitarios cobrindo os 3 niveis de IA

## Implementation Details

### AIPlayer

- Implementa `Player` (`name`, `hand`, `score`, `canastas`, `playTurn`)
- Constructor: `(name, difficulty = 'medium', initialCards = [])`
- `playTurn(gameState: GameStateForAI): PlayerMove` — despacha para
  `decideEasy` / `decideMedium` / `decideHard`
- `addCanasta(canasta)` — adiciona meld e soma `getScore()` ao score
- `clone()` — copia profunda (hand, score, canastas, dificuldade e memoria de
  descartes)
- `getDiscardedCards(): Set<string>` — novo metodo publico (nao estava no
  plano) para expor a memoria de descartes da IA hard e permitir testa-la sem
  quebrar encapsulamento

### Estrategias

- **Easy**: escolhe aleatoriamente entre todos os movimentos validos
  (`draw`, `discard`, `play_canasta`) via `Math.random()`.
- **Medium**: prioriza `play_canasta` (aleatorio entre as canastas
  disponiveis); se nao houver, tenta descartar uma carta "segura" (rank
  `2`-`5`); senao descarta aleatoriamente entre as opcoes.
- **Hard**: deterministico (sem `Math.random`). Atualiza uma `Set` de cartas
  descartadas (memoria) a cada turno; prioriza a maior canasta disponivel
  (ordenada por tamanho); se nao houver canasta, ordena os descartes
  candidatos priorizando cartas "seguras" e de rank mais baixo, escolhendo
  sempre o primeiro da ordenacao (garante mesmo resultado para o mesmo
  estado).

### Deteccao real de canastas em `getValidMoves` / `findCanastaMoves`

O plano deixava esse ponto como TODO ("Simplificado... Implementacao completa
seria gerar todas as combinacoes"). Implementei a deteccao real:

1. Agrupa as cartas nao-curinga da mao por naipe.
2. Dentro de cada naipe, remove ranks duplicados (mantendo a primeira
   ocorrencia) e ordena por `rankToNumber`.
3. Testa todas as janelas contiguas dessa lista ordenada com 3+ cartas,
   chamando `isValidCanasta` diretamente — se invalida por causa de 1
   lacuna, tenta novamente incluindo 1 curinga da mao (se houver).
4. Testa tambem pares de 2 cartas reais + 1 curinga (cobre o caso de uma
   canasta de 3 cartas formada por 2 reais e 1 curinga).
5. Cada janela valida vira um move `{ type: 'play_canasta', cards }`.

Isso e uma busca simples (nao exaustiva em todas as combinacoes possiveis —
por exemplo nao tenta remover cartas do meio de uma janela para reduzir
lacunas), mas **encontra canastas obvias** como `5H 6H 7H` juntas na mao,
que era o criterio pedido. A validacao final sempre passa por
`isValidCanasta` (utils.ts existente), entao nenhum move invalido pode ser
gerado mesmo que a heuristica de busca seja simples.

### Teste que comprova a deteccao (Passo 4 do pedido)

`tests/engine/ai.test.ts` — `'medium AI with 5H6H7H plus unrelated cards
returns play_canasta with exactly those 3 cards'`: mao com
`KC, 5H, 9D, 6H, 3S, 7H` (cartas de naipes diferentes misturadas para
garantir que a busca nao acerte por acaso); a IA medium retorna
`{ type: 'play_canasta', cards: [5H, 6H, 7H] }` (ordenado e comparado por
`toString()`).

## Test Results

**Todos os testes passam: 34/34**
- 11 novos testes em `tests/engine/ai.test.ts`
- 23 testes existentes (Card, Hand, Canasta, Utils, Player) continuam
  passando — nenhuma regressao
- Testes com aleatoriedade (easy AI) rodados 5x manualmente sem flakiness

Testes cobertos em `ai.test.ts`:
1. Criacao da IA com nivel de dificuldade
2. Easy AI retorna move valido
3. Easy AI nunca retorna `discard` com `cardIndex` fora do range da mao
4. Medium AI prefere jogar canasta quando disponivel
5. Medium AI com `5H6H7H` + cartas nao relacionadas retorna exatamente essas
   3 cartas em `play_canasta`
6. Medium AI descarta carta segura quando nao ha canasta
7. Hard AI e deterministico para o mesmo `gameState` (mesmo `type` e
   `cardIndex` em 2 chamadas)
8. Hard AI joga canasta quando disponivel
9. Hard AI rastreia cartas descartadas (memoria) entre turnos
10. `addCanasta` incrementa `canastas` e `score`
11. `clone()` copia hand, score, canastas e dificuldade

## TypeScript Compilation

`npx tsc --noEmit` — **PASS** (sem erros)

## Deviations from Plan

- Adicionado `getDiscardedCards(): Set<string>` a `AIPlayer` (nao existe no
  codigo-base do plano) para permitir testar a memoria de descartes da IA
  hard sem expor o campo privado diretamente. Nao altera nenhum arquivo das
  Tasks 1-3.
- `getValidMoves` foi tornado publico (era privado no plano) para
  simplificar testes futuros de `Game`/`Store`; nao muda a assinatura nem o
  comportamento externo do `playTurn`.
- Nenhum arquivo de Tasks 1-3 (`card.ts`, `hand.ts`, `canasta.ts`,
  `utils.ts`, `player.ts`) foi modificado.

## Dependencies

- Consumes: `Player`, `PlayerMove`, `Card`, `Hand`, `Canasta`, `isValidCanasta`,
  `rankToNumber`
- Produces: `AIPlayer`, `AIDifficulty`, `GameStateForAI` (consumidos por
  `Game` e `gameStore` nas Tasks 5/6)

## Next Step

Pronto para Task 5: `Game` (maestro) e `GameState`.
