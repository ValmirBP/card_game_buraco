import { useGameStore, TEAM_DISPLAY_NAME } from '../../src/store/gameStore'
import { GameSession } from '../../src/session/GameSession'
import { Game } from '../../src/engine/game'
import { AIPlayer, AIDifficulty, findMeldCandidates, planOpeningMelds } from '../../src/engine/ai'
import { HumanPlayer } from '../../src/engine/player'
import { Card, Rank, Suit } from '../../src/engine/card'
import { Canasta } from '../../src/engine/canasta'
import { teamIdOfSeat } from '../../src/engine/gameState'
import type { Team, TeamId, TeamScoreBreakdown } from '../../src/engine/gameState'
import type { PlainCard, SeatConfig, SeatView } from '../../src/session/types'

const DIFFICULTIES: AIDifficulty[] = ['easy', 'medium', 'hard']
const SEEDS = [101, 202, 303, 404, 505]
const TEAMS: TeamId[] = ['A', 'B']
const SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']
const TOTAL_CARDS = 108
const VU_SCORE = 1500
const VU_MINIMUM = 75
const TARGET = 3000
const MAX_TURNS_PER_ROUND = 3000
const MAX_ROUNDS = 40
const SOAK_TIMEOUT = 120000

type Path = 'offline' | 'online'
type Scores = Record<TeamId, number>
type CanastraCount = { clean: number; dirty: number }
type Counts = Record<TeamId, CanastraCount>
type Kind = 'cartas' | 'mortos' | 'mesa' | 'placar-parcial' | 'vu' | 'mao-vazia' | 'turno' | 'view' | 'humano' | 'retomada'
type Violation = { kind: Kind; where: string; msg: string }
type Lay = { team: TeamId; seat: number; points: number; opening: boolean; minimum: number; ok: boolean }
type Closer = { seat: number; team: TeamId; handEmpty: boolean; hasCleanCanastra: boolean; mortoResolved: boolean }

type RoundStart = {
  round: number
  startScores: Scores
  startCanastras: Counts
  minimums: Scores
}

type RoundRecord = RoundStart & {
  turns: number
  finished: boolean
  finalized: boolean
  lays: Lay[]
  log: string[]
  teamScores: Scores
  meldScoreSums: Scores
  canastrasOnTable: Counts
  handPoints: number[]
  breakdowns: TeamScoreBreakdown[]
  winnerTeam?: TeamId
  endScores: Scores
  endCanastras: Counts
  matchWinner?: TeamId
  closer?: Closer
}

type MatchRecord = {
  path: Path
  label: string
  difficulty: AIDifficulty
  seed: number
  rounds: RoundRecord[]
  violations: Violation[]
  error?: string
  matchWinner?: TeamId
  finalScores: Scores
  afterWinnerNoop?: boolean
  afterWinnerError?: string
  midRoundNextRoundErrors: string[]
  humanOpenings: number
  humanRejections: number
  resumes: number
}

type MatchOptions = { human?: boolean; presets?: Scores[]; resumeAtTurn?: number }

function presetLabel(opts: MatchOptions): string {
  return opts.presets ? `/placares ${opts.presets.map(p => `${p.A}x${p.B}`).join(',')}` : ''
}

const OFFLINE_NAME_TEAM: Record<string, TeamId> = { Alice: 'A', Bruno: 'A', Ana: 'B', Carlos: 'B' }
const ONLINE_NAME_TEAM: Record<string, TeamId> = { J0: 'A', J1: 'B', J2: 'A', J3: 'B' }
const OPENING_LINE = /^(.+) abriu o jogo da dupla com (\d+) pontos \(vulnerável\)\.$/
const GAME_OVER_LINE = /^Fim de jogo — Time (A|B) venceu!$/

function lcg(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function withSeed<T>(seed: number, fn: () => T): T {
  const spy = jest.spyOn(Math, 'random').mockImplementation(lcg(seed))
  try {
    return fn()
  } finally {
    spy.mockRestore()
  }
}

function readmeValue(card: Card): number {
  if (card.isWild) return 20
  if (card.rank === 'A') return 15
  if (card.rank === '2') return 10
  if (['3', '4', '5', '6', '7'].includes(card.rank)) return 5
  return 10
}

function points(cards: Card[]): number {
  return cards.reduce((sum, c) => sum + readmeValue(c), 0)
}

function cardKey(card: Card): string {
  return `${card.suit}|${card.rank}|${card.isWild ? 'W' : 'N'}`
}

function serializeCounts(counts: Map<string, number>): string {
  return [...counts.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, n]) => `${k}=${n}`)
    .join(',')
}

const EXPECTED_COMPOSITION = (() => {
  const counts = new Map<string, number>()
  for (const suit of SUITS) for (const rank of RANKS) counts.set(`${suit}|${rank}|N`, 2)
  counts.set('hearts|2|W', 4)
  return serializeCounts(counts)
})()

function compositionOf(cards: Card[]): string {
  const counts = new Map<string, number>()
  for (const c of cards) counts.set(cardKey(c), (counts.get(cardKey(c)) ?? 0) + 1)
  return serializeCounts(counts)
}

function teamOf(game: Game, id: TeamId): Team {
  return game.state.teams.find(t => t.id === id)!
}

function allCards(game: Game): Card[] {
  const s = game.state
  return [
    ...s.players.flatMap(p => p.hand.getCards()),
    ...s.teams.flatMap(t => t.melds.flatMap(m => m.cards)),
    ...s.deck,
    ...s.discardPile,
    ...s.mortos.flat(),
  ]
}

function minimumsOf(game: Game): Scores {
  return { A: teamOf(game, 'A').openingMinimum, B: teamOf(game, 'B').openingMinimum }
}

function cloneCounts(c: Counts): Counts {
  return { A: { ...c.A }, B: { ...c.B } }
}

function canastrasOnTable(game: Game): Counts {
  const out: Counts = { A: { clean: 0, dirty: 0 }, B: { clean: 0, dirty: 0 } }
  for (const t of game.state.teams) {
    for (const m of t.melds) {
      if (m.cards.length < 7) continue
      if (m.isClean) out[t.id].clean++
      else out[t.id].dirty++
    }
  }
  return out
}

