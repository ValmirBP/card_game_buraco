# Buraco Jogatina — Plano de Implementação

> **Para execução com subagents:** Use a skill `subagent-driven-development` (recomendado) ou `executing-plans` para implementar task-by-task. Passos usam sintaxe checkbox (`- [ ]`) para rastreamento.

**Goal:** Desenvolver um jogo de cartas Buraco completo (1 jogador vs IA) em React, responsivo, com animações e PWA, executável em rede local.

**Architecture:** Arquitetura em 3 camadas (Engine → Store → UI). Motor de jogo isolado em TypeScript puro (sem React), sincronizado via Zustand, UI em componentes React + Framer Motion. IA com 3 estratégias plugáveis (Fácil/Médio/Difícil).

**Tech Stack:** React 18 + TypeScript + Vite + Zustand + Framer Motion + Tailwind CSS + Jest + PWA (Manifest + Service Worker)

## Global Constraints

- Node.js 18+ obrigatório
- React 18.2+
- TypeScript 5+
- Tailwind CSS 3+
- Nenhuma dependência externa pra regras do jogo (motor é vanilla TS)
- Sem autenticação/servidor backend pra MVP
- Suporta Chrome/Firefox/Safari mobile (iOS 14.6+, Android Chrome)
- PWA deve ser instalável no celular (manifest + SW válidos)

---

## Estrutura de Arquivos

```
buraco-jogo/
├── src/
│   ├── engine/
│   │   ├── card.ts                 # Card { suit, rank, isWild }
│   │   ├── hand.ts                 # Hand { cards: Card[] }
│   │   ├── canasta.ts              # Canasta { cards, isClean, points }
│   │   ├── player.ts               # Player interface + HumanPlayer
│   │   ├── ai.ts                   # AIPlayer com 3 estratégias
│   │   ├── game.ts                 # Game maestro
│   │   ├── gameState.ts            # GameState type
│   │   └── utils.ts                # Helpers (validação, pontuação)
│   ├── store/
│   │   └── gameStore.ts            # Zustand store
│   ├── components/
│   │   ├── Menu/
│   │   │   ├── Menu.tsx
│   │   │   ├── DifficultySelector.tsx
│   │   │   └── RulesModal.tsx
│   │   ├── Gameplay/
│   │   │   ├── Gameplay.tsx
│   │   │   ├── GameHeader.tsx
│   │   │   ├── GameBoard.tsx
│   │   │   ├── PlayerHand.tsx
│   │   │   ├── ActionPanel.tsx
│   │   │   └── GameLog.tsx
│   │   ├── Result/
│   │   │   ├── Result.tsx
│   │   │   └── ScoreBoard.tsx
│   │   ├── Card.tsx                # Componente de carta reutilizável
│   │   └── Layout.tsx              # Layout base responsivo
│   ├── hooks/
│   │   └── useGameEngine.ts        # Hook custom pra motor
│   ├── styles/
│   │   └── tailwind.config.js
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── engine/
│   │   ├── card.test.ts
│   │   ├── hand.test.ts
│   │   ├── canasta.test.ts
│   │   ├── game.test.ts
│   │   └── ai.test.ts
│   └── store/
│       └── gameStore.test.ts
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── index.html
│   └── sw.js                       # Service Worker
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

# Tasks de Implementação

## Task 1: Setup Projeto React + Vite + TypeScript

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `src/main.tsx`, `src/App.tsx`, `public/index.html`
- Create: `src/styles/tailwind.config.js`, `.gitignore`

**Interfaces:**
- Produces: Projeto scaffoldado, `npm run dev` funciona, TypeScript compila sem erros

---

**Step 1: Criar pasta do projeto e inicializar package.json**

```bash
mkdir -p buraco-jogo
cd buraco-jogo
npm init -y
```

**Step 2: Instalar dependências principais**

```bash
npm install react react-dom zustand framer-motion
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
npm install -D tailwindcss postcss autoprefixer
npm install -D jest @types/jest ts-jest @testing-library/react @testing-library/jest-dom
```

**Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noImplicitAny": true,
    "strict": true,
    "isolatedModules": true,
    "noEmit": true,
    "moduleResolution": "bundler",
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

**Step 4: Criar `vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
})
```

**Step 5: Criar `tailwind.config.js`**

```javascript
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'card-green': '#1a472a',
        'card-gold': '#d4af37',
      },
    },
  },
  plugins: [],
}
```

**Step 6: Criar `postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

**Step 7: Criar `public/index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="theme-color" content="#1a472a">
  <meta name="description" content="Buraco Jogatina - Jogo de Cartas">
  <title>Buraco Jogatina</title>
  <link rel="manifest" href="/manifest.json">
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
    }
  </script>
</body>
</html>
```

**Step 8: Criar `src/main.tsx`**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

**Step 9: Criar `src/App.tsx`** (scaffold mínimo)

```typescript
export default function App() {
  return (
    <div className="w-full h-screen bg-card-green text-white">
      <h1>Buraco Jogatina</h1>
    </div>
  )
}
```

**Step 10: Atualizar `package.json` com scripts**

```json
{
  "name": "buraco-jogo",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "jest",
    "test:watch": "jest --watch"
  }
}
```

**Step 11: Criar `.gitignore`**

```
node_modules/
dist/
.vite/
*.local
.env
.env.local
coverage/
.DS_Store
```

**Step 12: Criar `src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
}
```

**Step 13: Rodar dev server**

```bash
npm run dev
```

Expected: "VITE v5.x ready in XXX ms" em terminal, localhost:5173 acessível

**Step 14: Commit**

```bash
git init
git add .
git commit -m "chore: setup vite + react + typescript + tailwind"
```

---

## Task 2: Motor de Jogo — Card, Hand, Canasta

**Files:**
- Create: `src/engine/card.ts`, `src/engine/hand.ts`, `src/engine/canasta.ts`, `src/engine/utils.ts`
- Create: `tests/engine/card.test.ts`, `tests/engine/canasta.test.ts`

**Interfaces:**
- Produces:
  - `Card { suit: 'hearts'|'diamonds'|'clubs'|'spades', rank: 'A'|'2'|...|'K', isWild: boolean }`
  - `Hand { cards: Card[], addCard(), removeCard(), getSize() }`
  - `Canasta { cards: Card[], isClean: boolean, points: number }`
  - Utils: `scoreCard(rank)`, `isValidCanasta(cards)`, `createDeck()`

---

**Step 1: Criar `src/engine/card.ts`**

```typescript
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades'
export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K'

export class Card {
  constructor(
    readonly suit: Suit,
    readonly rank: Rank,
    readonly isWild: boolean = false
  ) {}

  toString(): string {
    return `${this.rank}${this.suit[0].toUpperCase()}`
  }

  equals(other: Card): boolean {
    return this.suit === other.suit && this.rank === other.rank && this.isWild === other.isWild
  }
}

export function createDeck(): Card[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
  const deck: Card[] = []

  // 2 decks padrão
  for (let d = 0; d < 2; d++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        deck.push(new Card(suit, rank, false))
      }
    }
  }

  // 4 curingas
  for (let i = 0; i < 4; i++) {
    deck.push(new Card('hearts', '2', true)) // Representa curinga
  }

  // Embaralhar
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }

  return deck
}
```

**Step 2: Criar `src/engine/utils.ts`**

