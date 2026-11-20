import { motion } from 'motion/react'
import type { Word } from '../../engine/types.ts'
import type { ScoreBreakdown } from '../../engine/scoring.ts'
import { speak } from '../../audio/tts.ts'
import { Hanzi, Pinyin } from './Pinyin.tsx'
import { Icon } from './Icon.tsx'
import { cx } from './ui.tsx'

export function WordCard({ word, score, unplanned, className }: { word: Word; score?: ScoreBreakdown; unplanned?: boolean; className?: string }) {
  return (
    <motion.button
      key={word.key}
      onClick={() => speak(word.hanzi)}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={cx('card flex w-full items-center gap-3 px-4 py-3 text-left', className)}
    >
      <Hanzi hanzi={word.hanzi} syllables={word.syllables} className="shrink-0 font-han text-4xl leading-none" />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <Pinyin syllables={word.syllables} className="font-display text-lg font-semibold" />
          {unplanned && <span className="rounded bg-gold/20 px-1.5 text-[10px] font-bold text-gold uppercase">bonus word</span>}
        </span>
        <span className="line-clamp-2 block text-sm text-ink-soft dark:text-ink-faint">{word.meaning || '—'}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {score && <span className="font-display text-xl font-bold text-cinnabar">+{score.total}</span>}
        {score && <ScoreDetail score={score} />}
        <Icon name="speaker" className="size-5 text-ink-faint" />
      </span>
    </motion.button>
  )
}

function ScoreDetail({ score }: { score: ScoreBreakdown }) {
  const bits = [
    score.wordMultiplier > 1 && `词×${score.wordMultiplier}`,
    score.lengthMultiplier > 1 && `len×${score.lengthMultiplier}`,
    score.comboMultiplier > 1 && `combo×${score.comboMultiplier}`,
  ].filter(Boolean)
  if (!bits.length) return null
  return <span className="text-[10px] font-semibold text-ink-soft dark:text-ink-faint">{bits.join(' · ')}</span>
}
