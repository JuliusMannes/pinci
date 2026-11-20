import index from './hsk-index.json'
import type { Word } from '../engine/types.ts'
import { wordKey } from '../engine/types.ts'
import type { CharTable } from './import/dict.ts'

export interface DeckMeta {
  id: string
  name: string
  group: string
  count: number
  builtin: boolean
}

export const HSK_GROUPS = [
  { id: 'hsk3', name: 'HSK 3.0', note: '2021 standard · levels 1–6 and 7–9' },
  { id: 'hsk2026', name: 'HSK 3.0 · 2026', note: 'Revised 2026 syllabus' },
  { id: 'hsk2', name: 'HSK 2.0', note: 'Classic 6 levels' },
] as const

export const HSK_DECKS: DeckMeta[] = index.map((d) => ({
  id: d.id,
  group: d.version,
  name: `${HSK_GROUPS.find((g) => g.id === d.version)!.name} · ${d.level === 7 && d.version !== 'hsk2' ? 'Level 7–9' : `Level ${d.level}`}`,
  count: d.count,
  builtin: true,
}))

export const isBuiltin = (id: string) => HSK_DECKS.some((d) => d.id === id)
export const hskDeck = (id: string) => HSK_DECKS.find((d) => d.id === id)

const dataUrl = (path: string) => `${import.meta.env.BASE_URL}data/${path}`

let charsPromise: Promise<CharTable> | null = null
export function loadChars(): Promise<CharTable> {
  charsPromise ??= fetch(dataUrl('chars.json')).then((r) => r.json())
  return charsPromise
}

const UNKNOWN_POINTS = 8

export function makeWord(hanzi: string, syllables: string[], meaning: string, chars: CharTable): Word {
  return {
    key: wordKey(hanzi, syllables),
    hanzi,
    syllables,
    meaning,
    values: [...hanzi].map((c) => chars[c]?.[0] ?? UNKNOWN_POINTS),
  }
}

const hskCache = new Map<string, Promise<Word[]>>()
export function loadHskDeck(id: string): Promise<Word[]> {
  let p = hskCache.get(id)
  if (!p) {
    p = Promise.all([fetch(dataUrl(`hsk/${id}.json`)).then((r) => r.json() as Promise<[string, string, string][]>), loadChars()]).then(
      ([rows, chars]) => rows.map(([h, py, m]) => makeWord(h, py.split(' '), m, chars)),
    )
    hskCache.set(id, p)
  }
  return p
}
