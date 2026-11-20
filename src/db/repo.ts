import { db, type RoundRow } from './db.ts'
import type { Word } from '../engine/types.ts'
import { wordKey } from '../engine/types.ts'
import type { GameState } from '../engine/game.ts'
import { applyOutcome, type Progress } from '../engine/srs.ts'
import { isBuiltin, loadChars, loadHskDeck, makeWord } from '../data/hsk.ts'

export async function loadDeckWords(id: string): Promise<Word[]> {
  if (isBuiltin(id)) return loadHskDeck(id)
  const [rows, chars] = await Promise.all([db.words.where('deckId').equals(id).toArray(), loadChars()])
  return rows.map((r) => makeWord(r.hanzi, r.syllables, r.meaning, chars))
}

/** Union of several decks, deduplicated by word key. */
export async function loadPool(deckIds: string[]): Promise<Word[]> {
  const lists = await Promise.all(deckIds.map(loadDeckWords))
  const seen = new Map<string, Word>()
  for (const list of lists) for (const w of list) if (!seen.has(w.key)) seen.set(w.key, w)
  return [...seen.values()]
}

export async function progressFor(keys: string[]): Promise<Map<string, Progress>> {
  const rows = await db.progress.bulkGet(keys)
  return new Map(rows.filter((r): r is Progress => !!r).map((r) => [r.key, r]))
}

export interface NewWord {
  hanzi: string
  syllables: string[]
  meaning: string
}

export async function saveDeck(name: string, words: NewWord[], id = `deck-${Date.now().toString(36)}`): Promise<string> {
  await db.transaction('rw', db.decks, db.words, async () => {
    if (!(await db.decks.get(id))) await db.decks.add({ id, name, createdAt: Date.now() })
    const seen = new Set((await db.words.where('deckId').equals(id).toArray()).map((w) => w.key))
    const rows = []
    for (const w of words) {
      const key = wordKey(w.hanzi, w.syllables)
      if (seen.has(key)) continue
      seen.add(key)
      rows.push({ deckId: id, key, ...w })
    }
    await db.words.bulkAdd(rows)
  })
  return id
}

export const renameDeck = (id: string, name: string) => db.decks.update(id, { name })

export async function deleteDeck(id: string) {
  await db.transaction('rw', db.decks, db.words, async () => {
    await db.words.where('deckId').equals(id).delete()
    await db.decks.delete(id)
  })
}

export const deleteWord = (id: number) => db.words.delete(id)

/** Persists a finished round: SRS outcomes + round history. Returns the previous best score for this mode/size. */
export async function recordRound(state: GameState, deckIds: string[], size: string, daily?: string): Promise<number | null> {
  const now = Date.now()
  const keys = Object.keys(state.outcomes)
  const previousBest = await bestScore(state.config.mode, size)
  await db.transaction('rw', db.progress, db.rounds, async () => {
    const prev = await progressFor(keys)
    await db.progress.bulkPut(keys.map((k) => applyOutcome(prev.get(k), k, state.outcomes[k], now)))
    const round: RoundRow = {
      mode: state.config.mode,
      size,
      score: state.score,
      words: state.found.length,
      mistakes: state.mistakes,
      hints: state.hintsUsed,
      bestStreak: state.bestStreak,
      durationMs: (state.endedAt ?? now) - state.startedAt,
      endedAt: now,
      deckIds,
      daily,
    }
    await db.rounds.add(round)
  })
  return previousBest
}

export async function bestScore(mode: string, size: string): Promise<number | null> {
  let best: number | null = null
  await db.rounds
    .where('mode')
    .equals(mode)
    .each((r) => {
      if (r.size === size && (best === null || r.score > best)) best = r.score
    })
  return best
}

export async function resetProgress() {
  await Promise.all([db.progress.clear(), db.rounds.clear()])
}
