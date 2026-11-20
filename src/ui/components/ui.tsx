import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { Icon, type IconName } from './Icon.tsx'
import { useNav } from '../../store/nav.ts'

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName }) {
  return (
    <button
      {...rest}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100',
        variant === 'primary' && 'bg-cinnabar text-white shadow-[0_3px_0_#7d1f19,0_8px_16px_-6px_rgb(184_50_42/0.6)] active:translate-y-px',
        variant === 'secondary' && 'bg-white/70 text-ink ring-1 ring-black/10 dark:bg-night-3 dark:text-paper dark:ring-white/10',
        variant === 'ghost' && 'text-ink-soft hover:bg-black/5 dark:text-ink-faint dark:hover:bg-white/5',
        variant === 'danger' && 'bg-cinnabar/10 text-cinnabar ring-1 ring-cinnabar/30',
        className,
      )}
    >
      {icon && <Icon name={icon} className="size-4.5" />}
      {children}
    </button>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: ReactNode }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cx('flex rounded-xl bg-black/5 p-1 dark:bg-white/5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition',
            o.value === value ? 'bg-white text-ink shadow-sm dark:bg-night-3 dark:text-paper' : 'text-ink-soft dark:text-ink-faint',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-xs text-ink-soft dark:text-ink-faint">{hint}</span>}
      </span>
      <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-jade' : 'bg-black/15 dark:bg-white/15')}>
        <span className={cx('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-5.5' : 'left-0.5')} />
      </span>
    </button>
  )
}

export function Checkbox({ checked, onChange, className }: { checked: boolean; onChange: (v: boolean) => void; className?: string }) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      className={cx(
        'flex size-6 shrink-0 items-center justify-center rounded-md ring-1 transition',
        checked ? 'bg-jade text-white ring-jade' : 'bg-white/60 ring-black/20 dark:bg-white/5 dark:ring-white/20',
        className,
      )}
    >
      {checked && <Icon name="check" className="size-4" strokeWidth={2.6} />}
    </button>
  )
}

export function Header({ title, subtitle, back = true, right }: { title: ReactNode; subtitle?: ReactNode; back?: boolean; right?: ReactNode }) {
  const go = useNav((s) => s.go)
  return (
    <header className="safe-top sticky top-0 z-20 -mx-4 mb-3 flex items-center gap-2 bg-paper/85 px-4 pb-2 backdrop-blur dark:bg-night/85">
      {back && (
        <button onClick={() => go({ name: 'home' })} className="-ml-2 rounded-full p-2 text-ink-soft dark:text-ink-faint" aria-label="Back">
          <Icon name="back" className="size-6" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-xl font-semibold">{title}</h1>
        {subtitle && <p className="truncate text-xs text-ink-soft dark:text-ink-faint">{subtitle}</p>}
      </div>
      {right}
    </header>
  )
}

export function Section({ title, children, action }: { title?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mb-5">
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold tracking-wider text-ink-soft uppercase dark:text-ink-faint">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function ProgressBar({ parts, className }: { parts: { value: number; className: string }[]; className?: string }) {
  const total = Math.max(1, parts.reduce((s, p) => s + p.value, 0))
  return (
    <div className={cx('flex h-1.5 overflow-hidden rounded-full bg-black/8 dark:bg-white/8', className)}>
      {parts.map((p, i) => (
        <div key={i} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} />
      ))}
    </div>
  )
}
