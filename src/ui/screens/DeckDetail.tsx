import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db.ts'
import { hskDeck, isBuiltin, loadChars, loadHskDeck, makeWord } from '../../data/hsk.ts'
import { deleteDeck, deleteWord, progressFor, renameDeck } from '../../db/repo.ts'
import { MASTERED_BOX, MAX_BOX, type Progress } from '../../engine/srs.ts'
import { stripTones } from '../../engine/pinyin.ts'
import type { Word } from '../../engine/types.ts'
import { useSettings } from '../../store/settings.ts'
import { useNav } from '../../store/nav.ts'
import { speak } from '../../audio/tts.ts'
import { Hanzi, Pinyin } from '../components/Pinyin.tsx'
import { Icon } from '../components/Icon.tsx'
import { Button, Checkbox, Header, ProgressBar, cx } from '../components/ui.tsx'

const PAGE = 150

export function DeckDetailScreen({ id }: { id: string }) {
  const go = useNav((s) => s.go)
  const { deckIds, set } = useSettings()
  const builtin = isBuiltin(id)
  const deck = useLiveQuery(() => (builtin ? undefined : db.decks.get(id)), [id])
  const rows = useLiveQuery(() => (builtin ? [] : db.words.where('deckId').equals(id).toArray()), [id])
  const [hsk, setHsk] = useState<Word[] | null>(null)
  const [words, setWords] = useState<(Word & { rowId?: number })[] | null>(null)
  const [progress, setProgress] = useState<Map<string, Progress>>(new Map())
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE)

  useEffect(() => {
    if (builtin) loadHskDeck(id).then(setHsk)
  }, [id, builtin])

  useEffect(() => {
    ;(async () => {
      const chars = await loadChars()
      const list = builtin ? hsk : rows?.map((r) => ({ ...makeWord(r.hanzi, r.syllables, r.meaning, chars), rowId: r.id }))
      if (!list) return
      setWords(list)
      setProgress(await progressFor(list.map((w) => w.key)))
    })()
  }, [builtin, hsk, rows])

  const filtered = useMemo(() => {
    const q = stripTones(query.trim().toLowerCase())
    if (!words || !q) return words ?? []
    return words.filter((w) => w.hanzi.includes(q) || stripTones(w.syllables.join('')).includes(q.replace(/\s/g, '')) || w.meaning.toLowerCase().includes(q))
  }, [words, query])

  const mastered = words?.filter((w) => (progress.get(w.key)?.box ?? 0) >= MASTERED_BOX).length ?? 0
  const learning = words?.filter((w) => progress.has(w.key)).length ?? 0
  const name = builtin ? hskDeck(id)!.name : (deck?.name ?? '…')
  const selected = deckIds.includes(id)

  return (
    <div className="mx-auto max-w-lg px-4 pb-28">
      <Header
        title={name}
        subtitle={words ? `${words.length} words · ${mastered} mastered` : 'Loading…'}
        right={
          !builtin && (
            <div className="flex">
              <button
                className="rounded-full p-2 text-ink-soft"
                aria-label="Rename"
                onClick={() => {
                  const n = prompt('Deck name', name)
                  if (n?.trim()) renameDeck(id, n.trim())
                }}
              >
                <Icon name="edit" />
              </button>
              <button
                className="rounded-full p-2 text-cinnabar"
                aria-label="Delete deck"
                onClick={async () => {
                  if (!confirm(`Delete “${name}” and its ${words?.length ?? 0} words?`)) return
                  await deleteDeck(id)
                  set({ deckIds: deckIds.filter((x) => x !== id).length ? deckIds.filter((x) => x !== id) : ['hsk3-1'] })
                  go({ name: 'decks' })
                }}
              >
                <Icon name="trash" />
              </button>
            </div>
          )
        }
      />

      <div className="card mb-4 flex items-center gap-3 p-4">
        <Checkbox
          checked={selected}
          onChange={(v) => {
            const next = v ? [...new Set([...deckIds, id])] : deckIds.filter((x) => x !== id)
            if (next.length) set({ deckIds: next })
          }}
        />
        <div className="flex-1">
          <p className="text-sm font-medium">{selected ? 'Included in play' : 'Not included in play'}</p>
          <ProgressBar
            className="mt-2"
            parts={[
              { value: mastered, className: 'bg-jade' },
              { value: learning - mastered, className: 'bg-gold' },
              { value: (words?.length ?? 0) - learning, className: 'bg-transparent' },
            ]}
          />
          <p className="mt-1 text-[11px] text-ink-soft dark:text-ink-faint">
            <span className="text-jade">■</span> mastered {mastered} · <span className="text-gold">■</span> learning {learning - mastered} · new{' '}
            {(words?.length ?? 0) - learning}
          </p>
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search hanzi, pinyin or meaning"
        className="card mb-3 w-full px-4 py-2.5 outline-none"
      />

      <div className="card divide-y divide-black/5 dark:divide-white/5">
        {filtered.slice(0, limit).map((w) => (
          <div key={w.key} className="flex items-center gap-3 px-4 py-2.5">
            <button onClick={() => speak(w.hanzi)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <Hanzi hanzi={w.hanzi} syllables={w.syllables} className="w-20 shrink-0 font-han text-2xl" />
              <span className="min-w-0 flex-1">
                <Pinyin syllables={w.syllables} className="block font-display font-semibold" />
                <span className="block truncate text-xs text-ink-soft dark:text-ink-faint">{w.meaning}</span>
              </span>
            </button>
            <BoxDots box={progress.get(w.key)?.box} />
            {w.rowId !== undefined && (
              <button onClick={() => deleteWord(w.rowId!)} className="p-1 text-ink-faint" aria-label="Delete word">
                <Icon name="x" className="size-4" />
              </button>
            )}
          </div>
        ))}
        {words && !filtered.length && <p className="p-4 text-center text-sm text-ink-soft">No words.</p>}
      </div>
      {filtered.length > limit && (
        <Button variant="ghost" className="mt-2 w-full" onClick={() => setLimit(limit + PAGE)}>
          Show more ({filtered.length - limit})
        </Button>
      )}
    </div>
  )
}

export function BoxDots({ box }: { box?: number }) {
  return (
    <span className="flex gap-0.5" title={box === undefined ? 'new' : `box ${box}`}>
      {Array.from({ length: MAX_BOX }, (_, i) => (
        <span
          key={i}
          className={cx('size-1.5 rounded-full', box !== undefined && i < box ? (box >= MASTERED_BOX ? 'bg-jade' : 'bg-gold') : 'bg-black/10 dark:bg-white/10')}
        />
      ))}
    </span>
  )
}
