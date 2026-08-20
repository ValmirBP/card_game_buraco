# Fase 2 — Motor Buraco 4 Jogadores/Duplas + Morto — Relatório

**Worktree:** `.worktrees/buraco-impl` (branch `buraco-impl`). Só `src/engine/**` e `tests/engine/**` foram tocados.

## Status

- `npx jest tests/engine`: **102 passed / 102 total** (6 suites).
- `npx tsc --noEmit`: limpo em `src/engine/**` (0 erros). Restam 11 erros pré-existentes fora de escopo em `src/store/gameStore.ts`, `src/components/Gameplay/GameBoard.tsx` e `src/components/Result/Result.tsx` — todos por causa da API antiga (`GameState.melds`/`winner`, `Game.draw()`, `GameStateForAI.melds`) que a store/UI ainda usa. Ficam para quem for adaptar store/UI, conforme instruído.

## Commits

1. `22d14a9` — `feat(engine): ace both-ends sequences + ace trio melds`
2. `3c4e09a` — `feat(engine): teams + morto for 4-player Buraco`
3. `1de0ac3` — `feat(engine): team-aware AI with extend_meld support`

## Nova API pública (para a store consumir)

### `gameState.ts`

```ts
export type TeamId = 'A' | 'B'

export interface Team {
  id: TeamId
  seats: number[]           // [0,2] para A, [1,3] para B
  melds: Canasta[]          // jogos/canastras COMPARTILHADOS da dupla
  score: number
  hasTakenMorto: boolean
}

export function teamIdOfSeat(seat: number): TeamId
export function teamOfSeat(state: GameState, seat: number): Team

export interface GameState {
  players: Player[]         // exatamente 4, índice === assento
  teams: Team[]              // exatamente 2 ('A' e 'B')
  currentPlayerIndex: number // 0..3
  deck: Card[]                // baço
  discardPile: Card[]
  mortos: Card[][]            // 0, 1 ou 2 mortos de 11 cartas; shift() ao pegar
  round: number
  status: 'setup' | 'playing' | 'finished'
  winnerTeam?: TeamId
}

export function createGameState(players: Player[]): GameState // exige 4 players
```

Removido: `GameState.melds: Map<...>` e `GameState.winner: Player`.

### `canasta.ts`

```ts
export type CanastaType = 'sequence' | 'aces'

export class Canasta {
  readonly cards: Card[]
  readonly isClean: boolean
  readonly points: number      // 500 limpa / 300 suja (mantido)
  readonly type: CanastaType

  constructor(cards: Card[])   // lança se isValidCanasta(cards) === false
  getScore(): number
  withExtraCards(added: Card[]): Canasta // lança se a extensão for inválida; NÃO muta this
  clone(): Canasta
}
```

### `utils.ts`

```ts
export function isValidCanasta(cards: Card[]): boolean
export function canExtendMeld(existing: Card[], added: Card[]): boolean
export function canastaPoints(isClean: boolean): number
export function scoreCard(rank: Rank): number
export function rankToNumber(rank: Rank): number   // inalterado, A=14 (uso interno/AI)
export function isConsecutive(r1: Rank, r2: Rank): boolean
```

### `game.ts`

```ts
export class Game {
  state: GameState

  constructor(players: Player[])      // exige exatamente 4 players, senão lança

  setup(): void                        // 11 cartas x4, 2 mortos de 11, 1 descarte, resto = baço (41)
  drawFromDeck(): Card | null
  takeDiscardPile(): Card[] | null     // ver decisão abaixo
  discard(cardIndex: number): boolean

  playCanasta(cards: Card[]): boolean  // baixa no time do jogador atual
  extendMeld(meldIndex: number, cards: Card[]): boolean // estende meld do time do jogador atual

  pickUpMorto(): boolean               // dá 11 cartas ao jogador atual, marca team.hasTakenMorto
  canClose(team: Team): boolean        // true sse team.hasTakenMorto

  endTurn(): void                       // 0->1->2->3->0
  getCurrentPlayer(): Player
  getTeamOfCurrentPlayer(): Team
  getValidMoves(): PlayerMove[]

  isGameOver(): boolean                 // status==='playing' && (batida ou baço vazio)
  finish(): void                        // idempotente; ajusta team.score, define winnerTeam

  getGameState(): GameState
  clone(): Game
}
```

Removido: `Game.draw()` (renomeado `drawFromDeck()`), pontuação por `Player.score` (agora em `Team.score`), `state.winner`/`calculateWinner()` privado (agora `state.winnerTeam` via comparação direta de `teams`).

### `player.ts`

```ts
export type PlayerMove = {
  type: 'draw' | 'play_canasta' | 'discard' | 'take_discard' | 'extend_meld'
  cardIndex?: number
  meldIndex?: number   // para extend_meld: índice do meld do time (renomeado de canastIndex)
  cards?: Card[]        // para play_canasta/extend_meld
}
```
`Player`, `HumanPlayer` inalterados na interface pública (mantêm `hand`, `score`, `canastas`, `addCanasta`, `clone` — vestigiais para pontuação individual, não usados por `Game` para pontuação de partida, que agora é 100% em `Team.score`).

### `ai.ts`

