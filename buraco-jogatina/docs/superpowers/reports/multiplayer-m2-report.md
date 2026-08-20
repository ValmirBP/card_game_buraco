# Multiplayer M2 — Servidor WebSocket

## Status

Done. Built in worktree `/Users/valmirdebarros/Desktop/proj pessoal/.worktrees/buraco-impl`
(branch `buraco-impl`), on top of the M1 baseline (279 passing tests).

- `npx tsc --noEmit`: clean (now covers `server/**` too — `tsconfig.json`'s
  `include` grew from `["src"]` to `["src", "server"]`).
- `npx jest`: **298/298 tests passing** (279 pre-existing + 19 new in
  `tests/server/`).
- `npm run build`: clean (`tsc && vite build`).
- No file under `src/store/**`, `src/components/**`, or `src/App.tsx` was
  touched. `server/**` only imports from `src/session/**` and `src/engine/**`
  (types), never from store/UI code.
- Manually verified: booted the server (`PORT=3001 npx tsx server/index.ts`),
  confirmed it printed LAN addresses, `curl localhost:3001` returned the
  built `dist/index.html`, and a real `ws` client round-tripped
  `create` → `joined` + `lobby` over the socket. Server was stopped after
  verification, not left running.

## Commit

- `63a574b` — `feat(server): multiplayer WS server with room registry (M2)`
  (single commit; adds `server/rooms.ts`, `server/protocol.ts`,
  `server/index.ts`, and `tests/server/{rooms,protocol}.test.ts`; adds `ws`
  runtime dep and `tsx`/`@types/ws`/`@types/node` dev deps; adds `server`/
  `start` npm scripts; extends `tsconfig.json` include).

## How to run

```bash
npm run build        # produces dist/ (PWA)
npm run server        # tsx server/index.ts, PORT default 3001
# or, in one shot:
npm run start          # npm run build && tsx server/index.ts
```

`PORT` env var overrides the default (3001). On boot the server logs the
local URL and every non-internal IPv4 LAN address found via
`os.networkInterfaces()`, e.g.:

```
Buraco multiplayer server rodando na porta 3001
  Local:   http://localhost:3001
  Na rede: http://192.168.2.169:3001
```

Point a phone on the same Wi-Fi at one of the "Na rede" URLs.

The same HTTP server (`node:http`) both serves `dist/**` as static files
(with SPA fallback to `index.html` for any path that isn't an existing
file) and hosts the `ws` `WebSocketServer` — one process, one port.

## Files added

