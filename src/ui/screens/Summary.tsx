import { motion } from 'motion/react'
import { intactWords, type GameState } from '../../engine/game.ts'
import type { Word } from '../../engine/types.ts'
import { play, useNav, type PlaySetup } from '../../store/nav.ts'
import { dailyStreak, useSettings } from '../../store/settings.ts'
import { speak } from '../../audio/tts.ts'
import { Seal } from '../components/Seal.tsx'
import { Hanzi, Pinyin } from '../components/Pinyin.tsx'
import { Icon } from '../components/Icon.tsx'
import { Button, Section, cx } from '../components/ui.tsx'
import { MODE_INFO } from './Game.tsx'

export function SummaryScreen({ setup, result, best }: { setup: PlaySetup; result: GameState; best: number | null }) {
  const go = useNav((s) => s.go)
  const daily = useSettings((s) => s.daily)
  const missed = result.config.mode === 'blitz' ? [] : intactWords(result)
  const newBest = best === null || result.score > best
  const title = result.status === 'won' ? 'Board cleared' : result.status === 'timeup' ? "Time's up" : 'Round over'
  const seconds = Math.round(((result.endedAt ?? Date.now()) - result.startedAt) / 1000)

  return (
    <div className="safe-top safe-bottom mx-auto max-w-lg px-4">
      <div className="flex flex-col items-center pt-6 pb-4 text-center">
        <Seal text={result.status === 'won' ? '完成' : '结束'} size={84} />
        <p className="mt-4 text-sm font-semibold tracking-wider text-ink-soft uppercase dark:text-ink-faint">
          {MODE_INFO[result.config.mode].title} · {title}
        </p>
        <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-6xl font-bold">
          {result.score}
        </motion.p>
        {newBest && result.score > 0 && <p className="mt-1 rounded-full bg-gold/20 px-3 py-0.5 text-sm font-bold text-gold">New best!</p>}
        {!newBest && best !== null && <p className="text-sm text-ink-soft dark:text-ink-faint">Best: {best}</p>}
        {setup.daily && (
          <p className="mt-2 flex items-center gap-1 text-sm font-semibold text-cinnabar">
            <Icon name="flame" className="size-4" /> {dailyStreak(daily)} day streak
          </p>
        )}
      </div>

      <div className="mb-5 grid grid-cols-4 gap-2 text-center">
        <Stat label="words" value={result.found.length} />
        <Stat label="best combo" value={result.bestStreak} />
        <Stat label="mistakes" value={result.mistakes} />
        <Stat label="time" value={`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`} />
      </div>

      <Section title={`Found · ${result.found.length}`}>
        <div className="card divide-y divide-black/5 dark:divide-white/5">
          {result.found.map((f, i) => (
            <WordRow key={i} word={f.word} points={f.score.total} flag={result.outcomes[f.word.key]} />
          ))}
          {!result.found.length && <p className="p-4 text-center text-sm text-ink-soft">No words this time.</p>}
        </div>
      </Section>

      {missed.length > 0 && (
        <Section title={`Missed · ${missed.length}`}>
          <div className="card divide-y divide-black/5 dark:divide-white/5">
            {missed.map((w) => (
              <WordRow key={w.key} word={w} flag="fail" />
            ))}
          </div>
        </Section>
      )}

      <div className="sticky bottom-0 flex gap-2 bg-gradient-to-t from-paper via-paper/90 pt-4 pb-2 dark:from-night dark:via-night/90">
        <Button variant="ghost" icon="home" onClick={() => go({ name: 'home' })}>
          Home
        </Button>
        <Button
          variant="primary"
          icon="play"
          className="flex-1"
          onClick={() => play(setup.daily ? { ...setup, mode: 'zen', daily: undefined } : setup)}
        >
          {setup.daily ? 'Practice more' : 'Play again'}
        </Button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card py-2">
      <p className="font-display text-xl font-bold">{value}</p>
      <p className="text-[10px] font-semibold tracking-wide text-ink-soft uppercase dark:text-ink-faint">{label}</p>
    </div>
  )
}

function WordRow({ word, points, flag }: { word: Word; points?: number; flag?: string }) {
  return (
    <button onClick={() => speak(word.hanzi)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left">
      <Hanzi hanzi={word.hanzi} syllables={word.syllables} className="w-20 shrink-0 font-han text-2xl" />
      <span className="min-w-0 flex-1">
        <Pinyin syllables={word.syllables} className="block font-display font-semibold" />
        <span className="block truncate text-xs text-ink-soft dark:text-ink-faint">{word.meaning}</span>
      </span>
      {flag && flag !== 'ok' && (
        <span className={cx('rounded px-1.5 py-0.5 text-[10px] font-bold uppercase', flag === 'fail' ? 'bg-cinnabar/15 text-cinnabar' : 'bg-gold/20 text-gold')}>
          review
        </span>
      )}
      {points !== undefined && <span className="font-display font-bold text-cinnabar">+{points}</span>}
    </button>
  )
}
