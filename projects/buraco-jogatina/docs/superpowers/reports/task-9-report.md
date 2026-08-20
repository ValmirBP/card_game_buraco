# Task 9 Implementation Report — Gameplay Component

**Status:** DONE

**Commit Hash:** `6df9c3d`

## Summary

Implementado o Task 9 do plano Buraco Jogatina MVP: a tela de jogo completa
em `src/components/Gameplay/` (`Gameplay.tsx`, `GameHeader.tsx`,
`GameBoard.tsx`, `PlayerHand.tsx`, `ActionPanel.tsx`), usando a API REAL do
`useGameStore` (lida diretamente de `src/store/gameStore.ts` antes de
escrever qualquer código — a API do plano estava desatualizada, ex.:
`selectCard`/`selectedCardIndex` não existem; o real é
`toggleCardSelection`/`selectedCardIndices[]`; `playCanasta(cardIndices)`
não existia no snippet do plano). Nenhum arquivo de engine/store/teste
pré-existente foi modificado. `App.tsx` não foi tocado (fora do escopo
desta task).

## Files Created

- `src/components/Gameplay/Gameplay.tsx` (default export, props
  `{ onGameEnd: () => void }`) — orquestra tudo: layout responsivo (header
  → grid `1 col` mobile / `lg:grid-cols-3` desktop com board+log →
  mão → action panel `fixed` no rodapé com `pb-28` de respiro), estado
  local `phase: 'draw' | 'play'`, agendamento do turno da IA via
  `useEffect` + `setTimeout`, e detecção de fim de jogo.
- `src/components/Gameplay/GameHeader.tsx` — grid 2 colunas com cada
  jogador (nome, pontos, nº de canastras), destaque com borda/fundo dourado
  + selo "Vez" + leve `scale` (framer-motion) no jogador do turno atual.
- `src/components/Gameplay/GameBoard.tsx` — canastras de cada jogador
  (`game.state.melds.get(player.name)`) renderizadas com `CardComponent`
  em leque (`-space-x-8`), rótulo Limpa/Suja + pontos, animação
  `AnimatePresence`/`initial→animate` ao surgir uma nova canasta; pilha de
  descarte mostrando só o topo (`discardPile[length-1]`) com fade+slide ao
  trocar.
- `src/components/Gameplay/PlayerHand.tsx` — mão do humano
  (`game.state.players[0].hand.getCards()`) em scroll horizontal
  (`overflow-x-auto`), cada carta com `onClick={() => toggleCardSelection(i)}`
  e `selected={selectedCardIndices.includes(i)}`; contador "Cartas: N |
  Selecionadas: M".
- `src/components/Gameplay/ActionPanel.tsx` — rodapé `fixed` com 3 botões
  (Comprar / Jogar Canasta / Descartar), todos `min-h-[44px]`, habilitação
  conforme `phase` (ver abaixo); recebe `phase` e os 3 handlers como props
  de `Gameplay` (não chama o store diretamente para draw/discard/playCanasta
  — só lê `version`/`game`/`selectedCardIndices` para decidir o `disabled`).

## Controle de fase do turno

Estado local (`useState<'draw'|'play'>('draw')`) dentro de `Gameplay`,
transições feitas explicitamente nos handlers (não inferidas a partir de
`currentPlayerIndex`, para bater exatamente com a especificação):

- `handleDraw`: chama `draw()` → `setPhase('play')`.
- `handleDiscard`: só executa se `selectedCardIndices.length === 1`; chama
  `discard(idx)` (que internamente já chama `game.endTurn()`, passando a
  vez pra IA) → `setPhase('draw')` (fica pronto pro próximo turno do
  humano).
- `handlePlayCanasta`: só executa se `selectedCardIndices.length >= 3`;
  chama `playCanasta(indices)`; **não** muda de fase — o jogador pode jogar
  mais canastras ou descartar em seguida.

`ActionPanel` deriva `disabled` de `isHumanTurn = status==='playing' &&
currentPlayerIndex===0` combinado com `phase` e `selectedCardIndices.length`,
exatamente conforme as regras do prompt (Comprar só em `phase==='draw'`;
Descartar exige exatamente 1 selecionada em `phase==='play'`; Jogar Canasta
exige ≥3 selecionadas em `phase==='play'`).

## Reatividade (`version`)

Todo componente que lê `game` também seleciona `version` do store — mesmo
quando não usado diretamente no JSX (comentado inline em cada arquivo
explicando o porquê, referenciando o "REACTIVITY CONTRACT" documentado em
`gameStore.ts`):

```typescript
useGameStore(s => s.version) // força re-render a cada mutação do `game`
const game = useGameStore(s => s.game)
```

Aplicado em `Gameplay`, `GameHeader`, `GameBoard`, `PlayerHand` e
`ActionPanel`. Sem isso, como `game` é a mesma referência de objeto mutada
in-place por `draw()`/`discard()`/`playCanasta()`/`aiTurn()`, o Zustand
nunca dispararia re-render e a tela ficaria congelada após a primeira ação.
Validado num smoke test temporário (rodado localmente e depois removido,
não faz parte do commit) que simulou draw → seleção de carta → discard →
avanço de fake timers → `aiTurn` disparado → volta a vez pro humano, e
confirmou que a UI refletia cada mudança de estado sem precisar de reload.

## Turno da IA (agendamento e proteção contra dupla execução)

Implementado em `Gameplay` com um `useEffect` que observa `[version, game]`:

