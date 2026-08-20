# Fase 5 - Engine/IA report

Worktree: `.worktrees/buraco-impl` (branch `buraco-impl`). Escopo respeitado: só `src/engine/**` e `tests/engine/**` foram tocados (fora isso, só este relatório em `docs/`).

## Status

Concluído. `npx tsc --noEmit` limpo. `npx jest` completo: **223/223 verdes** (214 base + 6 novos de Partes A/B + 3 novos de Parte C).

Nota sobre o baseline: `tests/store/mortoToDeck.test.ts` tem 1 teste probabilístico pré-existente (`aiTurn completo`) que falha ocasionalmente por depender de shuffle não determinístico do baralho - confirmado que já falhava/piscava *antes* de qualquer mudança desta tarefa (rodei o arquivo isolado 3x: passou, falhou, passou). É fora do escopo (`tests/store`, não `tests/engine`) e não foi tocado.

## Commits

1. `10c1db2` - `fix(engine): morto penalty only applies while a morto remains on the table` (Partes A + B juntas - ver justificativa abaixo)
2. `2f3a696` - `feat(engine): AI prioritizes a clean canastra before dirtying melds` (Parte C)

Partes A e B foram commitadas juntas: ambas mexem na mesma função (`Game.finish()`) e a Parte B literalmente reformula o cálculo que a Parte A corrige (o breakdown recomputa os 4 componentes do zero, incluindo a penalidade do morto já corrigida) - separar geraria um commit intermediário com uma implementação de `finish()` que seria imediatamente reescrita no commit seguinte, sem valor histórico real.

## Parte A - penalidade do morto refinada

`Game.finish()`: a penalidade de -100 por não ter pego o morto agora só se aplica quando **ainda há morto na mesa** (`!team.hasTakenMorto && this.state.mortos.length > 0`). Se os dois mortos já viraram monte (baço esgotado + promovido via `drawFromDeck`/`promoteMortoIfDeckEmpty`, deixando `mortos.length === 0`), ninguém é penalizado por não ter pego - já que não havia mais como pegar.

Testes (`tests/engine/game.test.ts`, describe `Parte A - morto penalty refined`):
- time sem morto + `mortos.length > 0` → -100
- time sem morto mas `mortos = []` (viraram monte) → sem penalidade, para ambos os times
- time que pegou o morto → nunca penalizado, independente de `mortos.length`

Isso também obrigou a ajustar os testes pré-existentes do describe `morto penalty` (que não chamavam `setup()`, então `state.mortos` ficava `[]` por padrão): agora eles setam explicitamente `game.state.mortos` com um morto fictício quando querem exercitar o caso "penalizado", para não conflitar com a regra nova.

## Parte B - detalhamento de pontos (`TeamScoreBreakdown`)

Nova API em `src/engine/gameState.ts`:

```ts
export interface TeamScoreBreakdown {
  teamId: TeamId
  meldPoints: number     // soma de canasta.getScore() das melds atuais do time
  batidaBonus: number    // +100 se o time bateu, senão 0
  mortoPenalty: number   // -100 se penalizado (regra da Parte A), senão 0
  handPenalty: number    // negativo: -(soma scoreCardValue das mãos dos 2 parceiros)
  total: number          // meldPoints + batidaBonus + mortoPenalty + handPenalty
}
```

`GameState.scoreBreakdowns?: TeamScoreBreakdown[]` - populado por `finish()`, um item por time.

Mudança de comportamento importante em `Game.finish()`: `team.score` deixou de ser um valor incrementalmente ajustado (subtrai penalidade da mão, soma bônus, subtrai penalidade do morto sobre o que já estava lá) e passou a ser **totalmente derivado** a cada chamada: `team.score = breakdown.total`, onde `meldPoints` é recomputado do zero a partir de `team.melds.reduce((s, m) => s + m.getScore(), 0)` - nunca lido do `team.score` anterior, para não haver risco de contar em dobro. Isso significa que qualquer código (UI/store) que dependia de pré-setar `team.score` antes de `finish()` como um proxy de "pontos já acumulados" vai ser ignorado - `finish()` agora é a fonte da verdade.

`closerTeamId` (quem bateu) é detectado exatamente como antes: o time cujo jogador tem a mão vazia E passa em `canClose` (mesmo critério já usado por `isGameOver`).

Idempotência preservada: `finish()` retorna cedo se `status === 'finished'`, então uma segunda chamada não recalcula nada (mesmo `scoreBreakdowns` por referência, mesmo `team.score`).

Testes novos (describe `Parte B - scoreBreakdowns`): soma correta de cada componente por time, `finish()` chamado 2x não muda nem duplica `scoreBreakdowns`, e `team.score === breakdown.total` para todos os times em cenários variados.

### Ajuste nos testes pré-existentes de `finish - team scoring`

