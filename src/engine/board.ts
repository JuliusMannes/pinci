import type { Bonus, Tile, Word } from './types.ts'
import { shuffle, weightedIndex, type Rng } from './rng.ts'

export const MIN_WORD = 2
export const MAX_WORD = 4

export interface PickOptions {
  weight?: (w: Word) => number
  /** Word keys that must not be picked. */
  exclude?: ReadonlySet<string>
  /** Syllable sequences that must not be picked (avoids two words that read identically). */
  excludeReadings?: ReadonlySet<string>
}

export function isPlayable(w: Word): boolean {
  return w.syllables.length >= MIN_WORD && w.syllables.length <= MAX_WORD && w.syllables.length === [...w.hanzi].length
}

const LENGTH_FACTOR = [0, 0, 1, 0.55, 0.35]

/** Can `r` syllables be filled using at most counts[len] words of each length (2..4)? */
function canFill(r: number, counts: readonly number[]): boolean {
  for (let b = 0; b <= Math.min(counts[3], Math.floor(r / 3)); b++)
    for (let c = 0; c <= Math.min(counts[4], Math.floor((r - 3 * b) / 4)); c++) {
      const rest = r - 3 * b - 4 * c
      if (rest % 2 === 0 && rest / 2 <= counts[2]) return true
    }
  return false
}

/** Picks distinct words whose syllable counts sum exactly to `total`. */
export function pickWords(pool: readonly Word[], total: number, rng: Rng, opts: PickOptions = {}): Word[] | null {
  const readings = new Set(opts.excludeReadings)
  const usedHanzi = new Set<string>()
  const candidates = pool.filter((w) => isPlayable(w) && !opts.exclude?.has(w.key) && !readings.has(w.syllables.join(' ')))
  const available = (w: Word) => !readings.has(w.syllables.join(' ')) && !usedHanzi.has(w.hanzi)

  const chosen: Word[] = []
  const weights = candidates.map((w) => (opts.weight ? opts.weight(w) : 1) * LENGTH_FACTOR[w.syllables.length])
  let remaining = total
  while (remaining > 0) {
    const counts = [0, 0, 0, 0, 0]
    for (const w of candidates) if (available(w)) counts[w.syllables.length]++
    const okLength = [false, false]
    for (let len = MIN_WORD; len <= MAX_WORD; len++) {
      const c = counts.slice()
      c[len]--
      okLength[len] = len <= remaining && c[len] >= 0 && canFill(remaining - len, c)
    }
    const live = candidates.map((w, i) => {
      if (!okLength[w.syllables.length] || !available(w)) return 0
      return weights[i] > 0 ? weights[i] : 1e-6
    })
    const idx = weightedIndex(live, rng)
    if (idx < 0) return null
    const w = candidates[idx]
    chosen.push(w)
    readings.add(w.syllables.join(' '))
    usedHanzi.add(w.hanzi)
    remaining -= w.syllables.length
  }
  return chosen
}

export function tilesFor(words: readonly Word[], nextId: () => number): Tile[] {
  return words.flatMap((w) =>
    w.syllables.map((syllable, pos) => ({
      id: nextId(),
      syllable,
      hanzi: [...w.hanzi][pos],
      value: w.values[pos] ?? 1,
      wordKey: w.key,
      pos,
    })),
  )
}

/** Classic layout: tiles are shuffled into the given cells. */
export function placeClassic(tiles: readonly Tile[], cells: readonly number[], rng: Rng): Map<number, Tile> {
  const shuffled = shuffle(tiles, rng)
  return new Map(cells.map((c, i) => [c, shuffled[i]]))
}

export function neighbors(cell: number, rows: number, cols: number): number[] {
  const r = Math.floor(cell / cols)
  const c = cell % cols
  const out: number[] = []
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) out.push(nr * cols + nc)
    }
  return out
}

export function isAdjacent(a: number, b: number, cols: number): boolean {
  return a !== b && Math.abs(Math.floor(a / cols) - Math.floor(b / cols)) <= 1 && Math.abs((a % cols) - (b % cols)) <= 1
}

/**
 * Path layout: each word occupies a chain of 8-connected cells (Boggle-style).
 * Uses randomized Warnsdorff-style search with restarts. Returns null if no tiling was found.
 */
export function placePaths(
  words: readonly Word[],
  tiles: readonly Tile[],
  cells: readonly number[],
  rows: number,
  cols: number,
  rng: Rng,
  attempts = 300,
): Map<number, Tile> | null {
  if (tiles.length !== cells.length) return null
  const byWord = new Map<string, Tile[]>()
  for (const t of tiles) byWord.set(t.wordKey, [...(byWord.get(t.wordKey) ?? []), t])
  for (const list of byWord.values()) list.sort((a, b) => a.pos - b.pos)

  for (let attempt = 0; attempt < attempts; attempt++) {
    const free = new Set(cells)
    const result = new Map<number, Tile>()
    const freeDegree = (c: number) => neighbors(c, rows, cols).filter((n) => free.has(n)).length
    const order = shuffle(words, rng).sort((a, b) => b.syllables.length - a.syllables.length)
    let ok = true
    for (const w of order) {
      const len = w.syllables.length
      const starts = shuffle([...free], rng).sort((a, b) => freeDegree(a) - freeDegree(b))
      let path: number[] | null = null
      const dfs = (p: number[]): boolean => {
        if (p.length === len) {
          path = p
          return true
        }
        const last = p[p.length - 1]
        const next = shuffle(
          neighbors(last, rows, cols).filter((n) => free.has(n) && !p.includes(n)),
          rng,
        ).sort((a, b) => freeDegree(a) - freeDegree(b))
        return next.some((n) => dfs([...p, n]))
      }
      for (const s of starts.slice(0, 4)) if (dfs([s])) break
      if (!path) {
        ok = false
        break
      }
      const wordTiles = byWord.get(w.key)!
      ;(path as number[]).forEach((c, i) => {
        free.delete(c)
        result.set(c, wordTiles[i])
      })
      if ([...free].some((c) => freeDegree(c) === 0)) {
        ok = false
        break
      }
    }
    if (ok && free.size === 0) return result
  }
  return null
}

const BONUS_SETS: Record<number, Bonus[]> = {
  16: ['DL', 'DL', 'TL', 'DW'],
  20: ['DL', 'DL', 'DL', 'TL', 'DW'],
  30: ['DL', 'DL', 'DL', 'TL', 'TL', 'DW', 'TW'],
}

export function placeBonuses(size: number, rng: Rng): (Bonus | null)[] {
  const set = BONUS_SETS[size] ?? BONUS_SETS[20].slice(0, Math.max(1, Math.round(size / 5)))
  const cells = shuffle(
    Array.from({ length: size }, (_, i) => i),
    rng,
  ).slice(0, set.length)
  const out: (Bonus | null)[] = Array(size).fill(null)
  cells.forEach((c, i) => (out[c] = set[i]))
  return out
}