function checkGame(game: Game, minimums: Scores, where: string): Violation[] {
  const v: Violation[] = []
  const s = game.state
  const cards = allCards(game)
  if (cards.length !== TOTAL_CARDS) v.push({ kind: 'cartas', where, msg: `${cards.length} cartas em jogo` })
  if (new Set(cards).size !== cards.length) v.push({ kind: 'cartas', where, msg: 'a mesma carta aparece em dois lugares' })
  if (compositionOf(cards) !== EXPECTED_COMPOSITION) v.push({ kind: 'cartas', where, msg: 'a composição do baralho mudou' })
  if (s.mortos.length > 2 || s.mortos.some(m => m.length !== 11)) {
    v.push({ kind: 'mortos', where, msg: `mortos com tamanhos ${s.mortos.map(m => m.length).join('/')}` })
  }
  if (s.currentPlayerIndex < 0 || s.currentPlayerIndex > 3) v.push({ kind: 'turno', where, msg: `assento atual ${s.currentPlayerIndex}` })
  for (const t of s.teams) {
    if (t.openingMinimum !== minimums[t.id]) {
      v.push({ kind: 'vu', where, msg: `mínimo de abertura do time ${t.id} mudou para ${t.openingMinimum} no meio da rodada` })
    }
    for (const m of t.melds) {
      let valid = m.cards.length >= 3
      try {
        new Canasta(m.cards)
      } catch {
        valid = false
      }
      if (!valid) v.push({ kind: 'mesa', where, msg: `jogo inválido na mesa do time ${t.id}: ${m.cards.map(cardKey).join(' ')}` })
    }
    if (s.status === 'playing') {
      const sum = t.melds.reduce((n, m) => n + m.getScore(), 0)
      if (t.score !== sum) v.push({ kind: 'placar-parcial', where, msg: `time ${t.id} com ${t.score} e jogos somando ${sum}` })
    }
    if (minimums[t.id] > 0 && t.melds.length > 0) {
      const onTable = points(t.melds.flatMap(m => m.cards))
      if (onTable < minimums[t.id]) v.push({ kind: 'vu', where, msg: `time ${t.id} vulnerável com só ${onTable} pontos na mesa` })
    }
  }
  if (s.status === 'playing') {
    s.players.forEach((p, seat) => {
      if (p.hand.isEmpty()) v.push({ kind: 'mao-vazia', where, msg: `assento ${seat} sem cartas com a rodada em andamento` })
    })
  }
  return v
}

function recordLays(game: Game, lays: Lay[]): void {
  const original = Game.prototype.playMelds
  game.playMelds = (groups: Card[][]) => {
    const team = game.getTeamOfCurrentPlayer()
    const opening = game.needsOpening(team)
    const seat = game.state.currentPlayerIndex
    const ok = original.call(game, groups)
    lays.push({ team: team.id, seat, points: points(groups.flat()), opening, minimum: team.openingMinimum, ok })
    return ok
  }
}

function closeRound(
  start: RoundStart,
  game: Game,
  turns: number,
  lays: Lay[],
  log: string[],
  endScores: Scores,
  endCanastras: Counts,
  matchWinner: TeamId | undefined,
  finalized: boolean
): RoundRecord {
  const s = game.state
  const closerSeat = s.closerSeat
  let closer: Closer | undefined
  if (closerSeat !== undefined) {
    const t = teamOf(game, teamIdOfSeat(closerSeat))
    closer = {
      seat: closerSeat,
      team: t.id,
      handEmpty: s.players[closerSeat].hand.isEmpty(),
      hasCleanCanastra: t.melds.some(m => m.cards.length >= 7 && m.isClean),
      mortoResolved: t.hasTakenMorto || s.mortos.length === 0,
    }
  }
  return {
    ...start,
    turns,
    finished: s.status === 'finished',
    finalized,
    lays,
    log,
    teamScores: { A: teamOf(game, 'A').score, B: teamOf(game, 'B').score },
    meldScoreSums: {
      A: teamOf(game, 'A').melds.reduce((n, m) => n + m.getScore(), 0),
      B: teamOf(game, 'B').melds.reduce((n, m) => n + m.getScore(), 0),
    },
    canastrasOnTable: canastrasOnTable(game),
    handPoints: s.players.map(p => points(p.hand.getCards())),
    breakdowns: s.scoreBreakdowns ?? [],
    winnerTeam: s.winnerTeam,
    endScores,
    endCanastras,
    matchWinner,
    closer,
  }
}

function newMatch(path: Path, label: string, difficulty: AIDifficulty, seed: number): MatchRecord {
  return {
    path,
    label,
    difficulty,
    seed,
    rounds: [],
    violations: [],
    finalScores: { A: 0, B: 0 },
    midRoundNextRoundErrors: [],
    humanOpenings: 0,
    humanRejections: 0,
    resumes: 0,
  }
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.stack ?? e.message : String(e)
}

const st = () => useGameStore.getState()

function snapshot(game: Game): string {
  const s = game.state
  return JSON.stringify({
    hands: s.players.map(p => p.hand.getCards().map(cardKey)),
    kinds: s.players.map(p => (p instanceof AIPlayer ? `ai:${p.difficulty}` : 'human')),
    melds: s.teams.map(t => t.melds.map(m => m.cards.map(cardKey))),
    teams: s.teams.map(t => [t.id, t.score, t.hasTakenMorto, t.mortoTakenBySeat ?? null, t.mortoUsed ?? null, t.openingMinimum]),
    deck: s.deck.map(cardKey),
    discard: s.discardPile.map(cardKey),
    mortos: s.mortos.map(m => m.map(cardKey)),
    current: s.currentPlayerIndex,
    status: s.status,
    recycles: s.discardRecycles,
  })
}

function storeResume(rec: MatchRecord, game: Game, lays: Lay[], where: string): Game {
  const before = snapshot(game)
  const storeBefore = JSON.stringify({ scores: st().matchScores, round: st().round, log: st().gameLog.length })
  if (!st().resumeSavedGame()) {
    rec.violations.push({ kind: 'retomada', where, msg: 'resumeSavedGame devolveu false' })
    return game
  }
  const resumed = st().game!
  if (resumed === game) rec.violations.push({ kind: 'retomada', where, msg: 'o jogo não foi recarregado do salvamento' })
  if (snapshot(resumed) !== before) rec.violations.push({ kind: 'retomada', where, msg: 'o estado retomado difere do estado salvo' })
  const storeAfter = JSON.stringify({ scores: st().matchScores, round: st().round, log: st().gameLog.length })
  if (storeAfter !== storeBefore) rec.violations.push({ kind: 'retomada', where, msg: 'placar, rodada ou log mudaram ao retomar' })
  recordLays(resumed, lays)
  rec.resumes++
  return resumed
}

