import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db.ts'
import { MASTERED_BOX, MAX_BOX } from '../../engine/srs.ts'
import { GRID_SIZES, type GridSizeId } from '../../engine/types.ts'
import { dailyStreak, useSettings } from '../../store/settings.ts'
import { speak } from '../../audio/tts.ts'
import { Hanzi, Pinyin } from '../components/Pinyin.tsx'
import { Header, Section } from '../components/ui.tsx'
import { MODE_INFO } from './Game.tsx'

export function StatsScreen() {
  const daily = useSettings((s) => s.daily)
  const progress = useLiveQuery(() => db.progress.toArray(), [])
  const rounds = useLiveQuery(() => db.rounds.toArray(), [])
  if (!progress || !rounds) return null
  const now = Date.now()
  const boxes = Array.from({ length: MAX_BOX + 1 }, (_, b) => progress.filter((p) => p.box === b).length)
  const maxBox = Math.max(1, ...boxes)
  const mastered = progress.filter((p) => p.box >= MASTERED_BOX).length
  const due = progress.filter((p) => p.due <= now).length
  const correct = progress.reduce((s, p) => s + p.correct, 0)
  const seen = progress.reduce((s, p) => s + p.seen, 0)
  const tough = [...progress].filter((p) => p.wrong > 0).sort((a, b) => b.wrong - a.wrong || a.box - b.box).slice(0, 10)
  const best = new Map<string, number>()
  for (const r of rounds) {
    const k = `${r.mode}|${r.size}`
    best.set(k, Math.max(best.get(k) ?? 0, r.score))
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28">
      <Header title="Progress" subtitle={`${rounds.length} ${rounds.length === 1 ? 'round' : 'rounds'} played`} back={false} />
      <div className="mb-5 grid grid-cols-2 gap-2">
        <Big label="words practised" value={progress.length} />
        <Big label="mastered" value={mastered} accent="text-jade" />
        <Big label="due for review" value={due} accent="text-gold" />
        <Big label="accuracy" value={seen ? `${Math.round((correct / seen) * 100)}%` : '—'} />
        <Big label="daily streak" value={dailyStreak(daily)} accent="text-cinnabar" />
        <Big label="daily puzzles" value={Object.keys(daily).length} />
      </div>

      <Section title="Spaced-repetition boxes">
        <div className="card flex h-36 items-end gap-2 px-4 pt-4 pb-2">
          {boxes.map((n, b) => (
            <div key={b} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-ink-soft tabular-nums">{n}</span>
              <div
                className={b >= MASTERED_BOX ? 'w-full rounded-t bg-jade' : b === 0 ? 'w-full rounded-t bg-cinnabar/70' : 'w-full rounded-t bg-gold'}
                style={{ height: `${(n / maxBox) * 80}px`, minHeight: 2 }}
              />
              <span className="text-[10px] text-ink-faint">{b}</span>
            </div>
          ))}
        </div>
        <p className="mt-1 px-1 text-[11px] text-ink-soft dark:text-ink-faint">
          Words move up a box when you find them without help, and back to box 0 when you miss them. Box {MASTERED_BOX}+ counts as mastered.
        </p>
      </Section>

      {best.size > 0 && (
        <Section title="Best scores">
          <div className="card divide-y divide-black/5 dark:divide-white/5">
            {[...best].map(([k, v]) => {
              const [mode, size] = k.split('|') as [keyof typeof MODE_INFO, GridSizeId]
              const g = GRID_SIZES[size]
              return (
                <div key={k} className="flex items-center justify-between px-4 py-2.5">
                  <span>
                    <span className="mr-2 font-han text-cinnabar">{MODE_INFO[mode].han}</span>
                    {MODE_INFO[mode].title} <span className="text-xs text-ink-soft">{g ? `${g.cols}×${g.rows}` : size}</span>
                  </span>
                  <span className="font-display text-lg font-bold">{v}</span>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {tough.length > 0 && (
        <Section title="Trickiest words">
          <div className="card divide-y divide-black/5 dark:divide-white/5">
            {tough.map((p) => {
              const [hanzi, py] = p.key.split('|')
              const syllables = py.split(' ')
              return (
                <button key={p.key} onClick={() => speak(hanzi)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
                  <Hanzi hanzi={hanzi} syllables={syllables} className="w-20 font-han text-2xl" />
                  <Pinyin syllables={syllables} className="flex-1 font-display font-semibold" />
                  <span className="text-xs text-cinnabar">missed {p.wrong}×</span>
                </button>
              )
            })}
          </div>
        </Section>
      )}
    </div>
  )
}

function Big({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="card p-3">
      <p className={`font-display text-3xl font-bold ${accent ?? ''}`}>{value}</p>
      <p className="text-xs text-ink-soft dark:text-ink-faint">{label}</p>
    </div>
  )
}
