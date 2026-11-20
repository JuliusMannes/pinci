export interface DictEntry {
  syllables: string[]
  meaning: string
}

export interface Dict {
  lookup(hanzi: string): DictEntry[] | undefined
  /** Most common reading of a single character. */
  charReading(ch: string): string | undefined
  /** Segmentation cost of a dictionary word (lower = more common); Infinity if unknown. */
  cost(hanzi: string): number
  /** Word appears in the HSK frequency list. */
  isCommon(hanzi: string): boolean
  maxLen: number
}

export type CharTable = Record<string, [points: number, reading: string]>

const RARE_WORD_COST = 14
const RARE_CHAR_COST = 12

/**
 * Builds a dictionary from the tab-separated `cedict.txt` produced by scripts/build-data.ts:
 * `hanzi \t syllables \t meaning [\t frequency rank]`
 */
export function buildDict(text: string, chars: CharTable = {}): Dict {
  const map = new Map<string, DictEntry[]>()
  const costs = new Map<string, number>()
  let maxLen = 1
  for (const line of text.split('\n')) {
    if (!line) continue
    const [hanzi, py, meaning = '', rank] = line.split('\t')
    const entry = { syllables: py.split(' '), meaning }
    const list = map.get(hanzi)
    if (list) list.push(entry)
    else map.set(hanzi, [entry])
    if (rank) costs.set(hanzi, Math.log(Number(rank) + 10))
    const len = [...hanzi].length
    if (len > maxLen) maxLen = len
  }
  return {
    lookup: (h) => map.get(h),
    charReading: (ch) => chars[ch]?.[1] ?? map.get(ch)?.[0]?.syllables[0],
    cost: (h) => costs.get(h) ?? (map.has(h) ? ([...h].length > 1 ? RARE_WORD_COST : RARE_CHAR_COST) : Infinity),
    isCommon: (h) => costs.has(h),
    maxLen,
  }
}