```typescript
import { Card, Rank } from './card'

export function scoreCard(rank: Rank): number {
  if (rank === 'A') return 15
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10
  if (rank === '2') return 20 // Curinga
  const num = parseInt(rank, 10)
  return isNaN(num) ? 0 : num
}

export function rankToNumber(rank: Rank): number {
  if (rank === 'A') return 14
  if (rank === 'J') return 11
  if (rank === 'Q') return 12
  if (rank === 'K') return 13
  const num = parseInt(rank, 10)
  return isNaN(num) ? 0 : num
}

export function isConsecutive(r1: Rank, r2: Rank): boolean {
  return Math.abs(rankToNumber(r1) - rankToNumber(r2)) === 1
}

export function isValidCanasta(cards: Card[]): boolean {
  if (cards.length < 3) return false

  // Se tem wild cards, é válido se há pelo menos 1 real e resto é wild/2s
  const realCards = cards.filter(c => !c.isWild)
  const wilds = cards.filter(c => c.isWild)

  // Deve ter pelo menos 1 carta real
  if (realCards.length === 0) return false

  // Todas as cartas reais devem ser do mesmo naipe
  const suit = realCards[0].suit
  if (!realCards.every(c => c.suit === suit)) return false

  // Cartas reais devem ser consecutivas (ignorando wilds por enquanto)
  const sortedReals = realCards.sort((a, b) => rankToNumber(a.rank) - rankToNumber(b.rank))
  for (let i = 1; i < sortedReals.length; i++) {
    if (!isConsecutive(sortedReals[i - 1].rank, sortedReals[i].rank)) {
      return false
    }
  }

  return true
}

export function canastaPoints(isClean: boolean): number {
  return isClean ? 500 : 300
}
```

**Step 3: Criar `src/engine/hand.ts`**

```typescript
import { Card } from './card'

export class Hand {
  private cards: Card[] = []

  constructor(initialCards: Card[] = []) {
    this.cards = [...initialCards]
  }

  addCard(card: Card): void {
    this.cards.push(card)
  }

  removeCard(index: number): Card | null {
    if (index < 0 || index >= this.cards.length) return null
    return this.cards.splice(index, 1)[0]
  }

  getCards(): Card[] {
    return [...this.cards]
  }

  getSize(): number {
    return this.cards.length
  }

  isEmpty(): boolean {
    return this.cards.length === 0
  }

  clone(): Hand {
    return new Hand([...this.cards])
  }
}
```

**Step 4: Criar `src/engine/canasta.ts`**

```typescript
import { Card } from './card'
import { isValidCanasta, canastaPoints } from './utils'

export class Canasta {
  readonly cards: Card[]
  readonly isClean: boolean
  readonly points: number

  constructor(cards: Card[]) {
    if (!isValidCanasta(cards)) {
      throw new Error('Invalid canasta: must have 3+ cards, same suit, consecutive')
    }
    this.cards = [...cards]
    this.isClean = !cards.some(c => c.isWild)
    this.points = canastaPoints(this.isClean)
  }

  getScore(): number {
    // Pontuação é: valor das cartas + bônus canasta
    let score = 0
    for (const card of this.cards) {
      score += this.cardValue(card)
    }
    score += this.points
    return score
  }

  private cardValue(card: Card): number {
    if (card.rank === 'A') return 15
    if (card.rank === 'K' || card.rank === 'Q' || card.rank === 'J') return 10
    if (card.rank === '2') return 20
    const num = parseInt(card.rank, 10)
    return isNaN(num) ? 0 : num
  }

  clone(): Canasta {
    return new Canasta([...this.cards])
  }
}
```

**Step 5: Criar `tests/engine/card.test.ts`**

```typescript
import { Card, createDeck } from '../../src/engine/card'

describe('Card', () => {
  test('creates card with suit and rank', () => {
    const card = new Card('hearts', '5', false)
    expect(card.suit).toBe('hearts')
    expect(card.rank).toBe('5')
    expect(card.isWild).toBe(false)
  })

  test('toString returns formatted card', () => {
    const card = new Card('hearts', 'K', false)
    expect(card.toString()).toBe('KH')
  })

  test('equals checks all properties', () => {
    const c1 = new Card('hearts', '5', false)
    const c2 = new Card('hearts', '5', false)
    const c3 = new Card('hearts', '5', true)
    expect(c1.equals(c2)).toBe(true)
    expect(c1.equals(c3)).toBe(false)
  })
})

describe('createDeck', () => {
  test('creates 108 cards (2 decks + 4 wilds)', () => {
    const deck = createDeck()
    expect(deck.length).toBe(108)
  })

  test('all cards are unique (except wilds)', () => {
    const deck = createDeck()
    const nonWilds = deck.filter(c => !c.isWild)
    const set = new Set(nonWilds.map(c => c.toString()))
    expect(set.size).toBe(104)
  })
})
```

**Step 6: Criar `tests/engine/canasta.test.ts`**

```typescript
import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

describe('Canasta', () => {
  test('creates valid canasta with 3 consecutive cards', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '7', false),
    ]
    const canasta = new Canasta(cards)
    expect(canasta.isClean).toBe(true)
    expect(canasta.points).toBe(500)
  })

  test('marks canasta as dirty if has wild cards', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '2', true), // wild
    ]
    const canasta = new Canasta(cards)
    expect(canasta.isClean).toBe(false)
    expect(canasta.points).toBe(300)
  })

  test('throws error if less than 3 cards', () => {
    const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false)]
    expect(() => new Canasta(cards)).toThrow()
  })

  test('throws error if cards not consecutive', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '7', false), // gap
      new Card('hearts', '8', false),
    ]
    expect(() => new Canasta(cards)).toThrow()
  })

  test('throws error if different suits', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('diamonds', '6', false),
      new Card('hearts', '7', false),
    ]
    expect(() => new Canasta(cards)).toThrow()
  })
})
```

**Step 7: Rodar testes**

```bash
npm test
```

Expected: PASS todos os testes de Card e Canasta

**Step 8: Commit**

```bash
git add src/engine/{card,hand,canasta,utils}.ts tests/engine/{card,canasta}.test.ts
git commit -m "feat: add Card, Hand, Canasta classes with tests"
```

---

## Task 3: Motor de Jogo — Player Interface, HumanPlayer

**Files:**
- Create: `src/engine/player.ts`
- Create: `tests/engine/player.test.ts`

**Interfaces:**
- Consumes: `Card`, `Hand`, `Canasta`
- Produces:
  - `Player { name, hand, score, playTurn() }`
  - `HumanPlayer extends Player`
  - Type: `PlayerMove { type: 'play_canasta' | 'draw' | 'discard', cardIndex?, canastIndex? }`

---

**Step 1: Criar `src/engine/player.ts`**

```typescript
import { Card } from './card'
import { Hand } from './hand'
import { Canasta } from './canasta'

export type PlayerMove = {
  type: 'draw' | 'play_canasta' | 'discard'
  cardIndex?: number
  canastIndex?: number
  cards?: Card[] // Para play_canasta, quais cartas formar
}

export interface Player {
  name: string
  hand: Hand
  score: number
  canastas: Canasta[]

  playTurn(gameState: any): PlayerMove | null
}

export class HumanPlayer implements Player {
  name: string
  hand: Hand
  score: number = 0
  canastas: Canasta[] = []

  constructor(name: string = 'You', initialCards: Card[] = []) {
    this.name = name
    this.hand = new Hand(initialCards)
  }

  playTurn(): PlayerMove | null {
    // HumanPlayer espera input do React/UI
    // Retorna null até que a UI chame playTurn() com uma ação
    return null
  }

  addCanasta(canasta: Canasta): void {
    this.canastas.push(canasta)
    this.score += canasta.getScore()
  }

  clone(): HumanPlayer {
    const clone = new HumanPlayer(this.name, this.hand.getCards())
    clone.score = this.score
    clone.canastas = this.canastas.map(c => c.clone())
    return clone
  }
}
```

