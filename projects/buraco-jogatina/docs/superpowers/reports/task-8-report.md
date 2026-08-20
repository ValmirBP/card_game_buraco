# Task 8 Implementation Report — Menu Component

**Status:** DONE

**Commit Hash:** `6a8f5e1`

## Summary

Implementado o Task 8 do plano Buraco Jogatina MVP: três componentes em
`src/components/Menu/` — `Menu.tsx`, `DifficultySelector.tsx` e
`RulesModal.tsx` — todos com textos em português, acessíveis
(botões com `min-h-[44px]`, modais com `role="dialog"`/`aria-modal`) e
integrados ao `useGameStore` existente. `App.tsx` **não foi tocado**
(integração de telas fica para task posterior, conforme instrução).

## Files Created

- `src/components/Menu/Menu.tsx` (default export) — props
  `{ onStart: () => void }`. Título "Buraco" / "Jogatina", input de nome do
  jogador (default `'Você'`, com fallback pra `'Você'` se o usuário limpar o
  campo), botão "Jogar vs IA" (abre `DifficultySelector`) e botão "Regras"
  (abre `RulesModal`). Ao escolher dificuldade, chama
  `useGameStore.getState().initGame(playerName, difficulty)` e em seguida
  `onStart()`.
- `src/components/Menu/DifficultySelector.tsx` (default export) — props
  `{ onSelect: (d: AIDifficulty) => void, onCancel: () => void }`. Modal
  fixed/overlay com framer-motion (fade no overlay + fade+scale no card),
  3 opções (Fácil/Médio/Difícil) com descrições em PT, botão "Cancelar".
- `src/components/Menu/RulesModal.tsx` (default export) — props
  `{ onClose: () => void }`. Modal com as regras do Buraco em PT: objetivo,
  preparação (14 cartas), turno (comprar → formar canastras → descartar),
  pontuação (canasta limpa 500 / suja 300 / bônus de fechamento +100 /
  cartas na mão contam negativo). Área de conteúdo com `overflow-y-auto` e
  `max-h-[80vh]` no card pra ficar scrollável em telas pequenas. Botão
  "Fechar".
- `tests/components/Menu/Menu.test.tsx` (opcional, incluído) — smoke tests
  com `@testing-library/react`: renderiza título/botões, clique em "Jogar vs
  IA" mostra as 3 dificuldades, selecionar uma dificuldade chama `initGame`
  (verificado via `useGameStore.getState().game`) e `onStart`, clique em
  "Regras" abre e fecha o modal.

## Integração com dependências existentes

- `useGameStore.getState().initGame(playerName, difficulty)` — assinatura
  confirmada lendo `src/store/gameStore.ts` antes de escrever o código;
  usada exatamente como no plano.
- `AIDifficulty` importado de `../../engine/ai` (`'easy' | 'medium' | 'hard'`).
- Cores `bg-card-gold`, `text-card-gold`, `bg-card-green` — reaproveitadas do
  tema `@theme` já definido em `src/styles/index.css` (Task 7); confirmado
  que resolvem corretamente pois já validado no build da Task 7.
- Nenhum arquivo de engine/store/teste pré-existente foi modificado.

## TypeScript Compilation

`npx tsc --noEmit` — PASS (sem erros)

## Build

`npm run build` — PASS

```
vite v8.2.0 building client environment for production...
✓ 17 modules transformed.
dist/index.html                   0.66 kB │ gzip:  0.39 kB
dist/assets/index-CFplTIqq.css    3.74 kB │ gzip:  1.17 kB
dist/assets/index-CAROOKDy.js   191.27 kB │ gzip: 60.38 kB
✓ built in 147ms
```

## Test Results

Suite completa (existente + novo smoke test opcional do Menu), todos
verdes:

```
Test Suites: 8 passed, 8 total
Tests:       69 passed, 69 total
```

(65 testes pré-existentes intactos + 4 novos testes de `Menu.tsx`.)

## Deviations from Plan

1. Textos de UI traduzidos para português (o snippet original do plano
   estava em inglês — "Play vs IA", "Rules", "Enter your name" etc.),
   conforme instrução explícita desta task ("Textos em português").
2. Placeholder do input mudado para "Seu nome" e valor default para
   `'Você'` (em vez de `'You'`), com fallback de string vazia para
   `'Você'` ao confirmar a dificuldade — pequena robustez extra não pedida
   explicitamente mas alinhada ao objetivo "default You/Você".
3. Adicionados atributos de acessibilidade além do mínimo pedido (44px):
   `role="dialog"`, `aria-modal="true"`, `aria-labelledby` nos dois modais,
   e `label` com `sr-only` associado ao input de nome.
4. Smoke test opcional foi criado (a task marcava como opcional) — arquivo
   novo em `tests/components/Menu/Menu.test.tsx`, sem alterar nenhum teste
   existente.
5. `App.tsx` não foi modificado — a task explicitamente disse "Não precisa
   ligar no App.tsx ainda".

## Concerns

- Nenhuma pendência bloqueante. `tsc --noEmit` e `npm run build` limpos,
  69/69 testes verdes (65 pré-existentes + 4 novos).
- Diretório solto `.superpowers/` apareceu como untracked no worktree
  (não criado por este trabalho, provavelmente artefato de tooling da
  skill) — não foi adicionado ao commit, só os 4 arquivos relevantes desta
  task foram staged (`git add` explícito por caminho, sem `-A`/`.`).
- `DifficultySelector` e `RulesModal` não fecham ao clicar fora do modal
  nem com tecla `Esc` — só via botão dedicado ("Cancelar"/"Fechar"), que é
  exatamente o que a task pediu ("modais fecham no botão"). Se desejado
  fechar por overlay/Esc, é um enhancement pra task futura.

## Dependencies

- Consumes: `useGameStore` (`src/store/gameStore.ts`), `AIDifficulty`
  (`src/engine/ai.ts`).
- Produces: `Menu`, `DifficultySelector`, `RulesModal` — prontos para serem
  importados por `App.tsx` numa task futura de integração de telas
  (`screen === 'menu' && <Menu onStart={...} />`).

## Next Step

Pronto para a task de integração de telas em `App.tsx` (roteamento
menu/gameplay/result) e para a Task 9 (Gameplay component).
