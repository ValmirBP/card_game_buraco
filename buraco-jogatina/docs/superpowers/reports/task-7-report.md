# Task 7 Implementation Report — UI Base (Layout Responsivo e Componentes Atômicos)

**Status:** DONE

**Commit Hash:** `c877348`

## Summary

Implementado o Task 7 do plano Buraco Jogatina MVP: `src/components/Layout.tsx`
e `src/components/Card.tsx` (`CardComponent`), tema custom do Tailwind CSS v4
via diretiva `@theme` em `src/styles/index.css`, e `src/App.tsx` atualizado
para renderizar `<Layout>` com um placeholder simples ("Buraco Jogatina"),
sem importar Menu/Gameplay/Result (que ainda não existem — Tasks 8/9).

## Files Created

- `src/components/Layout.tsx` — container full-screen, gradiente
  `from-card-green to-green-900`, `max-w-7xl mx-auto`, padding responsivo.
- `src/components/Card.tsx` — exporta `CardComponent` (props `card`,
  `onClick?`, `selected?`, `index?`), com framer-motion (`whileHover`,
  `whileTap`, entrada animada com `delay: index * 0.05`).

## Files Modified

- `src/styles/index.css` — adicionado bloco `@theme` com
  `--color-card-green: #0d3b1f` e `--color-card-gold: #d4af37` (mantido o
  resto do arquivo intacto).
- `src/App.tsx` — agora renderiza `<Layout>` com um título placeholder
  ("Buraco Jogatina") em vez do `<div>` scaffold anterior. Nenhum import de
  Menu/Gameplay/Result/`useGameStore` foi adicionado (evitando quebrar o
  build, conforme instruído).

## Tailwind v4 — Cores Custom via `@theme`

O projeto já tinha um `tailwind.config.js` na raiz com
`theme.extend.colors` (`card-green`, `card-gold`), mas **esse arquivo é
ignorado pelo Tailwind v4** por padrão quando se usa `@tailwindcss/postcss`
(config CSS-first) — não há diretiva `@config` em `src/styles/index.css`
apontando pra ele. Por isso as classes `bg-card-green`/`text-card-gold`/etc
não aplicavam antes desta task, apesar do config JS existir.

Corrigido adicionando o bloco `@theme` diretamente no CSS (conforme
instruído na tarefa):

```css
@theme {
  --color-card-green: #0d3b1f;
  --color-card-gold: #d4af37;
}
```

**Verificação:** rodei `npm run build` e inspecionei o CSS gerado em
`dist/assets/index-*.css`:

```
--color-card-green:#0d3b1f
--color-card-gold:#d4af37
.from-card-green{--tw-gradient-from:var(--color-card-green);...}
.border-card-gold{border-color:var(--color-card-gold)}
.text-card-gold{color:var(--color-card-gold)}
```

Confirmado que as classes usadas em `Layout.tsx` (`from-card-green`),
`Card.tsx` (`border-card-gold` no estado `selected`) e `App.tsx`
(`text-card-gold`) resolvem corretamente para os valores hex do tema. Não
consegui abrir o `npm run dev` no Browser pane porque a ferramenta de
preview exige um `.claude/launch.json` na raiz do repo principal (fora do
worktree, que estava fora do escopo "trabalhe SOMENTE aqui") — a
verificação via CSS gerado foi considerada suficiente e conclusiva.

## Card Component — Curinga (`isWild`)

Quando `card.isWild === true`, o componente não mostra rank/naipe normal;
mostra visualmente como curinga: ícones `★` acima/abaixo do texto
`JOKER`, tudo em roxo (`text-purple-600`), com fundo levemente diferenciado
(`bg-purple-50`) para destacar do resto das cartas na mão.

## TypeScript Compilation

`npx tsc --noEmit` — PASS (sem erros)

## Build

`npm run build` — PASS

```
vite v8.2.0 building client environment for production...
✓ 17 modules transformed.
dist/index.html                   0.66 kB │ gzip:  0.39 kB
dist/assets/index-CZtLKWa6.css    2.98 kB │ gzip:  0.98 kB
dist/assets/index-DQh9ui6h.js   191.27 kB │ gzip: 60.38 kB
✓ built in 179ms
```

## Test Results

Suite existente inalterada — nenhum novo teste unitário foi adicionado
(não obrigatório para componentes visuais conforme a tarefa; optei por não
adicionar o smoke test opcional para manter o escopo da task restrito ao
pedido mínimo).

```
Test Suites: 7 passed, 7 total
Tests:       65 passed, 65 total
```

## Deviations from Plan

1. O plano original (Step 3 da task) instruía atualizar
   `src/styles/tailwind.config.js` — esse arquivo não existe no projeto
   (o config real está em `tailwind.config.js` na raiz, criado na Task 1).
   Segui a instrução mais específica e correta para Tailwind v4 dada no
   prompt desta task: definir as cores via `@theme` em
   `src/styles/index.css`, que é o que efetivamente faz as classes
   funcionarem. O `tailwind.config.js` da raiz foi deixado como está (não é
   lido pelo pipeline v4 atual, mas removê-lo estava fora do escopo pedido).
2. `App.tsx` não segue literalmente o snippet do plano original (Step 4, que
   já importava `Menu`/`Gameplay`/`Result`/`useGameStore` com roteamento por
   `useState`) — conforme instrução explícita desta task ("NÃO altere
   App.tsx para importar Menu/Gameplay/Result... Deixe App.tsx renderizando
   `<Layout>` com um placeholder simples"), mantive apenas `<Layout>` +
   título.
3. Smoke test opcional com `@testing-library/react` não foi criado (marcado
   como opcional na tarefa).

## Concerns

- Nenhuma. Cores Tailwind v4 confirmadas funcionando via inspeção do CSS
  gerado (`from-card-green`, `border-card-gold`, `text-card-gold` todos
  resolvem para os hex corretos). Build e `tsc --noEmit` limpos. Todos os
  65 testes pré-existentes continuam verdes.
- `tailwind.config.js` na raiz agora está "morto" (não referenciado por
  nenhum `@config`) — não é um bug introduzido por esta task (já estava
  assim desde o Task 1), só registrando para consciência de quem for mexer
  no tema depois.

## Dependencies

- Consumes: `Card` (tipo) de `src/engine/card.ts`.
- Produces: `Layout`, `CardComponent` — consumidos pelas Tasks 8/9 (Menu,
  Gameplay).

## Next Step

Pronto para Task 8 (Menu component) e Task 9 (Gameplay), que vão importar
`Layout` e `CardComponent` e finalmente cablear o roteamento de telas em
`App.tsx`.