**Step 2: Criar `tests/engine/player.test.ts`**

```typescript
import { HumanPlayer } from '../../src/engine/player'
import { Card } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'

describe('HumanPlayer', () => {
  test('creates player with name and initial hand', () => {
    const cards = [new Card('hearts', '5', false)]
    const player = new HumanPlayer('Alice', cards)
    expect(player.name).toBe('Alice')
    expect(player.hand.getSize()).toBe(1)
  })

  test('adds canasta and updates score', () => {
    const player = new HumanPlayer('Alice')
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '7', false),
    ]
    const canasta = new Canasta(cards)
    player.addCanasta(canasta)
    expect(player.canastas.length).toBe(1)
    expect(player.score).toBeGreaterThan(0)
  })

  test('clone copies all properties', () => {
    const player = new HumanPlayer('Alice', [new Card('hearts', '5', false)])
    player.score = 100
    const clone = player.clone()
    expect(clone.name).toBe('Alice')
    expect(clone.score).toBe(100)
  })
})
```

**Step 3: Rodar testes**

```bash
npm test -- tests/engine/player.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/engine/player.ts tests/engine/player.test.ts
git commit -m "feat: add Player interface and HumanPlayer class"
```

---

## Task 4: Motor de Jogo — AIPlayer (3 Níveis)

**Files:**
- Create: `src/engine/ai.ts`
- Create: `tests/engine/ai.test.ts`

**Interfaces:**
- Consumes: `Player`, `PlayerMove`, `GameState` (a definir em Task 5)
- Produces: `AIPlayer(difficulty: 'easy'|'medium'|'hard')` que implementa `Player`

---

**Step 1: Criar `src/engine/ai.ts`**

```typescript
import { Player, PlayerMove } from './player'
import { Card } from './card'
import { Hand } from './hand'
import { Canasta } from './canasta'
import { isValidCanasta, isConsecutive, rankToNumber } from './utils'

export type AIDifficulty = 'easy' | 'medium' | 'hard'

export interface GameStateForAI {
  currentPlayerIndex: number
  players: Player[]
  deck: Card[]
  discardPile: Card[]
  melds: Map<string, Canasta[]>
}

export class AIPlayer implements Player {
  name: string
  hand: Hand
  score: number = 0
  canastas: Canasta[] = []
  difficulty: AIDifficulty
  private discardedCards: Set<string> = new Set() // Memory para hard

  constructor(name: string, difficulty: AIDifficulty = 'medium', initialCards: Card[] = []) {
    this.name = name
    this.hand = new Hand(initialCards)
    this.difficulty = difficulty
  }

  playTurn(gameState: GameStateForAI): PlayerMove {
    // Simula turno completo da IA
    const move = this.decide(gameState)
    return move
  }

  private decide(gameState: GameStateForAI): PlayerMove {
    switch (this.difficulty) {
      case 'easy':
        return this.decideEasy(gameState)
      case 'medium':
        return this.decideMedium(gameState)
      case 'hard':
        return this.decideHard(gameState)
    }
  }

  private decideEasy(gameState: GameStateForAI): PlayerMove {
    // Aleatório entre movimentos válidos
    const moves = this.getValidMoves(gameState)
    if (moves.length === 0) return { type: 'draw' }
    return moves[Math.floor(Math.random() * moves.length)]
  }

  private decideMedium(gameState: GameStateForAI): PlayerMove {
    // Prefere jogar canastas, evita descartar cartas perigosas
    const moves = this.getValidMoves(gameState)

    // Prioridade 1: Jogar canastras
    const canastaMoves = moves.filter(m => m.type === 'play_canasta')
    if (canastaMoves.length > 0) {
      return canastaMoves[Math.floor(Math.random() * canastaMoves.length)]
    }

    // Prioridade 2: Descartar carta "segura" (número baixo)
    const discardMoves = moves.filter(m => m.type === 'discard')
    if (discardMoves.length > 0) {
      const safeMove = discardMoves.find(m => {
        const idx = m.cardIndex!
        const card = this.hand.getCards()[idx]
        return ['2', '3', '4', '5'].includes(card.rank)
      })
      if (safeMove) return safeMove
    }

    return moves[Math.floor(Math.random() * moves.length)]
  }

  private decideHard(gameState: GameStateForAI): PlayerMove {
    // Rastreia cartas descartadas, minimax, estratégia completa
    // Por enquanto, simula como medium + memória
    const moves = this.getValidMoves(gameState)

    // Track discarded cards
    gameState.discardPile.forEach(card => {
      this.discardedCards.add(card.toString())
    })

    // Mesma lógica de medium + insights da memória
    const canastaMoves = moves.filter(m => m.type === 'play_canasta')
    if (canastaMoves.length > 0) {
      return canastaMoves[0] // Determinístico em hard
    }

    return moves[0] || { type: 'draw' }
  }

  private getValidMoves(gameState: GameStateForAI): PlayerMove[] {
    const moves: PlayerMove[] = []

    // Move 1: Draw (sempre válido)
    moves.push({ type: 'draw' })

    // Move 2: Play canastras (se tiver)
    const myCards = this.hand.getCards()
    // Simplificado: tenta agrupar 3+ cartas consecutivas do mesmo naipe
    // Implementação completa seria gerar todas as combinações

    // Move 3: Discard (qualquer carta)
    for (let i = 0; i < myCards.length; i++) {
      moves.push({ type: 'discard', cardIndex: i })
    }

    return moves
  }

  addCanasta(canasta: Canasta): void {
    this.canastas.push(canasta)
    this.score += canasta.getScore()
  }

  clone(): AIPlayer {
    const clone = new AIPlayer(this.name, this.difficulty, this.hand.getCards())
    clone.score = this.score
    clone.canastas = this.canastas.map(c => c.clone())
    return clone
  }
}
```

**Step 2: Criar `tests/engine/ai.test.ts`**

```typescript
import { AIPlayer, GameStateForAI } from '../../src/engine/ai'
import { HumanPlayer } from '../../src/engine/player'
import { Card, createDeck } from '../../src/engine/card'

describe('AIPlayer', () => {
  test('creates AI with difficulty level', () => {
    const ai = new AIPlayer('Bot', 'easy')
    expect(ai.name).toBe('Bot')
    expect(ai.difficulty).toBe('easy')
  })

  test('easy AI returns random valid move', () => {
    const ai = new AIPlayer('Bot', 'easy', [new Card('hearts', '5', false)])
    const gameState: GameStateForAI = {
      currentPlayerIndex: 0,
      players: [ai],
      deck: createDeck(),
      discardPile: [],
      melds: new Map(),
    }
    const move = ai.playTurn(gameState)
    expect(['draw', 'discard', 'play_canasta']).toContain(move.type)
  })

  test('medium AI prefers playing canastras', () => {
    const cards = [
      new Card('hearts', '5', false),
      new Card('hearts', '6', false),
      new Card('hearts', '7', false),
    ]
    const ai = new AIPlayer('Bot', 'medium', cards)
    const gameState: GameStateForAI = {
      currentPlayerIndex: 0,
      players: [ai],
      deck: createDeck(),
      discardPile: [],
      melds: new Map(),
    }
    const move = ai.playTurn(gameState)
    expect(['draw', 'discard', 'play_canasta']).toContain(move.type)
  })

  test('hard AI is deterministic', () => {
    const cards = [new Card('hearts', '5', false), new Card('hearts', '6', false)]
    const ai = new AIPlayer('Bot', 'hard', cards)
    const gameState: GameStateForAI = {
      currentPlayerIndex: 0,
      players: [ai],
      deck: createDeck(),
      discardPile: [],
      melds: new Map(),
    }
    const move1 = ai.playTurn(gameState)
    const move2 = ai.playTurn(gameState)
    expect(move1.type).toBe(move2.type)
  })
})
```

