import Dexie, { type EntityTable } from 'dexie'
import type { Progress } from '../engine/srs.ts'
import type { Mode } from '../engine/types.ts'

export interface DeckRow {
  id: string
  name: string
  createdAt: number
}

export interface WordRow {
  id?: number
  deckId: string
  key: string
  hanzi: string
  syllables: string[]
  meaning: string
}

export interface RoundRow {
  id?: number
  mode: Mode
  size: string
  score: number
  words: number
  mistakes: number
  hints: number
  bestStreak: number
  durationMs: number
  endedAt: number
  deckIds: string[]
  daily?: string
}

export const db = new Dexie('pinci') as Dexie & {
  decks: EntityTable<DeckRow, 'id'>
  words: EntityTable<WordRow, 'id'>
  progress: EntityTable<Progress, 'key'>
  rounds: EntityTable<RoundRow, 'id'>
}

db.version(1).stores({
  decks: 'id, createdAt',
  words: '++id, deckId, key, [deckId+key]',
  progress: 'key, due, box',
  rounds: '++id, mode, endedAt, daily',
})
