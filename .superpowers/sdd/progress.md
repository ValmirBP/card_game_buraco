# Implementation Progress — Buraco Jogatina MVP

**Plan:** `/../../docs/superpowers/plans/2026-08-04-buraco-jogo-implementacao.md`

## Completed Tasks

- **Task 1:** Setup React + Vite + TypeScript (commits: 0514c96..6255664, review: ✅ CLEAN)

## In Progress

- Task 2: Motor de Jogo — Card, Hand, Canasta (dispatched)

## Not Started

- Task 3–15

---

**Notes:**
- Worktree: `.worktrees/buraco-impl`
- Base commit: `a5395bf` (repo init)
Task 2: complete (commits d270128..98bcad1, review: 1 Critical + 1 Important fixed, re-review clean)
Task 3: complete (commit 75913bf, inline review clean; Minor p/ review final: playTurn(gameState: any) sem tipo)
Task 4: complete (commit d1d50b4, review clean — 0 Critical/Important)
  Minors p/ review final: teste medium-discard com assert dentro de if; teste easy fraco; código morto ai.ts:63; heurística de canasta não-exaustiva (documentada)
Task 5: complete (commit 010406a, review clean — 0 Critical/Important)
  Gap do plano detectado: pontuação final (mão negativa + bônus fechamento) ausente — fix despachado
  Minors p/ review final: type assertions unknown em game.ts (Player sem addCanasta/clone na interface); empate sem teste
Task 5 fix: pontuação final implementada (commit e61c104, 56/56 testes, TDD, idempotente)
Task 6: complete (commit 330a4c5, review clean — 0 Critical/Important; 65/65 testes)
  Minor p/ review final: cast (as AIPlayer) em gameStore.ts:192 — mesmo padrão de game.ts
Task 7: complete (commit c877348, inline review clean; build ok, cores v4 via @theme)
  Minor p/ review final: tailwind.config.js é dead code no Tailwind v4 (ignorado) — remover na limpeza
Task 8: complete (commit 6a8f5e1, 69/69 testes, build ok — Menu/DifficultySelector/RulesModal em PT-BR)
Task 9: complete (commit 6df9c3d, review: 1 Critical [aiTurn não dispara em remount sob StrictMode] + 1 Minor)
  -> Critical será corrigido no overhaul visual (mesmo arquivo Gameplay.tsx)
Task 10 (Result) + polish visual: consolidados em uma task de overhaul (pedido do usuário: mais estilo + cartas coloridas)

=== FASE 1.5 (visual) concluída ===
Overhaul visual commitado (7f364e1): tema cassino, cartas 2-cores legíveis, curinga desenhado, PT-BR, mão justa, ordenação AKQJ. 69/69 testes.
Fix Tailwind v4 (@import) foi a causa raiz da UI quebrada.

=== FASE 2 (Buraco tradicional) iniciada ===
Spec: docs/superpowers/specs/2026-08-04-buraco-fase2-4jogadores-design.md
Regras: 4 jogadores/2 duplas, morto (cruz), ás nas 2 pontas, trinca de ases, comprar descarte, estender jogos baixados.
- Fase 2.1 MOTOR: despachado (engine rework, TDD) — em andamento
- Fase 2.2 STORE: pendente
- Fase 2.3 UI mesa 4 assentos + morto em cruz: pendente

Fase 2.1 MOTOR: completo (commits 22d14a9, 3c4e09a, 1de0ac3) — 102 testes engine. Revisão: APPROVED.
  Follow-ups (não-bloqueantes): 
   [Important] finish() sem penalidade por morto não pego (spec 3.6) — implementar depois
   [Important] takeDiscardPile não impõe "usar carta do topo" — garantir na store/UI (habilitar botão só se topo é jogável)
   [Minor] canClose sem exigir canastra limpa (spec marca opcional)
Fase 2.2 STORE: em finalização (gameStore.ts já na nova API)
Fase 2.2 STORE: completo (commit ac77519) — 116 testes store+engine
Fase 2.3 UI mesa 4 assentos: completo (commits 578cad7, 1f15ce2, e0038d9) — tsc 0 erros, 120 testes, verificado ao vivo
  + fix portal modais (e9af1d7) — DifficultySelector/RulesModal agora empilham corretamente
