import { motion } from 'motion/react'
import { cx } from './ui.tsx'

/** Red seal-stamp (印章) rendering of a word: 2–3 characters stacked, 4 characters in the classic 2×2 layout. */
export function Seal({ text, className, size = 96, animate = true }: { text: string; className?: string; size?: number; animate?: boolean }) {
  const chars = [...text]
  // Traditional seals read top-to-bottom, right-to-left.
  const cells = chars.length === 4 ? [chars[2], chars[0], chars[3], chars[1]] : chars
  const grid = chars.length === 4
  const fontSize = grid ? size * 0.36 : size / Math.max(chars.length, 2) * 0.82
  return (
    <motion.div
      className={cx('seal flex items-center justify-center font-han', className)}
      style={{ width: grid ? size : size * 0.62, height: size, fontSize }}
      initial={animate ? { scale: 1.9, opacity: 0, rotate: -16 } : false}
      animate={{ scale: 1, opacity: 0.95, rotate: -6 }}
      exit={{ opacity: 0, scale: 1.05, transition: { duration: 0.35 } }}
      transition={{ type: 'spring', stiffness: 700, damping: 22 }}
    >
      <div className={cx('grid leading-none', grid ? 'grid-cols-2 gap-[6%]' : 'grid-cols-1 gap-[2%]')}>
        {cells.map((c, i) => (
          <span key={i} className="text-center">
            {c}
          </span>
        ))}
      </div>
    </motion.div>
  )
}