```typescript
const scheduledAiVersionRef = useRef<number | null>(null)

useEffect(() => {
  if (!game) return
  if (game.state.status !== 'playing') return
  if (game.state.currentPlayerIndex !== 1) return
  if (scheduledAiVersionRef.current === version) return

  scheduledAiVersionRef.current = version
  const timeoutId = setTimeout(() => {
    useGameStore.getState().aiTurn()
  }, 900)

  return () => clearTimeout(timeoutId)
}, [version, game])
```

Duas camadas de proteção contra dupla execução:

1. **Cleanup do `useEffect`**: toda vez que o effect roda de novo (nova
   `version`, ou remontagem em React StrictMode em dev), o `timeoutId`
   anterior é limpo antes de um novo ser agendado — evita que dois
   `setTimeout` pendentes disparem `aiTurn()` duas vezes para o mesmo
   turno.
2. **Ref `scheduledAiVersionRef`**: guarda a última `version` para a qual já
   agendamos (ou já disparamos) o turno da IA. Como `aiTurn()` roda draw →
   canastras → discard → `endTurn()` inteiro numa única chamada e só
   incrementa `version` uma vez ao final, quando o efeito roda de novo após
   a IA jogar, `currentPlayerIndex` já voltou a ser `0` (humano) e o efeito
   retorna cedo (`if (currentPlayerIndex !== 1) return`) — não há caminho
   onde `aiTurn()` seja agendado duas vezes para o mesmo turno da IA.

Delay de "pensando" fixo em `AI_THINK_DELAY_MS = 900` (900ms), conforme
pedido.

## Game Over

`useEffect` observando `[version, game, onGameEnd]`: se
`game.state.status === 'finished'`, chama `onGameEnd()`. O store já chama
`game.finish()` internamente (via `appendGameOverLog`) tanto em `discard()`
quanto em `aiTurn()` quando `game.isGameOver()` é verdadeiro, então
`Gameplay` só precisa observar o `status`, não chamar `finish()` ele mesmo
(diferente do snippet do plano, que chamava `game.finish()` na UI — teria
duplicado a lógica já feita pelo store).

## TypeScript Compilation

`npx tsc --noEmit` — PASS (sem erros)

## Build

`npm run build` — PASS

```
vite v8.2.0 building client environment for production...
✓ 17 modules transformed.
dist/index.html                   0.66 kB │ gzip:  0.39 kB
dist/assets/index-DqvnZED7.css    4.44 kB │ gzip:  1.39 kB
dist/assets/index-DniwweyU.js   191.27 kB │ gzip: 60.38 kB
✓ built in 152ms
```

## Test Results

Suite existente, intacta (nenhum teste novo commitado — o smoke test usado
para validar manualmente o fluxo draw/discard/AI-turn foi removido depois
de confirmado):

```
Test Suites: 8 passed, 8 total
Tests:       69 passed, 69 total
```

## Deviations from Plan

1. API do store: usado `toggleCardSelection`/`selectedCardIndices[]` (real)
   em vez de `selectCard`/`selectedCardIndex` (plano, obsoleto);
   `playCanasta(cardIndices)` implementado de fato (o plano deixava o botão
   "Play Canasta" sempre `disabled`).
2. Fase do turno (`draw`/`play`) e agendamento do turno da IA
   (`setTimeout(900ms)` + limpeza) **não existiam no plano** — são
   requisitos adicionais desta instrução, implementados inteiramente no
   componente `Gameplay` (o store deliberadamente não agenda `aiTurn()`
   sozinho, conforme comentário no próprio `gameStore.ts`).
3. `ActionPanel` não lê `draw`/`discard`/`playCanasta` diretamente do
   store — recebe handlers como props de `Gameplay`, que é quem decide as
   transições de fase. Isso evita duplicar a lógica de fase em dois lugares.
4. Detecção de fim de jogo simplificada: `Gameplay` só observa
   `game.state.status === 'finished'` (já setado pelo store), sem chamar
   `game.finish()` na UI como o plano fazia.
5. Textos em PT-BR ("Comprar", "Jogar Canasta", "Descartar", "Sua Mão",
   "Mesa", "Canastras de X", "Limpa"/"Suja", "Aguardando o Bot jogar...").
6. Todos os botões do `ActionPanel` com `min-h-[44px]` (touch-friendly).

## Concerns

- Nenhuma pendência bloqueante. `tsc --noEmit` e `npm run build` limpos,
  69/69 testes pré-existentes verdes.
- `App.tsx` ainda não importa `Gameplay` — a integração de telas (menu →
  gameplay → result) fica para uma task de roteamento futura, fora do
  escopo pedido aqui.
- Diretório solto `.superpowers/` segue aparecendo como untracked no
  worktree (não criado por este trabalho); não foi adicionado ao commit —
  só os 5 arquivos de `src/components/Gameplay/` foram staged
  explicitamente por caminho.
- `GameBoard` assume no máximo 2 jogadores lado a lado
  (`sm:grid-cols-2`); como o motor atual (`Game`) só é instanciado com
  `[human, ai]` (2 jogadores) via `initGame`, isso é consistente com o
  estado atual do jogo, mas se uma task futura permitir 3-4 jogadores o
  grid precisará de ajuste.

## Dependencies

- Consumes: `useGameStore` (`src/store/gameStore.ts`), `CardComponent`
  (`src/components/Card.tsx`), tipos do engine (`Game`, `Card`, `Canasta`
  via os campos de `game.state`).
- Produces: `Gameplay` (default export, props `{ onGameEnd: () => void }`),
  pronto para ser importado por `App.tsx` numa task de integração de telas.

## Next Step

Pronto para a Task 10 (Result component) e para a task de integração de
telas em `App.tsx` (roteamento `menu` → `gameplay` → `result`).