```ts
export interface GameStateForAI {
  currentPlayerIndex: number
  players: Player[]
  deck: Card[]
  discardPile: Card[]
  teams: Team[]          // substituiu melds: Map<string, Canasta[]>
}

export class AIPlayer implements Player {
  // mesma API pública de antes (name, hand, score, canastas, difficulty,
  // playTurn, getValidMoves, getDiscardedCards, addCanasta, clone)
}
```
`AIPlayer.playTurn` roda para qualquer assento; identifica o próprio time via `teams.find(t => t.seats.includes(currentPlayerIndex))` e considera `extend_meld` nos melds desse time antes de cair para descarte.

## Decisões de design

### 1. Ás nas duas pontas (`isValidCanasta` / `utils.ts`)

`isValidSequence` tenta as duas leituras do Ás (`aceMode: 'low' | 'high'`) via `sequenceRankValue`: baixo trata A=1 (permite A-2-3), alto trata A=14 (permite ...Q-K-A). Testa as duas ordenações e aceita se qualquer uma fechar as lacunas dentro do nº de curingas disponíveis. Isso mantém `rankToNumber` (usado por `ai.ts` e testes antigos, sempre A=14) intocado — a ambiguidade do Ás é local a `isValidCanasta`/`canExtendMeld`, não vaza para o resto do motor.

### 2. Trinca de ases

Antes de tentar a validação de sequência por naipe, `isValidCanasta` checa `isValidAceTrio`: se **todas** as cartas reais forem Ás (naipe irrelevante), é válido — respeitando ainda a regra geral de no máximo 1 curinga. Isso é checado primeiro porque uma trinca de ases nunca teria naipe único nem sequência coerente, então não conflita com o caminho normal.

### 3. `canExtendMeld`

Implementado como `isValidCanasta([...existing, ...added])` — reaproveita toda a lógica de validação (naipe, lacunas, limite de 1 curinga total, trinca de ases) sem duplicar regras. Efeito colateral aceito: se o meld existente já tem 1 curinga, adicionar outro curinga falha (correto, ≤1 curinga por meld).

### 4. "Pegar o descarte" (`takeDiscardPile`)

A regra tradicional ("só pode pegar se usar imediatamente a carta do topo em um jogo") **não é imposta dentro de `takeDiscardPile()`**. O método é só o mecanismo: devolve todas as cartas do descarte e esvazia a pilha (ou `null` se vazia). Motivo da decisão: impor a regra aqui exigiria uma API transacional (pegar + obrigatoriamente baixar/estender ou desfazer o pega), o que acopla `takeDiscardPile` a `playCanasta`/`extendMeld` de um jeito que complica a API sem necessidade nesta fase. Em vez disso, documentei no código que o chamador (fluxo de UI ou a lógica de decisão da IA) é responsável por checar com `isValidCanasta`/`canExtendMeld` contra a carta do topo *antes* de chamar `takeDiscardPile()`. Isso segue o mesmo padrão já usado por `discard()`/`playCanasta()`, que também deixam decisões de ordenação/turno para o chamador.

### 5. Morto — quando "bate"

`pickUpMorto()` só marca `team.hasTakenMorto = true` (não fecha a rodada). O motor chama isso automaticamente (`maybeAutoPickUpMorto`, privado) sempre que a mão do jogador atual fica vazia após `discard`/`playCanasta`/`extendMeld` **e** o time ainda não pegou morto **e** ainda há mortos disponíveis. `isGameOver()`/`finish()` tratam como "batida" apenas quando a mão de um jogador está vazia **e** seu time **já** tem `hasTakenMorto === true` — ou seja, na 2ª vez que a mão zera (a 1ª só dispara o morto). `canClose(team)` expõe a regra "só pode bater com morto pego" para quem for construir o fluxo de bater na UI/store.

### 6. Pontuação por dupla (`finish()`)

`finish()` percorre os 4 jogadores por assento, calcula a penalidade de cada mão (`scoreCard` somado) e subtrai do `team.score` do time daquele assento (não do `player.score`individual) — assim as penalidades dos dois parceiros caem no mesmo placar do time, como pede o spec. O time "fechador" (jogador com mão vazia e `team.hasTakenMorto === true` no momento do finish) recebe +100. `winnerTeam` é o `team.id` de maior `score` após os ajustes. `finish()` é idempotente (`status==='finished'` retorna cedo).

## Testes cobertos (destaques)

- `utils.test.ts`: ás alto/baixo, ás não pode "pontecar" naipes fora de ordem, trinca de ases (2/3/4 ases, com/sem curinga), exceção só vale pra ás (reijeta trinca de reis), `canExtendMeld` para sequência e trinca.
- `canasta.test.ts`: `type` exposto, `withExtraCards` não muta o original e lança em extensão inválida.
- `game.test.ts`: setup com contagem exata (11×4 + 2×11 + 1 = 67, baço=41), times com seats corretos, parceiro pode baixar/estender no meld do outro parceiro, `pickUpMorto` manual e automático (ao zerar a mão), `canClose`, `isGameOver` distinguindo "mão vazia sem morto" (jogo continua) de "mão vazia com morto pego" (batida), `finish` com pontuação agregada por dupla e bônus de fechamento, idempotência.
- `ai.test.ts`: IA roda com `teams` no lugar do `melds` Map, encontra trinca de ases e sequência ás-alto, propõe `extend_meld` quando há jogo do time em que uma carta da mão encaixa, nunca retorna `play_canasta` inválido em qualquer dificuldade.
