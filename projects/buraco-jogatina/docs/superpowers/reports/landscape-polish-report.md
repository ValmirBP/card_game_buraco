# Landscape polish — relatório

Ajustes finos de layout (paisagem) no Buraco single-player: menu sem rolagem,
mesa com painéis "Nós"/"Eles" como vista principal, mão em "meia carta" no
rodapé, e nomes-padrão dos bots trocados por nomes reais editáveis.

Worktree: `.worktrees/buraco-impl` (branch `buraco-impl`).

## Status

Concluído. `npx tsc --noEmit` limpo, `npm run build` ok, `npx jest` **303/303**
verdes (2 asserts de nomes-padrão em `tests/store/gameStore.test.ts` foram
atualizados de "Parceiro"/"Adversário 1" para "Bruno"/"Ana", refletindo o
pedido #4 — nenhuma mudança de lógica).

## O que foi feito

### 1. Menu inicial fixo, sem rolagem (`src/App.tsx`, `src/components/Menu/Menu.tsx`)
- `App.tsx`: `fitScreen` agora também é `true` para a tela `'menu'` (antes só
  gameplay/onlineGameplay), então o `Layout` aplica `h-[100dvh] overflow-hidden`
  ao menu também.
- `Menu.tsx`: raiz virou `flex h-full min-h-0 flex-col justify-center
  overflow-y-auto` (com `landscape:overflow-hidden`), título/subtítulo e leque
  decorativo de cartas encolhem (`landscape:text-xl` / `landscape:hidden` no
  leque), e o corpo (nome + editar nomes | botões) virou um `grid` de 1 coluna
  em retrato e **2 colunas lado a lado em paisagem** (`landscape:grid-cols-2`),
  cabendo em alturas de paisagem de celular (~340–430px) sem rolar.
- `DifficultySelector.tsx` e `RulesModal.tsx`: paddings/tamanhos de fonte
  reduzidos em paisagem (`landscape:p-4`, `landscape:text-*`) e
  `max-h-[9x dvh] overflow-y-auto` como rede de segurança — nenhum força
  rolagem da página, só scroll interno se necessário.

### 2. Mesa: painéis "Nós"/"Eles" como vista dominante (`src/components/Gameplay/GameBoard.tsx`, `Seat.tsx`)
- Grid da mesa em paisagem passou de "3 colunas lado a lado" (mesa central
  larga, paineis estreitos de 84–110px) para **2 linhas**: uma faixa fina no
  topo (`grid-rows-[auto_minmax(0,1fr)]`, linha 1 = `auto`) com
  assentos/monte/descarte/mortos compactos, e a linha 2 (`1fr`, toda a altura
  restante) com os painéis "Nós" | "Eles" lado a lado, ocupando a maior parte
  da tela — a área onde se baixa/estende jogo.
- Os 4 assentos viraram uma fileira horizontal única de "pílulas" compactas
  em paisagem (`landscape:flex landscape:flex-wrap`, ignorando o grid 3x3 de
  retrato), mostrando avatar+nome+contagem de cartas; o assento "Você" some
  (a própria mão já cumpre esse papel).
- Cartas de mesa (`TABLE_CARD_SIZE`) e mortos encolhidos ainda mais em
  paisagem para dar espaço aos painéis; título "Mesa" escondido em paisagem
  (só o selo de turno "Sua vez"/"🤖 jogando…" permanece).
- Monte/descarte, mortos e a extensão de jogos continuam totalmente
  clicáveis e visíveis — só compactados.

### 3. Mão do humano em "meia carta" (`src/components/Gameplay/PlayerHand.tsx`)
- Faixa da mão, em paisagem, tem `overflow-y-hidden` + `max-height` reduzido
  (`landscape:max-h-[1.9rem]`) quando nada está selecionado — só a metade de
  cima das cartas "espia" (rank/naipe do canto continuam legíveis).
- Ao selecionar 1+ cartas, a faixa cresce (`landscape:max-h-[5rem]`,
  transição suave) revelando as cartas inteiras — a seleção já eleva a carta
  (`Card.tsx`, inalterado) então ela sobe e some por completo do "corte".
- Rolagem horizontal preservada se a mão não couber; ordenação inalterada.

### 4. Nomes-padrão dos bots (`src/App.tsx`, `src/components/Menu/Menu.tsx`, `src/store/gameStore.ts`)
- Defaults trocados de "Parceiro"/"Adversário 1"/"Adversário 2" para
  **"Bruno"** (parceiro), **"Ana"** (adversário 1), **"Carlos"** (adversário 2)
  em `initGame`, `startNextRound` (gameStore) e nos dois `DEFAULT_BOT_NAMES`
  (App.tsx e Menu.tsx). O humano continua "Você" por padrão.
- A função "Editar nomes" no menu continua igual — os rótulos dos campos
  ("Parceiro", "Adversário 1", "Adversário 2") não mudaram, só os
  placeholders/defaults.
- Único ajuste em teste: `tests/store/gameStore.test.ts` (2 asserts) —
  atualizado para os novos nomes-padrão.

## Arquivos alterados
- `src/App.tsx`
- `src/components/Menu/Menu.tsx`
- `src/components/Menu/DifficultySelector.tsx`
- `src/components/Menu/RulesModal.tsx`
- `src/components/Gameplay/GameBoard.tsx`
- `src/components/Gameplay/Seat.tsx`
- `src/components/Gameplay/PlayerHand.tsx`
- `src/store/gameStore.ts` (só defaults de nome + comentário; sem mudança de lógica)
- `tests/store/gameStore.test.ts` (2 asserts de nomes-padrão)

Não tocados: `src/engine/**`, `src/session/**`, `src/components/Online/**`
(exceto que `OnlineGameBoard.tsx` importa `Seat.tsx`, que teve apenas classes
Tailwind `landscape:` reduzidas de tamanho — nenhuma mudança fora do variant
de paisagem, nenhuma mudança de props/lógica).

## Verificação feita (landscape, via browser tool)
Testado em `812×375`, `740×360` e `667×340`:
- **Menu**: cabe inteiro, sem rolagem (`scrollHeight === innerHeight`
  confirmado via JS nos 3 tamanhos); "Editar nomes" expande e ainda cabe;
  modal de dificuldade abre e cabe (`clientHeight` < `innerHeight`, sem
  scroll da página).
- **Jogo**: `document.documentElement.scrollHeight === window.innerHeight`
  confirmado nos 3 tamanhos, inclusive após comprar/selecionar/descartar
  (que muda a altura da faixa da mão dinamicamente). Painéis "Nós"/"Eles"
  visivelmente maiores que a faixa de assentos/monte/descarte no topo.
- **Interações**: clique no monte compra (contagem do monte e da mão
  atualizam); seleção de carta expande a faixa da mão e ergue a carta
  selecionada por completo; clique no descarte com 1 carta selecionada
  descarta (turno avança para a IA, que joga automaticamente); nomes
  "Bruno"/"Ana"/"Carlos" aparecem nos assentos e nos placeholders de edição.

Não foi possível registrar screenshots no relatório (ambiente de agente sem
anexo de imagem), mas a verificação visual foi feita via screenshots do
browser tool durante a sessão, nos três tamanhos de paisagem pedidos.