FASE 2 JOGÁVEL: localhost:5173 (4 jogadores/2 duplas/morto). localhost:5174 = 2 jogadores (visual).
Follow-ups não-bloqueantes pendentes: penalidade morto-não-pego em finish(); regra "usar topo" do descarte é best-effort na UI; canClose sem exigir canastra limpa.

=== FASE 3 concluída ===
Motor (609885d): 2 como curinga por posição, canastra=7+, pontos 200 limpa/100 suja + soma cartas, bater exige canastra limpa + morto, suja permanente, descarte inicial vazio (42 no baço). 123 testes engine.
UI (562b4d6..a194825): pegar descarte corrigido (sempre habilitado c/ aviso), morto em CRUZ c/ badge 11 cartas, animação compra (desliza+flip+organiza), feltro realista c/ moldura madeira, nomes editáveis dos bots, placar das duplas, registro abaixo da mão.
Integração (c733634): testes store alinhados. TOTAL: 143/143 testes, tsc limpo, build ok.

=== FASE 3b concluída ===
Motor (d2ced92, 8b11660): 2-mesmo-naipe como curinga mantém limpa (só ace-low), regra do 9 (só suja se 2 ainda curinga no momento, permanente), Canasta.layout/resolveMeldLayout, IA propõe take_discard e prioriza extend_meld. 
UI inline: animação compra com pausa 1.2s; seleção da mão sem cobrir vizinha; melds renderizados via layout. 167/167 testes, build ok.
Regras extra: morto vira monte quando baço acaba (90a23c2, 170 testes); IA fácil sempre baixa/estende quando pode.

=== Regras oficiais Jogatina (Fase 3c) ===
Motor (a45fcb7, 28f7b2c, 0836608): tabela nova de valores (A15/K-8=10/7-3=5/2=10/joker20), canastra de quinhentos (500) e Real (1000), ás nas 2 pontas (14 cartas), penalidade -100 morto não pego, batida direta testada. 197 testes.
Exceções do usuário mantidas: trinca de ases; 2-mesmo-naipe nasce limpa + regra do 9.
UI: lixo totalmente aberto (leque com scroll), rótulos de canastra por tipo, store usa scoreCardValue.

=== Fase 5 (ajustes pós-entrega) ===
Motor+IA (10c1db2, 2f3a696): penalidade morto -100 só se !hasTakenMorto E mortos>0 (não pune se virou monte); TeamScoreBreakdown em state.scoreBreakdowns (meldPoints/batidaBonus/mortoPenalty/handPenalty/total; team.score=total derivado); IA todos níveis evita sujar canastra limpa e prioriza limpa antes de suja. 223 testes.
UI inline: carta deitada na canastra fechada (GameBoard); tela de resultado com detalhamento por dupla (Result). tsc/build ok.

Fase 5b (bugs de jogo real): regra do 2-mesmo-naipe corrigida (c3c06cc — limpa só até 8, suja do 9+ considerando posição do curinga); IA gate duro: não desce jogo sujo sem canastra limpa fechada (437fc70). Teste mortoToDeck de-flaked. 233 testes.

=== Fase 6 (partida por pontos) ===
Store (d55e80f): partida até 3000 (MATCH_TARGET), matchScores/matchCanastras/round/matchWinner/matchConfig, accumulateMatchRound + finalizeRoundIfNeeded (guard roundFinalized), startNextRound recria rodada mantendo acumulado. Result: fim de rodada vs fim de partida, total X/3000 com barra, canastras limpas/sujas por dupla. App: handleNextRound/handleNewMatch. 243 testes.

=== Multiplayer M1-M3 + fix curinga ===
M1 GameSession (2ada70f), M2 servidor WS (63a574b), M3 cliente online+lobby (75908c6). Fix: IA nunca descarta curinga (joker/2) com carta comum na mão. 301 testes.

QR code (3b3a233): servidor manda serverUrl (IP LAN); lobby gera QR client-side (dep qrcode) da joinUrl ?sala=CODE; escanear abre direto na tela de entrar com código preenchido. Fix curinga + layout fit também na main. 301 testes.
