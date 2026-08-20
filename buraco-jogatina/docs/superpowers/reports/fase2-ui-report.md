# Fase 2 — UI da mesa de 4 jogadores/2 duplas — Relatório

**Worktree:** `.worktrees/buraco-impl` (branch `buraco-impl`). Só `src/components/**` e `src/App.tsx` foram tocados, conforme instruído (`src/App.tsx` não precisou de mudanças — já usava `game`/`version` corretamente). `src/engine/**` e `src/store/gameStore.ts` não foram tocados.

## Status

- `npx tsc --noEmit`: **0 erros** em todo o projeto (corrigidos os 6 erros pré-existentes em `GameBoard.tsx`/`Result.tsx`, que usavam a API antiga `GameState.melds`/`.winner`/`Gameplay.draw()`).
- `npm run build`: passa (`tsc && vite build`, ~210ms de build Vite).
- `npx jest`: **120/120 passed** (8 suites) — nenhum teste quebrado (não havia testes de componente para `Gameplay`/`GameBoard`/`Result`, só `tests/components/Menu/Menu.test.tsx`, que não foi tocado).
- Verificação visual no browser (dev server em `localhost:5173`, dificuldade fácil): iniciei uma partida, comprei, joguei uma canasta (10♠9♠8♠), estendi essa canasta com J♠, descartei, e observei as 3 IAs jogarem em sequência (Adversário 1 → Parceiro → Adversário 2) antes do turno voltar para mim — tudo confirmado via `get_page_text`/DOM inspection, não só visualmente.

## Commits

1. `578cad7` — `feat(ui): 4-seat table with teams, morto cross, discard/melds visible`
2. `1f15ce2` — `feat(ui): extend meld + take discard controls`
3. `e0038d9` — `feat(ui): team-based Result screen`

## Layout dos 4 assentos

`GameBoard.tsx` foi reescrito como uma mesa CSS grid `[minmax(0,1fr)_auto_minmax(0,1fr)]` × 3 linhas: Parceiro (assento 2) no topo, Adversário 1 (assento 1) à esquerda, Adversário 2 (assento 3) à direita, Você (assento 0) embaixo — todos via um novo componente `Seat.tsx` reutilizável (avatar com inicial, nome, cor por time: dourado para Time A/"Nós", fúcsia para Time B/"Eles", destaque + "Sua vez"/"🤖 jogando…" no turno atual). Só os assentos que não são o humano mostram o leque de versos (`compact` no assento 0, já que a mão completa aberta é renderizada por `PlayerHand` abaixo).

**Bug de layout encontrado e corrigido durante a verificação visual:** a coluna central (`grid-cols-[1fr_auto_1fr]`) tinha largura `auto` baseada no conteúdo mais largo, o que fazia as colunas laterais (`1fr`) *transbordarem* o container pai quando o conteúdo central era mais largo que o esperado — troquei para `minmax(0,1fr)` nas colunas laterais. Um segundo problema (mais sutil): o leque de versos de cada assento usava `CardBack` com `transform: scale(0.55)` + margens negativas (`-space-x-8`) dimensionadas para o tamanho *não escalado* do card — como `transform` não afeta o box model, o espaçamento real ficava ~3× mais largo que o visualmente esperado, fazendo o leque do Adversário 1/2 invadir visualmente a área dos mortos. Troquei por um mini card-back próprio (`w-6 h-9`, sem `transform`) com margens negativas compatíveis com seu tamanho real.

**Centro da mesa:** monte (verso + contador), descarte (carta do topo + leque translúcido das ~3 cartas anteriores), os 2 mortos como cruz (✚ — dois `CardBack` sobrepostos, um girado 90°, cor por baralho) que somem/viram "Ambos os mortos já foram pegos" quando `mortos.length === 0`, e dois painéis "Nós"/"Eles" com as canastras do time (`team.melds`), pontos, contagem, "Limpa"/"Suja", "Trinca de Áses" quando `type === 'aces'`, e indicador "morto pego".

## Regra de "Pegar Descarte"

