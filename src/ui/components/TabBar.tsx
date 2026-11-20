import { useNav, type Route } from '../../store/nav.ts'
import { Icon, type IconName } from './Icon.tsx'
import { cx } from './ui.tsx'

const TABS: { name: Route['name']; label: string; icon: IconName; match: Route['name'][] }[] = [
  { name: 'home', label: 'Play', icon: 'play', match: ['home'] },
  { name: 'decks', label: 'Decks', icon: 'decks', match: ['decks', 'deck', 'import'] },
  { name: 'stats', label: 'Progress', icon: 'stats', match: ['stats'] },
  { name: 'settings', label: 'Settings', icon: 'gear', match: ['settings'] },
]

export function TabBar() {
  const { route, go } = useNav()
  if (route.name === 'import') return null
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-black/5 bg-paper/90 backdrop-blur-md dark:border-white/5 dark:bg-night/90">
      <div className="mx-auto flex max-w-lg">
        {TABS.map((t) => (
          <button
            key={t.name}
            onClick={() => go({ name: t.name } as Route)}
            className={cx(
              'flex flex-1 flex-col items-center gap-0.5 pt-2 text-[11px] font-semibold',
              t.match.includes(route.name) ? 'text-cinnabar' : 'text-ink-soft dark:text-ink-faint',
            )}
          >
            <Icon name={t.icon} className="size-5.5" />
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
