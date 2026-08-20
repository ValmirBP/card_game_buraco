# Fase 3b — Engine: regras avançadas do Buraco + IA (relatório)

Worktree: `/Users/valmirdebarros/Desktop/proj pessoal/.worktrees/buraco-impl`
Escopo tocado: apenas `src/engine/**` e `tests/engine/**` (store/UI não foram alterados).

## Status

Concluído. `npx tsc --noEmit` limpo. `npx jest tests/engine` 147/147 verdes.
`npx jest tests/store` 16/16 verdes (nenhum teste de store quebrou — retrocompatibilidade
mantida no construtor de `Canasta`).

## Commits

1. `d2ced92` — feat(engine): 2-do-mesmo-naipe como curinga não suja + layout do curinga (Partes A e B)
2. `8b11660` — feat(engine): IA compra da mesa (take_discard) e prioriza extend_meld (Parte C)

(Existem outros commits de UI intercalados no histórico do worktree — `de637f8`, `acfb6b7`,
`94c5d7b` — de outra sessão trabalhando em paralelo no mesmo worktree; não fazem parte
desta entrega e não tocam `src/engine`/`tests/engine`.)

## Testes: X/Y

- `tests/engine`: 147/147 (eram 123 antes; +24 testes novos cobrindo Partes A, B e C)
- `tests/store`: 16/16 (inalterado, apenas confirmação de não regressão)
- Total do projeto (engine + store): 163/163

## Parte A — Regra do 2 do mesmo naipe

`analyzeMeld` (em `src/engine/utils.ts`, função interna `analyzeSequence`) agora tenta duas
interpretações para um 2 do mesmo naipe da sequência, preferindo a primeira que validar:

1. **Natural** (posição 2, ace-low) — nunca suja, independente de haver um 9 real.
2. **Curinga fora de posição** (Parte A) — só alcançável quando esse 2 é o ÚNICO curinga do
   meld (orçamento de 1 já usado nele). Não suja a canastra, **exceto** pela "regra do 9":
   se a sequência contém um 9 real do mesmo naipe, a canastra fica suja.

Joker e 2 de naipe diferente continuam sujando como antes (comportamento inalterado).

A interpretação "curinga fora de posição" é restrita ao modo **ace-low** — permitir também
ace-high reintroduziria o "dar a volta" (ex.: `[K,A,2♥]`), que continua rejeitado (teste
`isValidCanasta` já existente).

**Sujeira permanente** (Parte A.4/A.3, corrigida a pedido do usuário durante a implementação):
uma vez que uma extensão via `withExtraCards`/`extendMeld` torna o meld sujo pela regra do 9,
ele nunca mais volta a ficar limpo — mesmo que uma reanálise fresca do conjunto de cartas
resultante (por exemplo depois de completar A,2,3,4,5,6,7,8,9, onde o 2 "pareceria" natural)
diria que está limpo. Isso é implementado via um flag `wasDirty` que se propaga adiante.

## Parte B — Layout do curinga

Nova estrutura em `MeldAnalysis`/`Canasta`:

```ts
interface MeldLayoutEntry {
  card: Card
  representsValue: number // valor numérico que a carta ocupa na sequência
}
```

- `analyzeMeld(cards).layout` — ordem canônica (ascendente) + valor representado por cada carta.
- `resolveMeldLayout(cards): MeldLayoutEntry[] | null` — wrapper de conveniência.
- `Canasta.layout: MeldLayoutEntry[]` — exposto na classe, atualizado a cada
  `withExtraCards`/reconstrução.

O curinga sempre desliza para a **menor posição livre compatível** com as cartas reais:
se há exatamente um gap interno entre as cartas reais, o curinga ocupa esse gap; se as cartas
reais já são consecutivas (curinga "sobrando"), ele desce para `min - 1` (ou sobe para
`max + 1` se `min - 1` estiver fora da faixa válida). Exemplo do usuário verificado em teste:
`[6♠,2♠,8♠]` → curinga representa 7; ao adicionar `7♠` → curinga desliza e passa a
representar 5 (`[2♠(=5),6,7,8]`).

