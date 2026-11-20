import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db.ts'
import { hskDeck } from '../../data/hsk.ts'
import { GRID_SIZES, type GridSizeId } from '../../engine/types.ts'
import { dailyStreak, todayKey, useSettings, type Settings } from '../../store/settings.ts'
import { play, useNav } from '../../store/nav.ts'
import { Seal } from '../components/Seal.tsx'
import { Icon } from '../components/Icon.tsx'
import { Button, Section, Segmented, cx } from '../components/ui.tsx'
import { MODE_INFO } from './Game.tsx'

const MODES: Settings['mode'][] = ['zen', 'path', 'blitz', 'clue']

export function useDeckNames(ids: string[]) {
  const custom = useLiveQuery(() => db.decks.bulkGet(ids.filter((id) => !hskDeck(id))), [ids.join(',')])
  return ids.map((id) => hskDeck(id)?.name ?? custom?.find((d) => d?.id === id)?.name ?? '…')
}

export function HomeScreen() {
  const s = useSettings()
  const go = useNav((x) => x.go)
  const today = todayKey()
  const doneToday = today in s.daily
  const streak = dailyStreak(s.daily)
  const due = useLiveQuery(() => db.progress.where('due').belowOrEqual(Date.now()).count(), [])
  const names = useDeckNames(s.deckIds)
  const dailyNames = useDeckNames(s.dailyDeckIds)

  return (
    <div className="safe-top mx-auto max-w-lg px-4 pb-28">
      <header className="flex items-center gap-4 pt-4 pb-6">
        <Seal text="拼词" size={64} animate={false} />
        <div>
          <h1 className="font-display text-3xl font-bold">Pīncí</h1>
          <p className="text-sm text-ink-soft dark:text-ink-faint">Piece syllables together into words</p>
        </div>
      </header>

      <button
        onClick={() => !doneToday && play({ mode: 'daily', size: '4x5', deckIds: s.dailyDeckIds, daily: today })}
        className="card mb-6 flex w-full items-center gap-4 p-4 text-left"
      >
        <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-cinnabar font-han text-2xl text-white">日</div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Daily puzzle</p>
          <p className="truncate text-xs text-ink-soft dark:text-ink-faint">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })} · {dailyNames.join(', ')}
          </p>
        </div>
        <div className="text-right">
          {doneToday ? (
            <p className="font-display text-xl font-bold text-jade">{s.daily[today]}</p>
          ) : (
            <Icon name="play" className="ml-auto size-6 text-cinnabar" />
          )}
          <p className="flex items-center justify-end gap-0.5 text-xs font-semibold text-cinnabar">
            <Icon name="flame" className="size-3.5" />
            {streak}
          </p>
        </div>
      </button>

      <Section title="Mode">
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button
              key={m}
              onClick={() => s.set({ mode: m })}
              className={cx('card relative overflow-hidden p-3 text-left transition', s.mode === m && 'ring-2! ring-cinnabar!')}
            >
              <span className="absolute -right-1 -bottom-3 font-han text-6xl text-ink/6 dark:text-paper/6">{MODE_INFO[m].han}</span>
              <p className="font-semibold">{MODE_INFO[m].title}</p>
              <p className="text-xs leading-snug text-ink-soft dark:text-ink-faint">{MODE_INFO[m].blurb}</p>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Board">
        <Segmented<GridSizeId>
          value={s.size}
          onChange={(size) => s.set({ size })}
          options={(Object.keys(GRID_SIZES) as GridSizeId[]).map((id) => ({
            value: id,
            label: (
              <span>
                {GRID_SIZES[id].cols}×{GRID_SIZES[id].rows} <span className="text-xs opacity-60">· {(GRID_SIZES[id].cols * GRID_SIZES[id].rows) / 2} words</span>
              </span>
            ),
          }))}
        />
      </Section>

      <Section title="Words from">
        <button onClick={() => go({ name: 'decks' })} className="card flex w-full items-center gap-3 p-3 text-left">
          <Icon name="decks" className="size-5 shrink-0 text-jade" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{names.join(', ')}</span>
            {!!due && <span className="text-xs text-ink-soft dark:text-ink-faint">{due} words due for review — they'll show up first</span>}
          </span>
          <Icon name="chevron" className="size-4 text-ink-faint" />
        </button>
      </Section>

      <Button variant="primary" icon="play" className="w-full py-4 text-lg" onClick={() => play({ mode: s.mode, size: s.size, deckIds: s.deckIds })}>
        Play {MODE_INFO[s.mode].title}
      </Button>
    </div>
  )
}
