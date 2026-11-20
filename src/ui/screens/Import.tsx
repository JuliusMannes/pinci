import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db.ts'
import { loadDictionary } from '../../data/dictionary.ts'
import { parseNotes, type Candidate } from '../../data/import/parser.ts'
import { parsePinyin } from '../../engine/pinyin.ts'
import { saveDeck } from '../../db/repo.ts'
import { useSettings } from '../../store/settings.ts'
import { useNav } from '../../store/nav.ts'
import { Hanzi, Pinyin } from '../components/Pinyin.tsx'
import { Icon } from '../components/Icon.tsx'
import { Button, Checkbox, Header, Section, Segmented, cx } from '../components/ui.tsx'

type Filter = 'picked' | 'notes' | 'more'

const SOURCE_BADGE: Record<Candidate['source'], { label: string; className: string }> = {
  notes: { label: 'from notes', className: 'bg-cinnabar/12 text-cinnabar' },
  dictionary: { label: 'dictionary', className: 'bg-jade/12 text-jade' },
  phrase: { label: 'phrase', className: 'bg-gold/20 text-gold' },
  guessed: { label: 'check pinyin', className: 'bg-black/8 text-ink-soft dark:bg-white/10 dark:text-ink-faint' },
}

const defaultName = () => `Lesson notes · ${new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`

export function ImportScreen() {
  const go = useNav((s) => s.go)
  const { deckIds, set } = useSettings()
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [name, setName] = useState(defaultName)
  const [target, setTarget] = useState<string>('new')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<Candidate[] | null>(null)
  const [filter, setFilter] = useState<Filter>('picked')
  const [editing, setEditing] = useState<string | null>(null)
  const decks = useLiveQuery(() => db.decks.orderBy('createdAt').reverse().toArray(), [])

  const onFile = async (file: File) => {
    setError(null)
    setName(file.name.replace(/\.[^.]+$/, ''))
    try {
      if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') {
        setBusy('Reading PDF…')
        const { pdfToText } = await import('../../data/import/pdf.ts')
        setText(await pdfToText(file))
      } else setText(await file.text())
    } catch (e) {
      setError(`Could not read the file: ${e}`)
    } finally {
      setBusy(null)
    }
  }

  const analyze = async () => {
    setError(null)
    setBusy('Loading dictionary…')
    try {
      const dict = await loadDictionary()
      setBusy('Finding words…')
      const found = parseNotes(text, dict)
      if (!found.length) setError('No Chinese words of 2–4 characters were found in this text.')
      else {
        setItems(found)
        setFilter('picked')
      }
    } catch (e) {
      setError(`Something went wrong: ${e}`)
    } finally {
      setBusy(null)
    }
  }

  const update = (hanzi: string, patch: Partial<Candidate>) => setItems((list) => list!.map((c) => (c.hanzi === hanzi ? { ...c, ...patch } : c)))

  const visible = useMemo(() => {
    if (!items) return []
    if (filter === 'picked') return items.filter((c) => c.include)
    if (filter === 'notes') return items.filter((c) => c.source === 'notes')
    return items.filter((c) => !c.include)
  }, [items, filter])

  const picked = items?.filter((c) => c.include) ?? []

  const save = async () => {
    setBusy('Saving…')
    const id = await saveDeck(
      target === 'new' ? name.trim() || defaultName() : decks!.find((d) => d.id === target)!.name,
      picked.map((c) => ({ hanzi: c.hanzi, syllables: c.syllables, meaning: c.meaning })),
      target === 'new' ? undefined : target,
    )
    set({ deckIds: [...new Set([...deckIds, id])] })
    setBusy(null)
    go({ name: 'deck', id })
  }

  if (!items)
    return (
      <div className="mx-auto max-w-lg px-4 pb-28">
        <Header title="Import notes" subtitle="Turn lesson notes into a review deck" />
        <Section title="Source">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.csv,.tsv,.pdf,text/plain,text/csv,application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <Button icon="upload" className="mb-3 w-full py-3" onClick={() => fileRef.current?.click()}>
            Choose a file (.txt, .csv, .pdf)
          </Button>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder={'…or paste text here. Anything works:\n\n老师 lǎoshī teacher\n学生, xue2sheng, student\n舒服：comfortable\n你几点起床 get up?\n我每天做运动，我每周工作…'}
            className="card w-full resize-none p-3 font-mono text-sm outline-none"
          />
        </Section>
        {error && <p className="mb-3 text-sm text-cinnabar">{error}</p>}
        <Button variant="primary" className="w-full py-3" disabled={!text.trim() || !!busy} onClick={analyze}>
          {busy ?? 'Find words'}
        </Button>
        <p className="mt-3 text-xs leading-relaxed text-ink-soft dark:text-ink-faint">
          Pīncí splits sentences into dictionary words, keeps English glosses next to the hanzi as the meaning, fills in pinyin from CC-CEDICT and skips
          numbers. You can review everything before saving. The dictionary (≈3 MB) downloads once and then works offline.
        </p>
      </div>
    )

  return (
    <div className="mx-auto max-w-lg px-4 pb-44">
      <Header
        title="Review words"
        subtitle={`${picked.length} selected · ${items.length} found`}
        right={
          <Button variant="ghost" onClick={() => setItems(null)}>
            Edit text
          </Button>
        }
      />
      <Segmented<Filter>
        className="mb-3"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'picked', label: `Selected ${picked.length}` },
          { value: 'notes', label: `From notes ${items.filter((c) => c.source === 'notes').length}` },
          { value: 'more', label: `More ${items.length - picked.length}` },
        ]}
      />
      {filter === 'more' && (
        <p className="mb-3 px-1 text-xs text-ink-soft dark:text-ink-faint">
          Phrases and unknown words (names, typos) aren't selected by default. Check the pinyin before adding them.
        </p>
      )}
      <div className="card divide-y divide-black/5 dark:divide-white/5">
        {visible.map((c) => (
          <CandidateRow key={c.hanzi} c={c} editing={editing === c.hanzi} onEdit={() => setEditing(editing === c.hanzi ? null : c.hanzi)} update={update} />
        ))}
        {!visible.length && <p className="p-4 text-center text-sm text-ink-soft">Nothing here.</p>}
      </div>

      <div className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-paper/95 px-4 pt-3 backdrop-blur dark:border-white/5 dark:bg-night/95">
        <div className="mx-auto flex max-w-lg flex-col gap-2">
          <div className="flex gap-2">
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="card shrink-0 px-2 py-2 text-sm outline-none">
              <option value="new">New deck</option>
              {decks?.map((d) => (
                <option key={d.id} value={d.id}>
                  Add to: {d.name}
                </option>
              ))}
            </select>
            {target === 'new' && (
              <input value={name} onChange={(e) => setName(e.target.value)} className="card min-w-0 flex-1 px-3 py-2 text-sm outline-none" placeholder="Deck name" />
            )}
          </div>
          <Button variant="primary" className="w-full py-3" disabled={!picked.length || !!busy} onClick={save}>
            {busy ?? `Save ${picked.length} words`}
          </Button>
        </div>
      </div>
    </div>
  )
}

