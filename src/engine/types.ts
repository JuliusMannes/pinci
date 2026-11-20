export interface Word {
  /** Stable identity used for progress tracking: `${hanzi}|${syllables.join(' ')}` */
  key: string
  hanzi: string
  /** Lowercase, tone-marked syllables; exactly one per character. */
  syllables: string[]
  meaning: string
  /** Tile points per syllable. */
  values: number[]
}

export type Bonus = 'DL' | 'TL' | 'DW' | 'TW'

export interface Tile {
  id: number
  syllable: string
  hanzi: string
  value: number
  /** Key of the word this tile was dealt for. */
  wordKey: string
  /** Position of this tile within that word. */
  pos: number
}

export type Mode = 'zen' | 'path' | 'blitz' | 'daily' | 'clue'
export type Layout = 'classic' | 'path'
export type MatchBy = 'pinyin' | 'hanzi'

export interface GridSize {
  rows: number
  cols: number
}

export const GRID_SIZES: Record<string, GridSize> = {
  '4x4': { rows: 4, cols: 4 },
  '4x5': { rows: 5, cols: 4 },
  '5x6': { rows: 6, cols: 5 },
}
export type GridSizeId = keyof typeof GRID_SIZES

export function wordKey(hanzi: string, syllables: string[]): string {
  return `${hanzi}|${syllables.join(' ')}`
}

export function layoutFor(mode: Mode): Layout {
  return mode === 'path' ? 'path' : 'classic'
}
