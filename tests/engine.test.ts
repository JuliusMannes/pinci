import { describe, expect, it } from 'vitest'
import { isAdjacent, pickWords, placeBonuses, placePaths, tilesFor } from '../src/engine/board.ts'
import { mulberry32 } from '../src/engine/rng.ts'
import { buildIndex } from '../src/engine/match.ts'
import { classicClearable, pathClearable } from '../src/engine/solver.ts'
import { comboMultiplier, scoreWord } from '../src/engine/scoring.ts'
import { applyOutcome, reviewWeight } from '../src/engine/srs.ts'
import { cellsOfWord, createGame, gameReducer, intactWords as intactWordsOf, type GameState } from '../src/engine/game.ts'
import type { Tile } from '../src/engine/types.ts'
import { POOL, ctxFor, w } from './helpers.ts'

describe('pickWords', () => {
  it('fills the exact tile count with distinct readings', () => {
    for (let seed = 1; seed < 40; seed++) {
      const words = pickWords(POOL, 20, mulberry32(seed))!
      expect(words.reduce((n, x) => n + x.syllables.length, 0)).toBe(20)
      const readings = words.map((x) => x.syllables.join(' '))
      expect(new Set(readings).size).toBe(readings.length)
    }
  })

  it('returns null if the pool is too small', () => {
    expect(pickWords(POOL.slice(0, 3), 16, mulberry32(1))).toBeNull()
  })

  it('handles odd totals using 3-syllable words', () => {
    const words = pickWords(POOL, 7, mulberry32(3))!
    expect(words.reduce((n, x) => n + x.syllables.length, 0)).toBe(7)
  })
})

describe('placePaths', () => {
  it('places every word as an adjacent chain', () => {
    for (let seed = 1; seed < 20; seed++) {
      const rng = mulberry32(seed)
      const words = pickWords(POOL, 30, rng)!
      let id = 0
      const tiles = tilesFor(words, () => id++)
      const cells = Array.from({ length: 30 }, (_, i) => i)
      const placed = placePaths(words, tiles, cells, 6, 5, rng)!
      expect(placed.size).toBe(30)
      for (const word of words) {
        const path = [...placed].filter(([, t]) => t.wordKey === word.key).sort(([, a], [, b]) => a.pos - b.pos).map(([c]) => c)
        for (let i = 1; i < path.length; i++) expect(isAdjacent(path[i - 1], path[i], 5)).toBe(true)
      }
    }
  })
})

describe('bonuses', () => {
  it('places the right number of bonus squares', () => {
    expect(placeBonuses(20, mulberry32(1)).filter(Boolean)).toHaveLength(5)
    expect(placeBonuses(30, mulberry32(1)).filter(Boolean)).toHaveLength(7)
  })
})

describe('solver', () => {
  const index = buildIndex(POOL, 'pinyin')
  it('classic: detects clearable and stuck multisets', () => {
    expect(classicClearable(['lǎo', 'shī', 'diàn', 'nǎo'], index)).toBe(true)
    expect(classicClearable(['lǎo', 'nǎo', 'diàn', 'shī'], index)).toBe(true)
    expect(classicClearable(['lǎo', 'nǎo'], index)).toBe(false)
    expect(classicClearable(['tú', 'shū', 'guǎn'], index)).toBe(true)
  })
  it('path: respects adjacency', () => {
    const t = (syllable: string): Tile => ({ id: 0, syllable, hanzi: '', value: 1, wordKey: '', pos: 0 })
    // 2x2 grid: everything adjacent
    expect(pathClearable([t('lǎo'), t('shī'), t('diàn'), t('nǎo')], 2, 2, index)).toBe(true)
    // 1x4 row: lǎo nǎo diàn shī -> lǎo-? not adjacent to shī
    expect(pathClearable([t('lǎo'), t('diàn'), t('nǎo'), t('shī')], 1, 4, index)).toBe(false)
    expect(pathClearable([t('lǎo'), t('shī'), t('diàn'), t('nǎo')], 1, 4, index)).toBe(true)
  })
})

