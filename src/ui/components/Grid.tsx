import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import type { Bonus, Layout, Tile } from '../../engine/types.ts'
import type { GameAction, GameState } from '../../engine/game.ts'
import { isAdjacent } from '../../engine/board.ts'
import { toneOf } from '../../engine/pinyin.ts'
import type { Display } from '../../store/settings.ts'
import { useSettings } from '../../store/settings.ts'
import { sfx } from '../../audio/sfx.ts'
import { TONE_CLASS } from './Pinyin.tsx'
import { cx } from './ui.tsx'

/** Cell height relative to its width. */
export const CELL_ASPECT = 0.92

export const BONUS_LABEL: Record<Bonus, string> = { DL: '字×2', TL: '字×3', DW: '词×2', TW: '词×3' }
export const BONUS_CLASS: Record<Bonus, string> = {
  DL: 'bg-bonus-dl text-[#1d4a6b]',
  TL: 'bg-bonus-tl text-white',
  DW: 'bg-bonus-dw text-[#7a2430]',
  TW: 'bg-bonus-tw text-white',
}

export interface Flash {
  cells: number[]
  seq: number
}

export interface Floater {
  id: number
  cell: number
  text: string
  sub?: string
}

interface Props {
  state: GameState
  layout: Layout
  display: Display
  revealCells: number[]
  shake: Flash | null
  flash: Flash | null
  floaters: Floater[]
  width: number
  dispatch: (a: GameAction) => void
}

