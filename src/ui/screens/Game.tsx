import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { cellsOfWord, createGame, gameReducer, intactWords, layoutOf, type GameAction, type GameContext, type GameState } from '../../engine/game.ts'
import { buildIndex, tileUnit } from '../../engine/match.ts'
import { hashString, mulberry32, randomSeed } from '../../engine/rng.ts'
import { reviewWeight } from '../../engine/srs.ts'
import { isPlayable } from '../../engine/board.ts'
import { HINT_COST, type ScoreBreakdown } from '../../engine/scoring.ts'
import { GRID_SIZES, type Word } from '../../engine/types.ts'
import { loadPool, progressFor, recordRound } from '../../db/repo.ts'
import { matchByFor, useSettings, type Display } from '../../store/settings.ts'
import { useNav, type PlaySetup } from '../../store/nav.ts'
import { sfx } from '../../audio/sfx.ts'
import { speak } from '../../audio/tts.ts'
import { CELL_ASPECT, Grid, type Flash, type Floater } from '../components/Grid.tsx'
import { Seal } from '../components/Seal.tsx'
import { WordCard } from '../components/WordCard.tsx'
import { Icon, type IconName } from '../components/Icon.tsx'
import { Button, cx } from '../components/ui.tsx'
import { useElementSize, useNow } from '../hooks.ts'

export const MODE_INFO = {
  zen: { title: 'Zen', han: '禅', blurb: 'Clear the board at your own pace.' },
  path: { title: 'Path', han: '路', blurb: 'Drag through neighbouring tiles, Boggle-style.' },
  blitz: { title: 'Blitz', han: '快', blurb: '90 seconds. Tiles refill. +2s per word.' },
  clue: { title: 'Clues', han: '谜', blurb: 'Find the words from their English meanings.' },
  daily: { title: 'Daily', han: '日', blurb: 'One shared board per day.' },
} as const

type Loaded = { ctx: GameContext; initial: GameState } | { error: string }

export function GameScreen({ setup, nonce }: { setup: PlaySetup; nonce: number }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const display = useSettings((s) => s.display)
  const go = useNav((s) => s.go)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const pool = await loadPool(setup.deckIds)
      const now = Date.now()
      const progress = setup.daily ? new Map() : await progressFor(pool.map((w) => w.key))
      const seed = setup.daily ? hashString(`pinci-daily-${setup.daily}-${setup.deckIds.join(',')}`) : randomSeed()
      const ctx: GameContext = {
        pool,
        indexes: { pinyin: buildIndex(pool, 'pinyin'), hanzi: buildIndex(pool, 'hanzi') },
        weight: setup.daily ? undefined : (w) => reviewWeight(progress.get(w.key), now),
        rng: mulberry32(seed),
      }
      const { rows, cols } = GRID_SIZES[setup.size]
      const initial = createGame({ mode: setup.mode, rows, cols, matchBy: matchByFor(useSettings.getState().display) }, ctx, now)
      if (cancelled) return
      const playable = pool.filter(isPlayable).length
      setLoaded(
        initial
          ? { ctx, initial }
          : { error: `The selected decks have ${playable} playable words — a ${setup.size.replace('x', '×')} board needs at least ${Math.ceil((rows * cols) / 2)}. Add more decks or pick a smaller grid.` },
      )
    })().catch((e) => !cancelled && setLoaded({ error: String(e) }))
    return () => {
      cancelled = true
    }
  }, [setup, nonce])

  if (!loaded)
    return (
      <div className="flex h-dvh items-center justify-center">
        <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ repeat: Infinity, duration: 1.4 }}>
          <Seal text="拼词" size={72} />
        </motion.div>
      </div>
    )
  if ('error' in loaded)
    return (
      <div className="safe-top flex h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="text-ink-soft dark:text-ink-faint">{loaded.error}</p>
        <div className="flex gap-2">
          <Button onClick={() => go({ name: 'decks' })} icon="decks">
            Choose decks
          </Button>
          <Button variant="ghost" onClick={() => go({ name: 'home' })}>
            Home
          </Button>
        </div>
      </div>
    )
  return <Board key={nonce} setup={setup} ctx={loaded.ctx} initial={loaded.initial} display={display} />
}

interface LastMatch {
  word: Word
  score: ScoreBreakdown
  unplanned: boolean
}

