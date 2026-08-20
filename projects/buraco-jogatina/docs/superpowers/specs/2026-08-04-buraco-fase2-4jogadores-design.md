# Buraco Fase 2 — 4 Jogadores em Duplas + Morto

**Data:** 2026-08-04
**Base:** Estende o MVP (motor + UI 1×IA). Converte para o Buraco tradicional de 4 jogadores em 2 duplas, com morto.

---

## 1. Objetivo

Transformar o jogo de "1 humano × 1 IA" para o **Buraco tradicional**:

- 4 jogadores, 2 duplas (parceiros de frente um pro outro)
- Modo solo: **você + parceiro IA** × **2 IAs adversárias**
- Mecânica do **morto** (mãos de morte)
- Pontuação **por dupla** (canastras compartilhadas do time)
- Ordenação de cartas **A K Q J 10 9 8 7 6 5 4 3 2 A** (Ás nas duas pontas)
- Visual: mesa de carteado com 4 assentos, cartas fundo branco/naipes coloridos, versos de cores diferentes por baralho, efeitos/animações

---

## 2. Assentos, Duplas e Ordem de Turno

```
              [ Assento 2: Parceiro IA ]
                        (Dupla A)
   [ Assento 1 ]                    [ Assento 3 ]
   Adversário IA                    Adversário IA
     (Dupla B)                        (Dupla B)
              [ Assento 0: Você ]
                    (Dupla A)
```

- **Dupla A (Nós):** assentos 0 (humano) e 2 (parceiro IA)
- **Dupla B (Eles):** assentos 1 e 3 (ambos IA)
- **Ordem de turno:** 0 → 1 → 2 → 3 → 0 (sentido anti-horário na tela, padrão do jogo)
- Parceiros ficam sempre em assentos opostos (0↔2, 1↔3)

---

## 3. Mudanças no Motor

### 3.1 Novo conceito: Team

```typescript
type TeamId = 'A' | 'B'

interface Team {
  id: TeamId
  playerSeats: number[]      // [0, 2] ou [1, 3]
  melds: Canasta[]           // jogos/canastras COMPARTILHADAS da dupla
  score: number              // pontuação da dupla
  hasTakenMorto: boolean     // já pegou o morto?
}
```

- Canastras passam a pertencer ao **time**, não ao jogador. Qualquer parceiro pode adicionar cartas às canastras do time.
- `GameState.melds: Map<playerId, Canasta[]>` → **`teams: Team[]`** (melds movem pra dentro de Team).

### 3.2 GameState (revisado)

```typescript
interface GameState {
  players: Player[]          // 4 jogadores (seat = índice)
  teams: Team[]              // 2 times
  currentPlayerIndex: number // 0..3
  deck: Card[]               // baço
  discardPile: Card[]
  mortos: Card[][]           // 2 mortos, 11 cartas cada
  round: number
  status: 'setup' | 'playing' | 'finished'
  winnerTeam?: TeamId
}
```

### 3.3 Setup

- 2 baralhos + curingas (mantém 108 cartas — validar total após reservar mortos)
- Distribui **11 cartas** para cada um dos 4 jogadores (Buraco tradicional: 11, não 14)
- Reserva **2 mortos** de 11 cartas cada
- Vira 1 carta pro descarte inicial
- Restante = baço

> Contagem: 4×11 (mãos) + 2×11 (mortos) + 1 (descarte) = 67 cartas usadas de imediato; resto no baço. Ajustar composição do baralho se necessário para fechar a conta (documentar no plano).

### 3.4 Turno

Igual ao MVP, mas por assento (0..3) e melds do time:
1. Comprar 1 do baço (ou pegar o descarte inteiro, regra futura)
2. Baixar/estender jogos do **time**
3. Descartar 1

### 3.5 Morto

- Quando um jogador **zera a mão** durante o turno (após descartar ou baixar tudo) e o **time ainda não pegou o morto**:
  - O jogador **pega um morto** como nova mão (o time marca `hasTakenMorto = true`)
  - O jogo continua
- Um time só pode **bater (fechar)** se `hasTakenMorto === true` (e, regra tradicional, ter ao menos uma canastra limpa — configurável).
- Se um jogador zera a mão e o time **já pegou** o morto e cumpre os requisitos de batida → **bate** (fim da mão).

### 3.6 Fim e Pontuação (por dupla)

- Mão termina quando um time **bate** (ou baço/descarte esgotam = "buraco").
- Pontuação da **dupla**: soma das canastras do time (limpa 500 / suja 300, valores atuais do MVP mantidos nesta fase) + bônus de batida (+100) − valor das cartas que sobraram nas mãos dos dois parceiros − penalidade por morto não pego.
- `winnerTeam` = time de maior pontuação.

### 3.7 Ordenação de cartas (A K Q J 10 … 2 A)

- Nova função de ordenação para exibição e lógica: sequência de exibição **decrescente** A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2.
- **Ás nas duas pontas:** A pode ser alto (…Q-K-A) ou baixo (A-2-3). `isValidCanasta` deve aceitar as duas leituras do Ás ao validar sequências e no cálculo de lacunas para curinga.
- Ordenação da mão exibida segue A K Q J 10…2 agrupando por naipe.