Como `meldPoints` agora vem de `team.melds` (não de um `team.score` pré-setado manualmente), os testes antigos que faziam `teamA.score = 100` como atalho para simular "pontos de melds já jogados" foram reescritos: removi esses atalhos e recalculei os valores esperados a partir dos componentes reais (melds de verdade via `cleanCanastra()`, ou 0 quando não há melds). Exemplos: "subtracts sum of remaining hand values" agora espera `-35` (era `65`, que dependia do hack `score=100`); "team that closed... gets +100 bonus" agora espera `355`/`-10` (era `200`/`40`). O teste de `winnerTeam`/idempotência não precisou de números novos pois não fazia asserção de valor absoluto.

## Parte C - IA prioriza canastra limpa antes de sujar (`src/engine/ai.ts`)

Aplicado em **todas** as dificuldades (easy/medium/hard), via 3 helpers privados novos em `AIPlayer`:

- `teamHasCleanCanastra(team)`: `team.melds.some(m => m.isCanastra && m.isClean)`.
- `wouldDirtyCleanCanastra(meld, added)` / `isDirtyMeldMove(move, ownTeam)`: checam a "sujeira" construindo de fato o `Canasta`/`withExtraCards` resultante e lendo `.isClean` - não um heurístico baseado só em `Card.isWild`, então também pega o caso de um '2' natural sujando via "regra do 9".
- `preferNaturalMelds(moves, ownTeam)`: se o time ainda não tem canastra limpa, filtra `moves` para manter só os que não usam curinga; se isso zerar a lista, faz fallback para a lista original (nunca trava a IA numa jogada impossível).

Mudanças concretas:
1. **Guardrail duro** (`findExtendMeldMoves`): nunca propõe um `extend_meld` que transformaria uma canastra limpa existente do time em suja - filtrado na origem, então nem aparece em `getValidMoves()`. Vale para os 3 níveis, já que os 3 usam `getValidMoves()`.
2. **Prioridade**: em `decideEasy`/`decideMedium`/`decideHard`, os buckets de `extend_meld` e `play_canasta` passam por `preferNaturalMelds` antes de escolher (aleatório no easy/medium, determinístico por ordenação no hard). Enquanto o time não tem canastra limpa, jogos naturais são preferidos; uma vez que o time já tem uma, o filtro vira no-op e o comportamento é o mesmo de antes (baixa/estende livremente, inclusive suja).

Testes novos (`tests/engine/ai.test.ts`, describe `Part C`):
- com canastra limpa já na mesa, a IA (hard) pode propor um `play_canasta` sujo (com curinga) para uma segunda sequência;
- sem canastra limpa, com uma opção limpa e uma suja disponíveis na mesma mão, a IA (hard) escolhe a limpa;
- guardrail: com uma canastra limpa de 7 cartas na mesa e só um curinga na mão (que tecnicamente estenderia a sequência), `getValidMoves` nunca inclui esse `extend_meld`, e a IA cai para draw/discard sem travar.

Nenhum teste de IA pré-existente precisou de expectativa alterada - os cenários usados neles são sempre 100% naturais (sem curinga envolvido), então o novo filtro é no-op para eles.

## Verificação final

- `npx tsc --noEmit`: sem erros.
- `npx jest`: 223/223 (ignorando a flakiness pré-existente e fora de escopo em `tests/store/mortoToDeck.test.ts`, confirmada independente desta mudança).
- Nenhum arquivo fora de `src/engine/**` / `tests/engine/**` foi modificado (além deste relatório).

---

## Follow-up: dois bugs ligados no "2-mesmo-naipe" (regra do 9 + gate da IA)

Base ao iniciar: `npx jest` → 222 passed, 1 failed (`tests/store/mortoToDeck.test.ts`, flaky pré-existente fora de escopo - reproduzido isoladamente, some/aparece em reruns sem relação com este trabalho). Nenhum outro teste falhava.

### Bug 2 (raiz) - `analyzeMeld`/`analyzeSequence` em `src/engine/utils.ts`

A "regra do 9" (Interpretação 2 de `analyzeSequence`: um '2' do mesmo naipe atuando como o único curinga da sequência) só olhava se havia uma carta REAL de rank '9' entre as cartas (`others.some(c => c.rank === '9')`). Isso deixava `8♠-2♠-10♠-J♠` marcado como LIMPA, porque o '2' preenche a lacuna do 9 sem que exista nenhuma carta real de rank 9 na mão - o bug reportado pelo usuário.

Fix: em vez de procurar um '9' literal, calculo o valor máximo alcançado pela sequência inteira - cartas reais **e** a posição que o curinga passa a representar (via `computeWildValue`, já usado para o layout/UI) - e sujo o meld sempre que esse máximo for `>= 9`:

```ts
if (genericWildCount === 0 && trySequenceWithAceMode(others, 1, 'low')) {
  const realValues = others.map(c => sequenceRankValue(c.rank, 'low')).sort((a, b) => a - b)
  const wildValue = computeWildValue(realValues, 'low')
  const maxValue = Math.max(...realValues, wildValue)
  return buildSequenceAnalysis(others, natural2, 'low', maxValue < 9)
}
```

