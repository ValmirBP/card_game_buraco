# Fase 3 — Engine Buraco: regras autênticas de canastra

**Status:** concluído. `npx tsc --noEmit` limpo. `npx jest tests/engine`: **123/123 verde**.

Worktree: `/Users/valmirdebarros/Desktop/proj pessoal/.worktrees/buraco-impl`
Escopo respeitado: apenas `src/engine/**` e `tests/engine/**` foram tocados
(`src/components/Layout.tsx` e `src/store/gameStore.ts` já apareciam modificados
no worktree antes desta tarefa e foram deixados intocados/não commitados por
esta sessão).

## Commits

1. `609885d` — `feat(engine): regras autenticas de canastra (2 como curinga, 7+ cartas, 200/100, bater com limpa)`
   - `src/engine/utils.ts`, `src/engine/canasta.ts`, `src/engine/game.ts`
   - `tests/engine/utils.test.ts`, `tests/engine/canasta.test.ts`, `tests/engine/game.test.ts`
   - Inclui também a regra adicional pedida no meio da tarefa: `setup()` não
     vira mais carta para o descarte (baço com 42 cartas, `discardPile` vazio).

## Mudanças na API pública

### `src/engine/utils.ts`

- **Novo:** `isWildInMeld(card: Card, meldSuit: Suit, positionValue: number): boolean`
  Decide se `card` age como curinga *nesta posição/naipe específicos*:
  - joker (`card.isWild`) → sempre `true`.
  - carta de rank `'2'` → `true` (curinga) **exceto** quando `card.suit === meldSuit && positionValue === 2` (aí é natural).
  - qualquer outra carta real → `false`.

- **Novo:** `analyzeMeld(cards: Card[]): { type: 'sequence' | 'aces'; isClean: boolean } | null`
  Substitui a lógica interna antiga (`isValidAceTrio`/`isValidSequence` ficaram
  embutidas aqui). Único ponto de verdade usado tanto por `isValidCanasta`
  quanto pelo construtor de `Canasta`, evitando divergência entre validação e
  cálculo de "limpo/sujo". Regras:
  - Separa `cards` em `jokers`, `twos` (rank `'2'`, não-joker) e `others` (resto).
  - **Trinca de ases:** `others` só pode conter Ases; exige `others.length >= 2`;
    todo `2` presente conta como curinga (um `2` nunca é "Ás natural");
    `jokers.length + twos.length` deve ser `<= 1`.
  - **Sequência:** `others` define o naipe do jogo (`suit = others[0].suit`,
    todos devem bater); `naturalCandidates` = 2s do mesmo naipe (só **1** pode
    virar natural — o excedente **não pode virar curinga**, invalida o jogo,
    ex.: dois `2♥` na mesma sequência); `wildTwos` = 2s de naipe diferente
    (sempre curinga); `jokers.length + wildTwos.length <= 1`. Se há 1 natural
    candidate, só é válido testando ace-low (`A,2,3...`); sem natural 2, testa
    ace-low e ace-high como antes.
  - **Efeito colateral importante:** um `2` do **mesmo naipe** fora da posição
    2 (ex.: `K♥,A♥,2♥` — "dar a volta") é **inválido**, não vira curinga
    genérico. Só `2` de naipe diferente ou joker podem preencher lacunas como
    curinga.

- `isValidCanasta(cards)` = `analyzeMeld(cards) !== null` (assinatura inalterada).
- `canExtendMeld(existing, added)` inalterado na assinatura; comportamento
  segue automaticamente as novas regras via `isValidCanasta`.
- **Mudança de assinatura:** `canastaPoints(isClean: boolean, cardCount: number): number`
  (antes só recebia `isClean`). Agora retorna `0` se `cardCount < 7`; caso
  contrário `200` (limpa) ou `100` (suja).

### `src/engine/canasta.ts` (`Canasta`)

- **Novo campo:** `isCanastra: boolean = cards.length >= 7`.
- `isClean` agora vem de `analyzeMeld(cards).isClean` (natural 2 não suja).
- **Mudança semântica de `points`:** antes era só o bônus (500/300 fixo a
  partir de 3 cartas). Agora `points = somaValorCartas(scoreCard) + bônus`,
  onde bônus é `0` se `< 7` cartas, `200`/`100` se `>= 7` (limpa/suja).
  `getScore()` simplesmente retorna `this.points` (não soma mais nada por
  cima — antes fazia `cardSum + this.points`, hoje seria dobrar a conta).