### 3.8 IA (3 assentos)

- `AIPlayer` reaproveitada (easy/medium/hard), agora rodando para 3 assentos (1 parceiro + 2 adversários).
- **Consciência de time:** a IA deve baixar em canastras do **próprio time** e considerar o parceiro (não descartar cartas que ajudem os adversários; ajudar a completar canastras do time). Ampliar `GameStateForAI` com `teams`.
- Dificuldade escolhida no menu aplica-se às 3 IAs (ou só às adversárias — decidir no plano; default: todas as IAs no mesmo nível).

---

## 4. Mudanças na UI

### 4.1 Mesa de 4 assentos

- Layout tipo mesa de carteado: **você embaixo**, **parceiro em cima**, **adversários nas laterais** (esquerda = assento 1, direita = assento 3).
- Cada assento: avatar, nome, nº de cartas na mão (viradas para os outros), indicador de dupla (cor do time), rótulo do turno.
- Centro da mesa: baço (verso), descarte, mortos (2 cartas viradas até serem pegos), e as **canastras por dupla** (dois painéis: "Nós" e "Eles").
- Só a **sua mão** é visível (cartas abertas); parceiros/adversários mostram versos.

### 4.2 Cartas

- **Fundo branco**, naipes tradicionais em 2 cores (copas/ouros vermelho, paus/espadas preto).
- **Versos de cores diferentes** por baralho (verso azul e verso vermelho) — o monte mostra os dois.
- Mão ordenada A K Q J 10…2 agrupada por naipe. ✅ (implementado na Fase 1.5)

### 4.4 Visibilidade da mesa (refinamento do usuário)

- **Descarte visível** — o jogador deve ver a pilha de descarte (ao menos a carta do topo, idealmente as últimas cartas em leque/pilha).
- **Cartas baixadas visíveis** — todos os jogos/canastras baixados (de ambas as duplas) ficam abertos e visíveis na mesa.
- **Morto visível em cruz** — os 2 mortos ficam na mesa, cada um representado por **duas cartas viradas cruzadas** (uma sobre a outra em formato de cruz/✚), até serem pegos.

### 4.3 Efeitos (bem-vindos)

- Distribuição inicial animada (cartas voando para os 4 assentos).
- Compra/descarte com movimento e leve rotação.
- Canastra formada: brilho + contador de pontos com pop.
- Pegar o morto: animação de destaque ("Morto!").
- Batida: efeito de vitória (confete/flash) + banner.
- Indicador "IA pensando…" nos turnos das IAs.
- Transições suaves entre telas.

---

## 5. Impacto e Estratégia de Migração

Arquivos do motor a alterar: `gameState.ts` (teams, mortos), `game.ts` (setup 11 cartas, morto, batida, pontuação por dupla, ordem 0..3), `canasta.ts`/`utils.ts` (Ás nas duas pontas, ordenação), `ai.ts` (consciência de time, `GameStateForAI` com teams), `card.ts` (cor do verso). Store e UI acompanham.

Estratégia: **TDD** no motor primeiro (regras de time, morto, batida, pontuação, Ás-duplo), depois store, depois a mesa 4-assentos + efeitos. Reaproveitar o design de cartas/tema/efeitos do overhaul visual da Fase 1.5.

---

## 5.1 Regras adicionais de jogo (refinamentos do usuário)

Estas entram no motor da Fase 2:

1. **Ás nas duas pontas** — o Ás pode ser alto (…Q-K-A) ou baixo (A-2-3) em sequências do mesmo naipe. `isValidCanasta` valida as duas leituras.
2. **Ases em trio (trinca de ases)** — além das sequências do mesmo naipe, um **trio (ou mais) de ases** é um jogo válido — três ou mais Áses juntos formam uma canastra, independentemente do naipe. (Exceção às regras normais de sequência; vale só para Ás.)
3. **Comprar o descarte** — no lugar de comprar do monte, o jogador pode **pegar a pilha de descarte inteira** para a mão. Condição (Buraco tradicional): só pode pegar se conseguir usar imediatamente a carta do topo em um jogo (baixando ou estendendo). Ao pegar, todas as cartas do descarte vão para a mão.
4. **Estender jogos baixados** — se o jogador já tem um jogo/canastra baixado na mesa e tem na mão uma carta que continua aquela sequência (ou um Ás para uma trinca de ases), pode **adicionar a carta ao jogo já baixado** (do seu time), em vez de só formar jogos novos. Vale para os jogos do próprio time (parceiros compartilham).

## 6. Fora de escopo desta fase (possível Fase 3)

- Regras avançadas de canastra brasileira autêntica (canastra = 7+ cartas, valores 200/100), caso o usuário queira depois
- Multiplayer entre dispositivos + modo TV (Fase original planejada)

---

**Status:** Aguardando conclusão do overhaul visual (Fase 1.5) para iniciar implementação.
