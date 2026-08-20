# Fase 3 — UI/UX do Buraco — Relatório

Worktree: `/Users/valmirdebarros/Desktop/proj pessoal/.worktrees/buraco-impl` (branch `buraco-impl`)

## Status

Todos os 8 itens do feedback foram implementados. `npx tsc --noEmit` limpo, `npm run build` ok,
`npx jest tests/store tests/components` = 17 passando / 3 falhando (falhas pré-existentes, causadas
pelo agente do motor rodando em paralelo — confirmado com `git stash` antes de qualquer mudança
minha: os mesmos 3 testes já falhavam). Não toquei em `src/engine/**`.

## Commits (nesta ordem, na branch `buraco-impl`)

1. `562b4d6` fix(ui): take discard button
2. `114a374` feat(ui): stacked mortos with card count
3. `6ca53dd` fix(ui): morto layout as a cross per user correction
4. `20431f7` feat(ui): draw animation slide+flip
5. `711c973` feat(ui): realistic felt table
6. `7b4a4fa` feat(ui): editable bot names
7. `a194825` feat(ui): team scoreboard (inclui também o refactor "registro abaixo da mão", commitados juntos por tocarem o mesmo trecho de `Gameplay.tsx`)

## Item a item

**1. Botão "Pegar descarte"** — Diagnóstico: `canTakeDiscardPile` (em `discardRules.ts`) exigia
provar, por combinatória, que a carta do topo do descarte formava uma canastra nova com 2+ cartas
da mão ou estendia um jogo do time. Isso raramente é verdade cedo na partida, então o botão ficava
desabilitado quase sempre — parecia quebrado. **Escolhi a opção "sempre habilitado quando há carta
no descarte"** (a regra estrita `canUseTopDiscardCard` foi mantida como helper, usada só para exibir
o aviso "Lembre-se: você deve usar a carta do topo do descarte" quando não dá pra provar que a carta
do topo é útil). Isso bate com o pedido do usuário: "se a heurística estiver deixando casos óbvios
de fora, simplifique". Arquivos: `src/components/Gameplay/discardRules.ts`,
`src/components/Gameplay/ActionPanel.tsx`, `src/components/Gameplay/Gameplay.tsx`.

**2. Pegar a pilha completa** — Já funcionava na store (`takeDiscardPile` move todas as cartas).
O "bug" percebido pelo usuário era consequência do item 1 (botão nunca habilitado). Confirmado
visualmente: log mostra "X pegou a pilha de descarte (N cartas)" e a mão cresce corretamente.

**3. Mortos em CRUZ** — Implementei primeiro empilhado reto, mas o usuário corrigiu pedindo o
formato de cruz (✚) que já existia na intenção original: morto 1 deitado (rotate 90°) por cima do
morto 2 na vertical, cruzados no centro, cada um com badge "N cartas" dourado no próprio verso
(antes o badge ficava preso ao morto errado / cortado). Ao pegar um morto, a animação
(`AnimatePresence`) desfaz a cruz e sobra só o outro card upright. Arquivo:
`src/components/Gameplay/GameBoard.tsx`.

**4. Animação de compra** — Criado `src/components/Gameplay/DrawAnimation.tsx`: overlay
`motion.div` fixed que mede `#deck-pile` (adicionado em GameBoard) e `#player-hand-anchor`
(adicionado em PlayerHand) via `getBoundingClientRect`, anima translação monte→mão (~0.8s) com flip
3D (`rotateY` 0→180, duas faces com `backfaceVisibility: hidden`) e desaparece via timeout depois
que a mão real já foi atualizada (a store já adiciona a carta real instantaneamente; o ghost só
sobrevoa por cima, sem bloquear input). Verificado no browser: compra de carta funcionando, mão
subiu de 11 para 12 cartas, log atualizado.

**5. Mesa realista** — `src/components/Layout.tsx`: feltro com `radial-gradient` de vinheta +
`repeating-conic-gradient` sutil + ruído SVG inline (`feTurbulence`, data URI, sem assets externos —
mantém PWA offline) e moldura de madeira (`linear-gradient` marrom com bevel via `box-shadow`
inset) envolvendo toda a área de jogo. Verificado visualmente — efeito discreto, não exagerado.

**6. Nomes editáveis dos bots** — `initGame` na store ganhou 3º parâmetro opcional
`names?: { partner?; opponent1?; opponent2? }` (mantendo retrocompatibilidade — testes antigos que
chamam `initGame(name, difficulty)` continuam passando). Seats: 0=humano, 1=opponent1, 2=partner,
3=opponent2, como especificado. `Menu.tsx` ganhou toggle "Editar nomes" com 3 inputs (defaults
Parceiro/Adversário 1/Adversário 2). `App.tsx` guarda os nomes escolhidos e os repassa em "Jogar
Novamente". Adicionei 2 testes novos em `tests/store/gameStore.test.ts` cobrindo nomes customizados
e o fallback sem nomes.

**7. Placar das duplas sempre visível** — Novo `src/components/Gameplay/Scoreboard.tsx`: barra
`sticky top-0` estilo cassino (fundo escuro, borda dourada para "Nós"/Time A, magenta para
"Eles"/Time B), mostra pontos, nº de canastras e ✓/✗ morto pego para as duas duplas, renderizada no
topo de `Gameplay.tsx` — fica visível mesmo rolando a página. O painel de placar que já existia
dentro de `GameBoard` (com os jogos baixados) foi mantido como está.

**8. Registro abaixo da mão** — `Gameplay.tsx` reordenado: removi o grid de 2 colunas
(mesa+registro lado a lado) e passei para coluna única `mesa → sua mão → registro`, mantendo o
painel de registro compacto (últimas 6 entradas, `overflow-y-auto`).

**Canastra! (defensivo)** — Em `GameBoard.tsx`, o texto "Limpa/Suja (+pontos)" agora também mostra
"· Canastra!" quando `(canasta as unknown as { isCanastra?: boolean }).isCanastra ??
canasta.cards.length >= 7` é verdadeiro — compila independente da ordem de merge com o agente do
motor, sem tocar em `src/engine/**`.

## Concerns / observações para o usuário

- Os 3 testes falhando em `tests/store/gameStore.test.ts` (tamanho do baralho, pilha de descarte
  inicial vazia, condição de fim de jogo) são causados pelas mudanças do motor feitas em paralelo
  (commit `609885d feat(engine): regras autenticas de canastra...`), não pelas minhas alterações.
  Precisam ser revisitados depois que a Fase de motor estabilizar — os testes de store provavelmente
  precisarão de pequenos ajustes de números esperados (ex.: `108 - 4*11 - 2*11 - 1` mudou porque a
  contagem de descarte inicial/baralho mudou).
- O item 1 optou pela versão simplificada ("sempre habilitado") em vez de manter/corrigir a
  heurística estrita — decisão explicitamente autorizada pelo enunciado do usuário quando a
  heurística "deixa casos óbvios de fora". A heurística estrita foi preservada como
  `canUseTopDiscardCard` só para o aviso, não para bloquear.
- Itens 7 e 8 foram commitados juntos (`a194825`) porque ambos alteravam o mesmo trecho de
  `Gameplay.tsx` na mesma sessão de edição; o diff de cada preocupação está claramente identificável
  nos arquivos tocados (`Scoreboard.tsx` é novo/item 7; a reordenação do JSX é o item 8).
- Durante a correção do item 3, a primeira versão (empilhado reto com badges) foi substituída pela
  versão em cruz a pedido explícito do usuário — o commit `6ca53dd` documenta a mudança.