function humanStoreTurn(rec: MatchRecord, game: Game, rng: () => number, where: string): void {
  const player = game.state.players[0]
  if (game.state.discardPile.length > 1 && rng() < 0.35) st().takeDiscardPile()
  else st().drawFromDeck()
  if (game.state.status !== 'playing') return

  const team = teamOf(game, 'A')
  const hand = player.hand.getCards()
  const idx = (group: Card[]) => group.map(c => hand.indexOf(c))
  if (game.needsOpening(team)) {
    const small = findMeldCandidates(hand).find(g => points(g) < team.openingMinimum)
    if (small) {
      const version = st().version
      const logLength = st().gameLog.length
      const accepted = st().playMelds([idx(small)])
      const untouched =
        !accepted &&
        st().version === version &&
        st().gameLog.length === logLength &&
        player.hand.getSize() === hand.length &&
        team.melds.length === 0
      if (untouched) rec.humanRejections++
      else rec.violations.push({ kind: 'humano', where, msg: `descida de ${points(small)} aceita ou alterou o estado com a dupla vulnerável` })
    }
    for (const plan of planOpeningMelds(hand, team.openingMinimum)) {
      const groups = plan.map(idx)
      for (const g of groups.slice(0, -1)) st().stageOpeningGroup(g)
      if (JSON.stringify(st().stagedOpening) !== JSON.stringify(groups.slice(0, -1))) {
        rec.violations.push({ kind: 'humano', where, msg: 'stageOpeningGroup não reservou os grupos' })
      }
      if (groups.length > 1) {
        st().toggleCardSelection(groups[0][0])
        if (st().selectedCardIndices.length !== 0) {
          rec.violations.push({ kind: 'humano', where, msg: 'carta reservada pôde ser selecionada' })
        }
      }
      const logLength = st().gameLog.length
      const accepted = st().playMelds([...st().stagedOpening, groups[groups.length - 1]])
      if (accepted) {
        rec.humanOpenings++
        if (st().stagedOpening.length !== 0) rec.violations.push({ kind: 'humano', where, msg: 'a reserva não foi limpa após abrir' })
        const line = `Alice abriu o jogo da dupla com ${points(plan.flat())} pontos (vulnerável).`
        if (!st().gameLog.slice(logLength).includes(line)) rec.violations.push({ kind: 'humano', where, msg: `log sem "${line}"` })
        break
      }
      st().cancelOpening()
    }
  } else {
    for (const cand of findMeldCandidates(hand)) {
      const before = team.melds.length
      st().playCanasta(idx(cand))
      if (team.melds.length > before) break
    }
  }
  if (game.state.status !== 'playing') return

  const cards = player.hand.getCards()
  const order = cards.map((_, i) => i).sort((a, b) => readmeValue(cards[a]) - readmeValue(cards[b]) || a - b)
  for (const i of order) {
    st().discard(i)
    if (game.state.status !== 'playing' || game.state.currentPlayerIndex !== 0) return
  }
  rec.violations.push({ kind: 'humano', where, msg: 'nenhum descarte foi aceito' })
}

function playStoreRound(rec: MatchRecord, difficulty: AIDifficulty, opts: MatchOptions, logMark: number, rng: () => number): RoundRecord {
  let game = st().game!
  if (!opts.human) {
    game.state.players[0] = new AIPlayer('Alice', difficulty, game.state.players[0].hand.getCards())
  } else if (!(game.state.players[0] instanceof HumanPlayer)) {
    rec.violations.push({ kind: 'humano', where: rec.label, msg: 'o lugar 0 deixou de ser humano' })
  }
  const lays: Lay[] = []
  recordLays(game, lays)
  const start: RoundStart = {
    round: st().round,
    startScores: { ...st().matchScores },
    startCanastras: cloneCounts(st().matchCanastras),
    minimums: minimumsOf(game),
  }
  const where = (turn: number) => `${rec.label} rodada ${start.round} turno ${turn}`
  rec.violations.push(...checkGame(game, start.minimums, where(0)))

  let turns = 0
  while (game.state.status === 'playing' && turns < MAX_TURNS_PER_ROUND) {
    if (opts.resumeAtTurn !== undefined && turns === opts.resumeAtTurn) {
      game = storeResume(rec, game, lays, where(turns))
      if (!opts.human && !(game.state.players[0] instanceof AIPlayer)) {
        rec.violations.push({ kind: 'retomada', where: where(turns), msg: 'o lugar 0 voltou como humano' })
      }
    }
    const seat = game.state.currentPlayerIndex
    if (opts.human && seat === 0) humanStoreTurn(rec, game, rng, where(turns))
    else st().aiTurn()
    turns++
    rec.violations.push(...checkGame(game, start.minimums, where(turns)))
    if (game.state.status === 'playing' && game.state.currentPlayerIndex !== (seat + 1) % 4) {
      rec.violations.push({ kind: 'turno', where: where(turns), msg: `vez foi de ${seat} para ${game.state.currentPlayerIndex}` })
    }
  }

  return closeRound(
    start,
    game,
    turns,
    lays,
    st().gameLog.slice(logMark),
    { ...st().matchScores },
    cloneCounts(st().matchCanastras),
    st().matchWinner,
    st().roundFinalized
  )
}

function playStoreMatch(difficulty: AIDifficulty, seed: number, opts: MatchOptions = {}): MatchRecord {
  const label = `offline/${difficulty}/semente ${seed}${opts.human ? '/humano' : ''}${presetLabel(opts)}`
  const rec = newMatch('offline', label, difficulty, seed)
  const rng = lcg(seed ^ 0x5bd1e995)
  withSeed(seed, () => {
    try {
      window.localStorage.clear()
      st().resetGame()
      st().initGame('Alice', difficulty)
      let logMark = 0
      for (let r = 0; r < MAX_ROUNDS; r++) {
        const round = playStoreRound(rec, difficulty, opts, logMark, rng)
        rec.rounds.push(round)
        if (!round.finished) break
        const preset = opts.presets?.[r]
        if (preset) useGameStore.setState({ matchScores: { ...preset }, matchWinner: undefined })
        if (st().matchWinner) break
        logMark = st().gameLog.length
        st().startNextRound()
      }
      rec.matchWinner = st().matchWinner
      rec.finalScores = { ...st().matchScores }
      if (rec.matchWinner) {
        const game = st().game
        const round = st().round
        const logLength = st().gameLog.length
        st().startNextRound()
        rec.afterWinnerNoop = st().game === game && st().round === round && st().gameLog.length === logLength
      }
    } catch (e) {
      rec.error = errorText(e)
    }
  })
  return rec
}

function sessionGame(session: GameSession): Game {
  return (session as unknown as { game: Game }).game
}

function sessionLog(session: GameSession): string[] {
  return (session as unknown as { log: string[] }).log
}

function viewCardTotal(v: SeatView): number {
  return (
    v.players.reduce((n, p) => n + p.handCount, 0) +
    v.teams.reduce((n, t) => n + t.melds.reduce((k, m) => k + m.layout.length, 0), 0) +
    v.deckCount +
    v.discardPile.length +
    v.mortos.reduce((n, m) => n + m.count, 0)
  )
}

function checkView(session: GameSession, game: Game, minimums: Scores, where: string): Violation[] {
  const v: Violation[] = []
  const view = session.getPublicView()
  const total = viewCardTotal(view)
  if (total !== TOTAL_CARDS) v.push({ kind: 'view', where, msg: `view pública conta ${total} cartas` })
  for (const t of view.teams) {
    if (t.openingMinimum !== minimums[t.id]) v.push({ kind: 'view', where, msg: `view mostra mínimo ${t.openingMinimum} para o time ${t.id}` })
    if (t.score !== teamOf(game, t.id).score) v.push({ kind: 'view', where, msg: `view mostra placar ${t.score} para o time ${t.id}` })
  }
  if (view.status === 'playing' && view.phase !== 'draw') v.push({ kind: 'turno', where, msg: `fase ${view.phase} ao fim do turno` })
  return v
}

function toCard(p: PlainCard): Card {
  return new Card(p.suit as Suit, p.rank as Rank, p.isWild)
}

