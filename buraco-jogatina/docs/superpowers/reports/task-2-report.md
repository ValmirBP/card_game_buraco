# Task 2 Report — Motor de Jogo (Card, Hand, Canasta)

**Status:** DONE ✓

**Date:** 2026-08-04

---

## Summary

Task 2 foi completada com sucesso. Implementei as classes fundamentais do motor de jogo (Card, Hand, Canasta) + utilitários, com 10 testes Jest passando.

---

## Files Created

### Engine Classes
- **`src/engine/card.ts`** — Card class + createDeck()
  - Tipos: Suit ('hearts'|'diamonds'|'clubs'|'spades'), Rank ('A'|'2'...'K')
  - Card: suit, rank, isWild (readonly)
  - Métodos: toString(), equals()
  - createDeck(): 2 decks padrão + 4 curingas = 108 cartas embaralhadas

- **`src/engine/hand.ts`** — Hand class
  - addCard(card), removeCard(index), getCards(), getSize()
  - isEmpty(), clone() para imutabilidade

- **`src/engine/canasta.ts`** — Canasta class
  - Construtor valida: 3+ cartas, consecutivas, mesmo naipe
  - isClean: true se sem wilds, false se tem wilds
  - points: 500 (limpa), 300 (suja)
  - getScore(): valor das cartas + bônus canasta

- **`src/engine/utils.ts`** — Funções auxiliares
  - scoreCard(rank): pontuação por carta
  - rankToNumber(rank): conversão para ordenação
  - isConsecutive(r1, r2): verifica consecutividade
  - isValidCanasta(cards[]): validação completa
  - canastaPoints(isClean): bônus de canasta

### Tests
- **`tests/engine/card.test.ts`** — 5 testes
  - ✓ Card creation com suit/rank/isWild
  - ✓ Card.toString() format
  - ✓ Card.equals() comparação
  - ✓ createDeck() gera 108 cartas
  - ✓ Deck tem 52 valores únicos (2 decks)

- **`tests/engine/canasta.test.ts`** — 5 testes
  - ✓ Canasta válida com 3 cartas consecutivas
  - ✓ Canasta clean = 500 pts
  - ✓ Canasta dirty (com wild) = 300 pts
  - ✓ Rejeita < 3 cartas
  - ✓ Rejeita cartas não-consecutivas
  - ✓ Rejeita suits diferentes

---

## Test Results

```
Test Suites: 2 passed, 2 total
Tests:       10 passed, 10 total
Snapshots:   0 total
```

**All tests passing ✓**

---

## Spec Compliance

| Requisito | Status |
|-----------|--------|
| Card { suit, rank, isWild } | ✓ Implementado |
| createDeck() = 108 cartas | ✓ Verificado |
| Canasta validação (3+, consecutive, same suit) | ✓ Implementado |
| Clean canasta = 500 pts | ✓ Implementado |
| Dirty canasta = 300 pts | ✓ Implementado |
| Hand { addCard, removeCard, getCards } | ✓ Implementado |
| Jest testes | ✓ 10/10 passing |

---

## Key Implementation Details

### Deck Generation
- Loop 2x para 2 decks (4 suits × 13 ranks)
- Adiciona 4 curingas (representados como Card('hearts', '2', true))
- Fisher-Yates shuffle no final

### Canasta Validation
- Mínimo 3 cartas
- Todas as cartas reais (non-wild) devem ser do mesmo naipe
- Cartas reais devem ser consecutivas (aceita wilds intercalados)
- Lógica: filtra reais vs wilds, ordena reais, verifica consecutividade

### Scoring
- Cada carta tem pontuação individual (A=15, K/Q/J=10, 2=20, outros=face value)
- Canasta tem bônus base: clean=500, dirty=300
- getScore() = soma cartas + bônus

---

## Improvements vs. Plan

- Ajustei teste de deck: esperava 104 cartas únicas no Set, mas 2 decks geram apenas 52 valores (deduplication natural)
- Corrigido teste para validar: 104 cartas totais não-wild, 52 valores únicos

