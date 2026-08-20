# Buraco Jogatina — Design de Implementação MVP

**Data:** 2026-08-04  
**Escopo:** Jogo de cartas Buraco (1 jogador vs IA) responsivo em React, instalável como PWA no celular, com animações interativas.

---

## 1. Visão Geral

Desenvolver um **jogo de Buraco (cartas) web responsivo** baseado no app "Buraco Jogatina" da App Store. MVP inicial suporta:

- Gameplay completo vs IA (níveis: Fácil, Médio, Difícil)
- Animações dinâmicas e interativas (Framer Motion)
- Totalmente responsivo (mobile/tablet/desktop)
- Instalável como PWA (sem App Store)
- Executável em rede local (sem servidor na nuvem)

**Fase 2** (não neste MVP): multiplayer entre dispositivos + modo TV compartilhado.

---

## 2. Arquitetura

### 2.1 Camadas

```
┌─────────────────────────────────────────┐
│   UI (React + Tailwind + Framer Motion) │  Telas, animações, eventos
├─────────────────────────────────────────┤
│   State Manager (React Context/Zustand) │  Sincroniza motor ↔ UI
├─────────────────────────────────────────┤
│   Game Engine (TypeScript, sem UI)      │  Regras, validação, IA
└─────────────────────────────────────────┘
```

### 2.2 Motor de Jogo (`/src/engine/`)

**Responsabilidade:** Lógica pura do Buraco. Totalmente independente de React/UI.

**Classes principais:**

- **`Card`** — `{ suit: 'hearts'|'diamonds'|'clubs'|'spades', rank: 'A'|'2'...'K', isWild: boolean }`
- **`Hand`** — `{ cards: Card[] }` — cartelas de um jogador
- **`Canasta`** — `{ cards: Card[], isClean: boolean, points: number }` — sequência na mesa
- **`Player`** (interface)
  - `name: string`
  - `hand: Hand`
  - `score: number`
  - `playTurn(gameState): Move` — retorna próximo movimento (legal)
  
- **`HumanPlayer extends Player`** — aguarda input do React
- **`AIPlayer extends Player`** — implementa estratégia (Fácil/Médio/Difícil)

- **`Game`** — maestro
  - `state: GameState`
  - `play(playerId, cardIndex, targetCanasta?)` — aplica movimento, valida regras
  - `draw()` — compra do baço
  - `discard(cardIndex)` — descarta
  - `closeGame()` — fecha jogo
  - `getValidMoves(playerId): Move[]` — quais ações são legais agora
  - `getCurrentPlayer(): Player`
  - `isGameOver(): boolean`

**GameState:**
```typescript
{
  players: Player[],
  currentPlayerIndex: number,
  deck: Card[],          // Baço
  discardPile: Card[],   // Descarte
  melds: Map<playerId, Canasta[]>,
  round: number,
  status: 'setup' | 'playing' | 'finished',
  winner?: Player
}
```

### 2.3 IA — 3 Níveis

**Fácil:** Escolhe movimentos aleatoriamente entre válidos. Não usa estratégia.

**Médio:** 
- Tenta formar canastras quando possível
- Evita descartar cartas que completam canastras do jogador
- Prioriza cartas perigosas pra descartar

**Difícil:**
- Rastreia cartas descartadas pelos adversários (memory)
- Minimax simplificado: avalia próximos 2-3 turnos
- Forma canastras estratégicas, não apenas possíveis

Cada nível usa `Math.random()` com thresholds diferentes pra simular "erros" mesmo em Hard (não é perfeito).

### 2.4 State Manager (`/src/store/`)

**Zustand** (ou React Context) sincroniza `Game` (motor) com componentes React.

```typescript
type GameStore = {
  game: Game | null,
  uiState: {
    selectedCardIndex?: number,
    selectedCanasta?: Canasta,
    animatingCard?: Card,
  },
  
  // Actions
  initGame(playerName, aiDifficulty) => void,
  playCard(cardIndex, targetCanasta?) => void,
  discardCard(cardIndex) => void,
  draw() => void,
  resetGame() => void,
}
```

Sempre que `Game` muda estado, o store notifica componentes → re-render automático.

---

## 3. Regras do Buraco

### 3.1 Setup

- **Baralho:** 2 decks padrão (52×2) + 4 curingas = 108 cartas
- **Jogadores:** 2 (1 humano + 1 IA) — MVP inicial
- **Mão inicial:** 14 cartas cada
- **Pilhas:** Baço (draw) + Descarte (discard)

### 3.2 Turno