## Parte C — IA: compra da mesa e extend_meld agressivo

- Novo método privado `AIPlayer.isDiscardPileUseful(gameState)`: verifica se o topo do
  descarte estende algum meld do próprio time (`canExtendMeld`) OU forma um jogo válido
  junto com 2+ cartas da mão (`isValidCanasta`).
- `getValidMoves` agora inclui `{ type: 'take_discard' }` quando o topo é útil.
- `playTurn`/`decide*`:
  - **easy**: se útil, 50% de chance (`Math.random() < 0.5`) de retornar `take_discard`
    diretamente; senão sorteia entre os movimentos válidos (que já incluem `extend_meld`
    e, quando útil, `take_discard`).
  - **medium/hard**: retornam `take_discard` sempre que o topo é útil (maior prioridade,
    antes de qualquer decisão de extend/canasta/descarte). Cobre também o caso de pilhas
    grandes (>=4 cartas) — como a regra é "sempre pega quando útil", não há necessidade de
    um caminho especial adicional para pilhas grandes.
  - Prioridade reordenada em `decideMedium`/`decideHard`: **extend_meld ≥ play_canasta >
    discard** (antes canastas novas vinham primeiro, fazendo a IA raramente estender jogos
    do parceiro).

**Importante para quem for integrar na store**: `take_discard` só faz sentido como
**primeira ação do turno**, antes de comprar do monte. A execução mecânica
(`Game.takeDiscardPile()`) já existia e continua fora do escopo do engine de decisão — a
store deve chamá-la quando `playTurn`/`getValidMoves` da IA propuser esse move, e então
aplicar a extensão/novo meld correspondente com as cartas recebidas.

## API nova para store/UI consumir

- `Canasta.layout: { card: Card; representsValue: number }[]` — para desenhar o curinga na
  posição correta dentro do meld.
- `new Canasta(cards, { wasDirty?: boolean })` — segundo parâmetro **opcional**, retrocompatível.
  `Canasta.wasDirty: boolean` também é exposto (indica se o meld já foi sujo alguma vez,
  incluindo o próprio construtor atual).
- `resolveMeldLayout(cards: Card[]): MeldLayoutEntry[] | null` (em `utils.ts`).
- `AIPlayer` pode agora propor `{ type: 'take_discard' }` via `getValidMoves`/`playTurn` —
  nenhuma mudança de assinatura, apenas um novo valor possível já previsto no union type
  `PlayerMove['type']` existente.

## Arquivos alterados

- `src/engine/utils.ts` — `analyzeSequence`/`analyzeAceTrio` reescritos para produzir
  `layout`; nova regra do 2-mesmo-naipe-como-curinga e regra do 9; `resolveMeldLayout`.
- `src/engine/canasta.ts` — `CanastaOptions`, `layout`, `wasDirty` no construtor/`withExtraCards`/`clone`.
- `src/engine/ai.ts` — `isDiscardPileUseful`, `take_discard` em `getValidMoves`, reordenação
  de prioridades em `decideEasy`/`decideMedium`/`decideHard`.
- `tests/engine/utils.test.ts`, `tests/engine/canasta.test.ts`, `tests/engine/ai.test.ts` —
  testes novos para as três partes.

## Nota adicional — morto vira novo monte quando o baço acaba

Status: concluído. `npx tsc --noEmit` limpo. `npx jest` 170/170 verdes (eram 167; +3 testes novos).
Commit: `90a23c2` — feat(engine): morto vira novo monte quando o baço acaba.

Mudança cirúrgica em `Game.drawFromDeck()` (`src/engine/game.ts`): quando o baço esvazia mas
ainda há morto(s) na mesa, o último morto (`mortos.pop()`) vira o novo `state.deck` e a compra
prossegue normalmente a partir dele, sem embaralhar (ordem preservada — não havia necessidade
de aleatoriedade adicional, já que o morto já foi embaralhado no `setup()` original).
`isGameOver()` por exaustão agora exige `deck.length === 0 && mortos.length === 0` (batida via
`canClose` inalterada). `pickUpMorto`/`maybeAutoPickUpMorto` não precisaram mudar: já tratavam
"sem morto disponível" corretamente (retorno `false`/no-op), e essa mesma checagem agora também
cobre o caso em que o morto restante já foi consumido como monte.