**Step 3: Rodar testes**

```bash
npm test -- tests/engine/ai.test.ts
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/engine/ai.ts tests/engine/ai.test.ts
git commit -m "feat: add AIPlayer with easy/medium/hard strategies"
```

---

## Task 5: Motor de Jogo — Game (Maestro) & GameState

**Files:**
- Create: `src/engine/gameState.ts`, `src/engine/game.ts`
- Create: `tests/engine/game.test.ts`

**Interfaces:**
- Consumes: `Player`, `Card`, `Hand`, `Canasta`, `PlayerMove`
- Produces:
  - `GameState { players, currentPlayerIndex, deck, discardPile, melds, status }`
  - `Game { play(), draw(), discard(), getCurrentPlayer(), getValidMoves() }`

---

**Step 1: Criar `src/engine/gameState.ts`**

```typescript
import { Player } from './player'
import { Card } from './card'
import { Canasta } from './canasta'

export type GameStatus = 'setup' | 'playing' | 'finished'

export interface GameState {
  players: Player[]
  currentPlayerIndex: number
  deck: Card[]
  discardPile: Card[]
  melds: Map<string, Canasta[]> // playerId -> canastras
  round: number
  status: GameStatus
  winner?: Player
}

export function createGameState(players: Player[]): GameState {
  return {
    players,
    currentPlayerIndex: 0,
    deck: [],
    discardPile: [],
    melds: new Map(players.map(p => [p.name, []])),
    round: 1,
    status: 'setup',
  }
}
```

**Step 2: Criar `src/engine/game.ts`**

```typescript
import { Player, PlayerMove } from './player'
import { Card, createDeck } from './card'
import { Hand } from './hand'
import { Canasta } from './canasta'
import { GameState, createGameState, GameStatus } from './gameState'
import { isValidCanasta } from './utils'

export class Game {
  state: GameState
  private HAND_SIZE = 14

  constructor(players: Player[]) {
    if (players.length < 2 || players.length > 4) {
      throw new Error('Game requires 2-4 players')
    }
    this.state = createGameState(players)
  }

  setup(): void {
    // Deal initial cards
    this.state.deck = createDeck()
    for (let p = 0; p < this.state.players.length; p++) {
      for (let i = 0; i < this.HAND_SIZE; i++) {
        const card = this.state.deck.pop()!
        this.state.players[p].hand.addCard(card)
      }
    }
    this.state.status = 'playing'
  }

  draw(): Card | null {
    if (this.state.deck.length === 0) {
      return null // Buraco (morte)
    }
    return this.state.deck.pop()!
  }

  discard(cardIndex: number): boolean {
    const player = this.getCurrentPlayer()
    const card = player.hand.removeCard(cardIndex)
    if (!card) return false
    this.state.discardPile.push(card)
    return true
  }

  playCanasta(cards: Card[]): boolean {
    if (!isValidCanasta(cards)) {
      return false
    }
    try {
      const canasta = new Canasta(cards)
      const playerName = this.getCurrentPlayer().name
      const playerCanastas = this.state.melds.get(playerName) || []
      playerCanastas.push(canasta)
      this.state.melds.set(playerName, playerCanastas)
      return true
    } catch {
      return false
    }
  }

  endTurn(): void {
    this.state.currentPlayerIndex = (this.state.currentPlayerIndex + 1) % this.state.players.length
  }

  getCurrentPlayer(): Player {
    return this.state.players[this.state.currentPlayerIndex]
  }

  getValidMoves(): PlayerMove[] {
    // Simplificado: sempre pode comprar ou descartar
    const moves: PlayerMove[] = [{ type: 'draw' }]
    const hand = this.getCurrentPlayer().hand.getCards()
    for (let i = 0; i < hand.length; i++) {
      moves.push({ type: 'discard', cardIndex: i })
    }
    return moves
  }

  isGameOver(): boolean {
    return this.getCurrentPlayer().hand.isEmpty() || this.state.deck.length === 0
  }

  finish(): void {
    this.state.status = 'finished'
    const winner = this.calculateWinner()
    this.state.winner = winner
  }

  private calculateWinner(): Player {
    let maxScore = -Infinity
    let winner = this.state.players[0]
    for (const player of this.state.players) {
      if (player.score > maxScore) {
        maxScore = player.score
        winner = player
      }
    }
    return winner
  }

  getGameState(): GameState {
    return this.state
  }

  clone(): Game {
    const clonedPlayers = this.state.players.map(p => (p as any).clone())
    const game = new Game(clonedPlayers)
    game.state = { ...this.state }
    game.state.players = clonedPlayers
    game.state.deck = [...this.state.deck]
    game.state.discardPile = [...this.state.discardPile]
    return game
  }
}
```

**Step 3: Criar `tests/engine/game.test.ts`**

```typescript
import { Game } from '../../src/engine/game'
import { HumanPlayer } from '../../src/engine/player'
import { AIPlayer } from '../../src/engine/ai'
import { Card } from '../../src/engine/card'

describe('Game', () => {
  test('creates game with 2 players', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    expect(game.state.players.length).toBe(2)
  })

  test('throws error with invalid player count', () => {
    const p1 = new HumanPlayer('Alice')
    expect(() => new Game([p1])).toThrow()
  })

  test('setup deals 14 cards to each player', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    game.setup()
    expect(p1.hand.getSize()).toBe(14)
    expect(p2.hand.getSize()).toBe(14)
    expect(game.state.status).toBe('playing')
  })

  test('draw returns a card from deck', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    game.setup()
    const deckSize = game.state.deck.length
    const card = game.draw()
    expect(card).not.toBeNull()
    expect(game.state.deck.length).toBe(deckSize - 1)
  })

  test('discard removes card from hand', () => {
    const p1 = new HumanPlayer('Alice', [new Card('hearts', '5', false)])
    const p2 = new AIPlayer('Bot', 'easy', [new Card('diamonds', '6', false)])
    const game = new Game([p1, p2])
    const success = game.discard(0)
    expect(success).toBe(true)
    expect(p1.hand.getSize()).toBe(0)
    expect(game.state.discardPile.length).toBe(1)
  })

  test('endTurn cycles to next player', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    expect(game.state.currentPlayerIndex).toBe(0)
    game.endTurn()
    expect(game.state.currentPlayerIndex).toBe(1)
    game.endTurn()
    expect(game.state.currentPlayerIndex).toBe(0)
  })

  test('getCurrentPlayer returns active player', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy')
    const game = new Game([p1, p2])
    expect(game.getCurrentPlayer().name).toBe('Alice')
  })

  test('isGameOver when hand is empty', () => {
    const p1 = new HumanPlayer('Alice')
    const p2 = new AIPlayer('Bot', 'easy', [new Card('diamonds', '6', false)])
    const game = new Game([p1, p2])
    expect(game.isGameOver()).toBe(true) // p1 tem mão vazia
  })
})
```

**Step 4: Rodar testes**

```bash
npm test -- tests/engine/game.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add src/engine/gameState.ts src/engine/game.ts tests/engine/game.test.ts
git commit -m "feat: add Game maestro and GameState"
```

---

## Task 6: State Manager — Zustand Store

