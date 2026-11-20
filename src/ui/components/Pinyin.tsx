import { toneOf } from '../../engine/pinyin.ts'
import { useSettings } from '../../store/settings.ts'

export const TONE_CLASS = ['', 'text-tone-1', 'text-tone-2', 'text-tone-3', 'text-tone-4', 'text-tone-5'] as const

export function Syllable({ s, colored }: { s: string; colored?: boolean }) {
  const toneColors = useSettings((x) => x.toneColors)
  return <span className={colored ?? toneColors ? TONE_CLASS[toneOf(s)] : undefined}>{s}</span>
}

export function Pinyin({ syllables, className, colored }: { syllables: string[]; className?: string; colored?: boolean }) {
  return (
    <span className={className}>
      {syllables.map((s, i) => (
        <Syllable key={i} s={s} colored={colored} />
      ))}
    </span>
  )
}

/** Hanzi with each character coloured by its tone. */
export function Hanzi({ hanzi, syllables, className, colored }: { hanzi: string; syllables: string[]; className?: string; colored?: boolean }) {
  const toneColors = useSettings((x) => x.toneColors)
  const on = colored ?? toneColors
  return (
    <span className={className}>
      {[...hanzi].map((c, i) => (
        <span key={i} className={on ? TONE_CLASS[toneOf(syllables[i] ?? '')] : undefined}>
          {c}
        </span>
      ))}
    </span>
  )
}
