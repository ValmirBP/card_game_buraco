# Buraco Jogatina

Jogo de cartas **Buraco Aberto** (estilo Jogatina) para 4 jogadores em duplas. Roda no navegador, como app Android (Capacitor) e tem modo **online** com salas por código/QR. Interface em português, mesa de feltro, animações de compra/descarte e placar de duplas.

## Modos de jogo

- **Contra a IA** (offline): você + parceiro IA contra duas IAs, em 3 dificuldades (fácil, médio, difícil). A partida pode ser retomada ("Continuar partida").
- **Online**: salas com 4 lugares; lugares sem humano são preenchidos por IA. Um servidor Node (`server/`) ou **o próprio celular** (servidor WebSocket embutido no app Android) hospeda a sala. Entra-se por código, link ou QR.
  Quem cai no meio da partida volta para a mesma vaga com um **token de reconexão** (gerado pelo servidor e guardado só no aparelho do jogador); saber o código da sala e o nome não basta para assumir a vaga de outro.
  Na partida online há **reações só com emojis** (selo 💬 ao lado de "Sua Mão"; a paleta abre para cima): 12 emojis fixos, sem texto livre; o servidor só aceita emojis da lista e limita a 1 reação a cada 1,5 s por jogador. O emoji aparece num balão sobre quem mandou, para toda a sala, e some em 3 s.

## Stack

React 19 + TypeScript, Vite, Tailwind CSS v4, Zustand, Framer Motion, Capacitor 8 (Android), `ws` (servidor), Jest + Testing Library.

## Como rodar

```bash
npm install
npm run dev          # http://localhost:5173
npm run server       # servidor online (porta 3001, ou PORT=...)
npm start            # build + servidor servindo o jogo (online no navegador)
```

O modo online no navegador precisa do servidor rodando. No celular, abra `http://IP-DO-COMPUTADOR:5173` (dev) ou `:3001` (`npm start`) na mesma rede Wi-Fi.

## Testes e verificação

```bash
npm test             # suíte completa (Jest)
npx tsc --noEmit     # checagem de tipos
npm run build        # tsc + vite build
```

## Android

Veja [COMO-GERAR-APK-ANDROID.md](COMO-GERAR-APK-ANDROID.md). O app é travado em paisagem.

## Regras implementadas

- 2 baralhos + 4 curingas (108 cartas). Cada jogador recebe 11 cartas; 2 mortos de 11 ficam reservados; o resto é o monte. O descarte começa **vazio** (o primeiro jogador só compra do monte).
- **Curingas**: os 4 coringas e qualquer carta `2`. Um `2` só é natural quando é do mesmo naipe da sequência e ocupa a posição 2; fora disso vale como curinga. No máximo **1 curinga por jogo**.
- **Jogo válido**: sequência de 3+ cartas do mesmo naipe (Ás vale nas duas pontas: A-2-3… ou Q-K-A) ou **trinca de Ases** (2 a 4 Ases reais, de quaisquer naipes, com no máximo 1 curinga; nunca vira canastra).
- **Canastra** = jogo com 7+ cartas: limpa (sem curinga) +200, suja +100, **quinhentos** (13 cartas, 2 ao Ás, limpa) +500, **real** (14 cartas, Ás ao Ás, limpa) +1000. Estender um jogo recalcula se ele é limpo: um `2` do mesmo naipe que voltou à sua posição deixa a canastra limpa de novo.
- **Turno**: comprar do monte ou pegar o descarte inteiro, baixar/estender jogos, descartar. Se o descarte tinha só 1 carta quando foi pego, essa carta não pode voltar ao descarte no mesmo turno. Pegar o descarte não exige usar a carta do topo.
- **Morto**: quando um jogador da dupla esvazia a mão pela primeira vez, pega o morto automaticamente e segue jogando. Se o monte acaba, um morto ainda disponível vira o novo monte; quando monte e mortos acabam, o descarte é reembaralhado em novo monte. A rodada só termina por batida (ou, em caso extremo, com tudo vazio).
- **Bater**: só vale se a dupla já pegou o morto (ou não havia morto) e tem ao menos uma canastra limpa. Bater dá **+100**.
- **Penalidades do morto** (-100): a dupla nunca pegou um morto que ainda estava disponível, ou pegou e o jogador que o pegou nunca jogou com a mão nova.
- Fim da rodada: alguém bate. A pontuação da rodada soma jogos + bônus de batida + penalidade do morto - cartas que sobraram nas mãos (jokers 20, Ás 15, 8 a K 10, 3 a 7 5, 2 10). Em empate de pontos da rodada, a dupla A é a vencedora da rodada.
- **Partida**: soma as rodadas até **3000 pontos**.
- **Vulnerável (VU)**: a dupla com **1500 pontos ou mais** na partida fica vulnerável nas rodadas seguintes: a primeira descida da rodada precisa somar **75 pontos** em cartas (mesmos valores da contagem: coringa 20, Ás 15, 2 e 8 a K 10, 3 a 7 5), podendo juntar vários jogos na mesma descida. Depois de abrir, a rodada segue normal. A condição é reavaliada a cada rodada pelo placar atual. Vale offline e online, inclusive para as IAs; o placar mostra o selo **VU** e um aviso aparece no início da rodada.

## Estrutura

```
src/
  engine/       regras puras (card, hand, player, gameState, game, canasta, ai, utils)
  session/      GameSession: partida autoritativa usada pelo servidor (offline e online usam o mesmo motor)
  store/        estado do jogo local (Zustand) e salvamento da partida
  online/       cliente online (store, links, QR, servidor embutido no app)
  components/   Menu, Gameplay (mesa, mão, jogos baixados), Online, Result
  styles/       Tailwind v4 + tema de feltro
server/         servidor WebSocket (salas, protocolo)
android/        projeto Capacitor (inclui HostServerPlugin: servidor WebSocket no celular)
public/         manifest, ícones e sw.js
tests/          Jest (engine, session, server, online, store, components, ui)
docs/           specs, planos e relatórios históricos do desenvolvimento
```

`public/sw.js` é um *kill-switch*: versões antigas registravam um service worker que servia um shell velho dentro do WebView (tela verde). Ele apaga caches e se desregistra; `src/main.tsx` também remove qualquer service worker registrado.

## Jogos baixados sem rolagem

`src/components/Gameplay/meldLayout.ts` calcula, para o espaço medido do quadro de cada dupla, o maior tamanho de carta em que **todos** os jogos cabem (quebrando jogos longos em sub-colunas); `MeldArea.tsx` desenha o resultado. Canastras fechadas ganham moldura grossa e uma faixa com o tipo (REAL, 500, LIMPA, SUJA).