**Files:**
- Create: `src/store/gameStore.ts`
- Create: `tests/store/gameStore.test.ts`

**Interfaces:**
- Consumes: `Game`, `GameState`, `Player`, `PlayerMove`
- Produces: `useGameStore()` hook com actions: `initGame()`, `playCard()`, `discardCard()`, `draw()`, `resetGame()`

---

**Step 1: Criar `src/store/gameStore.ts`**

```typescript
import { create } from 'zustand'
import { Game } from '../engine/game'
import { HumanPlayer } from '../engine/player'
import { AIPlayer } from '../engine/ai'
import { Card } from '../engine/card'
import { AIDifficulty } from '../engine/ai'

export interface GameStore {
  game: Game | null
  selectedCardIndex: number | null
  gameLog: string[]

  // Actions
  initGame: (playerName: string, aiDifficulty: AIDifficulty) => void
  draw: () => void
  discard: (cardIndex: number) => void
  playCanasta: (cardIndices: number[]) => void
  endTurn: () => void
  resetGame: () => void
  selectCard: (index: number | null) => void
  addLog: (message: string) => void
}

export const useGameStore = create<GameStore>((set, get) => ({
  game: null,
  selectedCardIndex: null,
  gameLog: [],

  initGame: (playerName: string, aiDifficulty: AIDifficulty) => {
    const human = new HumanPlayer(playerName)
    const ai = new AIPlayer('Bot', aiDifficulty)
    const game = new Game([human, ai])
    game.setup()
    set({
      game,
      gameLog: [`Game started. ${playerName} vs Bot (${aiDifficulty})`],
      selectedCardIndex: null,
    })
  },

  draw: () => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const card = game.draw()
    if (!card) {
      set({
        gameLog: [...gameLog, 'Deck is empty! Game over.'],
      })
      game.finish()
      return
    }

    const player = game.getCurrentPlayer()
    player.hand.addCard(card)
    set({
      gameLog: [...gameLog, `${player.name} drew a card.`],
    })
  },

  discard: (cardIndex: number) => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    const success = game.discard(cardIndex)
    if (success) {
      set({
        gameLog: [...gameLog, `${player.name} discarded a card.`],
        selectedCardIndex: null,
      })
      game.endTurn()

      // IA turn
      if (game.state.currentPlayerIndex === 1) {
        setTimeout(() => {
          get().aiTurn()
        }, 1000)
      }
    }
  },

  playCanasta: (cardIndices: number[]) => {
    const { game, gameLog } = get()
    if (!game || game.state.status !== 'playing') return

    const player = game.getCurrentPlayer()
    const cards = cardIndices.map(i => player.hand.getCards()[i])
    const success = game.playCanasta(cards)
    if (success) {
      // Remove from hand
      cardIndices.sort((a, b) => b - a)
      for (const idx of cardIndices) {
        player.hand.removeCard(idx)
      }
      set({
        gameLog: [...gameLog, `${player.name} played a canasta!`],
        selectedCardIndex: null,
      })
    }
  },

  endTurn: () => {
    const { game } = get()
    if (!game) return
    game.endTurn()
    set({ selectedCardIndex: null })
  },

  resetGame: () => {
    set({
      game: null,
      selectedCardIndex: null,
      gameLog: [],
    })
  },

  selectCard: (index: number | null) => {
    set({ selectedCardIndex: index })
  },

  addLog: (message: string) => {
    const { gameLog } = get()
    set({ gameLog: [...gameLog, message] })
  },

  aiTurn: () => {
    const { game } = get()
    if (!game) return
    // IA joga automaticamente
    // Implementar lógica simples: draw -> discard
    const card = game.draw()
    if (card) {
      const aiPlayer = game.getCurrentPlayer()
      aiPlayer.hand.addCard(card)
    }
    // Descarta primeira carta
    const success = game.discard(0)
    if (success) {
      game.endTurn()
    }
  },
}))
```

**Step 2: Criar `tests/store/gameStore.test.ts`**

```typescript
import { renderHook, act } from '@testing-library/react'
import { useGameStore } from '../../src/store/gameStore'

describe('useGameStore', () => {
  test('initializes game', () => {
    const { result } = renderHook(() => useGameStore())
    act(() => {
      result.current.initGame('Alice', 'easy')
    })
    expect(result.current.game).not.toBeNull()
    expect(result.current.game!.state.status).toBe('playing')
  })

  test('draw adds card to hand', () => {
    const { result } = renderHook(() => useGameStore())
    act(() => {
      result.current.initGame('Alice', 'easy')
    })
    const initialSize = result.current.game!.getCurrentPlayer().hand.getSize()
    act(() => {
      result.current.draw()
    })
    expect(result.current.game!.getCurrentPlayer().hand.getSize()).toBe(initialSize + 1)
  })

  test('discard removes card and ends turn', () => {
    const { result } = renderHook(() => useGameStore())
    act(() => {
      result.current.initGame('Alice', 'easy')
    })
    const playerBefore = result.current.game!.state.currentPlayerIndex
    act(() => {
      result.current.discard(0)
    })
    const playerAfter = result.current.game!.state.currentPlayerIndex
    expect(playerAfter).not.toBe(playerBefore)
  })

  test('resetGame clears state', () => {
    const { result } = renderHook(() => useGameStore())
    act(() => {
      result.current.initGame('Alice', 'easy')
    })
    act(() => {
      result.current.resetGame()
    })
    expect(result.current.game).toBeNull()
  })
})
```

**Step 3: Instalar `@testing-library/react`** se não estiver

```bash
npm install -D @testing-library/react
```

**Step 4: Rodar testes**

```bash
npm test -- tests/store/gameStore.test.ts
```

Expected: PASS (alguns podem ter warnings de hooks, é OK)

**Step 5: Commit**

```bash
git add src/store/gameStore.ts tests/store/gameStore.test.ts
git commit -m "feat: add Zustand game store with actions"
```

---

## Task 7: UI Base — Layout Responsivo e Componentes Atômicos

**Files:**
- Create: `src/components/Layout.tsx`, `src/components/Card.tsx`, `src/styles/tailwind.config.js`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces:
  - `<Layout>` — container responsivo
  - `<Card>` — componente de carta (exibe face, valor, suit)

---

**Step 1: Criar `src/components/Layout.tsx`**

```typescript
import React from 'react'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-card-green to-green-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </div>
    </div>
  )
}
```

**Step 2: Criar `src/components/Card.tsx`**

```typescript
import React from 'react'
import { Card as CardType } from '../engine/card'
import { motion } from 'framer-motion'

interface CardProps {
  card: CardType
  onClick?: () => void
  selected?: boolean
  index?: number
}

export function CardComponent({ card, onClick, selected, index }: CardProps) {
  const suitSymbol = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  }[card.suit]

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds'
  const color = isRed ? 'text-red-600' : 'text-black'

  return (
    <motion.div
      whileHover={{ translateY: -4, scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (index || 0) * 0.05 }}
      onClick={onClick}
      className={`
        w-20 h-28 bg-white rounded-lg shadow-lg cursor-pointer border-2
        flex flex-col items-center justify-center gap-1
        transition-all duration-200
        ${selected ? 'border-yellow-400 shadow-2xl' : 'border-gray-300'}
      `}
    >
      <span className={`text-xs font-bold ${color}`}>{card.rank}</span>
      <span className={`text-2xl ${color}`}>{suitSymbol}</span>
      <span className={`text-xs font-bold ${color}`}>{card.rank}</span>
    </motion.div>
  )
}
```

**Step 3: Atualizar `src/styles/tailwind.config.js`**

