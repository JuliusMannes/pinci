import type { Tile, Word } from './types.ts'
import { countUnits, fitsIn, joinUnits, tileUnit, unitsOf, type PoolIndex } from './match.ts'
import { MAX_WORD, neighbors } from './board.ts'

/** Can a multiset of tile units be fully partitioned into words from the pool (order-free selection)? */
export function classicClearable(units: readonly string[], index: PoolIndex): boolean {
  const counts = countUnits(units)
  const seen = new Set<string>()
  const candByUnit = new Map<string, string[][]>()
  for (const u of counts.keys()) {
    for (const w of index.byUnit.get(u) ?? []) {
      const wu = unitsOf(w, index.matchBy)
      const k = joinUnits(wu)
      if (seen.has(k) || !fitsIn(wu, counts)) continue
      seen.add(k)
      for (const x of new Set(wu)) candByUnit.set(x, [...(candByUnit.get(x) ?? []), wu])
    }
  }
  const memo = new Map<string, boolean>()
  const rec = (): boolean => {
    const live = [...counts].filter(([, c]) => c > 0).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    if (!live.length) return true
    const key = live.map(([u, c]) => `${u}${c}`).join(',')
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const first = live[0][0]
    let ok = false
    for (const wu of candByUnit.get(first) ?? []) {
      if (!fitsIn(wu, counts)) continue
      for (const u of wu) counts.set(u, counts.get(u)! - 1)
      ok = rec()
      for (const u of wu) counts.set(u, counts.get(u)! + 1)
      if (ok) break
    }
    memo.set(key, ok)
    return ok
  }
  return rec()
}

/** Can the remaining tiles be cleared using only adjacent-cell paths spelling pool words? */
export function pathClearable(cells: readonly (Tile | null)[], rows: number, cols: number, index: PoolIndex): boolean {
  const maxLen = MAX_WORD
  const memo = new Map<string, boolean>()
  const remaining = new Set<number>()
  cells.forEach((t, i) => t && remaining.add(i))
  const unit = (c: number) => tileUnit(cells[c]!, index.matchBy)

  const extensions = (start: number, len: number, banned: Set<number>): number[][] => {
    if (len === 0) return [[]]
    const out: number[][] = []
    const walk = (p: number[]) => {
      if (p.length === len) return void out.push(p)
      const last = p.length ? p[p.length - 1] : start
      for (const n of neighbors(last, rows, cols))
        if (remaining.has(n) && !banned.has(n) && !p.includes(n)) walk([...p, n])
    }
    walk([])
    return out
  }

  const rec = (): boolean => {
    if (!remaining.size) return true
    const key = [...remaining].sort((a, b) => a - b).join(',')
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const c = Math.min(...remaining)
    let ok = false
    outer: for (let len = 2; len <= maxLen; len++) {
      for (let j = 0; j < len; j++) {
        for (const left of extensions(c, j, new Set([c]))) {
          for (const right of extensions(c, len - 1 - j, new Set([c, ...left]))) {
            const path = [...[...left].reverse(), c, ...right]
            if (!index.byKey.has(joinUnits(path.map(unit)))) continue
            for (const p of path) remaining.delete(p)
            ok = rec()
            for (const p of path) remaining.add(p)
            if (ok) break outer
          }
        }
      }
    }
    memo.set(key, ok)
    return ok
  }
  return rec()
}

export function wordsOnBoard(cells: readonly (Tile | null)[], planned: readonly Word[]): Word[] {
  const counts = new Map<string, number>()
  for (const t of cells) if (t) counts.set(t.wordKey, (counts.get(t.wordKey) ?? 0) + 1)
  return planned.filter((w) => counts.get(w.key) === w.syllables.length)
}
