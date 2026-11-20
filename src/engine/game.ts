import type { Bonus, Layout, MatchBy, Mode, Tile, Word } from './types.ts'
import { layoutFor } from './types.ts'
import { isAdjacent, neighbors, pickWords, placeBonuses, placeClassic, placePaths, tilesFor } from './board.ts'
import { countUnits, fitsIn, joinUnits, tileUnit, unitsOf, type PoolIndex } from './match.ts'
import { classicClearable, pathClearable, wordsOnBoard } from './solver.ts'
import { CLEAR_BONUS, HINT_COST, scoreWord, type ScoreBreakdown } from './scoring.ts'
import { worse, type Outcome } from './srs.ts'
import { pick, shuffle, type Rng } from './rng.ts'

export const BLITZ_MS = 90_000
export const BLITZ_TIME_BONUS_MS = 2_000

export interface GameConfig {
  mode: Mode
  rows: number
  cols: number
  matchBy: MatchBy
  blitzMs?: number
}

export interface GameContext {
  pool: readonly Word[]
  indexes: Record<MatchBy, PoolIndex>
  weight?: (w: Word) => number
  rng: Rng
}

export interface FoundWord {
  word: Word
  cells: number[]
  score: ScoreBreakdown
  unplanned: boolean
}

export type GameEvent =
  | { kind: 'match'; word: Word; cells: number[]; tiles: Tile[]; score: ScoreBreakdown; unplanned: boolean }
  | { kind: 'miss'; cells: number[] }
  | { kind: 'reshuffle' }
  | { kind: 'won'; bonus: number }
  | { kind: 'timeup' }
  | { kind: 'clue'; word: Word }
  | { kind: 'reveal'; word: Word }

export type Status = 'playing' | 'won' | 'timeup' | 'ended'

export interface GameState {
  config: GameConfig
  cells: (Tile | null)[]
  bonuses: (Bonus | null)[]
  /** Every word dealt onto the board this round (including refills). */
  planned: Word[]
  selection: number[]
  /** Selection is a complete word but could also be extended into a longer one. */
  ready: boolean
  score: number
  streak: number
  bestStreak: number
  mistakes: number
  hintsUsed: number
  found: FoundWord[]
  outcomes: Record<string, Outcome>
  revealKey: string | null
  clue: Word | null
  status: Status
  startedAt: number
  endsAt: number | null
  endedAt: number | null
  nextTileId: number
  events: GameEvent[]
  eventSeq: number
}

export type GameAction =
  | { type: 'tap'; cell: number; now: number }
  | { type: 'path'; cells: number[] }
  | { type: 'release'; now: number }
  | { type: 'submit'; now: number }
  | { type: 'clear' }
  | { type: 'hint'; kind: 'clue' | 'reveal' }
  | { type: 'shuffle' }
  | { type: 'tick'; now: number }
  | { type: 'end'; now: number }
  | { type: 'matchBy'; matchBy: MatchBy }

export const layoutOf = (s: GameState): Layout => layoutFor(s.config.mode)

function deal(
  words: Word[],
  cells: number[],
  layout: Layout,
  rows: number,
  cols: number,
  rng: Rng,
  firstId: number,
): { placement: Map<number, Tile>; nextId: number } | null {
  let id = firstId
  const tiles = tilesFor(words, () => id++)
  const placement = layout === 'path' ? placePaths(words, tiles, cells, rows, cols, rng) : placeClassic(tiles, cells, rng)
  return placement ? { placement, nextId: id } : null
}

/** Returns null when the pool does not contain enough playable words for this grid. */
export function createGame(config: GameConfig, ctx: GameContext, now: number): GameState | null {
  const size = config.rows * config.cols
  const layout = layoutFor(config.mode)
  const allCells = Array.from({ length: size }, (_, i) => i)
  for (let attempt = 0; attempt < 12; attempt++) {
    const words = pickWords(ctx.pool, size, ctx.rng, { weight: ctx.weight })
    if (!words) return null
    const dealt = deal(words, allCells, layout, config.rows, config.cols, ctx.rng, 0)
    if (!dealt) continue
    return {
      config,
      cells: allCells.map((c) => dealt.placement.get(c) ?? null),
      bonuses: placeBonuses(size, ctx.rng),
      planned: words,
      selection: [],
      ready: false,
      score: 0,
      streak: 0,
      bestStreak: 0,
      mistakes: 0,
      hintsUsed: 0,
      found: [],
      outcomes: {},
      revealKey: null,
      clue: null,
      status: 'playing',
      startedAt: now,
      endsAt: config.mode === 'blitz' ? now + (config.blitzMs ?? BLITZ_MS) : null,
      endedAt: null,
      nextTileId: dealt.nextId,
      events: [],
      eventSeq: 0,
    }
  }
  return null
}