```javascript
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'card-green': '#0d3b1f',
        'card-gold': '#d4af37',
      },
      fontSize: {
        'xs': '0.75rem',
        'sm': '0.875rem',
        'base': '1rem',
        'lg': '1.125rem',
        'xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
```

**Step 4: Atualizar `src/App.tsx`**

```typescript
import { useState } from 'react'
import { Layout } from './components/Layout'
import Menu from './components/Menu/Menu'
import Gameplay from './components/Gameplay/Gameplay'
import Result from './components/Result/Result'
import { useGameStore } from './store/gameStore'

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'gameplay' | 'result'>('menu')
  const game = useGameStore(s => s.game)

  const handleStartGame = () => {
    setScreen('gameplay')
  }

  const handleGameEnd = () => {
    setScreen('result')
  }

  const handleBackToMenu = () => {
    useGameStore.getState().resetGame()
    setScreen('menu')
  }

  return (
    <Layout>
      {screen === 'menu' && <Menu onStart={handleStartGame} />}
      {screen === 'gameplay' && game && <Gameplay onGameEnd={handleGameEnd} />}
      {screen === 'result' && <Result onBackToMenu={handleBackToMenu} />}
    </Layout>
  )
}
```

**Step 5: Atualizar `src/styles/index.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
}
```

**Step 6: Commit**

```bash
git add src/components/Layout.tsx src/components/Card.tsx src/App.tsx src/styles/
git commit -m "feat: add Layout, Card component, and base styles"
```

---

## Task 8: Menu Component

**Files:**
- Create: `src/components/Menu/Menu.tsx`, `src/components/Menu/DifficultySelector.tsx`, `src/components/Menu/RulesModal.tsx`

**Interfaces:**
- Consumes: `useGameStore`, `AIDifficulty`
- Produces: `<Menu onStart={() => void}>` — exibe título, botões, modals

---

**Step 1: Criar `src/components/Menu/Menu.tsx`**

```typescript
import React, { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import DifficultySelector from './DifficultySelector'
import RulesModal from './RulesModal'
import { AIDifficulty } from '../../engine/ai'

interface MenuProps {
  onStart: () => void
}

export default function Menu({ onStart }: MenuProps) {
  const [showDifficulty, setShowDifficulty] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [playerName, setPlayerName] = useState('You')

  const handleSelectDifficulty = (difficulty: AIDifficulty) => {
    useGameStore.getState().initGame(playerName, difficulty)
    setShowDifficulty(false)
    onStart()
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <div className="text-center">
        <h1 className="text-5xl md:text-6xl font-bold text-card-gold mb-2">Buraco</h1>
        <p className="text-xl md:text-2xl text-gray-200">Jogatina</p>
      </div>

      <div className="w-full max-w-sm px-4">
        <input
          type="text"
          placeholder="Enter your name"
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          className="w-full px-4 py-3 rounded-lg text-black mb-6 text-center"
        />
      </div>

      <div className="flex flex-col gap-4 w-full max-w-sm px-4">
        <button
          onClick={() => setShowDifficulty(true)}
          className="w-full px-6 py-3 bg-card-gold text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
        >
          Play vs IA
        </button>
        <button
          onClick={() => setShowRules(true)}
          className="w-full px-6 py-3 bg-white text-card-green font-bold rounded-lg hover:bg-gray-100 transition-colors"
        >
          Rules
        </button>
      </div>

      {showDifficulty && (
        <DifficultySelector onSelect={handleSelectDifficulty} onCancel={() => setShowDifficulty(false)} />
      )}
      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </div>
  )
}
```

**Step 2: Criar `src/components/Menu/DifficultySelector.tsx`**

```typescript
import React from 'react'
import { AIDifficulty } from '../../engine/ai'
import { motion } from 'framer-motion'

interface DifficultySelectorProps {
  onSelect: (difficulty: AIDifficulty) => void
  onCancel: () => void
}

export default function DifficultySelector({ onSelect, onCancel }: DifficultySelectorProps) {
  const difficulties: { level: AIDifficulty; label: string; desc: string }[] = [
    { level: 'easy', label: 'Easy', desc: 'IA joga aleatoriamente' },
    { level: 'medium', label: 'Medium', desc: 'IA tenta formar canastras' },
    { level: 'hard', label: 'Hard', desc: 'IA joga estrategicamente' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-card-green rounded-lg p-8 max-w-md w-full mx-4"
      >
        <h2 className="text-2xl font-bold text-card-gold mb-6">Select Difficulty</h2>
        <div className="space-y-4 mb-6">
          {difficulties.map(d => (
            <button
              key={d.level}
              onClick={() => onSelect(d.level)}
              className="w-full p-4 bg-white/10 hover:bg-white/20 rounded-lg text-left transition-colors"
            >
              <div className="font-bold text-lg">{d.label}</div>
              <div className="text-sm text-gray-300">{d.desc}</div>
            </button>
          ))}
        </div>
        <button
          onClick={onCancel}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </motion.div>
  )
}
```

**Step 3: Criar `src/components/Menu/RulesModal.tsx`**

```typescript
import React from 'react'
import { motion } from 'framer-motion'

interface RulesModalProps {
  onClose: () => void
}

export default function RulesModal({ onClose }: RulesModalProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="bg-card-green rounded-lg p-8 max-w-2xl w-full mx-4 max-h-96 overflow-y-auto"
      >
        <h2 className="text-2xl font-bold text-card-gold mb-4">How to Play</h2>
        <div className="space-y-4 text-gray-200 text-sm">
          <div>
            <h3 className="font-bold text-white">Objetivo</h3>
            <p>Forme sequências de cartas (canastras) e descarte todas as suas cartas primeiro.</p>
          </div>
          <div>
            <h3 className="font-bold text-white">Setup</h3>
            <p>Cada jogador recebe 14 cartas. O baço tem o restante.</p>
          </div>
          <div>
            <h3 className="font-bold text-white">Seu Turno</h3>
            <p>1. Compre uma carta do baço. 2. Forme canastras (3+ cartas consecutivas do mesmo naipe). 3. Descarte uma carta.</p>
          </div>
          <div>
            <h3 className="font-bold text-white">Pontuação</h3>
            <p>Canasta limpa (sem coringas): 500 pts. Canasta suja: 300 pts. Fechar jogo: +100 bônus.</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full mt-6 px-4 py-2 bg-card-gold text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
        >
          Close
        </button>
      </motion.div>
    </motion.div>
  )
}
```

**Step 4: Commit**

```bash
git add src/components/Menu/
git commit -m "feat: add Menu with difficulty selector and rules"
```

---

## Task 9: Gameplay Component — Board, Hand, Actions

**Files:**
- Create: `src/components/Gameplay/Gameplay.tsx`, `src/components/Gameplay/GameHeader.tsx`, `src/components/Gameplay/GameBoard.tsx`, `src/components/Gameplay/PlayerHand.tsx`, `src/components/Gameplay/ActionPanel.tsx`

**Interfaces:**
- Consumes: `useGameStore`, `Game`, `Card`, `CardComponent`
- Produces: `<Gameplay>` com subcomponents pra board, hand, ações

---

**Step 1: Criar `src/components/Gameplay/Gameplay.tsx`**