O motor (`Game.takeDiscardPile()`) é só o mecanismo cru, sem validar a regra tradicional. Implementei `canTakeDiscardPile(game)` em `src/components/Gameplay/discardRules.ts`: habilita o botão só se a carta do topo do descarte (a) estende algum meld do time do jogador atual via `canExtendMeld`, ou (b) forma um jogo novo válido junto com 2-3 cartas da mão via `isValidCanasta` — busco candidatas por `suit === top.suit || isWild || rank === 'A'` (cobre sequência do mesmo naipe e a trinca de ases numa única passada) e testo todos os pares/trios dessas candidatas com o topo. É best-effort por design (não é busca exaustiva de todo subconjunto da mão), mas cobre os casos reais dado que uma meld só aceita 1 curinga. `Gameplay.tsx` recalcula isso via `useMemo` a cada `version`/turno e passa como prop `canTakeDiscard` para `ActionPanel`, que desabilita o botão com tooltip explicativo quando `false`.

## Como funciona "Estender Jogo"

Não criei um botão dedicado — a UX é: selecionar 1+ cartas da mão (mesma seleção usada para `playCanasta`/`discard`) e clicar num meld do painel "Nós" em `GameBoard`. Só melds do Time A reagem a clique (só o humano/assento 0 age na UI). Antes de chamar `extendMeld`, faço uma checagem client-side com `canExtendMeld(meld.cards, selectedCards)`: se compatível, o meld ganha um anel dourado + sombra (feedback visual antes mesmo do clique); se o clique acontece mesmo assim com uma seleção incompatível, mostro uma dica vermelha temporária ("Essa seleção não estende esse jogo...") em vez de silenciosamente não fazer nada. Testei ao vivo: baixei 10♠9♠8♠, depois selecionei J♠ sozinho, o painel destacou automaticamente, cliquei e o motor estendeu para 10♠9♠8♠J♠ (677 pts, ainda "Limpa").

## IA (3 assentos) e retorno do turno

`Gameplay.tsx`: o `useEffect` que agenda `aiTurn()` trocou a condição de `currentPlayerIndex === 1` para `currentPlayerIndex !== 0` — como `aiTurn()` roda exatamente um assento por chamada e incrementa `version`, o efeito simplesmente re-dispara a cada mudança de `currentPlayerIndex`/`version` e cobre 1→2→3→0 em sequência, sem guarda de ref (mesma lógica documentada no efeito original, que já explicava por que um ref sobrevive ao remount mas o timeout não). Confirmado ao vivo via log: após meu descarte, rodaram em sequência "Adversário 1" (implícito, saiu do log de 5 linhas), "Parceiro" (comprou/descartou), "Adversário 2" (comprou, baixou uma canastra, descartou) — e o turno voltou para "Você" com o hint de fase `draw` correto.

## Result.tsx

Banner por dupla: `"🎉 Vocês venceram!"` se `winnerTeam === 'A'` (Time A = assentos 0+2, sempre o humano+parceiro), senão `"A dupla adversária venceu"`. Scoreboard lista as 2 duplas ordenadas por pontuação, com os nomes dos parceiros (`team.seats.map(seat => players[seat].name)`), pontos, nº de canastras e se pegou o morto.

## Concerns

- **Framework de teste manual via browser:** durante a verificação, cliques por coordenada de pixel na mão (cartas sobrepostas com `-space-x-8`) se mostraram frágeis — cartas selecionadas/levantadas cobrem a vizinha, e o clique preciso depende do z-index/raise da carta ao lado. Não é um bug de produto (o clique real do usuário do dedo/mouse funciona normalmente porque ele mira visualmente), mas vale nota caso se automatizem testes E2E de verdade (Playwright/Cypress): prefira `getByRole('button', {name: ...})` ou seletores estáveis por carta em vez de coordenadas.
- **`canTakeDiscardPile` é best-effort**, igual ao aviso já deixado no relatório da store para `Game.takeDiscardPile()`: cobre pares/trios de candidatas por naipe+curinga+ás, não todo subconjunto da mão. Suficiente para o gameplay real (um meld só aceita 1 curinga), mas não é uma prova formal de "não existe nenhuma combinação usável".
- **`extendMeld` na UI só oferece melds do Time A** (intencional, conforme a store só orquestrar ações do jogador humano/assento 0 na UI) — se uma fase futura permitir o humano ver as jogadas possíveis do parceiro/adversário com mais detalhe, essa é a hook natural para expandir.
- `GameHeader.tsx` foi removido (a info de cada jogador — nome, turno, pontuação — migrou para `Seat.tsx`, que também mostra o time e o nº de cartas, mais alinhado ao layout de mesa de 4 assentos do que o antigo header em grid 2×2).
