import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db.ts'
import { HSK_DECKS, HSK_GROUPS } from '../../data/hsk.ts'
import { useSettings } from '../../store/settings.ts'
import { useNav } from '../../store/nav.ts'
import { Icon } from '../components/Icon.tsx'
import { Button, Checkbox, Header, Section, cx } from '../components/ui.tsx'

export function DecksScreen() {
  const { deckIds, set } = useSettings()
  const go = useNav((s) => s.go)
  const [open, setOpen] = useState<string>('hsk3')
  const custom = useLiveQuery(async () => {
    const decks = await db.decks.orderBy('createdAt').reverse().toArray()
    return Promise.all(decks.map(async (d) => ({ ...d, count: await db.words.where('deckId').equals(d.id).count() })))
  }, [])

  const toggle = (id: string, on: boolean) => {
    const next = on ? [...new Set([...deckIds, id])] : deckIds.filter((x) => x !== id)
    if (next.length) set({ deckIds: next })
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-28">
      <Header title="Decks" subtitle={`${deckIds.length} selected for play`} back={false} />

      <Section
        title="Your notes"
        action={
          <Button variant="primary" icon="upload" className="px-3 py-1.5" onClick={() => go({ name: 'import' })}>
            Import
          </Button>
        }
      >
        <div className="card divide-y divide-black/5 dark:divide-white/5">
          {custom?.map((d) => (
            <DeckRow key={d.id} id={d.id} name={d.name} count={d.count} checked={deckIds.includes(d.id)} onToggle={toggle} />
          ))}
          {custom && !custom.length && (
            <button onClick={() => go({ name: 'import' })} className="w-full p-4 text-left text-sm text-ink-soft dark:text-ink-faint">
              Import notes from your lessons — a .txt, .csv or .pdf file, or pasted text. Messy is fine.
            </button>
          )}
        </div>
      </Section>

      {HSK_GROUPS.map((g) => (
        <Section key={g.id} title={g.name}>
          <div className="card divide-y divide-black/5 dark:divide-white/5">
            <button onClick={() => setOpen(open === g.id ? '' : g.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <span className="text-sm text-ink-soft dark:text-ink-faint">{g.note}</span>
              <span className="flex items-center gap-2 text-xs font-semibold text-jade">
                {HSK_DECKS.filter((d) => d.group === g.id && deckIds.includes(d.id)).length || ''}
                <Icon name="chevron" className={cx('size-4 transition', open === g.id && 'rotate-90')} />
              </span>
            </button>
            {open === g.id &&
              HSK_DECKS.filter((d) => d.group === g.id).map((d) => (
                <DeckRow key={d.id} id={d.id} name={d.name.split(' · ')[1]} count={d.count} checked={deckIds.includes(d.id)} onToggle={toggle} />
              ))}
          </div>
        </Section>
      ))}
    </div>
  )
}

function DeckRow({ id, name, count, checked, onToggle }: { id: string; name: string; count: number; checked: boolean; onToggle: (id: string, on: boolean) => void }) {
  const go = useNav((s) => s.go)
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Checkbox checked={checked} onChange={(v) => onToggle(id, v)} />
      <button onClick={() => go({ name: 'deck', id })} className="flex min-w-0 flex-1 items-center gap-2 text-left">
        <span className="min-w-0 flex-1 truncate font-medium">{name}</span>
        <span className="text-xs text-ink-soft tabular-nums dark:text-ink-faint">{count} words</span>
        <Icon name="chevron" className="size-4 text-ink-faint" />
      </button>
    </div>
  )
}