function CandidateRow({ c, editing, onEdit, update }: { c: Candidate; editing: boolean; onEdit: () => void; update: (h: string, p: Partial<Candidate>) => void }) {
  const [py, setPy] = useState(c.syllables.join(' '))
  const parsed = parsePinyin(py, [...c.hanzi].length)
  const badge = SOURCE_BADGE[c.source]
  return (
    <div className={cx('px-4 py-2.5', !c.include && 'opacity-70')}>
      <div className="flex items-center gap-3">
        <Checkbox checked={c.include} onChange={(v) => update(c.hanzi, { include: v })} />
        <button onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Hanzi hanzi={c.hanzi} syllables={c.syllables} className="shrink-0 font-han text-2xl" />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <Pinyin syllables={c.syllables} className="font-display font-semibold" />
              <span className={cx('rounded px-1.5 text-[10px] font-bold', badge.className)}>{badge.label}</span>
            </span>
            <span className="block truncate text-xs text-ink-soft dark:text-ink-faint">{c.meaning || 'no meaning yet'}</span>
          </span>
          <Icon name="edit" className="size-4 shrink-0 text-ink-faint" />
        </button>
      </div>
      {editing && (
        <div className="mt-2 flex flex-col gap-2 pl-9">
          <label className="text-xs text-ink-soft">
            Pinyin (tone marks or numbers)
            <input
              value={py}
              onChange={(e) => {
                setPy(e.target.value)
                const p = parsePinyin(e.target.value, [...c.hanzi].length)
                if (p) update(c.hanzi, { syllables: p })
              }}
              className={cx('card mt-1 w-full px-3 py-2 text-sm text-ink outline-none dark:text-paper', !parsed && 'ring-2! ring-cinnabar!')}
            />
          </label>
          <label className="text-xs text-ink-soft">
            Meaning
            <input
              value={c.meaning}
              onChange={(e) => update(c.hanzi, { meaning: e.target.value })}
              className="card mt-1 w-full px-3 py-2 text-sm text-ink outline-none dark:text-paper"
            />
          </label>
          {c.dictMeaning && c.dictMeaning !== c.meaning && (
            <button onClick={() => update(c.hanzi, { meaning: c.dictMeaning })} className="text-left text-xs text-jade">
              Use dictionary: {c.dictMeaning}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