1. **Compra:** Pega 1 carta do Baço (ou pega pilha inteira de Descarte se conseguir **canasta imediata** com ela)
2. **Joga canastras:** Forma sequências de 3+ cartas mesmo naipe na mesa
3. **Descarta:** Obrigatório descartar 1 carta pro Descarte

### 3.3 Canastras

- **Sequência:** 3+ cartas consecutivas, mesmo naipe (ex: 5♠ 6♠ 7♠)
- **Wild cards:** Curingas e 2s podem substituir qualquer carta
- **Canasta Limpa** (0 wild cards): 500 pontos
- **Canasta Suja** (com wild cards): 300 pontos
- Jogadores acumulam canastras na mesa; não pode remover nem mexer depois de formada

### 3.4 Fechamento & Pontuação

- **Fechamento:** Primeiro jogador a descartar todas as cartas (mão vazia) fecha o jogo
- **Pontos cartas:** Cada carta tem valor (A=15, K/Q/J=10, 2-10=face)
- **Bônus:** Quem fechou ganha +100
- **Negativo:** Cartas ainda na mão do adversário contam *negativo* pra ele
- **Fim:** Maior pontuação vence a rodada

### 3.5 Morte (Buraco)

Se o Baço acaba e o Descarte não pode ser comprado, o jogo acaba (ninguém consegue jogar mais). Pontuação final é calculada como está.

---

## 4. Interface de Usuário

### 4.1 Telas

#### Menu Inicial
- Logo/Título "Buraco Jogatina"
- Botão "Jogar vs IA" → modal de seleção de dificuldade (Fácil/Médio/Difícil)
- Botão "Regras" → modal explicativo
- Botão "Sobre" (opcional)

#### Gameplay
Layout responsivo:

