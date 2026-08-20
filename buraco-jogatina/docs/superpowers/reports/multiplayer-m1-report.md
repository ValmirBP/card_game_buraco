# Multiplayer M1 — Headless GameSession orchestrator

## Status

Done. Built in worktree `/Users/valmirdebarros/Desktop/proj pessoal/.worktrees/buraco-impl`
(branch `buraco-impl`), on top of the baseline 243 passing tests.

- `npx tsc --noEmit`: clean.
- `npx jest`: **279/279 tests passing** (243 pre-existing + 36 new in
  `tests/session/`).
- No file under `src/store/**`, `src/components/**`, or `src/App.tsx` was
  touched — single-player continues to run entirely on the existing
  `gameStore`. The new module only imports from `src/engine/**`.

## Commits

- `2ada70f` — `feat(session): headless GameSession orchestrator for multiplayer (M1)`
  (single commit; added `src/session/GameSession.ts`, `src/session/types.ts`,
  and 6 new test files under `tests/session/`).

## Files added

- `src/session/types.ts` — `SeatConfig`, `TurnPhase`, `Intent`, `IntentResult`,
  `PlainCard`, `MeldView`, `SeatPlayerView`, `SeatTeamView`, `SeatView`.
- `src/session/GameSession.ts` — the `GameSession` class, plus the exported
  pure helper `accumulateMatchRound` (parametrized by `matchTarget`, unlike
  the store's hardcoded-3000 version) and `DEFAULT_MATCH_TARGET = 3000`.
- `tests/session/setup.test.ts` — construction (11 cards/seat, 2 mortos of 11,
  empty discard, 42-card deck, throws on != 4 seats, initial seat/phase/status).
- `tests/session/phase.test.ts` — draw→play transitions, discard-ends-turn,
  out-of-phase/out-of-turn rejection, takeDiscard phase rules.
- `tests/session/intents.test.ts` — illegal `playCanasta`/`extendMeld`
  rejected with no side effects, a valid canasta accepted and scored, the
  "would empty hand illegally" guard, empty-discard-pile and
  round-still-in-progress rejections.
- `tests/session/views.test.ts` — `getViewFor` redaction (only the requested
  seat's cards ever appear as `{suit,...}` objects), player metadata, open
  discard pile, morto counts only, `getPublicView` hides all hands.
- `tests/session/ai.test.ts` — `runAiTurns()` no-ops on a human seat, advances
  through consecutive AI seats and stops at the next human (or round end),
  always ends each AI turn with a discard, and (with all 4 seats AI) plays an
  entire round to completion without throwing.
- `tests/session/match.test.ts` — `accumulateMatchRound` unit tests (mirrors
  `tests/store/matchScore.test.ts` but parametrized), plus `GameSession`
  integration: round-end accumulation, no double-accumulation, `nextRound`
  rebuilding a fresh round while keeping accumulated `matchScores`, and
  crossing `matchTarget` setting `matchWinner` + making `nextRound` a no-op.

## Final public API

```ts
type SeatKind = 'human' | 'ai'
interface SeatConfig { kind: SeatKind; name: string; difficulty?: AIDifficulty }
type TurnPhase = 'draw' | 'play'
type Intent =
  | { type: 'draw' }
  | { type: 'takeDiscard' }
  | { type: 'discard'; cardIndex: number }
  | { type: 'playCanasta'; cardIndices: number[] }
  | { type: 'extendMeld'; meldIndex: number; cardIndices: number[] }
  | { type: 'nextRound' }
interface IntentResult { ok: boolean; error?: string }

class GameSession {
  constructor(seats: SeatConfig[] /* length 4 */, matchTarget?: number /* default 3000 */)
  applyIntent(seat: number, intent: Intent): IntentResult
  runAiTurns(): string[]
  getViewFor(seat: number): SeatView
  getPublicView(): SeatView
  readonly currentSeat: number
  readonly phase: TurnPhase
  readonly status: 'playing' | 'finished'
}

// Also exported for direct unit testing, same role as gameStore's version:
export function accumulateMatchRound(
  matchScores: Record<TeamId, number>,
  matchCanastras: Record<TeamId, { clean: number; dirty: number }>,
  teams: Team[],
  matchTarget: number
): { matchScores, matchCanastras, matchWinner?: TeamId }
export const DEFAULT_MATCH_TARGET = 3000
```

Everything else (`Card`/meld types, engine classes) is imported straight from
`src/engine/**` — no duplicate type definitions.

## SeatView shape

```ts
interface PlainCard { suit: string; rank: string; isWild: boolean }
interface MeldView {
  layout: { card: PlainCard; representsValue?: number }[]
  isClean: boolean; isCanastra: boolean; kind: string; points: number; type: string
}
interface SeatView {
  seat: number                 // -1 for getPublicView()
  yourHand: PlainCard[]        // [] for getPublicView() or an out-of-range seat
  players: { seat: number; name: string; kind: SeatKind; handCount: number; teamId: 'A'|'B' }[]
  teams: { id: 'A'|'B'; score: number; hasTakenMorto: boolean; melds: MeldView[] }[]
  discardPile: PlainCard[]     // fully open, as in real Buraco
  deckCount: number
  mortos: { count: number }[]  // never contents
  currentSeat: number
  phase: TurnPhase
  status: 'playing' | 'finished'
  round: number
  matchScores: Record<'A'|'B', number>
  matchCanastras: Record<'A'|'B', { clean: number; dirty: number }>
  matchWinner?: 'A'|'B'
  winnerTeam?: 'A'|'B'         // this round's winner (set once Game.finish() ran)
  scoreBreakdowns?: TeamScoreBreakdown[]
  log: string[]                // full accumulated log so far, not just new events
}
```

Cards are always plain `{suit, rank, isWild}` objects (via a `toPlainCard`
helper), never raw `Card` class instances — the whole `SeatView` tree is
`JSON.stringify`-safe as-is.

## Behavioral notes for M2 (server) to rely on

- **Turn-phase authority**: `phase` starts `'draw'` for a seat's turn. Only
  `draw`/`takeDiscard` are legal in `'draw'`; only `discard`/`playCanasta`/
  `extendMeld` are legal in `'play'`. `discard` is the only intent that ends
  the turn (advances `currentSeat`, resets `phase` to `'draw'`). Meld intents
  never change phase or seat — a seat can meld any number of times before
  discarding.
- **`applyIntent` never throws** on bad input — it always returns
  `{ok:false, error}` for wrong seat/phase/status, invalid indices, invalid
  melds, or a would-illegally-empty-hand play. Safe to call directly off
  untrusted client messages after just checking `seat` matches the
  connection's assigned seat (the class does that check anyway, so even a
  mismatched claim is rejected).
- **`runAiTurns()` is synchronous and can process multiple seats in one
  call** — call it once after any successful human intent (or once
  immediately for an all-AI seat table) and broadcast the returned log lines
  plus a fresh `getViewFor`/`getPublicView` snapshot per connected client. It
  naturally stops at the next human seat or when the round/match ends, so
  it's safe to call unconditionally after every mutating intent without
  checking `currentSeat` kind first.
- **Round end vs. match end**: when a round finishes, `status` becomes
  `'finished'` but the match itself may still be open (`matchWinner`
  undefined) — the server should wait for host/consensus and then send a
  `nextRound` intent (from any seat; it's not seat-gated) to deal the next
  round. Once `matchWinner` is set, `nextRound` is rejected
  (`ok:false`) — the server should treat that as "match over, offer
  rematch/new session" rather than retry.
- **`log` in `SeatView` is the full cumulative log**, not a delta — if the
  server wants only new lines for a push update, prefer the return value of
  `runAiTurns()` (and track the discard/other-intent log line yourself, or
  slice `log` against a previously-seen length).
- **Seat 0/2 = Team A, seat 1/3 = Team B** (from the engine's
  `teamIdOfSeat`), unchanged from the single-player convention.
- The class holds no timers/intervals and does no I/O — a thin WebSocket/HTTP
  layer in M2 just needs to: receive a client message → map to `Intent` →
  call `applyIntent` → if `ok`, call `runAiTurns()` → broadcast updated views
  to all connected seats (and the public/TV view, if used) → send the
  `IntentResult` (with `error` if rejected) back to the requester.