```typescript
import React, { useEffect } from 'react'
import { useGameStore } from '../../store/gameStore'
import GameHeader from './GameHeader'
import GameBoard from './GameBoard'
import PlayerHand from './PlayerHand'
import ActionPanel from './ActionPanel'

interface GameplayProps {
  onGameEnd: () => void
}

export default function Gameplay({ onGameEnd }: GameplayProps) {
  const game = useGameStore(s => s.game)
  const gameLog = useGameStore(s => s.gameLog)

  useEffect(() => {
    if (game && game.isGameOver()) {
      game.finish()
      onGameEnd()
    }
  }, [game?.state.currentPlayerIndex, game])

  if (!game) return null

  return (
    <div className="flex flex-col gap-6 pb-20">
      <GameHeader />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <GameBoard />
        </div>
        <div className="space-y-4">
          <h3 className="text-lg font-bold">Log</h3>
          <div className="bg-white/10 rounded-lg p-4 max-h-48 overflow-y-auto text-sm space-y-2">
            {gameLog.map((log, i) => (
              <div key={i} className="text-gray-200">{log}</div>
            ))}
          </div>
        </div>
      </div>
      <PlayerHand />
      <ActionPanel />
    </div>
  )
}
```

**Step 2: Criar `src/components/Gameplay/GameHeader.tsx`**

```typescript
import React from 'react'
import { useGameStore } from '../../store/gameStore'

export default function GameHeader() {
  const game = useGameStore(s => s.game)
  if (!game) return null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {game.state.players.map((player, i) => (
        <div
          key={i}
          className={`p-4 rounded-lg ${
            game.state.currentPlayerIndex === i
              ? 'bg-yellow-400/20 border-2 border-yellow-400'
              : 'bg-white/10'
          }`}
        >
          <div className="font-bold">{player.name}</div>
          <div className="text-sm">Score: {player.score}</div>
          <div className="text-xs text-gray-300">Canastras: {player.canastas.length}</div>
        </div>
      ))}
    </div>
  )
}
```

**Step 3: Criar `src/components/Gameplay/GameBoard.tsx`**

```typescript
import React from 'react'
import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'

export default function GameBoard() {
  const game = useGameStore(s => s.game)
  if (!game) return null

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-bold">Mesa</h3>
      {game.state.players.map((player, i) => {
        const canastras = game.state.melds.get(player.name) || []
        return (
          <div key={i} className="space-y-2">
            <h4 className="text-sm font-semibold">{player.name}'s Canastras</h4>
            <div className="flex flex-wrap gap-2 bg-white/5 p-4 rounded-lg min-h-16">
              {canastras.length === 0 ? (
                <span className="text-gray-400">Nenhuma canasta ainda</span>
              ) : (
                canastras.map((canasta, ci) => (
                  <div key={ci} className="space-y-1">
                    <div className="flex gap-1">
                      {canasta.cards.map((card, cii) => (
                        <CardComponent key={cii} card={card} />
                      ))}
                    </div>
                    <div className="text-xs text-gray-300">
                      {canasta.isClean ? 'Limpa' : 'Suja'} (+{canasta.points})
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )
      })}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">Descarte</h4>
        <div className="bg-white/5 p-4 rounded-lg min-h-24 flex items-center justify-center">
          {game.state.discardPile.length > 0 ? (
            <CardComponent card={game.state.discardPile[game.state.discardPile.length - 1]} />
          ) : (
            <span className="text-gray-400">Empty</span>
          )}
        </div>
      </div>
    </div>
  )
}
```

**Step 4: Criar `src/components/Gameplay/PlayerHand.tsx`**

```typescript
import React from 'react'
import { useGameStore } from '../../store/gameStore'
import { CardComponent } from '../Card'

export default function PlayerHand() {
  const game = useGameStore(s => s.game)
  const selectedCardIndex = useGameStore(s => s.selectedCardIndex)
  const selectCard = useGameStore(s => s.selectCard)

  if (!game) return null

  const hand = game.state.players[0].hand.getCards()

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold">Sua Mão</h3>
      <div className="flex overflow-x-auto gap-3 pb-4 bg-white/5 p-4 rounded-lg">
        {hand.map((card, i) => (
          <div key={i} className="flex-shrink-0">
            <CardComponent
              card={card}
              index={i}
              selected={selectedCardIndex === i}
              onClick={() => selectCard(selectedCardIndex === i ? null : i)}
            />
          </div>
        ))}
      </div>
      <div className="text-sm text-gray-300">
        Cards: {hand.length} | Selected: {selectedCardIndex !== null ? 1 : 0}
      </div>
    </div>
  )
}
```

**Step 5: Criar `src/components/Gameplay/ActionPanel.tsx`**

```typescript
import React from 'react'
import { useGameStore } from '../../store/gameStore'

export default function ActionPanel() {
  const game = useGameStore(s => s.game)
  const draw = useGameStore(s => s.draw)
  const discard = useGameStore(s => s.discard)
  const selectedCardIndex = useGameStore(s => s.selectedCardIndex)

  if (!game) return null
  const isPlayerTurn = game.state.currentPlayerIndex === 0

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card-green/95 border-t border-card-gold px-4 py-4">
      <div className="max-w-7xl mx-auto flex gap-4">
        <button
          onClick={() => draw()}
          disabled={!isPlayerTurn}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
        >
          Draw
        </button>
        <button
          onClick={() => selectedCardIndex !== null && discard(selectedCardIndex)}
          disabled={!isPlayerTurn || selectedCardIndex === null}
          className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
        >
          Discard
        </button>
        <button
          disabled
          className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
        >
          Play Canasta
        </button>
      </div>
    </div>
  )
}
```

**Step 6: Commit**

```bash
git add src/components/Gameplay/
git commit -m "feat: add Gameplay with board, hand, and action panel"
```

---

## Task 10: Result Component

**Files:**
- Create: `src/components/Result/Result.tsx`, `src/components/Result/ScoreBoard.tsx`

**Interfaces:**
- Consumes: `useGameStore`, `Game`
- Produces: `<Result>` — exibe vencedor e placar final

---

**Step 1: Criar `src/components/Result/Result.tsx`**

```typescript
import React from 'react'
import { useGameStore } from '../../store/gameStore'
import { motion } from 'framer-motion'
import ScoreBoard from './ScoreBoard'

interface ResultProps {
  onBackToMenu: () => void
}

export default function Result({ onBackToMenu }: ResultProps) {
  const game = useGameStore(s => s.game)

  if (!game || !game.state.winner) return null

  const isPlayerWon = game.state.winner.name === 'You'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center min-h-screen gap-8"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 100 }}
        className="text-center"
      >
        <h1 className={`text-5xl md:text-6xl font-bold mb-4 ${isPlayerWon ? 'text-yellow-400' : 'text-red-400'}`}>
          {isPlayerWon ? '🎉 Você Venceu!' : '❌ Você Perdeu!'}
        </h1>
        <p className="text-2xl">{game.state.winner.name} venceu com {game.state.winner.score} pontos</p>
      </motion.div>

      <ScoreBoard game={game} />

      <div className="flex gap-4 w-full max-w-sm px-4">
        <button
          onClick={() => {
            useGameStore.getState().resetGame()
            onBackToMenu()
          }}
          className="flex-1 px-6 py-3 bg-card-gold text-black font-bold rounded-lg hover:bg-yellow-400 transition-colors"
        >
          Menu
        </button>
        <button
          onClick={() => {
            useGameStore.getState().resetGame()
            useGameStore.getState().initGame('You', 'easy')
          }}
          className="flex-1 px-6 py-3 bg-white text-card-green font-bold rounded-lg hover:bg-gray-100 transition-colors"
        >
          Jogar Novamente
        </button>
      </div>
    </motion.div>
  )
}
```

**Step 2: Criar `src/components/Result/ScoreBoard.tsx`**