function Board({ setup, ctx, initial, display }: { setup: PlaySetup; ctx: GameContext; initial: GameState; display: Display }) {
  const settings = useSettings()
  const go = useNav((s) => s.go)
  const ctxRef = useRef(ctx)
  const [state, dispatch] = useReducer((s: GameState, a: GameAction) => gameReducer(s, a, ctxRef.current), initial)
  const [last, setLast] = useState<LastMatch | null>(null)
  const [seal, setSeal] = useState<{ text: string; seq: number } | null>(null)
  const [shake, setShake] = useState<Flash | null>(null)
  const [flash, setFlash] = useState<Flash | null>(null)
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [areaRef, area] = useElementSize<HTMLDivElement>()
  const recorded = useRef(false)
  const layout = layoutOf(state)
  const { rows, cols } = state.config
  const now = useNow(250, state.endsAt !== null && state.status === 'playing')

  useEffect(() => {
    if (state.endsAt !== null) dispatch({ type: 'tick', now })
  }, [now, state.endsAt])

  useEffect(() => {
    const matchBy = matchByFor(display)
    if (matchBy !== state.config.matchBy) dispatch({ type: 'matchBy', matchBy })
  }, [display, state.config.matchBy])

  useEffect(() => {
    for (const e of state.events) {
      if (e.kind === 'match') {
        sfx.match(state.streak - 1)
        if (settings.autoSpeak) speak(e.word.hanzi)
        setLast({ word: e.word, score: e.score, unplanned: e.unplanned })
        setSeal({ text: e.word.hanzi, seq: state.eventSeq })
        setFlash({ cells: e.cells, seq: state.eventSeq })
        const id = state.eventSeq
        const sub = e.score.comboMultiplier > 1 ? `combo ×${e.score.comboMultiplier}` : e.unplanned ? 'bonus word' : undefined
        setFloaters((f) => [...f, { id, cell: e.cells[e.cells.length - 1], text: `+${e.score.total}`, sub }])
        setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 1400)
      } else if (e.kind === 'miss') {
        sfx.miss()
        setShake({ cells: e.cells, seq: state.eventSeq })
      } else if (e.kind === 'won' || e.kind === 'timeup') {
        setTimeout(() => sfx.win(), 250)
      } else if (e.kind === 'reshuffle') {
        sfx.shuffle()
        setToast('Some tiles were re-dealt so the board stays solvable')
      }
    }
  }, [state.eventSeq])

  useEffect(() => {
    if (!seal) return
    const t = setTimeout(() => setSeal(null), 950)
    return () => clearTimeout(t)
  }, [seal])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    if (state.status === 'playing' || recorded.current) return
    recorded.current = true
    const t = setTimeout(
      async () => {
        const best = await recordRound(state, setup.deckIds, setup.size, setup.daily)
        if (setup.daily) useSettings.getState().set({ daily: { ...useSettings.getState().daily, [setup.daily]: state.score } })
        go({ name: 'summary', setup, result: state, best })
      },
      state.status === 'won' ? 1700 : 700,
    )
    return () => clearTimeout(t)
  }, [state.status])

  const revealCells = useMemo(() => (state.revealKey ? cellsOfWord(state, state.revealKey) : []), [state])
  const gridWidth = Math.max(0, Math.min(area.width, (area.height / (rows * CELL_ASPECT)) * cols, 520))
  const remainingMs = state.endsAt !== null ? Math.max(0, state.endsAt - now) : null
  const cycleDisplay = () => settings.set({ display: display === 'pinyin' ? 'both' : display === 'both' ? 'hanzi' : 'pinyin' })
  const leave = () => {
    if (state.found.length === 0 || state.status !== 'playing') return go({ name: 'home' })
    if (confirm('End this round? Your progress so far will be saved.')) dispatch({ type: 'end', now: Date.now() })
  }

  const clues = useMemo(() => {
    if (state.config.mode !== 'clue') return []
    const found = new Set(state.found.map((f) => f.word.key))
    const onBoard = new Set(state.cells.flatMap((t) => (t ? [t.wordKey] : [])))
    return state.planned.filter((w) => found.has(w.key) || onBoard.has(w.key)).map((w) => ({ word: w, found: found.has(w.key) }))
  }, [state])

  const selectionText = state.selection.map((c) => tileUnit(state.cells[c]!, display === 'pinyin' ? 'pinyin' : 'hanzi')).join(display === 'pinyin' ? ' · ' : '')

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* HUD */}
      <div className="safe-top flex items-center gap-2 px-3 pb-1">
        <button onClick={leave} className="rounded-full p-2 text-ink-soft dark:text-ink-faint" aria-label="Back">
          <Icon name="back" className="size-6" />
        </button>
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <span className="font-han text-lg text-cinnabar">{MODE_INFO[state.config.mode].han}</span>
          <motion.span key={state.score} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className="font-display text-3xl font-bold tabular-nums">
            {state.score}
          </motion.span>
          {state.streak > 1 && (
            <span className="flex items-center gap-0.5 rounded-full bg-cinnabar/10 px-2 py-0.5 text-xs font-bold text-cinnabar">
              <Icon name="flame" className="size-3.5" />×{1 + Math.min(state.streak, 8) * 0.25}
            </span>
          )}
        </div>
        {remainingMs !== null && (
          <span className={cx('flex items-center gap-1 font-display text-xl font-bold tabular-nums', remainingMs < 10_000 && 'text-cinnabar')}>
            <Icon name="clock" className="size-4.5" />
            {Math.ceil(remainingMs / 1000)}s
          </span>
        )}
        <button onClick={cycleDisplay} className="card min-w-14 rounded-xl px-2.5 py-1.5 text-sm font-semibold" aria-label="Toggle hanzi">
          {display === 'pinyin' ? 'pīn' : display === 'both' ? '拼+字' : '字'}
        </button>
      </div>

      {/* clue list / hint clue */}
      {state.config.mode === 'clue' ? (
        <div className="mx-3 mb-1 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
          {clues.map(({ word, found }) => (
            <span
              key={word.key}
              className={cx(
                'rounded-lg px-2 py-1 text-xs',
                found ? 'bg-jade/15 text-jade line-through' : 'bg-white/70 ring-1 ring-black/10 dark:bg-night-3 dark:ring-white/10',
              )}
            >
              {found && <span className="mr-1 font-han not-italic no-underline">{word.hanzi}</span>}
              {shortMeaning(word.meaning)}
              <span className="ml-1 text-ink-faint">·{word.syllables.length}</span>
            </span>
          ))}
        </div>
      ) : (
        <AnimatePresence>
          {state.clue && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mx-3 mb-1 flex items-center gap-2 rounded-xl bg-gold/15 px-3 py-2 text-sm"
            >
              <Icon name="clue" className="size-4 shrink-0 text-gold" />
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold">{shortMeaning(state.clue.meaning)}</span>
                <span className="text-ink-soft dark:text-ink-faint"> · {state.clue.syllables.length} tiles</span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* grid */}
      <div ref={areaRef} className="relative mx-3 flex min-h-0 flex-1 items-center justify-center">
        {gridWidth > 0 && (
          <Grid
            state={state}
            layout={layout}
            display={display}
            revealCells={revealCells}
            shake={shake}
            flash={flash}
            floaters={floaters}
            width={gridWidth}
            dispatch={dispatch}
          />
        )}
        <AnimatePresence>
          {seal && (
            <div key={seal.seq} className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <Seal text={seal.text} size={Math.min(130, gridWidth * 0.32)} />
            </div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {state.status !== 'playing' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center gap-3"
            >
              <Seal text={state.status === 'won' ? '完成' : state.status === 'timeup' ? '时到' : '结束'} size={120} />
              <span className="card px-3 py-1 font-display text-lg font-semibold">
                {state.status === 'won' ? 'Board cleared! +25' : state.status === 'timeup' ? "Time's up!" : 'Round over'}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* selection / last word */}
      <div className="mx-3 mt-2 h-[84px]">
        {state.selection.length > 0 ? (
          <div className="card flex h-full items-center gap-3 px-4">
            <span className={cx('min-w-0 flex-1 truncate', display === 'pinyin' ? 'font-display text-2xl font-semibold' : 'font-han text-4xl')}>
              {selectionText}
            </span>
            {state.ready && (
              <Button variant="primary" icon="check" onClick={() => dispatch({ type: 'submit', now: Date.now() })}>
                Word
              </Button>
            )}
            <button onClick={() => dispatch({ type: 'clear' })} className="rounded-full p-2 text-ink-soft" aria-label="Clear selection">
              <Icon name="x" />
            </button>
          </div>
        ) : last ? (
          <WordCard word={last.word} score={last.score} unplanned={last.unplanned} className="h-full" />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink-soft dark:text-ink-faint">
            {layout === 'path'
              ? 'Drag through touching tiles (diagonals count) to spell a word — or tap them one by one.'
              : 'Tap syllables in order to build a word.'}
          </div>
        )}
      </div>

      {/* toolbar */}
      <div className="safe-bottom mx-3 mt-2 grid grid-cols-4 gap-2">
        <ToolButton icon="clue" label={`Clue −${HINT_COST.clue}`} disabled={state.config.mode === 'clue' || state.status !== 'playing'} onClick={() => dispatch({ type: 'hint', kind: 'clue' })} />
        <ToolButton icon="eye" label={`Reveal −${HINT_COST.reveal}`} disabled={state.status !== 'playing' || !intactWords(state).length} onClick={() => dispatch({ type: 'hint', kind: 'reveal' })} />
        <ToolButton
          icon="shuffle"
          label="Shuffle"
          disabled={layout !== 'classic' || state.status !== 'playing'}
          onClick={() => {
            sfx.shuffle()
            dispatch({ type: 'shuffle' })
          }}
        />
        <ToolButton
          icon="flag"
          label={state.config.mode === 'blitz' ? 'Stop' : 'Give up'}
          disabled={state.status !== 'playing'}
          onClick={() => confirm('End this round?') && dispatch({ type: 'end', now: Date.now() })}
        />
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-6 bottom-28 z-50 rounded-xl bg-ink px-4 py-3 text-center text-sm text-paper shadow-lg dark:bg-paper dark:text-ink"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ToolButton({ icon, label, onClick, disabled }: { icon: IconName; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="card flex flex-col items-center gap-0.5 rounded-xl py-2 text-[11px] font-semibold text-ink-soft transition active:scale-95 disabled:opacity-35 dark:text-ink-faint"
    >
      <Icon name={icon} className="size-5" />
      {label}
    </button>
  )
}

export function shortMeaning(m: string): string {
  let first = m.split(/;\s*/)[0].replace(/\(.*?\)\s*/g, '').trim()
  if (first.length > 26) first = first.split(/,\s*/)[0]
  return first.length > 30 ? `${first.slice(0, 29)}…` : first || m
}