- `withExtraCards(added)` inalterado na assinatura; construtor reavalia tudo
  do zero via `analyzeMeld`, então uma canastra suja **nunca** vira limpa ao
  ser estendida (o curinga nunca é removido, só recomputado sobre o conjunto
  maior de cartas).
- Erro lançado no construtor por cards inválidas foi só reescrito na
  mensagem, sem mudança estrutural.

### `src/engine/game.ts` (`Game`)

- **`canClose(team: Team): boolean`** — antes `return team.hasTakenMorto`.
  Agora: `team.hasTakenMorto && team.melds.some(m => m.isCanastra && m.isClean)`.
  Isso é a assinatura que a UI/store precisa saber: uma dupla só pode bater
  com morto tomado **e** pelo menos uma canastra limpa (7+ cartas, zero
  curinga).
- **`isGameOver()`** — o cálculo de "alguém bateu" trocou de checar
  `teamOfSeat(...).hasTakenMorto` direto para chamar `this.canClose(...)`.
- **`finish()`** — a detecção de `closerTeamId` (quem ganha o bônus de +100 e
  fica marcado como "fechou a rodada") também trocou para `this.canClose(...)`
  em vez de só `hasTakenMorto`.
- **`setup()`** (regra adicional pedida durante a tarefa) — não vira mais
  carta para `discardPile`; a pilha de descarte começa **vazia**. Distribuição:
  4×11 (mãos) + 2×11 (mortos) = 66 cartas, sobrando **42** no baço
  (`108 - 66 = 42`). Primeiro jogador da rodada só pode comprar do monte
  (`take_discard` não é uma jogada válida até alguém descartar).

## Impacto para UI/store (fora do escopo desta tarefa, mas relevante)

- `canastaPoints` mudou de assinatura (`(isClean, cardCount)`); qualquer
  código fora do engine que a chamava diretamente precisa passar `cardCount`.
- `Canasta.points` não é mais "só o bônus" — é pontuação total da carta (valor
  + bônus). Qualquer UI que somava `cardValue + points` seria uma contagem
  dupla agora; deve usar `getScore()`/`points` diretamente.
- `Canasta.isCanastra` é novo — UI que decidia "é canastra" olhando
  `cards.length >= 3` (como antes, implícito) deve passar a usar esse campo.
- `Game.canClose` agora pode ser `false` mesmo com `hasTakenMorto = true` —
  UI que habilitava o botão "bater" só checando `hasTakenMorto` vai precisar
  checar `canClose(team)` (que já olha as duas condições).
- `Game.setup()` não popula mais `discardPile` — UI que espera 1 carta visível
  na mesa logo após o setup vai ver a pilha vazia até o primeiro descarte.

## Testes

- `tests/engine/utils.test.ts` — reescrito com `real()`, `joker()`, `two(suit)`
  como helpers; cobre `isWildInMeld` isoladamente e todos os casos do enunciado
  (2 natural em A,2,3; 2 de naipe diferente como curinga; "dar a volta"
  K,A,2 mesmo naipe inválido; dois curingas no mesmo jogo inválido; dois 2s
  do mesmo naipe no mesmo jogo inválido; trinca de ases com 2 como curinga).
- `tests/engine/canasta.test.ts` — reescrito cobrindo `isCanastra`, `isClean`,
  `points` (soma + bônus 0/100/200), extensão mantendo sujeira, K,K,K e
  "dar a volta" lançando erro.
- `tests/engine/game.test.ts` — `canClose`/`isGameOver`/`finish` reescritos
  para exigir canastra limpa além do morto; testes de `setup()` atualizados
  para `discardPile.length === 0` e `deck.length === 42`.
- `src/engine/ai.ts` não precisou de mudanças: a IA já valida todo candidato a
  jogo via `isValidCanasta` antes de propor a jogada, então fica
  automaticamente presa às novas regras (nunca gera jogo inválido); os 21
  testes de `ai.test.ts` passaram sem alteração.

Resultado final: `npx jest tests/engine` → **123 passed, 123 total**.
