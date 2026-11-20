export interface Progress {
  key: string
  box: number
  due: number
  seen: number
  correct: number
  wrong: number
  lastSeen: number
}

export type Outcome = 'ok' | 'hard' | 'fail'

const DAY = 24 * 60 * 60 * 1000
export const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16, 32]
export const MAX_BOX = INTERVAL_DAYS.length - 1
export const MASTERED_BOX = 4

const SEVERITY: Record<Outcome, number> = { ok: 0, hard: 1, fail: 2 }
export const worse = (a: Outcome | undefined, b: Outcome): Outcome => (a && SEVERITY[a] >= SEVERITY[b] ? a : b)

export function applyOutcome(prev: Progress | undefined, key: string, outcome: Outcome, now: number): Progress {
  const p: Progress = prev ? { ...prev } : { key, box: 0, due: now, seen: 0, correct: 0, wrong: 0, lastSeen: now }
  p.seen++
  p.lastSeen = now
  if (outcome === 'ok') {
    p.correct++
    p.box = Math.min(MAX_BOX, p.box + 1)
    p.due = now + INTERVAL_DAYS[p.box] * DAY
  } else if (outcome === 'hard') {
    p.box = Math.max(1, p.box)
    p.due = now + DAY
  } else {
    p.wrong++
    p.box = 0
    p.due = now
  }
  return p
}

/** Sampling weight for building boards: due and weak words come up more often. */
export function reviewWeight(p: Progress | undefined, now: number): number {
  if (!p) return 3
  if (p.due <= now) return 4 + (MAX_BOX - p.box)
  return 0.5 / (1 + p.box)
}

export const isMastered = (p: Progress | undefined) => !!p && p.box >= MASTERED_BOX