export function Grid({ state, layout, display, revealCells, shake, flash, floaters, width, dispatch }: Props) {
  const { rows, cols } = state.config
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef<{ start: number; path: number[]; dragging: boolean } | null>(null)
  const [, force] = useState(0)
  const height = width * (rows / cols) * CELL_ASPECT

  const cellAt = (e: ReactPointerEvent, strict: boolean): number | null => {
    const rect = ref.current!.getBoundingClientRect()
    const fx = ((e.clientX - rect.left) / rect.width) * cols
    const fy = ((e.clientY - rect.top) / rect.height) * rows
    const c = Math.floor(fx)
    const r = Math.floor(fy)
    if (c < 0 || r < 0 || c >= cols || r >= rows) return null
    // While dragging, only register a cell near its centre so diagonal moves don't clip neighbours.
    if (strict && Math.hypot(fx - c - 0.5, fy - r - 0.5) > 0.42) return null
    return r * cols + c
  }

  const onDown = (e: ReactPointerEvent) => {
    if (state.status !== 'playing') return
    const cell = cellAt(e, false)
    if (cell === null || !state.cells[cell]) return
    if (layout === 'classic') {
      sfx.select(state.selection.length)
      dispatch({ type: 'tap', cell, now: Date.now() })
      return
    }
    ref.current!.setPointerCapture(e.pointerId)
    drag.current = { start: cell, path: [cell], dragging: false }
  }

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    if (!d) return
    const cell = cellAt(e, true)
    if (cell === null) return
    const path = d.path
    const last = path[path.length - 1]
    if (cell === last) return
    if (path.length >= 2 && cell === path[path.length - 2]) {
      path.pop()
    } else if (!path.includes(cell) && state.cells[cell] && isAdjacent(last, cell, cols)) {
      path.push(cell)
      sfx.select(path.length - 1)
    } else return
    d.dragging = true
    dispatch({ type: 'path', cells: [...path] })
    force((n) => n + 1)
  }

  const onUp = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (d.dragging) dispatch({ type: 'release', now: Date.now() })
    else {
      sfx.select(state.selection.length)
      dispatch({ type: 'tap', cell: d.start, now: Date.now() })
    }
  }

  const center = (cell: number) => [(cell % cols) + 0.5, (Math.floor(cell / cols) + 0.5) * CELL_ASPECT] as const
  const pathD = (cells: number[]) => cells.map((c, i) => `${i ? 'L' : 'M'}${center(c).join(' ')}`).join(' ')

  return (
    <div
      ref={ref}
      className="no-select relative touch-none"
      style={{ width, height, containerType: 'inline-size' }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      {/* empty slots + bonus squares */}
      {state.cells.map((_, i) => (
        <div key={`slot-${i}`} className="absolute p-[3.5%]" style={pos(i, rows, cols)}>
          <div className="slot flex h-full w-full items-center justify-center">
            {state.bonuses[i] && (
              <span className={cx('rounded px-1 py-px text-[2.6cqw] font-bold opacity-60', BONUS_CLASS[state.bonuses[i]!])}>
                {BONUS_LABEL[state.bonuses[i]!]}
              </span>
            )}
          </div>
        </div>
      ))}

      <AnimatePresence>
        {state.cells.map((t, i) =>
          t ? (
            <TileView
              key={t.id}
              tile={t}
              cell={i}
              rows={rows}
              cols={cols}
              display={display}
              bonus={state.bonuses[i]}
              selected={state.selection.includes(i)}
              ready={state.ready && state.selection.includes(i)}
              revealed={revealCells.includes(i)}
              shakeSeq={shake?.cells.includes(i) ? shake.seq : 0}
            />
          ) : null,
        )}
      </AnimatePresence>

      <svg
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox={`0 0 ${cols} ${rows * CELL_ASPECT}`}
        preserveAspectRatio="none"
      >
        <defs>
          <filter id="brush" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="2" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="0.07" />
          </filter>
        </defs>
        {state.selection.length > 1 && (
          <path
            d={pathD(state.selection)}
            fill="none"
            stroke={state.ready ? 'var(--color-gold)' : 'var(--color-jade)'}
            strokeOpacity={0.55}
            strokeWidth={0.13}
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#brush)"
          />
        )}
        <AnimatePresence>
          {flash && flash.cells.length > 1 && (
            <motion.path
              key={flash.seq}
              d={pathD(flash.cells)}
              fill="none"
              stroke="var(--color-cinnabar)"
              strokeWidth={0.16}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#brush)"
              initial={{ pathLength: 0, opacity: 0.9 }}
              animate={{ pathLength: 1, opacity: [0.9, 0.9, 0], transition: { pathLength: { duration: 0.25 }, opacity: { duration: 1.1, times: [0, 0.5, 1] } } }}
              exit={{ opacity: 0 }}
            />
          )}
        </AnimatePresence>
      </svg>

      <AnimatePresence>
        {floaters.map((f) => (
          <motion.div
            key={f.id}
            className="pointer-events-none absolute z-30 flex flex-col items-center"
            style={{ ...pos(f.cell, rows, cols), height: 'auto' }}
            initial={{ opacity: 0, y: 0, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], y: -60, scale: 1, transition: { duration: 1.3, times: [0, 0.15, 0.7, 1] } }}
          >
            <span className="font-display text-[6cqw] font-bold text-cinnabar drop-shadow-[0_1px_0_white] dark:drop-shadow-none">{f.text}</span>
            {f.sub && <span className="rounded bg-ink/80 px-1.5 text-[3cqw] font-semibold text-paper">{f.sub}</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function pos(cell: number, rows: number, cols: number) {
  return {
    left: `${((cell % cols) / cols) * 100}%`,
    top: `${(Math.floor(cell / cols) / rows) * 100}%`,
    width: `${100 / cols}%`,
    height: `${100 / rows}%`,
  }
}

interface TileProps {
  tile: Tile
  cell: number
  rows: number
  cols: number
  display: Display
  bonus: Bonus | null
  selected: boolean
  ready: boolean
  revealed: boolean
  shakeSeq: number
}

function TileView({ tile, cell, rows, cols, display, bonus, selected, ready, revealed, shakeSeq }: TileProps) {
  const toneColors = useSettings((s) => s.toneColors)
  const unit = 100 / cols
  const toneClass = toneColors ? TONE_CLASS[toneOf(tile.syllable)] : ''
  const len = tile.syllable.length
  const pinyinSize = display === 'both' ? 0.17 : len > 5 ? 0.2 : len > 4 ? 0.23 : 0.26
  return (
    <motion.div
      layout="position"
      className="absolute z-10 p-[3.5%]"
      style={pos(cell, rows, cols)}
      initial={{ opacity: 0, y: -30, scale: 0.85 }}
      animate={{ opacity: 1, y: selected ? -4 : 0, scale: selected ? 1.04 : 1 }}
      exit={{ opacity: 0, scale: 0.3, rotate: tile.id % 2 ? 12 : -12, transition: { duration: 0.3 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 30, layout: { type: 'spring', stiffness: 380, damping: 32 } }}
    >
      <motion.div
        key={shakeSeq}
        animate={shakeSeq ? { x: [0, -7, 7, -5, 5, -2, 0] } : undefined}
        transition={{ duration: 0.4 }}
        className={cx(
          'tile relative flex h-full w-full flex-col items-center justify-center leading-none',
          selected && 'tile-selected',
          ready && 'tile-ready',
          revealed && !selected && 'tile-reveal',
        )}
      >
        {display !== 'pinyin' && (
          <span className={cx('font-han', display === 'hanzi' && toneClass)} style={{ fontSize: `${unit * (display === 'both' ? 0.38 : 0.5)}cqw` }}>
            {tile.hanzi}
          </span>
        )}
        {display !== 'hanzi' && (
          <span
            className={cx('font-display font-semibold tracking-tight', toneClass, display === 'both' && 'mt-[6%] opacity-80')}
            style={{ fontSize: `${unit * pinyinSize}cqw` }}
          >
            {tile.syllable}
          </span>
        )}
        <span className="absolute right-[9%] bottom-[7%] font-display font-semibold text-ink-faint" style={{ fontSize: `${unit * 0.11}cqw` }}>
          {tile.value}
        </span>
        {bonus && (
          <span
            className={cx('absolute -top-[7%] -left-[5%] -rotate-12 rounded-[3px] px-[4%] py-[1%] font-bold shadow-sm', BONUS_CLASS[bonus])}
            style={{ fontSize: `${unit * 0.1}cqw` }}
          >
            {BONUS_LABEL[bonus]}
          </span>
        )}
      </motion.div>
    </motion.div>
  )
}