export function cellsOfWord(s: GameState, key: string): number[] {
  return s.cells
    .map((t, i) => [t, i] as const)
    .filter(([t]) => t?.wordKey === key)
    .sort(([a], [b]) => a!.pos - b!.pos)
    .map(([, i]) => i)
}

export const intactWords = (s: GameState) => wordsOnBoard(s.cells, s.planned)

const unitKey = (w: Word, by: MatchBy) => joinUnits(unitsOf(w, by))

function canExtend(s: GameState, index: PoolIndex, units: string[]): boolean {
  const cands = index.byPrefix.get(joinUnits(units))
  if (!cands?.length) return false
  const by = s.config.matchBy
  if (layoutOf(s) === 'classic') {
    const free = s.cells.flatMap((t, i) => (t && !s.selection.includes(i) ? [tileUnit(t, by)] : []))
    const counts = countUnits(free)
    return cands.some((w) => fitsIn(unitsOf(w, by).slice(units.length), counts))
  }
  const last = s.selection[s.selection.length - 1]
  const next = neighbors(last, s.config.rows, s.config.cols).filter((n) => s.cells[n] && !s.selection.includes(n))
  return cands.some((w) => next.some((n) => tileUnit(s.cells[n]!, by) === unitsOf(w, by)[units.length]))
}

function evaluate(s: GameState, ctx: GameContext, now: number, final: boolean): GameState {
  if (s.selection.length < 2) return { ...s, ready: false }
  const by = s.config.matchBy
  const index = ctx.indexes[by]
  const units = s.selection.map((c) => tileUnit(s.cells[c]!, by))
  const key = joinUnits(units)
  const poolMatch = index.byKey.get(key)?.[0]
  const planned = s.planned.find((w) => unitKey(w, by) === key && cellsOfWord(s, w.key).length > 0)
  const exact = planned ?? poolMatch
  const extend = !final && canExtend(s, index, units)
  if (exact && !extend) return accept(s, ctx, exact, !planned, now)
  if (exact) return { ...s, ready: true }
  if (extend) return { ...s, ready: false }
  return miss(s)
}

function miss(s: GameState): GameState {
  const first = s.cells[s.selection[0]]
  return {
    ...s,
    selection: [],
    ready: false,
    mistakes: s.mistakes + 1,
    streak: 0,
    outcomes: first ? { ...s.outcomes, [first.wordKey]: worse(s.outcomes[first.wordKey], 'hard') } : s.outcomes,
    events: [{ kind: 'miss', cells: s.selection }],
    eventSeq: s.eventSeq + 1,
  }
}

function accept(s: GameState, ctx: GameContext, word: Word, unplanned: boolean, now: number): GameState {
  const cells = s.cells.slice()
  const sel = s.selection
  let needsCheck = unplanned
  if (!unplanned) {
    // Tiles with identical faces are interchangeable: make sure the dealt tiles for `word` are the ones consumed.
    sel.forEach((c, i) => {
      const t = cells[c]!
      if (t.wordKey === word.key && t.pos === i) return
      const d = cells.findIndex((x, j) => x?.wordKey === word.key && x.pos === i && !sel.includes(j))
      if (d >= 0 && layoutOf(s) === 'classic') [cells[c], cells[d]] = [cells[d], cells[c]]
      else needsCheck = true
    })
  }
  const tiles = sel.map((c) => cells[c]!)
  const score = scoreWord(
    tiles.map((t) => t.value),
    sel.map((c) => s.bonuses[c]),
    s.streak,
    unplanned,
  )
  for (const c of sel) cells[c] = null
  let next: GameState = {
    ...s,
    cells,
    selection: [],
    ready: false,
    score: s.score + score.total,
    streak: s.streak + 1,
    bestStreak: Math.max(s.bestStreak, s.streak + 1),
    found: [...s.found, { word, cells: sel, score, unplanned }],
    outcomes: { ...s.outcomes, [word.key]: s.outcomes[word.key] ?? 'ok' },
    revealKey: s.revealKey === word.key ? null : s.revealKey,
    events: [{ kind: 'match', word, cells: sel, tiles, score, unplanned }],
    eventSeq: s.eventSeq + 1,
  }
  if (s.config.mode === 'blitz') {
    next = refill(next, ctx)
    next.endsAt = (next.endsAt ?? now) + BLITZ_TIME_BONUS_MS
  }
  if (next.cells.every((t) => !t)) return win(next, now)
  if (needsCheck) next = ensureClearable(next, ctx, now)
  const intact = new Set(intactWords(next).map((w) => w.key))
  if (next.clue && !intact.has(next.clue.key)) next.clue = null
  if (next.revealKey && !intact.has(next.revealKey)) next.revealKey = null
  return next
}

