# Buraco Jogatina

Jogo de cartas **Buraco Aberto** (estilo Jogatina) para 4 jogadores em duplas, jogando contra a IA. Rodando 100% no navegador, como Progressive Web App (PWA) instalável — dá para jogar no celular sem precisar de loja de aplicativos.

## O que é

- 4 jogadores, 2 duplas (você + parceiro controlado pela IA vs. dupla adversária controlada pela IA).
- Regra do **morto**: cada dupla pode pegar um monte de 11 cartas reservado quando um jogador daquela dupla bate (fecha) uma canastra limpa.
- Canastras (sequências de 7+ cartas do mesmo naipe): **limpa** (sem curinga, +200), **suja** (com curinga, +100), **quinhentos** (13 cartas, 2-ao-Ás, limpa, +500) e **real** (14 cartas, Ás-ao-Ás, limpa, +1000).
- Trinca de Ases (2 a 4 Ases reais, com no máximo 1 curinga) é reconhecida como jogo válido, à parte das sequências.
- Interface em português, com tabuleiro de mesa de feltro, animações de compra/descarte e placar de duplas.

## Stack

- React 18 + TypeScript
- Vite (build/dev server)
- Tailwind CSS v4
- Zustand (estado do jogo)
- Framer Motion (animações)
- Jest + Testing Library (testes)

## Como rodar

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`.

## Como buildar

```bash
npm run build
npm run preview   # serve o build de produção em http://localhost:4173
```

O build gera um app instalável como PWA: manifest (`public/manifest.webmanifest`), ícones (`public/icons/`) e service worker (`public/sw.js`), copiados automaticamente pelo Vite para `dist/`.

## Como jogar no celular (rede local)

1. Rode `npm run dev` (o servidor já escuta em `0.0.0.0:5173`, então fica acessível pela rede local) ou `npm run build && npm run preview` para testar o build de produção.
2. Descubra o IP do computador na rede local (Wi-Fi):
   - macOS: `ipconfig getifaddr en0` (ou veja em Ajustes > Wi-Fi).
3. No celular (mesma rede Wi-Fi), abra o navegador (Chrome no Android) em `http://IP-DO-COMPUTADOR:5173` (ou `:4173` se usar o preview).
4. Toque no menu do navegador e escolha **"Adicionar à tela inicial"** (ou "Instalar app"). O jogo abrirá em tela cheia, como um app nativo, sem precisar de loja.

> Em produção (`npm run preview` ou hospedado via HTTPS), o service worker cacheia os assets do build, permitindo abrir o app mesmo com conexão instável. Em `npm run dev` o service worker não é registrado, para não atrapalhar o hot-reload.

## Regras implementadas (resumo e exceções)

- Cada jogador recebe 11 cartas; 2 mortos de 11 cartas ficam reservados; o restante forma o monte de compra. O descarte começa vazio (primeiro jogador só pode comprar do monte).
- Curingas: os 4 coringas (jokers) e as cartas de rank `2`. Um `2` só é **natural** (não conta como curinga) quando está no mesmo naipe da sequência e na posição correta dessa sequência — em qualquer outro caso (naipe diferente, ou posição fora da sequência), o `2` sempre vale como curinga. No máximo 1 curinga por jogo (sequência).
- **Trinca de ases**: 2 a 4 Ases reais (de quaisquer naipes) formam um jogo válido à parte, podendo incluir 1 curinga.
- **Regra do 9** ("sujeira permanente"): uma vez que uma sequência ficou suja por causa de um `2` do mesmo naipe usado como curinga, ela permanece suja mesmo que depois uma carta real preencha a posição de forma que a análise voltaria a parecer limpa.
- Ás vale nas duas pontas da sequência (Ás-2-3... ou Q-K-Ás), afetando o cálculo de que canastra é "quinhentos" (2 ao Ás) ou "real" (Ás ao Ás).
- **Batida direta** sem pegar o morto: uma dupla que fecha o jogo sem nunca ter pego o morto sofre penalidade de -100 pontos.
- Fim de jogo: quando o monte e os dois mortos se esgotam, ou quando uma dupla bate (fecha a mão) tendo satisfeito a condição do morto (já pegou o morto, ou não havia morto disponível) e possuindo ao menos uma canastra limpa.
- Buraco **Aberto**: a pilha de descarte fica sempre visível e rolável, sem "carta virada" oculta.

## Estrutura de pastas

```
src/
  engine/       # regras do jogo, puro TypeScript (sem UI): card, hand, player,
                # gameState, game, canasta, ai, utils
  store/        # estado global (Zustand) que liga a engine à UI
  components/
    Menu/       # tela inicial, seletor de dificuldade, modal de regras
    Gameplay/   # tabuleiro, mão do jogador, painel de ações, placar, animações
    Result/     # tela de resultado final
  styles/       # CSS global (Tailwind v4 + tema de mesa de feltro)
public/
  manifest.webmanifest   # manifesto PWA
  sw.js                  # service worker (cache-first, vanilla)
  icons/                 # ícones do app (SVG + PNG 192/512)
tests/          # suíte de testes Jest (engine, store, componentes)
```

## Testes

```bash
npm test         # roda a suíte completa (197 testes)
npm run test:watch
```

Cobrem a engine (regras de sequência, curingas, trinca de ases, morto, pontuação), a store (Zustand) e componentes de UI principais.
