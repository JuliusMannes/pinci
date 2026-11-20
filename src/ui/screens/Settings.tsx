import { HSK_DECKS } from '../../data/hsk.ts'
import { resetProgress } from '../../db/repo.ts'
import { useSettings, type Display, type Theme } from '../../store/settings.ts'
import { speak, ttsAvailable } from '../../audio/tts.ts'
import { sfx } from '../../audio/sfx.ts'
import { Pinyin } from '../components/Pinyin.tsx'
import { Button, Header, Section, Segmented, Toggle } from '../components/ui.tsx'

const DAILY_PRESETS: { label: string; ids: string[] }[] = [
  { label: 'HSK 3.0 · Level 1', ids: ['hsk3-1'] },
  { label: 'HSK 3.0 · Levels 1–2', ids: ['hsk3-1', 'hsk3-2'] },
  { label: 'HSK 3.0 · Levels 1–3', ids: ['hsk3-1', 'hsk3-2', 'hsk3-3'] },
  { label: 'HSK 3.0 · Level 4', ids: ['hsk3-4'] },
  { label: 'HSK 2.0 · Levels 1–3', ids: ['hsk2-1', 'hsk2-2', 'hsk2-3'] },
  { label: 'HSK 2.0 · Level 4', ids: ['hsk2-4'] },
]

export function SettingsScreen() {
  const s = useSettings()
  const dailyPreset = DAILY_PRESETS.findIndex((p) => p.ids.join() === s.dailyDeckIds.join())

  return (
    <div className="mx-auto max-w-lg px-4 pb-28">
      <Header title="Settings" back={false} />

      <Section title="Tiles">
        <div className="card px-4 py-3">
          <p className="mb-2 font-medium">Show on tiles</p>
          <Segmented<Display>
            value={s.display}
            onChange={(display) => s.set({ display })}
            options={[
              { value: 'pinyin', label: 'Pinyin' },
              { value: 'both', label: 'Both' },
              { value: 'hanzi', label: 'Hanzi' },
            ]}
          />
          <p className="mt-2 text-xs text-ink-soft dark:text-ink-faint">You can also switch during a game with the button in the top-right corner.</p>
          <Toggle
            checked={s.toneColors}
            onChange={(toneColors) => s.set({ toneColors })}
            label="Tone colours"
            hint={<Pinyin syllables={['mā', 'má', 'mǎ', 'mà', 'ma']} colored className="font-display font-semibold tracking-wide [&>span]:mr-1.5" />}
          />
        </div>
      </Section>

      <Section title="Sound">
        <div className="card divide-y divide-black/5 px-4 dark:divide-white/5">
          <Toggle
            checked={s.sound}
            onChange={(sound) => {
              s.set({ sound })
              if (sound) sfx.match(2)
            }}
            label="Sound effects"
          />
          <Toggle
            checked={s.autoSpeak}
            onChange={(autoSpeak) => {
              s.set({ autoSpeak })
              if (autoSpeak) speak('你好')
            }}
            label="Read words aloud"
            hint={ttsAvailable() ? 'Uses the Chinese voice on your device' : 'Speech is not available in this browser'}
          />
        </div>
      </Section>

      <Section title="Appearance">
        <div className="card px-4 py-3">
          <Segmented<Theme>
            value={s.theme}
            onChange={(theme) => s.set({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </div>
      </Section>

      <Section title="Daily puzzle words">
        <div className="card px-4 py-3">
          <select
            value={dailyPreset}
            onChange={(e) => s.set({ dailyDeckIds: DAILY_PRESETS[Number(e.target.value)].ids })}
            className="w-full bg-transparent py-1 outline-none"
          >
            {dailyPreset < 0 && <option value={-1}>{s.dailyDeckIds.map((id) => HSK_DECKS.find((d) => d.id === id)?.name ?? id).join(', ')}</option>}
            {DAILY_PRESETS.map((p, i) => (
              <option key={p.label} value={i}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </Section>

      <Section title="Install on iPhone">
        <div className="card px-4 py-3 text-sm leading-relaxed">
          Open this page in Safari, tap <b>Share</b> → <b>Add to Home Screen</b>. Pīncí then runs full-screen and works offline.
        </div>
      </Section>

      <Section title="Data">
        <div className="card px-4 py-3 text-xs leading-relaxed text-ink-soft dark:text-ink-faint">
          HSK word lists from <i>complete-hsk-vocabulary</i> by drkameleon (MIT). Dictionary: CC-CEDICT by MDBG (CC BY-SA 4.0). Your decks and progress are
          stored only on this device.
        </div>
        <Button
          variant="danger"
          icon="trash"
          className="mt-3 w-full"
          onClick={async () => {
            if (!confirm('Reset all learning progress and round history? Your imported decks are kept.')) return
            await resetProgress()
            s.set({ daily: {} })
          }}
        >
          Reset progress
        </Button>
      </Section>
    </div>
  )
}