function win(s: GameState, now: number): GameState {
  return {
    ...s,
    status: 'won',
    score: s.score + CLEAR_BONUS,
    endedAt: now,
    clue: null,
    revealKey: null,
    events: [...s.events, { kind: 'won', bonus: CLEAR_BONUS }],
  }
}

function readingsOnBoard(s: GameState): Set<string> {
  const keys = new Set(s.cells.flatMap((t) => (t ? [t.wordKey] : [])))
  return new Set(s.planned.filter((w) => keys.has(w.key)).map((w) => w.syllables.join(' ')))
}

/** Blitz: tiles fall down their columns, new words drop in from the top. */
function refill(s: GameState, ctx: GameContext): GameState {
  const { rows, cols } = s.config
  const cells = s.cells.slice()
  for (let c = 0; c < cols; c++) {
    const col: Tile[] = []
    for (let r = rows - 1; r >= 0; r--) {
      const t = cells[r * cols + c]
      if (t) col.push(t)
    }
    for (let r = rows - 1, k = 0; r >= 0; r--, k++) cells[r * cols + c] = col[k] ?? null
  }
  const empties = cells.flatMap((t, i) => (t ? [] : [i]))
  const onBoard = new Set(cells.flatMap((t) => (t ? [t.wordKey] : [])))
  const base = { ...s, cells }
  const words =
    pickWords(ctx.pool, empties.length, ctx.rng, { weight: ctx.weight, exclude: onBoard, excludeReadings: readingsOnBoard(base) }) ??
    pickWords(ctx.pool, empties.length, ctx.rng, { weight: ctx.weight, exclude: onBoard })
  if (!words) return base
  const dealt = deal(words, empties, 'classic', rows, cols, ctx.rng, s.nextTileId)!
  for (const [c, t] of dealt.placement) cells[c] = t
  return { ...base, planned: [...s.planned, ...words], nextTileId: dealt.nextId }
}

/** If the remaining tiles can no longer be fully cleared, swap them for fresh words. */
function ensureClearable(s: GameState, ctx: GameContext, now: number): GameState {
  const index = ctx.indexes[s.config.matchBy]
  const layout = layoutOf(s)
  const { rows, cols } = s.config
  const occupied = s.cells.flatMap((t, i) => (t ? [i] : []))
  const ok =
    layout === 'classic'
      ? classicClearable(
          occupied.map((c) => tileUnit(s.cells[c]!, s.config.matchBy)),
          index,
        )
      : pathClearable(s.cells, rows, cols, index)
  if (ok) return s
  const intact = intactWords(s)
  const intactKeys = new Set(intact.map((w) => w.key))
  const orphans = occupied.filter((c) => !intactKeys.has(s.cells[c]!.wordKey))
  const exclude = new Set([...s.found.map((f) => f.word.key), ...intactKeys])
  const excludeReadings = new Set(intact.map((w) => w.syllables.join(' ')))
  // Prefer re-dealing only the orphaned tiles of broken words; fall back to the whole board.
  const plans = orphans.length >= 2 && orphans.length < occupied.length ? [orphans, orphans, orphans, occupied, occupied, occupied] : Array(6).fill(occupied)
  for (const cellsToDeal of plans) {
    const partial = cellsToDeal !== occupied
    const words = pickWords(ctx.pool, cellsToDeal.length, ctx.rng, {
      weight: ctx.weight,
      exclude: partial ? exclude : new Set(s.found.map((f) => f.word.key)),
      excludeReadings: partial ? excludeReadings : undefined,
    })
    if (!words) continue
    const dealt = deal(words, cellsToDeal, layout, rows, cols, ctx.rng, s.nextTileId)
    if (!dealt) continue
    const cells = s.cells.slice()
    for (const [c, t] of dealt.placement) cells[c] = t
    return {
      ...s,
      cells,
      planned: [...s.planned, ...words],
      nextTileId: dealt.nextId,
      events: [...s.events, { kind: 'reshuffle' }],
    }
  }
  return win({ ...s, cells: s.cells.map(() => null) }, now)
}