function humanSessionTurn(rec: MatchRecord, session: GameSession, rng: () => number, where: string): void {
  let view = session.getViewFor(0)
  const take = view.discardPile.length > 1 && rng() < 0.35
  const drawn = session.applyIntent(0, take ? { type: 'takeDiscard' } : { type: 'draw' })
  if (!drawn.ok) rec.violations.push({ kind: 'humano', where, msg: `compra recusada: ${drawn.error}` })
  if (session.status !== 'playing') return

  view = session.getViewFor(0)
  const team = view.teams.find(t => t.id === 'A')!
  const hand = view.yourHand.map(toCard)
  const idx = (group: Card[]) => group.map(c => hand.indexOf(c))
  if (team.openingMinimum > 0 && team.melds.length === 0) {
    const small = findMeldCandidates(hand).find(g => points(g) < team.openingMinimum)
    if (small) {
      const expected = `vulneravel: a abertura precisa somar ${team.openingMinimum} pontos (estas cartas somam ${points(small)})`
      const byMelds = session.applyIntent(0, { type: 'playMelds', groups: [idx(small)] })
      const byCanasta = session.applyIntent(0, { type: 'playCanasta', cardIndices: idx(small) })
      const after = session.getViewFor(0)
      const untouched = after.yourHand.length === hand.length && after.teams.find(t => t.id === 'A')!.melds.length === 0
      if (!byMelds.ok && byMelds.error === expected && !byCanasta.ok && byCanasta.error === expected && untouched) {
        rec.humanRejections++
      } else {
        rec.violations.push({
          kind: 'humano',
          where,
          msg: `descida de ${points(small)} vulnerável: playMelds=${JSON.stringify(byMelds)} playCanasta=${JSON.stringify(byCanasta)}`,
        })
      }
    }
    for (const plan of planOpeningMelds(hand, team.openingMinimum)) {
      const logLength = sessionLog(session).length
      const res = session.applyIntent(0, { type: 'playMelds', groups: plan.map(idx) })
      if (res.ok) {
        rec.humanOpenings++
        const line = `J0 abriu o jogo da dupla com ${points(plan.flat())} pontos (vulnerável).`
        if (!sessionLog(session).slice(logLength).includes(line)) rec.violations.push({ kind: 'humano', where, msg: `log sem "${line}"` })
        break
      }
      if (res.error !== 'essa jogada esvaziaria a mao sem poder bater') {
        rec.violations.push({ kind: 'humano', where, msg: `abertura de ${points(plan.flat())} recusada: ${res.error}` })
      }
    }
  } else {
    for (const cand of findMeldCandidates(hand)) {
      if (session.applyIntent(0, { type: 'playCanasta', cardIndices: idx(cand) }).ok) break
    }
  }
  if (session.status !== 'playing') return

  const cards = session.getViewFor(0).yourHand.map(toCard)
  const order = cards.map((_, i) => i).sort((a, b) => readmeValue(cards[a]) - readmeValue(cards[b]) || a - b)
  for (const i of order) {
    if (session.applyIntent(0, { type: 'discard', cardIndex: i }).ok) return
  }
  rec.violations.push({ kind: 'humano', where, msg: 'nenhum descarte foi aceito' })
}

function playSessionRound(rec: MatchRecord, session: GameSession, opts: MatchOptions, logMark: number, rng: () => number): RoundRecord {
  const game = sessionGame(session)
  const lays: Lay[] = []
  recordLays(game, lays)
  const view0 = session.getPublicView()
  const start: RoundStart = {
    round: view0.round,
    startScores: { ...view0.matchScores },
    startCanastras: cloneCounts(view0.matchCanastras),
    minimums: minimumsOf(game),
  }
  const where = (turn: number) => `${rec.label} rodada ${start.round} turno ${turn}`
  rec.violations.push(...checkGame(game, start.minimums, where(0)), ...checkView(session, game, start.minimums, where(0)))

  let turns = 0
  while (session.status === 'playing' && turns < MAX_TURNS_PER_ROUND) {
    const seat = session.currentSeat
    if (turns === 0) {
      const early = session.applyIntent(seat, { type: 'nextRound' })
      rec.midRoundNextRoundErrors.push(early.ok ? 'aceito' : early.error ?? '')
    }
    if (opts.human && seat === 0) humanSessionTurn(rec, session, rng, where(turns))
    else session.runNextAiTurn()
    turns++
    rec.violations.push(...checkGame(game, start.minimums, where(turns)), ...checkView(session, game, start.minimums, where(turns)))
    if (session.status === 'playing' && session.currentSeat !== (seat + 1) % 4) {
      rec.violations.push({ kind: 'turno', where: where(turns), msg: `vez foi de ${seat} para ${session.currentSeat}` })
    }
  }

  const view = session.getPublicView()
  return closeRound(
    start,
    game,
    turns,
    lays,
    view.log.slice(logMark),
    { ...view.matchScores },
    cloneCounts(view.matchCanastras),
    view.matchWinner,
    view.status === 'finished'
  )
}

function sessionSeats(difficulty: AIDifficulty, human: boolean): SeatConfig[] {
  return [0, 1, 2, 3].map(i => ({ kind: human && i === 0 ? 'human' : 'ai', name: `J${i}`, difficulty }))
}

function playSessionMatch(difficulty: AIDifficulty, seed: number, opts: MatchOptions = {}): MatchRecord & { fullLog: string[] } {
  const label = `online/${difficulty}/semente ${seed}${opts.human ? '/humano' : ''}${presetLabel(opts)}`
  const rec = { ...newMatch('online', label, difficulty, seed), fullLog: [] as string[] }
  const rng = lcg(seed ^ 0x5bd1e995)
  withSeed(seed, () => {
    try {
      const session = new GameSession(sessionSeats(difficulty, !!opts.human))
      let logMark = 0
      for (let r = 0; r < MAX_ROUNDS; r++) {
        const round = playSessionRound(rec, session, opts, logMark, rng)
        rec.rounds.push(round)
        if (!round.finished) break
        const preset = opts.presets?.[r]
        if (preset) {
          const internals = session as unknown as { matchScores: Scores; matchWinner?: TeamId }
          internals.matchScores = { ...preset }
          internals.matchWinner = undefined
        }
        logMark = sessionLog(session).length
        const next = session.applyIntent(r % 4, { type: 'nextRound' })
        if (!next.ok) {
          rec.afterWinnerError = next.error
          break
        }
      }
      const view = session.getPublicView()
      rec.matchWinner = view.matchWinner
      rec.finalScores = { ...view.matchScores }
      rec.fullLog = view.log
      rec.afterWinnerNoop = view.status === 'finished' && view.round === rec.rounds[rec.rounds.length - 1]?.round
    } catch (e) {
      rec.error = errorText(e)
    }
  })
  return rec
}

function playSessionMatchBulk(difficulty: AIDifficulty, seed: number): { log: string[]; scores: Scores; rounds: number; winner?: TeamId; error?: string } {
  const proto = GameSession.prototype as unknown as { runOneAiTurn: () => void }
  const original = proto.runOneAiTurn
  let turns = 0
  proto.runOneAiTurn = function (this: unknown) {
    if (++turns > MAX_TURNS_PER_ROUND) throw new Error(`mais de ${MAX_TURNS_PER_ROUND} turnos numa rodada`)
    return original.call(this)
  }
  try {
    return withSeed(seed, () => {
      const session = new GameSession(sessionSeats(difficulty, false))
      let rounds = 0
      try {
        while (rounds < MAX_ROUNDS) {
          turns = 0
          session.runAiTurns()
          rounds++
          if (!session.applyIntent(0, { type: 'nextRound' }).ok) break
        }
      } catch (e) {
        const view = session.getPublicView()
        return { log: view.log, scores: view.matchScores, rounds, winner: view.matchWinner, error: errorText(e) }
      }
      const view = session.getPublicView()
      return { log: view.log, scores: view.matchScores, rounds, winner: view.matchWinner }
    })
  } finally {
    proto.runOneAiTurn = original
  }
}

