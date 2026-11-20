import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GridSizeId, MatchBy, Mode } from '../engine/types.ts'

export type Display = 'pinyin' | 'both' | 'hanzi'
export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  display: Display
  toneColors: boolean
  sound: boolean
  autoSpeak: boolean
  theme: Theme
  mode: Exclude<Mode, 'daily'>
  size: GridSizeId
  deckIds: string[]
  dailyDeckIds: string[]
  /** date (YYYY-MM-DD) -> score */
  daily: Record<string, number>
}

interface SettingsStore extends Settings {
  set: (patch: Partial<Settings>) => void
}

export const useSettings = create<SettingsStore>()(
  persist(
    (set) => ({
      display: 'pinyin',
      toneColors: true,
      sound: true,
      autoSpeak: true,
      theme: 'system',
      mode: 'zen',
      size: '4x5',
      deckIds: ['hsk3-1'],
      dailyDeckIds: ['hsk3-1', 'hsk3-2'],
      daily: {},
      set: (patch) => set(patch),
    }),
    { name: 'pinci-settings', version: 1 },
  ),
)

export const matchByFor = (d: Display): MatchBy => (d === 'pinyin' ? 'pinyin' : 'hanzi')

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function dailyStreak(daily: Record<string, number>, from = new Date()): number {
  let streak = 0
  const d = new Date(from)
  if (!(todayKey(d) in daily)) d.setDate(d.getDate() - 1)
  while (todayKey(d) in daily) {
    streak++
    d.setDate(d.getDate() - 1)
  }
  return streak
}
