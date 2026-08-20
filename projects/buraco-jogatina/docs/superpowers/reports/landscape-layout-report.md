# Relatório — Reorganização da tela de jogo (single-player) para LANDSCAPE

## Status: concluído

## Escopo tocado
- `src/components/Gameplay/Gameplay.tsx`
- `src/components/Gameplay/GameBoard.tsx`
- `src/components/Gameplay/PlayerHand.tsx`
- `src/components/Gameplay/Scoreboard.tsx`
- `src/components/Gameplay/Seat.tsx`
- `src/components/Card.tsx` (props opt-in novas, sem mudar o comportamento padrão)

Nada em `src/engine/**`, `src/store/**` ou `src/components/Online/**` foi alterado.

## O que mudou

### `Card.tsx`
Adicionadas duas props **opt-in** (nunca usadas pelo modo Online nem por padrão):
- `sizeClassName?: string` — sobrescreve `CARD_SIZE_CLASSES` (footprint da carta).
- `compactOnLandscape?: boolean` — quando `true`, embute classes `landscape:` nos
  glifos (canto rank/naipe, símbolo central, ilustração do curinga) para
  encolherem *apenas* em orientação paisagem, proporcionalmente ao
  `sizeClassName` menor passado pelo chamador.

Como o modo Online (`OnlinePlayerHand`, `OnlineGameBoard`) nunca passa essas
props, ele continua usando `CARD_SIZE_CLASSES` padrão em qualquer orientação —
zero impacto ali.

Ajuste adicional pedido em revisão: o símbolo central e os índices de canto
usavam tamanho fixo (`text-4xl`/`text-sm`) que ficava desproporcional nas
cartas menores. Agora, com `compactOnLandscape`, o símbolo central cai para
`landscape:text-base` (16px) e os cantos para `landscape:text-[7px]`, com o
curinga (`JesterIllustration`) em `landscape:h-4 w-4` — testado numericamente
via `getBoundingClientRect`/`getComputedStyle` no navegador: carta de mesa
40×56px (ajustada a ~45×60 durante a mini-animação de entrada) com símbolo de
16px e canto de 7px; carta da mão 48×68px com símbolo de 16px e curinga de
16×16px — proporções corretas em ambos os casos.

### `GameBoard.tsx`
- Grid principal: `grid-cols-2 grid-rows-[auto_auto]` em retrato (mesa em
  cima, "Nós"/"Eles" lado a lado embaixo — o fallback original preservado);
  em paisagem vira `grid-cols-[minmax(84px,110px)_minmax(0,1fr)_minmax(84px,110px)]`
  numa única linha: **"Nós" | mesa central | "Eles"**.
- Morto(s): badge compacto no canto superior-esquerdo da mesa central,
  escala reduzida ainda mais em paisagem (`landscape:scale-[0.42]`).
- Monte/descarte: `TABLE_CARD_SIZE` (`w-16 h-24 sm:w-20 sm:h-28 landscape:w-10
  landscape:h-14`) aplicado via `sizeClassName` + `compactOnLandscape`.
- Assento "Você": **removido em paisagem** (`landscape:hidden`) — a mão já
  ocupa esse papel, e a indicação de turno vira um selo "Sua vez" no
  cabeçalho da mesa (`landscape:flex`), evitando uma linha extra que
  causava overflow (assento vazando ~23px para fora da mesa e sobrepondo a
  faixa da mão, visto e corrigido durante os testes visuais).
- Painéis "Nós"/"Eles": em paisagem, os jogos baixados ficam numa fileira
  horizontal (`landscape:flex-nowrap landscape:overflow-x-auto`) — cresce
  para o lado, nunca para baixo, exatamente a única rolagem permitida pelo
  pedido.
- Dica/erro de clique inválido: virou overlay absoluto (não reserva altura
  fixa), pra não empurrar o resto da mesa em telas de paisagem bem baixas.

### `Seat.tsx`
- Avatar, nome e badge "Sua vez" encolhem em paisagem
  (`landscape:h-5 landscape:w-5`, `landscape:text-[9px]` etc).
- O leque de versos dos oponentes (`-space-x-4 ...`) some em paisagem
  (`landscape:hidden`) — só avatar + contagem de cartas ficam, como pedido.

### `PlayerHand.tsx`
- `HAND_CARD_SIZE` (`landscape:w-12 landscape:h-[4.25rem]`), maior que as
  cartas da mesa mas ainda compacta, com `compactOnLandscape` pra o
  símbolo/curinga acompanhar.

### `Gameplay.tsx`
- Container da mesa: `landscape:overflow-hidden` (nada de rolagem interna
  em paisagem — a mesa se redimensiona pra caber).
- Linha de "Registro" (última ação): `landscape:hidden` — não essencial pro
  requisito e liberava altura pra mesa/mão.

## Verificação

- `npx tsc --noEmit` — limpo.
- `npx jest` — **303/303** (mesmo total do baseline, antes e depois).
- `npm run build` — build de produção ok.
- `npm run dev` + Browser pane redimensionado para paisagem de celular:
  - **812×375**: 4 assentos, monte, descarte, mortos e os dois painéis
    "Nós"/"Eles" visíveis simultaneamente, mão completa (11 cartas) embaixo,
    **sem rolagem de página nem da mesa** (`document.documentElement.scrollHeight
    === window.innerHeight` confirmado via JS).
  - **740×360**: mesmo resultado — sem overflow (`maxDescendantBottom` da
    mesa ficou dentro do `rootBottom`, verificado por script).
  - Interações testadas via clique real (não simulação de estado): comprar
    do monte, selecionar carta na mão, descartar, e a IA formando canastras
    automaticamente — tudo renderizou corretamente dentro do layout
    compacto, incluindo os painéis de jogos baixados com o texto abreviado
    (`+30`, `X pts · Yc`) e cartas proporcionalmente pequenas.
  - Fallback retrato (390×844, orientação não-landscape) conferido: layout
    original (assento "Você" visível, painéis lado a lado embaixo, registro
    visível) permanece intacto.

## Como ficou o layout landscape

```
┌─────────────────────────────────────────────────────────┐
│  Nós 30  1c ✗morto        Eles 0  0c ✗morto              │  <- Scoreboard (fino)
├───────────┬───────────────────────────────┬─────────────┤
│           │   Mesa                Sua vez │             │
│   Nós     │        Parceiro               │    Eles     │
│  jogos    │  Adv1  [Monte][Descarte] Adv2 │   jogos     │
│ (rolagem  │                                │  (rolagem   │
│ horizontal)│                               │  horizontal)│
├───────────┴───────────────────────────────┴─────────────┤
│  Sua Mão (11)              [cartas legíveis, compactas]  │
└─────────────────────────────────────────────────────────┘
```

Sem rolagem de página nem de mesa; único scroll é horizontal (painel de
canastras muito cheio, ou leque do descarte).

## Commits
- `a420cef` — `feat(gameplay): reorganize single-player table for landscape,
  no page/table scroll` (worktree `buraco-impl`). Inclui o ajuste de
  proporção dos glifos das cartas (símbolo central/índices de canto)
  feito em revisão, antes do commit único.