function fmt(v: Violation): string {
  return `[${v.kind}] ${v.where}: ${v.msg}`
}

function violationsOf(matches: MatchRecord[], kinds: Kind[]): string[] {
  return matches.flatMap(m => m.violations.filter(v => kinds.includes(v.kind)).map(fmt)).slice(0, 15)
}

function terminationProblems(m: MatchRecord): string[] {
  const out: string[] = []
  if (m.error) out.push(`${m.label}: exceção ${m.error}`)
  m.rounds.forEach(r => {
    if (!r.finished) out.push(`${m.label} rodada ${r.round}: não terminou em ${r.turns} turnos`)
    if (r.turns > MAX_TURNS_PER_ROUND) out.push(`${m.label} rodada ${r.round}: ${r.turns} turnos`)
    if (r.finished && !r.finalized) out.push(`${m.label} rodada ${r.round}: terminou sem ser finalizada no placar`)
  })
  if (!m.matchWinner) out.push(`${m.label}: sem vencedor após ${m.rounds.length} rodadas`)
  if (m.rounds.length > MAX_ROUNDS) out.push(`${m.label}: ${m.rounds.length} rodadas`)
  return out
}

function vuMinimumProblems(m: MatchRecord): string[] {
  return m.rounds.flatMap(r =>
    TEAMS.filter(id => r.minimums[id] !== (r.startScores[id] >= VU_SCORE ? VU_MINIMUM : 0)).map(
      id => `${m.label} rodada ${r.round}: time ${id} começou com ${r.startScores[id]} e mínimo ${r.minimums[id]}`
    )
  )
}

function vuLayProblems(m: MatchRecord): string[] {
  const out: string[] = []
  for (const r of m.rounds) {
    for (const id of TEAMS) {
      const where = `${m.label} rodada ${r.round} time ${id}`
      const teamLays = r.lays.filter(l => l.team === id)
      const accepted = teamLays.filter(l => l.ok)
      if (r.minimums[id] > 0) {
        teamLays
          .filter(l => l.opening && l.ok && l.points < VU_MINIMUM)
          .forEach(l => out.push(`${where}: abertura de ${l.points} aceita (assento ${l.seat})`))
        if (accepted.length > 0) {
          if (!accepted[0].opening) out.push(`${where}: primeira descida aceita não foi tratada como abertura`)
          if (accepted[0].points < VU_MINIMUM) out.push(`${where}: primeira descida soma só ${accepted[0].points}`)
          if (accepted.slice(1).some(l => l.opening)) out.push(`${where}: mais de uma abertura aceita`)
        }
      } else if (teamLays.some(l => l.opening)) {
        out.push(`${where}: dupla não vulnerável tratada como precisando abrir`)
      }
    }
  }
  return out
}

function vuWarning(path: Path, id: TeamId): string {
  return path === 'offline'
    ? `⚠️ Time ${id} (${TEAM_DISPLAY_NAME[id]}) está vulnerável (VU): a primeira descida da rodada precisa somar 75 pontos.`
    : `⚠️ Time ${id} está vulnerável (VU): a primeira descida da rodada precisa somar 75 pontos.`
}

function vuWarningProblems(m: MatchRecord): string[] {
  const out: string[] = []
  for (const r of m.rounds) {
    const expected = TEAMS.filter(id => r.minimums[id] > 0).map(id => vuWarning(m.path, id))
    const actual = r.log.filter(l => l.startsWith('⚠️'))
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      out.push(`${m.label} rodada ${r.round}: avisos ${JSON.stringify(actual)} esperado ${JSON.stringify(expected)}`)
    }
    if (r.round > 1) {
      const i = r.log.indexOf(`Rodada ${r.round} iniciada.`)
      if (i === -1) out.push(`${m.label} rodada ${r.round}: sem "Rodada ${r.round} iniciada."`)
      else if (JSON.stringify(r.log.slice(i + 1, i + 1 + expected.length)) !== JSON.stringify(expected)) {
        out.push(`${m.label} rodada ${r.round}: avisos VU não vêm logo após o início da rodada`)
      }
    }
  }
  return out
}

function openingLogProblems(m: MatchRecord): string[] {
  const out: string[] = []
  const nameTeam = m.path === 'offline' ? OFFLINE_NAME_TEAM : ONLINE_NAME_TEAM
  for (const r of m.rounds) {
    const lines = r.log.map(l => OPENING_LINE.exec(l)).filter((x): x is RegExpExecArray => x !== null)
    for (const id of TEAMS) {
      const where = `${m.label} rodada ${r.round} time ${id}`
      const teamLines = lines.filter(x => nameTeam[x[1]] === id)
      const openings = r.lays.filter(l => l.team === id && l.ok && l.opening)
      if (teamLines.length !== openings.length) out.push(`${where}: ${teamLines.length} linhas de abertura para ${openings.length} aberturas`)
      if (teamLines.length > 1) out.push(`${where}: abriu mais de uma vez no log`)
      if (r.minimums[id] === 0 && teamLines.length > 0) out.push(`${where}: log de abertura vulnerável sem estar vulnerável`)
      teamLines.forEach((x, i) => {
        if (Number(x[2]) < VU_MINIMUM) out.push(`${where}: log diz ${x[2]} pontos`)
        if (openings[i] && Number(x[2]) !== openings[i].points) out.push(`${where}: log diz ${x[2]}, cartas somam ${openings[i].points}`)
      })
    }
  }
  return out
}

function scoreProblems(m: MatchRecord): string[] {
  const out: string[] = []
  for (const r of m.rounds) {
    if (!r.finished) continue
    for (const id of TEAMS) {
      const delta = r.endScores[id] - r.startScores[id]
      if (delta !== r.teamScores[id]) {
        out.push(`${m.label} rodada ${r.round} time ${id}: placar foi de ${r.startScores[id]} para ${r.endScores[id]} mas a rodada valeu ${r.teamScores[id]}`)
      }
    }
  }
  const last = m.rounds[m.rounds.length - 1]
  if (last && JSON.stringify(last.endScores) !== JSON.stringify(m.finalScores)) out.push(`${m.label}: placar final difere do fim da última rodada`)
  return out
}

