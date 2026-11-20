import type { Bonus } from './types.ts'

export const LENGTH_MULTIPLIER: Record<number, number> = { 2: 1, 3: 1.5, 4: 2 }
export const UNPLANNED_BONUS = 5
export const CLEAR_BONUS = 25
export const HINT_COST = { clue: 2, reveal: 5 } as const
export const MAX_COMBO_STEPS = 8

export interface ScoreBreakdown {
  tileSum: number
  wordMultiplier: number
  lengthMultiplier: number
  comboMultiplier: number
  bonus: number
  total: number
}

export function comboMultiplier(streak: number): number {
  return 1 + Math.min(streak, MAX_COMBO_STEPS) * 0.25
}

/**
 * Scrabble-style scoring.
 * @param streak number of consecutive correct words *before* this one
 */
export function scoreWord(values: readonly number[], bonuses: readonly (Bonus | null)[], streak: number, unplanned = false): ScoreBreakdown {
  let tileSum = 0
  let wordMultiplier = 1
  values.forEach((v, i) => {
    const b = bonuses[i]
    tileSum += v * (b === 'DL' ? 2 : b === 'TL' ? 3 : 1)
    if (b === 'DW') wordMultiplier *= 2
    if (b === 'TW') wordMultiplier *= 3
  })
  const lengthMultiplier = LENGTH_MULTIPLIER[values.length] ?? 1
  const combo = comboMultiplier(streak)
  const bonus = unplanned ? UNPLANNED_BONUS : 0
  const total = Math.round(tileSum * wordMultiplier * lengthMultiplier * combo) + bonus
  return { tileSum, wordMultiplier, lengthMultiplier, comboMultiplier: combo, bonus, total }
}
