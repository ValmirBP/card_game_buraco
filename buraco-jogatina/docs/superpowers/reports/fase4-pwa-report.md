# Fase 4 — PWA instalável + documentação

## Status

Concluído. Todos os itens do escopo (PWA, polish mobile, README, verificação) foram entregues na worktree `/Users/valmirdebarros/Desktop/proj pessoal/.worktrees/buraco-impl`.

## Commits

- `078bb3d` — `feat: PWA manifest + service worker + mobile polish`
- `23a60ef` — `docs: README`

## O que foi feito

### PWA
- `public/manifest.webmanifest`: name "Buraco Jogatina", short_name "Buraco", `display: standalone`, `orientation: any`, `lang: pt-BR`, `theme_color`/`background_color` = `#0f5132` (verde da mesa, confirmado em `Layout.tsx` e `src/styles/index.css` — `--color-card-green`). Ícones SVG (`purpose: any`) + PNG 192/512 (`any` e `maskable`).
- Ícones gerados em `public/icons/`: `icon.svg` (desenhado à mão — mesa verde com bordas arredondadas e espada dourada em gradiente), convertido para `icon-192.png` e `icon-512.png` via `sips` (built-in do macOS; não havia `convert`/`rsvg-convert`/`canvas`/`sharp` disponíveis, mas `sips -s format png icon.svg --out ... -z W H` funcionou bem e a checagem visual (Read da imagem) confirma um ícone nítido e legível.
- `public/sw.js`: service worker vanilla, cache-first. Precache do app shell (`/`, `/index.html`, `/manifest.webmanifest`) no install; runtime cache para `/assets/*` (os arquivos com hash do build). Versionamento via `CACHE_VERSION` (`buraco-jogatina-v1`); o `activate` apaga qualquer cache de versão anterior. `skipWaiting()` + `clients.claim()` implementados. Sem workbox/CDN.
- Registro do SW movido para `src/main.tsx`, condicionado a `import.meta.env.PROD && 'serviceWorker' in navigator` (não registra em `npm run dev`, evitando conflito com HMR). Precisou criar `src/vite-env.d.ts` (`/// <reference types="vite/client" />`) porque `import.meta.env` não tipava sem isso.
- `index.html`: `<link rel="manifest" href="/manifest.webmanifest">` (era `/manifest.json`, arquivo que não existia), `theme-color` atualizado para `#0f5132`, `<link rel="apple-touch-icon" href="/icons/icon-192.png">` e `<link rel="icon">` SVG. Removido o script inline de registro do SW (agora fica em `main.tsx`, guardado por ambiente).

### Polish mobile
- `viewport` meta agora inclui `viewport-fit=cover` e `user-scalable=no` (evita zoom acidental em toques rápidos).
- `overscroll-behavior: none` adicionado em `html, body` no `src/styles/index.css` (evita pull-to-refresh no meio da partida).
- Barra de ações (`ActionPanel.tsx`) **já** tinha `pb-[max(0.75rem,env(safe-area-inset-bottom))]` implementado antes desta fase — nenhuma mudança necessária ali.

### README.md
Criado na raiz da worktree, em PT-BR: o que é o jogo (Buraco Aberto, 4 jogadores/duplas vs IA, morto, canastras de quinhentos/real), stack, como rodar/buildar, como jogar no celular na rede local (IP do computador + "Adicionar à tela inicial"), resumo das regras implementadas com as exceções pedidas (trinca de ases válida, regra do 2 do mesmo naipe como curinga/natural, regra do 9/sujeira permanente, Ás nas duas pontas, batida direta sem morto = -100), estrutura de pastas e testes (`npm test`, 197 testes).

## Verificação final

- `npx tsc --noEmit` → limpo (0 erros).
- `npm run build` → sucesso; `dist/` contém `manifest.webmanifest`, `sw.js` e `icons/` copiados por padrão pelo Vite a partir de `public/`.
- `npx jest` → **197/197 testes passando** (8 suítes).
- `npm run preview` (porta 4173) + `curl`:
  - `GET /manifest.webmanifest` → 200
  - `GET /sw.js` → 200
  - `GET /icons/icon-192.png` → 200
  - `GET /icons/icon-512.png` → 200
  - `GET /` → HTML aponta corretamente para `/manifest.webmanifest`, ícones e assets com hash.
- Não foi possível abrir o DevTools/Application via browser tool nesta sessão (o `.claude/launch.json` da worktree só tinha uma config `buraco-dev`, sem uma para o preview de produção); a validação foi feita via `curl` contra o servidor de preview, que é suficiente para confirmar que os arquivos estão servidos corretamente com os paths certos.

## Pendências / observações

- Nenhuma pendência de escopo. Os PNGs dos ícones foram gerados com sucesso (via `sips`, ferramenta nativa do macOS) — não foi necessário deixar apenas o SVG como fallback.
- Não alterei lógica de jogo (engine/store) — apenas `index.html`, `public/*`, `src/main.tsx` (registro do SW), `src/styles/index.css` (overscroll) e `README.md`, conforme escopo. Também criei `src/vite-env.d.ts` (necessário para tipar `import.meta.env.PROD` sem erro no `tsc --noEmit`).
- Diretórios untracked pré-existentes na worktree (`.claude/`, `.superpowers/`) não foram adicionados aos commits — não fazem parte do escopo desta fase.

## Adendo — fix final pré-merge (bug crítico de mão travada)

### Status
Concluído, via TDD, na mesma worktree.

### Bug corrigido
`playCanasta`/`extendMeld` permitiam esvaziar a mão de um jogador mesmo quando o time já tinha pego o morto e não tinha canastra limpa 7+ (`canClose` falso) — travando o jogo: mão vazia, nada pra descartar, `isGameOver()` falso, turno nunca termina.

### Regra implementada (motor)
Um jogador só pode baixar/estender esvaziando a mão se, imediatamente depois, o time puder: (a) pegar o morto (time ainda sem morto E há morto na mesa), OU (b) bater (`canClose`, avaliado já incluindo o meld recém-formado/estendido). Caso contrário, `playCanasta`/`extendMeld` retornam `false` sem nenhum efeito colateral (mão, melds e score intactos).

Implementado em `src/engine/game.ts`: `playCanasta`/`extendMeld` simulam o resultado (novo `Canasta` ou meld estendido) antes de mutar qualquer estado, via helper privado `wouldEmptyHandIllegally` + `canCloseWithMelds` (variante de `canClose` que aceita uma lista de melds hipotética). Dois helpers públicos foram expostos para a UI reusar exatamente a mesma checagem sem duplicar a regra: `Game.wouldPlayCanastaEmptyHandIllegally(cards)` e `Game.wouldExtendMeldEmptyHandIllegally(meldIndex, cards)`.

### UI
- `src/components/Gameplay/ActionPanel.tsx`: o botão "Jogar Canasta" fica desabilitado quando a seleção atual esvaziaria a mão ilegalmente (via `wouldPlayCanastaEmptyHandIllegally`), com hint "Você não pode baixar todas as cartas sem poder bater."
- `src/components/Gameplay/GameBoard.tsx`: clique para estender um meld agora também checa `wouldExtendMeldEmptyHandIllegally` antes de chamar a store, mostrando o mesmo hint em vez de deixar o jogador bater na regra do motor sem explicação.

### Testes (TDD, RED confirmado antes do fix)
Adicionados em `tests/engine/game.test.ts` (describe `hand-emptying meld legality...` e `wouldPlayCanastaEmptyHandIllegally / wouldExtendMeldEmptyHandIllegally (UI helpers)`) e `tests/store/gameStore.test.ts`:
1. Time com morto pego, sem canastra limpa, baixa a mão inteira num trio comum → `playCanasta` retorna `false`, sem efeitos colaterais.
2. Mesmo cenário mas o meld É uma canastra limpa 7+ → permitido (batida direta), `isGameOver()` vira `true`.
3. Time sem morto pego e morto disponível → permitido esvaziar (auto-pega o morto).
4. As mesmas 3 variações para `extendMeld` (com a última carta da mão).
5. Os dois helpers públicos testados isoladamente (4 casos).
6. Store: `aiTurn` não trava quando o motor recusa um meld que esvaziaria a mão ilegalmente — cai no fallback de descarte já existente (`discardLowestValueCard`) e o turno avança normalmente.

Algumas suítes pré-existentes usavam `game.playCanasta(hand.getCards())` (esvaziando a mão inteira) só como atalho para "semear" um meld já jogado antes de testar `extendMeld`/parceria — sem querer, isso já reproduzia o cenário do bug (mão emptied sem morto disponível e sem canastra limpa). Foram ajustadas para semear o meld diretamente em `team.melds` (como o describe `canClose` já fazia) ou para deixar uma carta "keeper" na mão, preservando a intenção original de cada teste.

### Limpeza aprovada no review
`tailwind.config.js` removido da raiz da worktree — confirmado via grep que nada no projeto referencia esse arquivo (Tailwind v4 configura via CSS/`@tailwindcss/postcss`, não JS).

### Verificação final
- `npx tsc --noEmit` → limpo.
- `npx jest` → **210/210 testes passando** (8 suítes; 197 baseline + 13 novos).
- `npm run build` → sucesso.

### Commits
- `fix(engine): block hand-emptying melds when player cannot bater or take morto`
- `chore: remove dead tailwind.config.js`
