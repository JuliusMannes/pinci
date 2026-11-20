import { create } from 'zustand'
import type { GameState } from '../engine/game.ts'
import type { GridSizeId, Mode } from '../engine/types.ts'

export interface PlaySetup {
  mode: Mode
  size: GridSizeId
  deckIds: string[]
  /** YYYY-MM-DD for the daily puzzle */
  daily?: string
}

export type Route =
  | { name: 'home' }
  | { name: 'game'; setup: PlaySetup; nonce: number }
  | { name: 'summary'; setup: PlaySetup; result: GameState; best: number | null }
  | { name: 'decks' }
  | { name: 'deck'; id: string }
  | { name: 'import' }
  | { name: 'stats' }
  | { name: 'settings' }

interface Nav {
  route: Route
  go: (r: Route) => void
}

export const useNav = create<Nav>((set) => ({
  route: { name: 'home' },
  go: (route) => {
    set({ route })
    window.scrollTo({ top: 0 })
  },
}))

export const play = (setup: PlaySetup) => useNav.getState().go({ name: 'game', setup, nonce: Date.now() })
