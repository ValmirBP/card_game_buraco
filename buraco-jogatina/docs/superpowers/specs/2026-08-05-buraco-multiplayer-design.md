# Buraco Multiplayer — Design (rede local, vagas flexíveis)

**Data:** 2026-08-05
**Base:** jogo single-player completo na `main` (motor + store + UI, 243 testes). Multiplayer é adição, não reescrita.

## Decisões (confirmadas pelo usuário)
- **Conexão:** servidor local no PC do usuário; dispositivos na mesma rede Wi-Fi conectam pelo IP (ex.: `192.168.x.x:PORTA`). Sem nuvem.
- **Formato:** sala de 4 lugares; cada lugar pode ser humano (que entrou) ou IA (preenche vaga). Ex.: 2 humanos + 2 bots.
- **Modo TV:** fase posterior.

## Arquitetura
Servidor **autoritativo**: roda o motor de jogo; clientes enviam INTENÇÕES, servidor valida e transmite o estado. Isso evita trapaça e mantém uma única fonte de verdade.

```
Celular A ─┐
Celular B ─┼─ WebSocket ─→ [Servidor Node]  (roda GameSession por sala)
   TV*    ─┘                  motor + IA das vagas vazias + estado por assento
```
(*TV = fase posterior, entra como espectador da mesa.)

O motor (`src/engine/`) é TS puro e roda igual no Node e no navegador — **lógica de regras compartilhada**.

## Fases

### M1 — GameSession (orquestrador headless) [FUNDAÇÃO]
Extrair a orquestração hoje presa no `gameStore` (Zustand) para uma classe **sem React/Zustand**, usável tanto no servidor quanto (futuramente) no client:
- `GameSession` encapsula: o `Game` (rodada) + camada de partida (matchScores, matchCanastras, round, matchWinner) + turnos de IA das vagas IA + aplicação de intenções + **views redigidas por assento** (mão própria visível; mãos alheias só como contagem).
- API: `applyIntent(seat, intent)`, `runAiTurns()` (roda IAs até vez de humano ou fim), `getViewFor(seat)`, `getPublicTableView()` (pra TV depois).
- NÃO altera store/UI atuais (single-player continua no store existente). Novo módulo + testes.

### M2 — Servidor WebSocket + salas
- Node + `ws`. Registro de salas: `criar sala` → código de 4-6 chars; `entrar(código, nome)` → recebe um assento livre; host inicia.
- Cada sala tem uma `GameSession`. Vagas não preenchidas por humanos = IA (dificuldade escolhida pelo host).
- Protocolo (JSON): cliente→servidor `{type:'join'|'start'|'intent', ...}`; servidor→cliente `{type:'state', view}` (redigida por assento), `{type:'log'}`, `{type:'error'}`, `{type:'lobby'}`.
- Turnos de IA rodados pelo servidor com pequeno delay; broadcast a cada mudança.
- Reconexão básica (mesmo nome reassume o assento) — best-effort.
- Servido junto do build estático do jogo, e imprime o IP/porta pra digitar no celular.

### M3 — Cliente modo online + lobby
- Nova camada de client (adaptador WS) que envia intenções e renderiza a `view` recebida do servidor (em vez de mutar um `Game` local).
- Tela de lobby: criar/entrar em sala por código, lista de assentos (quem é humano/IA), botão iniciar (host).
- Reaproveitar os componentes de mesa/mão atuais, alimentados pela `view` do servidor. Menu ganha "Jogar online" além de "Jogar vs IA" (single-player intacto).

### M4 — Modo TV (fase posterior)
- Uma tela entra como espectador (`getPublicTableView`): mostra a mesa inteira, sem nenhuma mão, ideal pra TV/Chromecast; celulares continuam mostrando a mão.

## Princípios
- Single-player nunca quebra: modo online é adição paralela.
- Servidor é a autoridade: cliente nunca decide regra, só envia intenção e renderiza.
- Privacidade por assento: servidor nunca manda a mão de um jogador pra outro.
- TDD no GameSession (regras/estado) e no roteamento de salas.

## Fora de escopo (agora)
- Nuvem/deploy externo; contas/persistência; ranking; chat.