describe('scoring', () => {
  it('applies tile and word multipliers, length and combo', () => {
    expect(scoreWord([1, 2], [null, null], 0).total).toBe(3)
    expect(scoreWord([1, 2], ['DL', null], 0).total).toBe(4)
    expect(scoreWord([1, 2], ['TL', 'DW'], 0).total).toBe(10)
    expect(scoreWord([2, 2, 2], [null, null, null], 0).total).toBe(9)
    expect(scoreWord([1, 1], [null, null], 4).total).toBe(4)
    expect(scoreWord([1, 1], [null, null], 0, true).total).toBe(7)
    expect(comboMultiplier(100)).toBe(3)
  })
})

describe('srs', () => {
  it('moves words through Leitner boxes', () => {
    const now = 1_000_000
    let p = applyOutcome(undefined, 'k', 'ok', now)
    expect(p.box).toBe(1)
    p = applyOutcome(p, 'k', 'ok', now)
    expect(p.box).toBe(2)
    p = applyOutcome(p, 'k', 'fail', now)
    expect(p.box).toBe(0)
    expect(p.due).toBe(now)
    expect(reviewWeight(p, now)).toBeGreaterThan(reviewWeight(undefined, now))
  })
})

function solve(state: GameState, ctx: ReturnType<typeof ctxFor>, key: string): GameState {
  for (const c of cellsOfWord(state, key)) state = gameReducer(state, { type: 'tap', cell: c, now: 1 }, ctx)
  if (state.ready) state = gameReducer(state, { type: 'submit', now: 1 }, ctx)
  return state
}