---

## Next Steps (Task 3)

Próxima tarefa: Implementar Player interface + HumanPlayer class
- Player { name, hand, score, canastas, playTurn() }
- HumanPlayer extends Player com addCanasta(), clone()

---

## Commit Hash

```
d270128 feat: implement Card, Hand, Canasta engine classes with Jest tests
```

---

## Bugfix Addendum (2026-08-04) — isValidCanasta wild-card handling

**Status:** DONE ✓
**Worktree:** `/Users/valmirdebarros/Desktop/proj pessoal/.worktrees/buraco-impl`
**Commit:** `d70d5f0` — `fix: isValidCanasta handles wild gap-filling and rejects multi-wild canastas`

### Bugs Fixed

1. **(Critical)** `isValidCanasta` never let wild cards fill gaps in the
   sequence — it only checked that the *real* cards were consecutive among
   themselves. `[5♥, 7♥, wild]` incorrectly returned `false` instead of
   `true` (a dirty 5-6-7 canasta with the wild standing in for the 6).
2. **(Important)** With exactly 1 real card + 2 wilds, the consecutiveness
   loop never ran (loop needs 2+ real cards), so the function returned
   `true` with zero validation.
3. **(Minor)** `Canasta.cardValue` in `src/engine/canasta.ts` duplicated the
   scoring logic already in `scoreCard()` (`src/engine/utils.ts`). Removed
   the private method; `getScore()` now calls `scoreCard(card.rank)`
   directly.

### New Rule Implemented (`src/engine/utils.ts::isValidCanasta`)

1. Minimum 3 cards.
2. At most 1 wild card per canasta (standard Buraco creation rule) — so
   1 real + 2 wilds is now correctly rejected.
3. At least 2 real (non-wild) cards.
4. All real cards must share the same suit.
5. No duplicate ranks among the real cards.
6. Real cards, sorted by rank, must have total rank gaps ≤ number of wilds
   available (a wild can fill a 1-card internal gap, or simply extend a
   run with 0 internal gaps).

### TDD Process Followed

1. Added `tests/engine/utils.test.ts` with all required true/false cases
   from the spec (clean run, gap-filling wild, tip-extending wild,
   multi-gap wild fill, <3 cards, 1 real + 2 wilds, gap larger than
   available wilds, mixed suits, duplicate ranks, 2 wilds present).
2. Ran `npm test` against the unfixed code first — **4 of the 10 new
   tests failed** exactly as predicted by the bug report (gap-filling
   cases returned `false`, the 1-real+2-wilds case and the 2-wilds
   case returned `true`), confirming the bugs before any fix was made.
3. Rewrote `isValidCanasta` per the rule above.
4. Fixed `Canasta.cardValue` duplication (uses `scoreCard` from
   `utils.ts` now).
5. Re-ran `npm test` — all tests green, no old assertions needed
   updating (the existing "marks canasta as dirty if has wild cards"
   test — 2 reals + 1 wild — was already consistent with the new rule).

### Final Test Output

```
> buraco-jogo@0.1.0 test
> jest

Test Suites: 3 passed, 3 total
Tests:       20 passed, 20 total
Snapshots:   0 total
Time:        0.543 s, estimated 1 s
Ran all test suites.
```

10 pre-existing tests (card.test.ts + canasta.test.ts) + 10 new tests
(utils.test.ts) = 20/20 passing. `npx tsc --noEmit` also compiles clean.

### Files Changed

- `src/engine/utils.ts` — rewrote `isValidCanasta`
- `src/engine/canasta.ts` — removed `cardValue`, uses `scoreCard` import
- `tests/engine/utils.test.ts` — new file, 10 tests

Note: `package.json` / `package-lock.json` had pre-existing unstaged
changes in the worktree unrelated to this task; they were left out of
the commit.

**Status:** DONE ✓