Casos verificados (todos em `tests/engine/utils.test.ts`, describe `Bug 2: regra do 9 estendida`):
1. `[6,2,8]` → 2 representa 7, max 8 → **LIMPA**. ✔
2. `[6,2,8]` + `7` → layout `[2(=5),6,7,8]`, max 8 → **LIMPA**. ✔
3. `[2(=5),6,7,8]` + `9` → max 9 → **SUJA**. ✔ (já coberto também em `tests/engine/canasta.test.ts`, incluindo a permanência via `wasDirty`)
4. `[8,2,10,J]` → 2 representa 9 sem nenhuma carta real de rank 9 → **SUJA** (bug corrigido). ✔
5. `[A,2,3,4,5,6,7,8]` com 2 NATURAL (posição 2, ace-low) → **LIMPA**, regra do 9-por-curinga não se aplica (branch de Interpretação 1, não tocado pelo fix). ✔
6. `[7,8,9,10,J,Q,K]` só com cartas reais, sem curinga → **LIMPA** (branch "no same-suit 2 present", também não tocado). ✔
7. Joker ou 2 de naipe diferente → **SUJA** sempre, independente de posição (branches inalterados). ✔

Nenhum teste pré-existente em `canasta.test.ts`/`utils.test.ts` assumia `8-2-10-J` (ou equivalente) como limpo, então não houve necessidade de ajustar expectativas antigas - só adicionei os 8 testes novos acima (describe completo, casos 1-7 + variante joker/naipe-diferente).

### Bug 1 (consequência + reforço) - gate duro em `src/engine/ai.ts`

Com o Bug 2 corrigido, `Canasta.isClean` já enxerga `8-2-10-J` como suja, então `isDirtyMeldMove`/`preferNaturalMelds` (infraestrutura já existente da fase anterior) já deprioritizam esse jogo automaticamente. Mas `preferNaturalMelds` é só uma *preferência* (fallback para a lista completa quando nada é natural) - o time ainda podia BAIXAR um jogo sujo como única opção de mesa, mesmo sem nenhuma canastra limpa fechada. Reforcei com um gate duro, aplicado dentro de `getValidMoves` (portanto vale para as 3 dificuldades, já que todas partem dele):

```ts
private hardGateDirtyMoves(moves: PlayerMove[], ownTeam: Team | undefined): PlayerMove[] {
  if (!ownTeam || this.teamHasCleanCanastra(ownTeam)) return moves
  return moves.filter(m => {
    if (m.type !== 'play_canasta' && m.type !== 'extend_meld') return true
    return !this.isDirtyMeldMove(m, ownTeam)
  })
}
```

Chamado no fim de `getValidMoves` (`return this.hardGateDirtyMoves(moves, ownTeam)`), depois de já ter empilhado draw/canasta/extend/take_discard/discard - então `draw`/`take_discard`/`discard` nunca são removidos, só `play_canasta`/`extend_meld` que resultariam em sujo. Reaproveitei `teamHasCleanCanastra`/`isDirtyMeldMove` já existentes (ground-truth via `Canasta`/`withExtraCards().isClean`, não um heurístico de `Card.isWild`) - nenhuma lógica nova de "o que é sujo" foi necessária, só o ponto de aplicação (gate vs. preferência).

Testes novos (`tests/engine/ai.test.ts`, describe `Bug 1: gate duro`):
- (a) sem canastra limpa fechada, único jogo de mesa disponível é `8-2-10-J` (suja) → `getValidMoves` não inclui nenhum `play_canasta`/`extend_meld`, e `playTurn` cai para `draw`/`discard`. ✔
- (b) com canastra limpa fechada do time (`cleanCanastra('hearts')`), o mesmo tipo de jogo sujo (`8-2-10-J`, outro naipe) aparece normalmente em `getValidMoves` e é baixado por `playTurn`. ✔
- (c) já coberto pelos testes pré-existentes da fase anterior ("sem canastra limpa, com opção limpa e opção suja disponíveis, escolhe a limpa") - continuou passando sem alteração, já que o gate só reforça (nunca contradiz) a preferência por jogos limpos.

Nenhum teste pré-existente de IA precisou de ajuste: os cenários "com canastra limpa" e "guardrail nunca suja canastra limpa existente" continuam batendo, pois o gate é um no-op quando o time já tem canastra limpa fechada, e o guardrail de `wouldDirtyCleanCanastra` é ortogonal (evita sujar uma canastra JÁ baixada, não relacionado a "propor" um jogo novo).

### Verificação final (follow-up)

- `npx tsc --noEmit`: sem erros.
- `npx jest`: **233/233** passed (223 base + 10 novos: 8 em `utils.test.ts` + 2 em `ai.test.ts`), rodado 2x para confirmar a flakiness do `mortoToDeck.test.ts` é intermitente e não relacionada (passou nas duas rodadas completas depois do fix).
- `npx jest tests/store`: 21/21 passed.
- Commits: `c3c06cc fix(engine): regra do 9 considera a posicao que o curinga representa` (Bug 2, `src/engine/utils.ts` + `tests/engine/utils.test.ts`) e `437fc70 fix(engine): IA nao propoe jogo sujo sem canastra limpa fechada do time` (Bug 1, `src/engine/ai.ts` + `tests/engine/ai.test.ts`).
- Nenhum arquivo fora de `src/engine/**` / `tests/engine/**` foi modificado (além deste relatório).