function breakdownProblems(m: MatchRecord): string[] {
  const out: string[] = []
  for (const r of m.rounds) {
    if (!r.finished) continue
    const where = `${m.label} rodada ${r.round}`
    for (const id of TEAMS) {
      const b = r.breakdowns.find(x => x.teamId === id)
      if (!b) {
        out.push(`${where}: sem detalhamento do time ${id}`)
        continue
      }
      if (b.total !== b.meldPoints + b.batidaBonus + b.mortoPenalty + b.handPenalty) out.push(`${where} time ${id}: total não fecha`)
      if (b.total !== r.teamScores[id]) out.push(`${where} time ${id}: total ${b.total} e placar da rodada ${r.teamScores[id]}`)
      if (b.meldPoints !== r.meldScoreSums[id]) out.push(`${where} time ${id}: jogos ${b.meldPoints} e mesa ${r.meldScoreSums[id]}`)
      if (b.mortoPenalty !== 0 && b.mortoPenalty !== -100) out.push(`${where} time ${id}: penalidade do morto ${b.mortoPenalty}`)
      const expectedBatida = r.closer?.team === id ? 100 : 0
      if (b.batidaBonus !== expectedBatida) out.push(`${where} time ${id}: batida ${b.batidaBonus}, esperado ${expectedBatida}`)
      for (const h of b.handBySeat) {
        if (h.points !== r.handPoints[h.seat]) out.push(`${where} assento ${h.seat}: mão vale ${r.handPoints[h.seat]}, detalhamento diz ${h.points}`)
        if (teamIdOfSeat(h.seat) !== id) out.push(`${where}: assento ${h.seat} no detalhamento do time ${id}`)
      }
      const counted = b.handBySeat.reduce((n, h) => n + (h.counted ? h.points : 0), 0)
      if (b.handPenalty !== -counted) out.push(`${where} time ${id}: penalidade de mão ${b.handPenalty}, esperado ${-counted}`)
    }
    const expectedWinner: TeamId = r.teamScores.B > r.teamScores.A ? 'B' : 'A'
    if (r.winnerTeam !== expectedWinner) out.push(`${where}: vencedor da rodada ${r.winnerTeam}, esperado ${expectedWinner}`)
  }
  return out
}

function closerProblems(m: MatchRecord): string[] {
  return m.rounds.flatMap(r => {
    if (!r.closer) return []
    const c = r.closer
    const out: string[] = []
    if (!c.handEmpty) out.push(`${m.label} rodada ${r.round}: quem bateu (${c.seat}) ainda tem cartas`)
    if (!c.hasCleanCanastra) out.push(`${m.label} rodada ${r.round}: bateu sem canastra limpa`)
    if (!c.mortoResolved) out.push(`${m.label} rodada ${r.round}: bateu sem pegar o morto disponível`)
    return out
  })
}

function canastraProblems(m: MatchRecord): string[] {
  const out: string[] = []
  for (const r of m.rounds) {
    if (!r.finished) continue
    for (const id of TEAMS) {
      const clean = r.endCanastras[id].clean - r.startCanastras[id].clean
      const dirty = r.endCanastras[id].dirty - r.startCanastras[id].dirty
      if (clean !== r.canastrasOnTable[id].clean || dirty !== r.canastrasOnTable[id].dirty) {
        out.push(`${m.label} rodada ${r.round} time ${id}: acumulou ${clean}/${dirty}, mesa tinha ${r.canastrasOnTable[id].clean}/${r.canastrasOnTable[id].dirty}`)
      }
    }
  }
  return out
}

function winnerProblems(m: MatchRecord): string[] {
  const out: string[] = []
  m.rounds.forEach((r, i) => {
    const reached = r.endScores.A >= TARGET || r.endScores.B >= TARGET
    const expected: TeamId | undefined = reached ? (r.endScores.B > r.endScores.A ? 'B' : 'A') : undefined
    if (r.matchWinner !== expected) out.push(`${m.label} rodada ${r.round}: vencedor ${r.matchWinner}, esperado ${expected} com ${JSON.stringify(r.endScores)}`)
    if (r.matchWinner && i !== m.rounds.length - 1) out.push(`${m.label}: rodada jogada depois do vencedor`)
  })
  if (m.matchWinner && Math.max(m.finalScores.A, m.finalScores.B) < TARGET) out.push(`${m.label}: vencedor sem 3000`)
  if (m.matchWinner && m.finalScores[m.matchWinner] < m.finalScores[m.matchWinner === 'A' ? 'B' : 'A']) out.push(`${m.label}: vencedor com menos pontos`)
  if (m.matchWinner && m.afterWinnerNoop !== true) out.push(`${m.label}: nova rodada começou depois do vencedor`)
  return out
}

function endLogProblems(m: MatchRecord): string[] {
  const out: string[] = []
  for (const r of m.rounds) {
    if (!r.finished) continue
    const where = `${m.label} rodada ${r.round}`
    const roundEnd = r.log.filter(l => l === `Fim da rodada ${r.round}.`).length
    const matchEnd = r.log.filter(l => /^Fim da partida — Time (A|B) venceu!$/.test(l))
    if (r.matchWinner) {
      if (roundEnd !== 0) out.push(`${where}: "Fim da rodada" na rodada final`)
      if (JSON.stringify(matchEnd) !== JSON.stringify([`Fim da partida — Time ${r.matchWinner} venceu!`])) out.push(`${where}: fim da partida ${JSON.stringify(matchEnd)}`)
    } else {
      if (roundEnd !== 1) out.push(`${where}: ${roundEnd} linhas "Fim da rodada ${r.round}."`)
      if (matchEnd.length !== 0) out.push(`${where}: "Fim da partida" sem vencedor`)
    }
    const gameOver = r.log.map(l => GAME_OVER_LINE.exec(l)).filter((x): x is RegExpExecArray => x !== null)
    if (gameOver.length !== 1 || gameOver[0][1] !== r.winnerTeam) out.push(`${where}: linhas de fim de jogo ${gameOver.map(x => x[0]).join(' | ')}`)
  }
  return out
}

function everyProblem(m: MatchRecord): string[] {
  return [
    ...terminationProblems(m),
    ...m.violations.map(fmt),
    ...vuMinimumProblems(m),
    ...vuLayProblems(m),
    ...vuWarningProblems(m),
    ...openingLogProblems(m),
    ...scoreProblems(m),
    ...breakdownProblems(m),
    ...closerProblems(m),
    ...canastraProblems(m),
    ...winnerProblems(m),
    ...endLogProblems(m),
  ].slice(0, 15)
}

function allRounds(matches: MatchRecord[]): RoundRecord[] {
  return matches.flatMap(m => m.rounds)
}

function vuActivity(matches: MatchRecord[]) {
  const rounds = allRounds(matches)
  const vulnerableRounds = rounds.filter(r => TEAMS.some(id => r.minimums[id] > 0))
  const lays = rounds.flatMap(r => r.lays.map(l => ({ ...l, roundMinimum: r.minimums[l.team] })))
  return {
    vulnerableRounds: vulnerableRounds.length,
    openings: lays.filter(l => l.ok && l.opening).length,
    refusedSmall: lays.filter(l => l.opening && !l.ok && l.points < VU_MINIMUM).length,
    smallAfterOpening: lays.filter(l => l.ok && !l.opening && l.roundMinimum > 0 && l.points < VU_MINIMUM).length,
    becameVulnerable: matches.filter(m => m.rounds.some((r, i) => i > 0 && TEAMS.some(id => r.minimums[id] > 0 && m.rounds[i - 1].minimums[id] === 0))).length,
    batidas: rounds.filter(r => r.closer).length,
  }
}

