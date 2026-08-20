# Redesign de interação — Buraco single-player (manipulação direta)

**Worktree:** `.worktrees/buraco-impl` (branch `buraco-impl`)
**Commit:** `a8b3f03` — feat(gameplay): redesign single-player interaction as direct manipulation
**Escopo:** só `src/components/Gameplay/**` (Online, engine, session e a lógica do gameStore não foram tocados)

## Status

Concluído. `npx tsc --noEmit` limpo, `npm run build` ok, `npx jest` **301/301** (mesmo baseline do início — nenhum teste quebrou, nenhum precisou ser atualizado porque não havia testes de componente cobrindo ActionPanel/GameBoard/Gameplay). Fluxo validado manualmente no browser (Chrome DevTools MCP, `npm run dev` porta 5173): comprar do monte, descartar clicando no descarte, selecionar cartas e clicar na mesa (com hint de rejeição correto para seleção inválida), passagem de turno e IA jogando automaticamente — tudo sem erros no console.

## O que mudou

### Botões removidos
`ActionPanel.tsx` foi deletado. Não há mais barra de ações no rodapé — a coluna `Gameplay.tsx` agora é: placar / mesa (flex-1) / registro (1 linha) / mão. A altura liberada foi para a mesa/mão.

### Novo modelo de cliques (tudo em `GameBoard.tsx`)
- **Monte (`#deck-pile`)**: clicável na fase `draw` (turno do humano) → `drawFromDeck()`. Pulsa levemente e ganha anel dourado quando ativo.
- **Descarte (`#discard-pile`)**: clicável duplo-propósito —
  - fase `draw` + pilha não-vazia → `takeDiscardPile()` (glow dourado quando pegável);
  - fase `play` + exatamente 1 carta selecionada → `discard(index)` (glow dourado como alvo de descarte).
  - Clicar fora dessas condições mostra uma dica curta ("Selecione 1 carta para descartar.", "O descarte está vazio.", etc.) em vez de nada acontecer.
- **Zona de baixar (`#meld-drop-zone`)**: nova faixa "Baixar jogo aqui" logo acima dos painéis de canastras. Clicável na fase `play` com 3+ cartas selecionadas → valida com `isValidCanasta` e `game.wouldPlayCanastaEmptyHandIllegally` (com hint se inválido) antes de chamar `playCanasta(selectedCardIndices)`.
- **Estender jogo existente**: continua sendo clicar diretamente num jogo já baixado do time A (comportamento que já existia antes desta task) → `extendMeld(meldIndex, selectedCardIndices)`, validado com `canExtendMeld` + `wouldExtendMeldEmptyHandIllegally`.
- Quando não é a vez do humano, nada é clicável (badges "🤖 … jogando…" na mesa e "IA jogando…" na mão).

`GameBoard` agora recebe callbacks de `Gameplay` (`onDraw`, `onTakeDiscardPile`, `onDiscardSelected`, `onPlayCanastaSelected`, `onExtendMeld`) em vez de chamar o store diretamente para as ações que precisam de animação — a validação "isso é jogável?" continua em `GameBoard` (mais perto do UI de hint), mas a orquestração de estado+animação ficou em `Gameplay`.

### Morto no canto
Os dois mortos (cruz ✚ com badge de contagem) foram movidos para o canto superior-esquerdo da mesa (`position: absolute`, `scale-[0.65]`/`scale-75`), fora do fluxo do grid central — não competem mais por espaço com monte/descarte/assentos.

### Animações (Framer Motion)
- `DrawAnimation.tsx` — inalterado, ainda cuida do monte → mão com flip 3D + hold.
- **Novo `CardFlyAnimation.tsx`** — overlay genérico "cartas fantasma voam de A para B", sem flip (cartas já viradas), com leque/stagger para múltiplas cartas. Reutilizado em três fluxos, todos orquestrados em `Gameplay.tsx` medindo âncoras via `getBoundingClientRect`:
  - **Descartar**: mão (`#player-hand-anchor`) → descarte (`#discard-pile`).
  - **Pegar descarte**: descarte (`#discard-pile`) → mão (até 3 cartas-fantasma representando o topo da pilha).
  - **Baixar/estender**: mão → `#meld-drop-zone` (nova canastra) ou o retângulo do jogo específico clicado (estender, capturado via `event.currentTarget.getBoundingClientRect()` no clique).
- Todas decorativas e não-bloqueantes — o estado real já foi atualizado no store antes da animação iniciar (mesmo padrão do `DrawAnimation` original).

### Dicas de contexto
Sem botões, as dicas curtas ficam na linha fina de `PlayerHand.tsx` (perto da mão): "Clique no monte para comprar (ou no descarte, se houver).", "Selecione 1 carta e clique no descarte para descartar.", "Selecione cartas e clique na mesa para baixar, ou num jogo do time para estender.", "IA jogando…". `GameBoard` mostra mensagens de rejeição pontuais (2.6s) quando um clique não é válido no contexto atual.

## Âncoras de animação criadas/reaproveitadas
| id | onde | usado por |
|---|---|---|
| `deck-pile` | `GameBoard.tsx` | `DrawAnimation` (já existia) |
| `discard-pile` | `GameBoard.tsx` (**novo**) | `CardFlyAnimation` (descartar / pegar descarte) |
| `meld-drop-zone` | `GameBoard.tsx` (**novo**) | `CardFlyAnimation` (baixar canastra nova) |
| `player-hand-anchor` | `PlayerHand.tsx` | `DrawAnimation` + `CardFlyAnimation` (já existia) |
| retângulo do jogo clicado | capturado ad-hoc via `event.currentTarget` em `GameBoard.handleMeldClick` | `CardFlyAnimation` (estender jogo existente) |

## Arquivos tocados
- `src/components/Gameplay/Gameplay.tsx` — orquestra fase, callbacks, os 4 estados de animação (draw/pickup/discard/table) e o layout sem `ActionPanel`.
- `src/components/Gameplay/GameBoard.tsx` — clique no monte/descarte/zona de baixar, morto no canto, validações + hints.
- `src/components/Gameplay/PlayerHand.tsx` — hints de contexto reescritos, seleção de carta desabilitada fora do turno humano.
- `src/components/Gameplay/CardFlyAnimation.tsx` — **novo**, animação genérica de voo de cartas.
- `src/components/Gameplay/ActionPanel.tsx` — **removido**.

## O que ficou pro próximo passo
- **Cerimônia de sorteio** (quem começa, distribuição visual das 11 cartas) não foi tocada — segue fora de escopo desta task, mencionada pelo usuário como próximo passo.
- Não adicionei affordance de clique para "pegar morto" (não existe ação de store dedicada para isso na lista fornecida; a promoção do morto parece automática no engine ao esvaziar a mão) — se o time quiser um gesto explícito de "puxar o morto pro canto", precisa de uma ação nova no store, fora do escopo (não pude alterar a lógica do `gameStore.ts`).
- `CardFlyAnimation` para "pegar descarte" mostra no máximo as 3 cartas do topo da pilha como fantasmas (não a pilha inteira) — decisão de legibilidade/performance; o estado real (todas as cartas) já está correto na mão por baixo.