Testes novos em `tests/engine/game.test.ts` (describe `drawFromDeck - morto becomes new deck
when baço runs out`): baço esvazia com 1 morto disponível (compra funciona, `mortos.length`
cai, `deck.length === 10`, jogo não termina); baço esvazia sem morto (retorna `null`,
`isGameOver() === true`, status continua `playing`); dois esvaziamentos seguidos consomem os
dois mortos antes do jogo poder terminar por exaustão.

Ajuste necessário fora do escopo original combinado (apenas `game.ts`/`game.test.ts`): o teste
`tests/store/gameStore.test.ts` → `'game finishes once the deck (baço) runs out'` zerava só
`game.state.deck` e esperava `status === 'finished'`; com a regra nova isso não é mais
suficiente porque ainda há morto na mesa. Adicionado `game.state.mortos = []` ao arranjo desse
teste para manter a suíte coerente com a nova regra (sem alterar o comportamento testado).
Os testes que já esvaziavam o deck via loop `while (drawFromDeck() !== null)` (em
`tests/engine/game.test.ts`, incluindo `isGameOver` → "returns true when deck is empty during
play") não precisaram de ajuste: o loop naturalmente drena os mortos também antes de retornar
`null`, então continuam verdes sem mudança.

## Nota adicional 2 — alinhamento às regras oficiais Jogatina (valores, quinhentos/real, morto)

Status: concluído. `npx jest` completo: **197/197 verdes** (eram 171 antes; +26 testes novos).
Escopo tocado: apenas `src/engine/**` e `tests/engine/**`, conforme combinado.

### Commits

1. `a45fcb7` — feat(engine): regras oficiais Jogatina - valores, A nas duas pontas, quinhentos/real
2. `28f7b2c` — feat(engine): Canasta.kind e bonus de quinhentos/real
3. `0836608` — feat(engine): penalidade -100 por não pegar morto + testes de batida direta

(Entre essas e a nota anterior, o worktree recebeu um commit de UI de outra sessão em paralelo,
`f3013af` — "feat(ui): fully open discard pile" — que não toca `src/engine`/`tests/engine` e não
faz parte desta entrega.)

### Exceções do usuário mantidas (NÃO mudadas)

- Trinca de ases continua válida (`type: 'aces'`), independente de naipe.
- 2 do mesmo naipe usado como curinga nasce **limpo**; só suja permanentemente se um 9 real do
  mesmo naipe entrar enquanto o 2 ainda estiver curinga fora de posição ("regra do 9" + sujeira
  permanente via `wasDirty`, já existentes). Não foi adotada a versão oficial "suja→limpa".

### 1. Nova tabela de valores de carta

`scoreCard(rank: Rank)` (em `src/engine/utils.ts`) passou a seguir a tabela oficial: Ás=15;
K/Q/J/10/9/8=10; 7/6/5/4/3=5; 2=10 (antes: 2 valia 20 e os números "batiam" com o próprio rank,
ex. 9 valia 9). Como essa assinatura só recebe o `Rank` e não consegue diferenciar um joker (que
também usa `rank: '2'`, `isWild: true`) de um 2 comum, foi adicionada:

```ts
export function scoreCardValue(card: Card): number // joker (isWild) -> 20; senão scoreCard(card.rank)
```

`scoreCard(rank)` foi **mantida com essa assinatura antiga por retrocompatibilidade** — é o que
`src/store/gameStore.ts` usa na heurística de descarte da IA (`discardLowestValue`), fora do
escopo desta tarefa; ela agora recebe `'2' -> 10` em vez de `20` para qualquer 2 (joker incluso),
já que não tem como saber que é joker. Todos os call sites *dentro do engine* (pontuação de
canasta em `canasta.ts`, penalidade de mão em `game.ts#finish`) foram migrados para
`scoreCardValue(card)`, que trata o joker corretamente.

### 2. Canastra especiais — `Canasta.kind` (novo campo público)

```ts
type CanastaKind = 'simples' | 'limpa' | 'suja' | 'quinhentos' | 'real'
```

- `computeCanastaKind(cardCount, isClean, layout)` (utils.ts): abaixo de 7 cartas → `'simples'`;
  suja → `'suja'`; limpa com 13 cartas → `'quinhentos'` (o único jeito de uma sequência
  mesmo-naipe limpa chegar a 13 cartas sem repetição é usar as 13 ranks do naipe inteiro — não
  precisa checar valores específicos); limpa com 14 cartas → `'real'` (só alcançável via o novo
  caminho "ás nas duas pontas", já que um naipe só tem 13 ranks — 14 cartas exige Ás duplicado).
  Caso contrário, `'limpa'`.
- `canastaPoints(kind, cardCount)` **mudou de assinatura** (antes `canastaPoints(isClean,
  cardCount)`): `'real'` → +1000, `'quinhentos'` → +500, `'suja'` → +100, `'limpa'`/`'simples'`
  em 7+ → +200 (simples nunca chega em 7+ na prática, é só fallback), abaixo de 7 → 0.
- `Canasta.kind` é calculado no construtor e re-derivado a cada `withExtraCards`/`clone`
  (automaticamente, já que ambos passam pelo construtor).

### 3. Ás nas duas pontas simultaneamente

`analyzeSequence` (utils.ts) ganhou um caminho novo, `analyzeDoubleAceSequence`, acionado quando
a sequência tem exatamente 2 Ases do mesmo naipe: um fica ancorado no valor 1 (antes do 2), o
outro no valor 14 (depois do K), permitindo sequências de até 14 cartas (A,2,3...K,A). Diferença
importante em relação a uma sequência normal: como as duas pontas já estão fixas em Ases reais,
**não há "espaço para deslizar"** um curinga sobrando — o curinga só pode preencher um gap
interno real; se não houver gap (sequência já completa) e ainda sobrar um curinga na jogada, a
combinação é invalida (`gapCount !== genericWildCount` → `null`). Um 2 do mesmo naipe na posição
natural continua nascendo limpo dentro desse caminho (exceção do usuário preservada); joker ou 2
de naipe diferente sujam como sempre. **`K-A-2` "dar a volta" continua inválido** — só é
alcançado com exatamente 1 ás (não aciona o caminho de duas pontas).

### 4. Penalidade do morto em `finish()`

Depois da penalidade de cartas na mão, `finish()` agora subtrai **-100 adicionais** de todo time
com `team.hasTakenMorto === false`, incondicionalmente (não importa a razão — nunca esvaziou a
mão para o auto-pickup, ou os dois mortos viraram monte antes de serem pegos). Isso empilha com
a penalidade de mão e é independente do bônus de +100 de quem bateu.

**Efeito colateral em testes antigos**: como `hasTakenMorto` começa `false` por padrão em
`createGameState`, todo teste de `finish()` que não setava esse flag explicitamente passou a
receber -100 "de graça" e teve que ser ajustado. Optei por **setar `hasTakenMorto = true`** nos
testes antigos focados especificamente na penalidade de cartas / bônus de batida (para não
misturar duas asserções na mesma expectativa), e criei um `describe` novo e dedicado
(`morto penalty (-100 for a team that never took a morto)`) para cobrir o -100 isoladamente, seu
empilhamento com a penalidade de mão, e a ausência de penalidade para quem pegou.

### 5. Batida direta (documentada + testada)

Confirmado que o fluxo já suportava: `Game.playCanasta`/`Game.extendMeld` chamam
`maybeAutoPickUpMorto()` ao final, que já pega o morto automaticamente se a mão ficar vazia e o
time ainda não tiver pego nenhum. Como `Game` nunca chama `endTurn()` internamente (isso é
responsabilidade da store/UI), a batida direta já "continua no mesmo turno" por construção — não
havia bug a corrigir, só faltava teste explícito. Adicionados dois testes em `game.test.ts`
(`describe('batida direta...')`) cobrindo `playCanasta` e `extendMeld` esvaziando a mão e
confirmando `hasTakenMorto === true`, mão realimentada com 11 cartas do morto, e
`currentPlayerIndex` inalterado.

### Testes: 197/197 (eram 171)

- `tests/engine/utils.test.ts`: +tabela de valores (scoreCard/scoreCardValue por faixa), +ás nas
  duas pontas (válido, layout 1..14, gap interno com curinga fica suja, curinga sobrando sem
  espaço é inválido, suits diferentes não acionam o caminho, K-A-2 continua inválido),
  +`computeCanastaKind`/`canastaPoints` (simples/limpa/suja/quinhentos/real).
- `tests/engine/canasta.test.ts`: valores antigos recalculados pela tabela nova (ex.: natural 2
  que valia 20 agora vale 10); `kind` verificado nos testes de canastra normal/suja; dois testes
  novos (`quinhentos` 13 cartas → soma+500, `real` 14 cartas → soma+1000, dupla-ás suja nunca
  vira quinhentos/real).
- `tests/engine/game.test.ts`: valores de penalidade recalculados (ex.: `9` que penalizava 9
  agora penaliza 10, já que 8/9/10 valem 10 na tabela oficial); testes de `finish` antigos
  isolados com `hasTakenMorto = true` nos dois times; `describe` novo para o -100; `describe`
  novo para batida direta.
- `tests/store/gameStore.test.ts`: **não precisou de nenhum ajuste numérico** — não havia
  asserção hardcoded de score/pontos ali.

### API nova / mudada para a UI integrar

- **`scoreCard(rank: Rank): number`** — assinatura preservada, mas a tabela de valores mudou
  (2 agora vale 10, não 20; números 3-7 valem 5 fixo, 8-10 valem 10 fixo — não é mais "= ao
  próprio rank"). Qualquer UI que exiba valor de carta usando `scoreCard(rank)` direto vai
  mostrar 10 para um joker (errado) — trocar para `scoreCardValue(card)`.
- **`scoreCardValue(card: Card): number`** (novo export) — usar este para exibir/calcular valor
  de qualquer carta, incluindo jokers (20).
- **`canastaPoints(kind: CanastaKind, cardCount: number): number`** — **mudou de assinatura**
  (antes `canastaPoints(isClean: boolean, cardCount: number)`). Só é relevante se a UI chamava
  essa função diretamente; `Canasta.points`/`Canasta.getScore()` já calculam isso internamente.
- **`Canasta.kind: 'simples' | 'limpa' | 'suja' | 'quinhentos' | 'real'`** (novo campo) — para a
  UI exibir o tipo de canastra e o bônus correspondente (200/100/500/1000).
- **`computeCanastaKind(cardCount, isClean, layout): CanastaKind`** (novo export, utils.ts).
- Nenhuma mudança em `Game`, `AIPlayer`, `Hand`, `Player` além do uso interno de
  `scoreCardValue` em `finish()` — comportamento de `finish()` mudou (penalidade -100 nova, ver
  seção 4), mas a assinatura do método é a mesma.

### Observação para a UI (não é bug, é design decision a considerar)

No caminho "ás nas duas pontas", quando o 2 está na posição natural, a interpretação
"natural/ace-low" é tentada primeiro e normalmente vence — ou seja, uma canastra de quinhentos
(2..K,Á) construída com um 2 natural tende a ter o Ás ancorado no valor **1** (antes do 2) no
`layout`, não no valor 14 (depois do K), mesmo sendo o mesmo conjunto de 13 cartas. Isso não afeta
pontuação/kind (que dependem só de `cardCount`+`isClean`, não da posição exibida), mas se a UI
quiser sempre desenhar "2,3...K,Á" da esquerda pra direita para uma canastra `kind === 'quinhentos'`,
pode precisar normalizar a exibição em vez de confiar cegamente em `representsValue`.