function describeCommonChecks(getMatches: () => MatchRecord[]): void {
  test.each(DIFFICULTIES)('dificuldade %s: nenhuma exceção e toda partida declara vencedor dentro do limite de rodadas', difficulty => {
    const matches = getMatches().filter(m => m.difficulty === difficulty)
    expect(matches).toHaveLength(SEEDS.length)
    expect(matches.flatMap(terminationProblems)).toEqual([])
    for (const m of matches) {
      expect(m.rounds.length).toBeGreaterThan(0)
      expect(m.rounds.length).toBeLessThanOrEqual(MAX_ROUNDS)
    }
  })

  test('toda rodada termina dentro do limite de turnos e é somada ao placar', () => {
    const rounds = allRounds(getMatches())
    expect(rounds.length).toBeGreaterThan(SEEDS.length * DIFFICULTIES.length)
    expect(rounds.filter(r => !r.finished || !r.finalized || r.turns > MAX_TURNS_PER_ROUND).map(r => r.round)).toEqual([])
    expect(Math.max(...rounds.map(r => r.turns))).toBeLessThanOrEqual(MAX_TURNS_PER_ROUND)
  })

  test('após cada turno: 108 cartas (mãos + mesa + monte + lixo + mortos), sem carta duplicada ou alterada, mortos intactos', () => {
    expect(violationsOf(getMatches(), ['cartas', 'mortos'])).toEqual([])
  })

  test('após cada turno: jogos válidos na mesa, placar parcial igual à soma dos jogos e ninguém sem cartas com a rodada em andamento', () => {
    expect(violationsOf(getMatches(), ['mesa', 'placar-parcial', 'mao-vazia'])).toEqual([])
  })

  test('cada turno termina passando a vez ao próximo assento', () => {
    expect(violationsOf(getMatches(), ['turno'])).toEqual([])
  })

  test('VU: o mínimo de cada rodada é 75 exatamente para a dupla que começou com 1500+ e não muda durante a rodada', () => {
    expect(getMatches().flatMap(vuMinimumProblems)).toEqual([])
    expect(violationsOf(getMatches(), ['vu'])).toEqual([])
  })

  test('VU: a primeira descida aceita de dupla vulnerável soma 75+ e nenhuma descida menor é aceita antes da abertura', () => {
    expect(getMatches().flatMap(vuLayProblems)).toEqual([])
  })

  test('VU: a regra entra em ação de verdade (rodadas vulneráveis, aberturas, recusas e liberação depois de abrir)', () => {
    const activity = vuActivity(getMatches())
    expect(activity.vulnerableRounds).toBeGreaterThan(0)
    expect(activity.becameVulnerable).toBeGreaterThan(0)
    expect(activity.openings).toBeGreaterThan(0)
    expect(activity.refusedSmall).toBeGreaterThan(0)
    expect(activity.smallAfterOpening).toBeGreaterThan(0)
    expect(activity.batidas).toBeGreaterThan(0)
  })

  test('VU: aviso no log logo após "Rodada N iniciada." apenas para as duplas vulneráveis', () => {
    expect(getMatches().flatMap(vuWarningProblems)).toEqual([])
  })

  test('VU: o log "abriu o jogo da dupla" sai uma vez por abertura, só para dupla vulnerável e com os pontos reais (75+)', () => {
    expect(getMatches().flatMap(openingLogProblems)).toEqual([])
  })

  test('placar: matchScores muda exatamente pela pontuação de cada dupla na rodada', () => {
    expect(getMatches().flatMap(scoreProblems)).toEqual([])
  })

  test('placar: detalhamento fecha (jogos + batida + morto + mãos) e bate com a mesa, as mãos e o vencedor da rodada', () => {
    expect(getMatches().flatMap(breakdownProblems)).toEqual([])
  })

  test('batida: quem bate tem a mão vazia, canastra limpa e morto resolvido', () => {
    expect(getMatches().flatMap(closerProblems)).toEqual([])
  })

  test('canastras da partida acumulam exatamente as canastras limpas e sujas da mesa', () => {
    expect(getMatches().flatMap(canastraProblems)).toEqual([])
  })

  test('vencedor: só com 3000+, é a dupla com mais pontos e nenhuma rodada nova começa depois dele', () => {
    expect(getMatches().flatMap(winnerProblems)).toEqual([])
  })

  test('log: "Fim da rodada N." nas intermediárias, "Fim da partida — Time X venceu!" na última e um fim de jogo por rodada', () => {
    expect(getMatches().flatMap(endLogProblems)).toEqual([])
  })
}

beforeEach(() => {
  window.localStorage.clear()
})

afterAll(() => {
  st().resetGame()
  window.localStorage.clear()
})

describe('soak offline: partidas completas só de IA pela store (aiTurn + startNextRound)', () => {
  let matches: MatchRecord[] = []
  beforeAll(() => {
    matches = DIFFICULTIES.flatMap(d => SEEDS.map(seed => playStoreMatch(d, seed)))
  }, SOAK_TIMEOUT)

  describeCommonChecks(() => matches)

  test('a mesma semente reproduz exatamente a mesma partida', () => {
    const again = playStoreMatch('medium', SEEDS[0])
    const original = matches.find(m => m.difficulty === 'medium' && m.seed === SEEDS[0])!
    expect(again.rounds.map(r => r.log)).toEqual(original.rounds.map(r => r.log))
    expect(again.finalScores).toEqual(original.finalScores)
    expect(again.matchWinner).toBe(original.matchWinner)
  })
})

describe('soak online: partidas completas só de IA pelo GameSession (runNextAiTurn + nextRound)', () => {
  let matches: (MatchRecord & { fullLog: string[] })[] = []
  beforeAll(() => {
    matches = DIFFICULTIES.flatMap(d => SEEDS.map(seed => playSessionMatch(d, seed)))
  }, SOAK_TIMEOUT)

  describeCommonChecks(() => matches)

  test('a view pública conta 108 cartas, o placar e o mínimo de abertura certos em todo turno', () => {
    expect(violationsOf(matches, ['view'])).toEqual([])
  })

  test('nextRound é recusado com a rodada em andamento e depois que a partida tem vencedor', () => {
    const early = matches.flatMap(m => m.midRoundNextRoundErrors)
    expect(early.length).toBe(allRounds(matches).length)
    expect(new Set(early)).toEqual(new Set(['a rodada atual ainda nao terminou']))
    expect(matches.map(m => m.afterWinnerError)).toEqual(matches.map(() => 'a partida ja foi encerrada'))
  })

  test.each(DIFFICULTIES)('dificuldade %s: runAiTurns em bloco produz a mesma partida que runNextAiTurn turno a turno', difficulty => {
    for (const seed of SEEDS.slice(0, 2)) {
      const stepwise = matches.find(m => m.difficulty === difficulty && m.seed === seed)!
      const bulk = playSessionMatchBulk(difficulty, seed)
      expect(bulk.error).toBeUndefined()
      expect(bulk.rounds).toBe(stepwise.rounds.length)
      expect(bulk.scores).toEqual(stepwise.finalScores)
      expect(bulk.winner).toBe(stepwise.matchWinner)
      expect(bulk.log).toEqual(stepwise.fullLog)
    }
  })
})