function hint(s: GameState, ctx: GameContext, kind: 'clue' | 'reveal'): GameState {
  const intact = intactWords(s)
  if (kind === 'clue') {
    if (s.config.mode === 'clue') return s
    const options = intact.filter((w) => w.key !== s.clue?.key)
    if (!options.length) return s
    const word = pick(options, ctx.rng)
    return {
      ...s,
      clue: word,
      score: Math.max(0, s.score - HINT_COST.clue),
      hintsUsed: s.hintsUsed + 1,
      outcomes: { ...s.outcomes, [word.key]: worse(s.outcomes[word.key], 'hard') },
      events: [{ kind: 'clue', word }],
      eventSeq: s.eventSeq + 1,
    }
  }
  const options = intact.filter((w) => w.key !== s.revealKey)
  if (!options.length) return s
  const word = options.find((w) => w.key === s.clue?.key) ?? pick(options, ctx.rng)
  return {
    ...s,
    revealKey: word.key,
    selection: [],
    ready: false,
    score: Math.max(0, s.score - HINT_COST.reveal),
    hintsUsed: s.hintsUsed + 1,
    outcomes: { ...s.outcomes, [word.key]: 'fail' },
    events: [{ kind: 'reveal', word }],
    eventSeq: s.eventSeq + 1,
  }
}

export function gameReducer(s: GameState, a: GameAction, ctx: GameContext): GameState {
  if (s.status !== 'playing' && a.type !== 'matchBy') return s
  const quiet = { ...s, events: [] as GameEvent[] }
  switch (a.type) {
    case 'tap': {
      if (!s.cells[a.cell]) return s
      const idx = s.selection.indexOf(a.cell)
      if (idx >= 0) return { ...quiet, selection: s.selection.slice(0, idx), ready: false }
      const last = s.selection[s.selection.length - 1]
      const restart = layoutOf(s) === 'path' && last !== undefined && !isAdjacent(last, a.cell, s.config.cols)
      return evaluate({ ...quiet, selection: restart ? [a.cell] : [...s.selection, a.cell] }, ctx, a.now, false)
    }
    case 'path':
      return { ...quiet, selection: a.cells.filter((c) => s.cells[c]), ready: false }
    case 'release':
      return s.selection.length >= 2 ? evaluate(quiet, ctx, a.now, true) : s
    case 'submit':
      return s.ready ? evaluate(quiet, ctx, a.now, true) : s
    case 'clear':
      return { ...quiet, selection: [], ready: false }
    case 'hint':
      return hint(quiet, ctx, a.kind)
    case 'shuffle': {
      if (layoutOf(s) !== 'classic') return s
      const occupied = s.cells.flatMap((t, i) => (t ? [i] : []))
      const tiles = shuffle(
        occupied.map((c) => s.cells[c]!),
        ctx.rng,
      )
      const cells = s.cells.slice()
      occupied.forEach((c, i) => (cells[c] = tiles[i]))
      return { ...quiet, cells, selection: [], ready: false }
    }
    case 'tick':
      if (s.endsAt === null || a.now < s.endsAt) return s
      return { ...quiet, status: 'timeup', endedAt: a.now, selection: [], events: [{ kind: 'timeup' }], eventSeq: s.eventSeq + 1 }
    case 'end': {
      const outcomes = { ...s.outcomes }
      if (s.config.mode !== 'blitz') for (const w of intactWords(s)) outcomes[w.key] = 'fail'
      return { ...quiet, status: 'ended', endedAt: a.now, selection: [], outcomes }
    }
    case 'matchBy':
      return { ...quiet, config: { ...s.config, matchBy: a.matchBy }, selection: [], ready: false }
  }
}