**Mobile (< 768px):**
- Topo: Info adversário (nome, # cartas, # canastras)
- Centro: Mesa (canastras visíveis, scroll horizontal se muitas)
- Rodapé: Sua mão (14 cartas em scroll horizontal)
- Botões: "Comprar" / "Descartar" contextuais

**Desktop (≥ 768px):**
- Esquerda: Info todos os adversários
- Centro: Mesa
- Direita: Sua mão (coluna vertical)
- Botões em painel lateral

**Elementos:**
- Indicador de turno (borda brilhante, "Sua vez" vs "IA jogando...")
- Placar em tempo real (canastras formadas, pontos)
- Log de ações (últimos 5 movimentos)
- Botão "Regras" pra consultar durante o jogo

#### Resultado (Win/Loss)
- Placar final
- Motivo do fim ("Você fechou!" / "IA fechou" / "Jogo terminou")
- Botões: "Jogar novamente" / "Voltar ao Menu"

### 4.2 Componentes React

```
App
├── Router (Menu, Gameplay, Result)
├── Menu
│   ├── Title
│   ├── StartButton
│   ├── RulesModal
│   └── DifficultySelector
├── Gameplay
│   ├── GameHeader (turnos, placar)
│   ├── GameBoard (mesa, canastras)
│   ├── PlayerHand (suas cartas)
│   ├── ActionPanel (comprar, descartar)
│   ├── GameLog
│   └── Card (component atomico)
└── Result
    ├── ScoreBoard
    ├── WinnerBanner
    └── Navigation
```

### 4.3 Estilo & Responsividade

- **Tailwind CSS** para layout e paleta de cores
- **Breakpoints:** 320px (mobile), 768px (tablet), 1280px (desktop)
- **Touch:** Buttons mínimo 44px × 44px
- **Cores:** Tema poker/cassino (verde baralho, ouro, branco)

---

## 5. Animações (Framer Motion)

- **Cartas:** Quando jogadas, "voam" da mão pro centro com easing smooth
- **Canastras:** Agrupam-se com pulse/glow ao se formarem; exibem pontos em pop-up
- **Descarte:** Cai na pilha com rotação + bounce leve
- **Turno IA:** Suas ações (compra, descarte) são automáticas (0.5–1s cada), pra o player acompanhar
- **Indicadores:** Borda brilhante ao redor do nome do jogador em turno

Todas as animações são **não-bloqueantes**: o player pode interagir enquanto estão rodando.

---

## 6. Build & Deploy

### 6.1 Stack Técnico

- **Frontend:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Animations:** Framer Motion
- **State:** Zustand
- **Testing:** Jest + React Testing Library
- **PWA:** Manifest + Service Worker

### 6.2 Estrutura de Pastas

```
/src
  /engine          # Motor de jogo (sem UI)
    game.ts
    player.ts
    ai.ts
    card.ts
    gameState.ts
  /store           # Zustand store
    gameStore.ts
  /components      # React components
    /Menu
    /Gameplay
    /Result
    /Card
  /hooks           # Custom React hooks
  /styles          # Tailwind config
  App.tsx
  main.tsx
public/
  manifest.json    # PWA manifest
  sw.js            # Service worker
```

### 6.3 Build & Run

```bash
npm install
npm run dev        # Dev server (localhost:5173)
npm run build      # Build otimizado
npm run preview    # Preview da build
npm test           # Jest
```

**PWA:** Service worker permite instalar no celular (Android Chrome, iOS Safari 16+). Usuário vê "Instalar app" ou similar.

**Rede Local:** Servidor Vite automático expõe em `http://192.168.1.XXX:5173` — qualquer dispositivo na rede local acessa.

---

## 7. Testes

### 7.1 Motor (Jest)

- **Validação de Canastras:** 3+ cartas consecutivas, mesmo naipe ✓
- **Pontuação:** Cálculo correto de pontos por canasta ✓
- **Turnos:** Ordem correta, turnos pulam legalmente ✓
- **IA Fácil/Médio/Difícil:** Não faz movimentos ilegais ✓
- **Fechamento:** Detecta quando mão fica vazia ✓

### 7.2 UI (React Testing Library)

- Menu renderiza com botões ✓
- Clique em "Jogar" inicia jogo ✓
- Cartas aparecem na mão ✓
- Clique em carta seleciona ✓
- "Descartar" tira carta da mão ✓

### 7.3 E2E (Opcional para MVP)

Pode usar Cypress/Playwright depois se necessário. MVP prioriza testes unitários do motor.

---

## 8. Cronograma & Prioridades (MVP)

**Fase 1 (Essencial):**
1. Motor de jogo + regras (Semana 1)
2. IA básica (Fácil/Médio) (Semana 1–2)
3. UI Menu + Gameplay (Semana 2–3)
4. Animações básicas (Semana 3)
5. PWA + responsividade (Semana 4)

**Fase 2 (Pós-MVP):**
- Multiplayer (dispositivo↔dispositivo)
- Modo TV (mesa em tela separada)
- Persistência de partidas (localStorage)
- Estatísticas/histórico

---

## 9. Decisões Arquiteturais

| Decisão | Alternativa | Motivo |
|---------|------------|--------|
| **React SPA** | Flutter/Kotlin nativo | Mesmo código roda web + PWA (instalável); desenvolvimento mais rápido |
| **Zustand** | Redux/MobX | Boilerplate mínimo, ideal pra escopo pequeno |
| **Framer Motion** | CSS Animations | Sintaxe declarativa, fácil coordenar múltiplas animações |
| **Jest (unit)** | E2E só | Motor precisa estar 100% correto; E2E pode vir depois |
| **Rede local só** | Servidor na nuvem | Menos complexo, sem custo de hosting, privado |

---

## 10. Riscos & Mitigação

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|--------|-----------|
| IA "burra" estraga diversão | Média | Alto | Testar níveis com gameplay real, iterar |
| Animações lentas em mobile | Média | Médio | Testar em dispositivos reais, usar `will-change` CSS |
| Regras ambíguas causam bugs | Baixa | Alto | Testes unitários cobrindo casos extremos |
| PWA não funciona em iOS | Baixa | Médio | Documentar limitações, modo web puro como fallback |

---

## 11. Apêndice: Exemplo de Turno

```
Turno do Jogador Humano:
1. Tela mostra "Sua vez"
2. Jogador clica em botão "Comprar"
   → Motor: draw() pega carta do Baço
   → UI: Carta aparece na mão com animação
3. Jogador vê 3 cartas que formam canasta (5♠ 6♠ 7♠)
4. Clica nas 3 cartas (multi-select)
5. Clica "Jogar Canasta"
   → Motor: valida canasta, adiciona pontos
   → UI: Cartas voam pra mesa com animação, canasta brilha, +300 pts exibidos
6. Jogador clica em carta pra descartar
7. Clica "Descartar"
   → Motor: tira da mão, põe no Descarte, muda turno
   → UI: Carta cai no descarte, aguarda turno da IA

Turno da IA (Médio):
1. IA toma decisão (0.5s)
2. Compra carta (animação)
3. Se consegue canasta, joga (animação)
4. Descarta (animação, 1s total)
5. Volta pro Jogador
```

---

**Status:** ✅ Design Aprovado  
**Próximo:** Plano de Implementação