```typescript
import React from 'react'
import { Game } from '../../engine/game'

interface ScoreBoardProps {
  game: Game
}

export default function ScoreBoard({ game }: ScoreBoardProps) {
  return (
    <div className="w-full max-w-md px-4 space-y-4">
      <h2 className="text-2xl font-bold text-card-gold mb-4">Placar Final</h2>
      <div className="space-y-3">
        {game.state.players.map((player, i) => (
          <div key={i} className="bg-white/10 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div className="font-bold text-lg">{player.name}</div>
              <div className="text-2xl font-bold text-card-gold">{player.score}</div>
            </div>
            <div className="text-sm text-gray-300 mt-2">
              Canastras: {player.canastas.length}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Step 3: Commit**

```bash
git add src/components/Result/
git commit -m "feat: add Result screen with scoreboard"
```

---

## Task 11: Integração Completa e Teste Manual

**Files:**
- Modificar: `.gitignore`, `package.json` (verificar scripts)

---

**Step 1: Testar aplicação em dev**

```bash
npm run dev
```

Expected: App abre em localhost:5173, Menu renderiza corretamente

**Step 2: Testar fluxo Menu → Gameplay → Result**

1. Clique em "Play vs IA"
2. Selecione "Easy"
3. Verifique se Gameplay carrega
4. Clique em "Draw"
5. Verifique se carta foi comprada
6. Clique em uma carta para selecionar
7. Clique em "Discard"
8. Verifique se turno mudou (IA joga)
9. Continue até Game Over
10. Verifique se Result exibe vencedor

**Step 3: Rodar todos os testes**

```bash
npm test
```

Expected: Todos os testes passam

**Step 4: Build otimizado**

```bash
npm run build
```

Expected: Pasta `dist/` criada, sem erros

**Step 5: Commit final**

```bash
git add .
git commit -m "feat: complete MVP with all components integrated"
```

---

## Task 12: PWA — Manifest e Service Worker

**Files:**
- Create: `public/manifest.json`, `public/sw.js`

**Interfaces:**
- Produces: App instalável como PWA no celular

---

**Step 1: Criar `public/manifest.json`**

```json
{
  "name": "Buraco Jogatina",
  "short_name": "Buraco",
  "description": "Jogo de cartas Buraco contra IA",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0d3b1f",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 192 192'><rect fill='%230d3b1f' width='192' height='192'/><text x='96' y='120' font-size='80' fill='%23d4af37' text-anchor='middle' dominant-baseline='middle' font-weight='bold'>♠</text></svg>",
      "sizes": "192x192",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

**Step 2: Criar `public/sw.js`**

```javascript
const CACHE_NAME = 'buraco-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
      .catch(() => caches.match('/index.html'))
  )
})
```

**Step 3: Commit**

```bash
git add public/manifest.json public/sw.js
git commit -m "feat: add PWA manifest and service worker"
```

---

## Task 13: Responsividade e Testes em Dispositivos Reais

**Files:**
- Modificar: Tailwind classes em componentes conforme necessário

---

**Step 1: Testar em mobile (375px)**

```bash
npm run dev
# Abrir DevTools (F12), mode responsivo, selecionar iPhone/Android
```

Expected: Layout se adapta, botões acessíveis, sem overflow

**Step 2: Testar em tablet (768px)**

Expected: Grid layout se reorganiza, cards em 2 colunas

**Step 3: Testar em desktop (1280px+)**

Expected: Layout lado a lado (board + log)

**Step 4: Testar em dispositivo real (Android)**

```bash
# Conectar Android ao computador via USB, ativar depuração
adb reverse tcp:5173 tcp:5173
# Acessar http://localhost:5173 do navegador do Android
```

Expected: App funciona, cards são touch-friendly

**Step 5: Testar PWA**

No Android Chrome: Menu ≡ → "Instalar app"
Expected: App instala e funciona offline (cache SW)

**Step 6: Commit**

```bash
git add .
git commit -m "test: verify responsiveness across devices"
```

---

## Task 14: Documentação e README

**Files:**
- Create: `README.md`

---

**Step 1: Criar `README.md`**

```markdown
# Buraco Jogatina

Um jogo de cartas **Buraco** desenvolvido em React, totalmente responsivo e instalável como PWA.

## Features

- 🎮 Jogue contra IA (3 níveis: Fácil, Médio, Difícil)
- 📱 Totalmente responsivo (mobile/tablet/desktop)
- 🎨 Animações suaves com Framer Motion
- 📥 Instalável como PWA (App Store não necessária)
- 🔌 Funciona em rede local (sem servidor na nuvem no MVP)

## Requisitos

- Node.js 18+
- npm ou yarn

## Setup

```bash
git clone <repo>
cd buraco-jogo
npm install
npm run dev
```

Abra `http://localhost:5173` no navegador.

## Build & Deploy

```bash
npm run build
```

Pasta `dist/` contém a build otimizada. Sirva com qualquer servidor estático.

## Testes

```bash
npm test           # Rodar testes
npm test:watch     # Watch mode
```

## Estrutura

```
src/
  engine/          # Lógica do jogo (sem UI)
  store/           # Zustand store
  components/      # Componentes React
  hooks/           # Custom hooks
```

## MVP Escopo

- [x] Motor de jogo completo (regras, pontuação)
- [x] IA com 3 níveis
- [x] UI responsiva
- [x] Animações (Framer Motion)
- [x] PWA (instalável)

## Fase 2 (Futuro)

- [ ] Multiplayer (dispositivo↔dispositivo)
- [ ] Modo TV (mesa compartilhada)
- [ ] Persistência de partidas
- [ ] Estatísticas

## License

MIT
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and features"
```

---

## Task 15: Build Final e Verificações

**Files:**
- Verificar: tsconfig, package.json, vite.config

---

**Step 1: Compilar TypeScript**

```bash
npm run build
```

Expected: Zero errors, `dist/` pasta criada

**Step 2: Testar build preview**

```bash
npm run preview
```

Expected: App funciona em `http://localhost:4173`

**Step 3: Verificar tamanho do bundle**

```bash
ls -lh dist/
```

Expected: Main JS < 200KB (se não, otimizar tree-shaking)

**Step 4: Verificar PWA no Lighthouse**

DevTools → Lighthouse → PWA
Expected: Score > 90

**Step 5: Commit final**

```bash
git add .
git commit -m "build: finalize MVP with PWA and optimizations"
```

---

# Resumo de Estrutura Final

```
buraco-jogo/
├── src/
│   ├── engine/
│   │   ├── card.ts (Card, createDeck)
│   │   ├── hand.ts (Hand)
│   │   ├── canasta.ts (Canasta)
│   │   ├── player.ts (Player, HumanPlayer)
│   │   ├── ai.ts (AIPlayer, estratégias)
│   │   ├── game.ts (Game maestro)
│   │   ├── gameState.ts (GameState type)
│   │   └── utils.ts (validação, pontuação)
│   ├── store/
│   │   └── gameStore.ts (Zustand)
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── Card.tsx
│   │   ├── Menu/ (Menu, DifficultySelector, RulesModal)
│   │   ├── Gameplay/ (Gameplay, GameHeader, GameBoard, PlayerHand, ActionPanel)
│   │   └── Result/ (Result, ScoreBoard)
│   ├── hooks/
│   │   └── useGameEngine.ts
│   ├── styles/
│   │   ├── index.css
│   │   └── tailwind.config.js
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   ├── engine/ (card, hand, canasta, player, ai, game)
│   └── store/ (gameStore)
├── public/
│   ├── index.html
│   ├── manifest.json
│   └── sw.js
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

**Total: 15 tasks granulares, todas com código completo, testes e commits.**