describe('game', () => {
  it('clears a zen board word by word and wins', () => {
    const ctx = ctxFor(POOL, 7)
    let s = createGame({ mode: 'zen', rows: 4, cols: 4, matchBy: 'pinyin' }, ctx, 0)!
    expect(s.cells.every(Boolean)).toBe(true)
    for (const word of s.planned) s = solve(s, ctx, word.key)
    expect(s.status).toBe('won')
    expect(s.found).toHaveLength(s.planned.length)
    expect(s.mistakes).toBe(0)
    expect(s.score).toBeGreaterThan(0)
  })

  it('registers a miss and resets the streak', () => {
    const ctx = ctxFor(POOL, 3)
    let s = createGame({ mode: 'zen', rows: 4, cols: 4, matchBy: 'pinyin' }, ctx, 0)!
    s = solve(s, ctx, s.planned[0].key)
    expect(s.streak).toBe(1)
    // tap the second syllable of a 2-syllable word twice-reversed: last then first
    const target = s.planned.find((x) => x.syllables.length === 2 && cellsOfWord(s, x.key).length === 2)!
    const [a, b] = cellsOfWord(s, target.key)
    const reversed = [target.syllables[1], target.syllables[0]].join(' ')
    if (!ctx.indexes.pinyin.byKey.has(reversed) && !ctx.indexes.pinyin.byPrefix.has(reversed)) {
      s = gameReducer(s, { type: 'tap', cell: b, now: 1 }, ctx)
      s = gameReducer(s, { type: 'tap', cell: a, now: 1 }, ctx)
      expect(s.mistakes).toBe(1)
      expect(s.streak).toBe(0)
      expect(s.events[0].kind).toBe('miss')
    }
  })

  it('waits when a word can be extended (图书 vs 图书馆)', () => {
    const pool = [w('图书馆', 'tú shū guǎn'), w('图书', 'tú shū'), w('老师', 'lǎo shī'), w('电脑', 'diàn nǎo'), w('朋友', 'péng you')]
    const ctx = ctxFor(pool, 1)
    let s: GameState | null = null
    for (let seed = 1; seed < 50 && !s?.planned.some((x) => x.hanzi === '图书馆'); seed++) {
      ctx.rng = mulberry32(seed)
      s = createGame({ mode: 'zen', rows: 1, cols: 7, matchBy: 'pinyin' }, ctx, 0)
    }
    expect(s!.planned.some((x) => x.hanzi === '图书馆')).toBe(true)
    const [a, b, c] = cellsOfWord(s!, w('图书馆', 'tú shū guǎn').key)
    let st = gameReducer(s!, { type: 'tap', cell: a, now: 1 }, ctx)
    st = gameReducer(st, { type: 'tap', cell: b, now: 1 }, ctx)
    expect(st.ready).toBe(true)
    st = gameReducer(st, { type: 'tap', cell: c, now: 1 }, ctx)
    expect(st.found.at(-1)!.word.hanzi).toBe('图书馆')
  })

  it('treats identical tiles as interchangeable', () => {
    const pool = [w('老师', 'lǎo shī'), w('老板', 'lǎo bǎn')]
    const ctx = ctxFor(pool, 2)
    let s = createGame({ mode: 'zen', rows: 2, cols: 2, matchBy: 'pinyin' }, ctx, 0)!
    const shiKey = pool[0].key
    const banKey = pool[1].key
    const laoOfBan = cellsOfWord(s, banKey)[0]
    const shi = cellsOfWord(s, shiKey)[1]
    s = gameReducer(s, { type: 'tap', cell: laoOfBan, now: 1 }, ctx)
    s = gameReducer(s, { type: 'tap', cell: shi, now: 1 }, ctx)
    expect(s.found[0].unplanned).toBe(false)
    expect(cellsOfWord(s, banKey)).toHaveLength(2)
    s = solve(s, ctx, banKey)
    expect(s.status).toBe('won')
  })

  it('re-deals orphaned tiles when a bonus word breaks the board', () => {
    const pool = [w('老师', 'lǎo shī'), w('电脑', 'diàn nǎo'), w('诗电', 'shī diàn'), w('朋友', 'péng you')]
    const ctx = ctxFor(pool, 1)
    let s: GameState | null = null
    for (let seed = 1; seed < 200; seed++) {
      ctx.rng = mulberry32(seed)
      s = createGame({ mode: 'zen', rows: 2, cols: 3, matchBy: 'pinyin' }, ctx, 0)
      const keys = s!.planned.map((x) => x.hanzi).sort().join()
      if (keys === ['老师', '电脑', '朋友'].sort().join()) break
    }
    const shi = cellsOfWord(s!, pool[0].key)[1]
    const dian = cellsOfWord(s!, pool[1].key)[0]
    let st = gameReducer(s!, { type: 'tap', cell: shi, now: 1 }, ctx)
    st = gameReducer(st, { type: 'tap', cell: dian, now: 1 }, ctx)
    expect(st.found[0]).toMatchObject({ unplanned: true })
    expect(st.events.some((e) => e.kind === 'reshuffle')).toBe(true)
    // 朋友 was intact and must not have moved
    expect(cellsOfWord(st, pool[3].key)).toEqual(cellsOfWord(s!, pool[3].key))
    for (const word of intactWordsOf(st)) st = solve(st, ctx, word.key)
    expect(st.status).toBe('won')
  })

  it('blitz refills the board and extends time', () => {
    const ctx = ctxFor(POOL, 5)
    let s = createGame({ mode: 'blitz', rows: 4, cols: 4, matchBy: 'pinyin' }, ctx, 0)!
    const endsAt = s.endsAt!
    s = solve(s, ctx, s.planned[0].key)
    expect(s.cells.every(Boolean)).toBe(true)
    expect(s.endsAt).toBeGreaterThan(endsAt)
    s = gameReducer(s, { type: 'tick', now: s.endsAt! + 1 }, ctx)
    expect(s.status).toBe('timeup')
  })

  it('path mode requires adjacency and wins', () => {
    const ctx = ctxFor(POOL, 9)
    let s = createGame({ mode: 'path', rows: 5, cols: 4, matchBy: 'pinyin' }, ctx, 0)!
    for (const word of s.planned) s = solve(s, ctx, word.key)
    expect(s.status).toBe('won')
  })

  it('hints cost points and mark outcomes', () => {
    const ctx = ctxFor(POOL, 11)
    let s = createGame({ mode: 'zen', rows: 4, cols: 4, matchBy: 'pinyin' }, ctx, 0)!
    s = solve(s, ctx, s.planned[0].key)
    const before = s.score
    s = gameReducer(s, { type: 'hint', kind: 'reveal' }, ctx)
    expect(s.score).toBe(Math.max(0, before - 5))
    expect(s.outcomes[s.revealKey!]).toBe('fail')
    s = gameReducer(s, { type: 'end', now: 2 }, ctx)
    expect(s.status).toBe('ended')
    expect(Object.values(s.outcomes).filter((o) => o === 'fail').length).toBeGreaterThan(1)
  })
})