describe('humano roteirizado + IAs: abertura vulnerável pelas ações do jogador', () => {
  const HUMAN_SEEDS = [7, 8, 9, 10]
  let offline: MatchRecord[] = []
  let online: MatchRecord[] = []
  beforeAll(() => {
    offline = DIFFICULTIES.flatMap(d => HUMAN_SEEDS.map(seed => playStoreMatch(d, seed, { human: true })))
    online = DIFFICULTIES.flatMap(d => HUMAN_SEEDS.map(seed => playSessionMatch(d, seed, { human: true })))
  }, SOAK_TIMEOUT)

  test('offline: invariantes, regra VU, placar e vencedor valem com o humano jogando pela store', () => {
    expect(offline.flatMap(everyProblem)).toEqual([])
  })

  test('offline: descida pequena do humano vulnerável é recusada sem mexer em nada e stageOpeningGroup + playMelds abre com 75+', () => {
    expect(violationsOf(offline, ['humano'])).toEqual([])
    expect(offline.reduce((n, m) => n + m.humanRejections, 0)).toBeGreaterThan(0)
    expect(offline.reduce((n, m) => n + m.humanOpenings, 0)).toBeGreaterThan(0)
    const humanLays = allRounds(offline).flatMap(r => r.lays.filter(l => l.seat === 0 && l.ok && l.opening))
    expect(humanLays.length).toBeGreaterThan(0)
    expect(humanLays.every(l => l.points >= VU_MINIMUM)).toBe(true)
  })

  test('online: invariantes, regra VU, placar e vencedor valem com o humano mandando intents', () => {
    expect(online.flatMap(everyProblem)).toEqual([])
  })

  test('online: playMelds/playCanasta abaixo de 75 recusados com a mensagem vulneravel; playMelds de 75+ abre a dupla', () => {
    expect(violationsOf(online, ['humano'])).toEqual([])
    expect(online.reduce((n, m) => n + m.humanRejections, 0)).toBeGreaterThan(0)
    expect(online.reduce((n, m) => n + m.humanOpenings, 0)).toBeGreaterThan(0)
    const humanLays = allRounds(online).flatMap(r => r.lays.filter(l => l.seat === 0 && l.ok && l.opening))
    expect(humanLays.length).toBeGreaterThan(0)
    expect(humanLays.every(l => l.points >= VU_MINIMUM)).toBe(true)
  })
})

describe('placares forçados depois da primeira rodada (fronteira de 1500 e reta final)', () => {
  const PRESETS: { name: string; scores: Scores; difficulty: AIDifficulty; seed: number }[] = [
    { name: 'A com 1499 e B com 1500', scores: { A: 1499, B: 1500 }, difficulty: 'easy', seed: 31 },
    { name: 'A com 1500 e B com 1499', scores: { A: 1500, B: 1499 }, difficulty: 'medium', seed: 32 },
    { name: 'as duas duplas com 1500', scores: { A: 1500, B: 1500 }, difficulty: 'hard', seed: 33 },
    { name: 'as duas vulneráveis na reta final (2900 x 2950)', scores: { A: 2900, B: 2950 }, difficulty: 'medium', seed: 34 },
    { name: 'uma vulnerável e a outra negativa (2200 x -300)', scores: { A: 2200, B: -300 }, difficulty: 'hard', seed: 35 },
  ]

  test.each(PRESETS)('offline, $name: a rodada seguinte aplica o VU certo e a partida termina íntegra', ({ scores, difficulty, seed }) => {
    const m = playStoreMatch(difficulty, seed, { presets: [scores] })
    expect(everyProblem(m)).toEqual([])
    expect(m.rounds.length).toBeGreaterThanOrEqual(2)
    const second = m.rounds[1]
    expect(second.startScores).toEqual(scores)
    expect(second.minimums).toEqual({ A: scores.A >= VU_SCORE ? VU_MINIMUM : 0, B: scores.B >= VU_SCORE ? VU_MINIMUM : 0 })
  })

  test.each(PRESETS)('online, $name: a rodada seguinte aplica o VU certo e a partida termina íntegra', ({ scores, difficulty, seed }) => {
    const m = playSessionMatch(difficulty, seed, { presets: [scores] })
    expect(everyProblem(m)).toEqual([])
    expect(m.rounds.length).toBeGreaterThanOrEqual(2)
    const second = m.rounds[1]
    expect(second.startScores).toEqual(scores)
    expect(second.minimums).toEqual({ A: scores.A >= VU_SCORE ? VU_MINIMUM : 0, B: scores.B >= VU_SCORE ? VU_MINIMUM : 0 })
  })

  const ON_OFF: Scores[] = [
    { A: 1500, B: 0 },
    { A: 1499, B: 1500 },
  ]

  test.each([
    ['offline', 'medium', 41],
    ['online', 'hard', 42],
  ] as [Path, AIDifficulty, number][])('%s: o VU liga e desliga ao longo da mesma partida conforme o placar de cada rodada', (path, difficulty, seed) => {
    const m = path === 'offline' ? playStoreMatch(difficulty, seed, { presets: ON_OFF }) : playSessionMatch(difficulty, seed, { presets: ON_OFF })
    expect(everyProblem(m)).toEqual([])
    expect(m.rounds.length).toBeGreaterThanOrEqual(3)
    const [first, second, third] = m.rounds
    expect(first.minimums).toEqual({ A: 0, B: 0 })
    expect(second.minimums).toEqual({ A: VU_MINIMUM, B: 0 })
    expect(third.minimums).toEqual({ A: 0, B: VU_MINIMUM })
    expect(second.log.filter(l => l.startsWith('⚠️'))).toEqual([vuWarning(path, 'A')])
    expect(third.log.filter(l => l.startsWith('⚠️'))).toEqual([vuWarning(path, 'B')])
    expect(third.lays.filter(l => l.team === 'A' && l.opening)).toEqual([])
    expect(second.lays.filter(l => l.team === 'B' && l.opening)).toEqual([])
    const firstOk = (r: RoundRecord, id: TeamId) => r.lays.find(l => l.team === id && l.ok)!
    expect(firstOk(second, 'A')).toEqual(expect.objectContaining({ opening: true, minimum: VU_MINIMUM }))
    expect(firstOk(second, 'A').points).toBeGreaterThanOrEqual(VU_MINIMUM)
    expect(firstOk(second, 'B')).toEqual(expect.objectContaining({ opening: false, minimum: 0 }))
    expect(firstOk(second, 'B').points).toBeLessThan(VU_MINIMUM)
    expect(firstOk(third, 'A')).toEqual(expect.objectContaining({ opening: false, minimum: 0 }))
    expect(firstOk(third, 'A').points).toBeLessThan(VU_MINIMUM)
    expect(firstOk(third, 'B')).toEqual(expect.objectContaining({ opening: true, minimum: VU_MINIMUM }))
    expect(firstOk(third, 'B').points).toBeGreaterThanOrEqual(VU_MINIMUM)
  })
})

describe('retomar a partida salva no meio de cada rodada (offline)', () => {
  test.each(DIFFICULTIES)('dificuldade %s: resumeSavedGame preserva cartas, placar e VU, e a partida termina íntegra', difficulty => {
    const m = playStoreMatch(difficulty, 77, { resumeAtTurn: 25 })
    expect(everyProblem(m)).toEqual([])
    expect(violationsOf([m], ['retomada'])).toEqual([])
    expect(m.resumes).toBeGreaterThan(0)
    expect(m.resumes).toBe(m.rounds.filter(r => r.turns > 25).length)
  })
})