- `server/rooms.ts` — `RoomManager`, pure/no-I/O room registry:
  - `createRoom(hostConnId, hostName, difficulty) -> { code, room }` — code
    is 5 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no `O/0/I/1`),
    regenerated on collision. Host always seat 0; seats 1-3 default to
    `kind:'ai'` with placeholder names (`"IA 2"`, etc.) until a human joins.
  - `joinRoom(code, connId, name) -> {seat} | {error}` — reconnection first:
    if a **disconnected** human seat (`connId === undefined`) has the same
    `name`, it's reassumed (seat's `connId` updated, same index returned).
    Otherwise takes the next seat with `kind:'ai'`; errors if the room
    doesn't exist, is already started, or has no free seat (5th human).
  - `leaveRoom(connId)` — clears that seat's `connId` (kind/name kept, so a
    later `joinRoom` with the same name reconnects to it). Does not free the
    seat back to AI.
  - `startRoom(code, byConnId) -> {ok:true} | {error}` — only succeeds if
    `byConnId` matches `seats[0].connId` (current host connection — works
    across host reconnects since that field updates on rejoin). Freezes a
    4-element `SeatConfig[]` (kind/name per current seats, `difficulty` set
    from the room's difficulty for AI seats) and constructs the
    `GameSession`.
  - `getRoom(code)`, `findRoomByConn(connId)` — lookups used by the protocol
    layer.
- `server/protocol.ts` — `ProtocolServer`, the transport-agnostic message
  handler (takes anything with `send(data: string)`, so it's testable with a
  fake socket, no real TCP/WS needed):
  - `registerConnection(connId, socket)`, `handleClose(connId)`,
    `handleMessage(connId, ClientMessage): Promise<void>`.
  - Tracks `connId -> {roomCode, seat}` internally; every `intent`/`start`
    call resolves the caller's room+seat from that map, so a client can
    never claim a different seat than the one it was assigned.
  - After a `start` or any successful `intent`, broadcasts `{type:'state'}`
    immediately (using the **pre-AI** state), then asynchronously runs
    `session.runAiTurns()` in a paced loop (`aiTurnDelayMs`, default 700ms,
    `0` in tests) — each iteration broadcasts the fresh state (and any log
    lines from that step as `{type:'log'}`) before waiting, so a spectator
    sees the AI's moves land one at a time instead of the final state
    snapping in.
  - `state`/`log` broadcasts only reach seats with `kind === 'human'` and a
    live `connId` — each gets its own `session.getViewFor(seat)`, so a
    client only ever receives its own hand.
  - Failed `applyIntent` / `startRoom` / `joinRoom` results send
    `{type:'error', message}` to the requester only — no broadcast.
- `server/index.ts` — process entry point: Node `http.createServer` serving
  `dist/**` (MIME by extension, SPA fallback), a `ws.WebSocketServer`
  attached to the same server, per-connection `connId` generation, and the
  LAN-address boot log described above. `PORT` from `process.env.PORT`
  (default `3001`).
- `tests/server/rooms.test.ts` — 11 tests: code charset/uniqueness, host
  seated at index 0 with AI defaults elsewhere, ordered seat assignment,
  5th-human rejection, invalid code rejection, host-only `startRoom` (and
  that a non-host attempt leaves `started:false`), frozen `SeatConfig`s
  matching who actually joined, `leaveRoom` marking (not freeing) a seat,
  name-based reconnection reassigning the same seat index,
  `findRoomByConn`.
- `tests/server/protocol.test.ts` — 8 tests using a `FakeSocket` (collects
  parsed JSON messages, no real socket): create → `joined`+`lobby`; join →
  seat assignment + lobby rebroadcast to both host and guest; invalid-code
  join → error to that client only; non-host `start` → error; `start` →
  each human seat gets its own redacted `state` (own `yourHand.length===11`,
  correct `seat` field); a legal `draw` intent is applied and rebroadcast
  (`phase` flips to `'play'`); an illegal `discard` before drawing → error
  only, no spurious state broadcast; a full human→AI→…→human turn cycle
  (draw+discard on an all-AI-opponents table) ends with `currentSeat` back
  at the human seat 0.

## package.json / tsconfig changes

- `dependencies`: added `ws`.
- `devDependencies`: added `tsx`, `@types/ws`, `@types/node` (the last was
  already present transitively; pinned as a direct dep for clarity).
- `scripts`: added `"server": "tsx server/index.ts"` and
  `"start": "npm run build && tsx server/index.ts"`.
- `tsconfig.json`: `include` extended to `["src", "server"]` so
  `npx tsc --noEmit` also type-checks the new server code (still
  `noEmit: true`, doesn't affect `vite build`, which only bundles what's
  reachable from the app entry point).

## Final WS protocol

Client → server (`ClientMessage`):

```ts
{ type: 'create', name: string, difficulty: 'easy'|'medium'|'hard' }
{ type: 'join', code: string, name: string }
{ type: 'start' }
{ type: 'intent', intent: Intent }   // Intent = the M1 session Intent union
{ type: 'nextRound' }                // sugar for {type:'intent', intent:{type:'nextRound'}}
```

Server → client (`ServerMessage`):

```ts
{ type: 'joined', code: string, seat: number, isHost: boolean }
{ type: 'lobby', code: string, isHost: boolean,
  seats: { index: number, kind: 'human'|'ai', name: string, connected: boolean }[] }
{ type: 'state', view: SeatView }    // session.getViewFor(seat) — own hand only
{ type: 'log', lines: string[] }     // incremental log lines from an AI-turn step
{ type: 'error', message: string }   // sent only to the requester
```

Notes for whoever writes the M3 client:

- Every WS message is a single JSON object per frame (`socket.send(JSON.stringify(...))`,
  parse with `JSON.parse(event.data)`); no framing/length-prefixing needed.
- After `create`/`join`, expect `joined` then a `lobby` broadcast (which also
  fires again on every subsequent join/leave — use it to render the
  waiting room and to know your own `seat`/`isHost`).
- After `start`, expect one or more `state` messages (immediately, then one
  more per AI turn taken automatically before play returns to you — each
  arrives ~700ms apart so you can render them as they land instead of only
  the final state). There's no separate "game started" message; the first
  `state` message *is* the started-game signal — stop rendering the lobby
  once one arrives.
- Send `intent` for every player action (`draw`, `takeDiscard`, `discard`,
  `playCanasta`, `extendMeld`); the server always replies with either an
  updated `state` broadcast (success — comes to *all* human seats, not just
  you) or an `error` (only to you, request rejected, your local state is
  unchanged so no need to roll anything back).
- Send `nextRound` (or `{type:'intent', intent:{type:'nextRound'}}`,
  equivalent) once players are ready to continue after a finished round;
  any seat can send it. It's a no-op error once `matchWinner` is set on the
  view — treat that as "match over".
- `SeatView.yourHand` is always *your own* hand; other seats only expose
  `handCount` inside `players[]`. Never expect another player's cards over
  the wire.
- Reconnection: if your WS drops, reconnect and send `join` again with the
  **same room code and same name** you used originally — the server
  reassigns you to your old seat (rather than erroring "room full" or
  handing you a new seat) as long as nobody else already reconnected with
  that name into that seat. This works even for the host restarting
  `start` privileges transfer to whichever connection is currently seat 0.
