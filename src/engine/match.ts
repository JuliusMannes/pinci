import type { MatchBy, Tile, Word } from './types.ts'
import { isPlayable } from './board.ts'

export interface PoolIndex {
  matchBy: MatchBy
  byKey: Map<string, Word[]>
  /** Proper prefixes (shorter than the word) -> words. */
  byPrefix: Map<string, Word[]>
  byUnit: Map<string, Word[]>
}

export function unitsOf(w: Word, by: MatchBy): string[] {
  return by === 'pinyin' ? w.syllables : [...w.hanzi]
}

export function tileUnit(t: Tile, by: MatchBy): string {
  return by === 'pinyin' ? t.syllable : t.hanzi
}

export const joinUnits = (units: readonly string[]) => units.join(' ')

function push<K, V>(map: Map<K, V[]>, k: K, v: V) {
  const list = map.get(k)
  if (list) list.push(v)
  else map.set(k, [v])
}

export function buildIndex(pool: readonly Word[], matchBy: MatchBy): PoolIndex {
  const index: PoolIndex = { matchBy, byKey: new Map(), byPrefix: new Map(), byUnit: new Map() }
  for (const w of pool) {
    if (!isPlayable(w)) continue
    const units = unitsOf(w, matchBy)
    push(index.byKey, joinUnits(units), w)
    for (let i = 1; i < units.length; i++) push(index.byPrefix, joinUnits(units.slice(0, i)), w)
    for (const u of new Set(units)) push(index.byUnit, u, w)
  }
  return index
}

/** Count of each unit in a list. */
export function countUnits(units: readonly string[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const u of units) m.set(u, (m.get(u) ?? 0) + 1)
  return m
}

export function fitsIn(units: readonly string[], counts: ReadonlyMap<string, number>): boolean {
  const need = countUnits(units)
  for (const [u, n] of need) if ((counts.get(u) ?? 0) < n) return false
  return true
}
