const PATHS = {
  back: 'M15 18l-6-6 6-6',
  speaker: 'M11 5L6 9H3v6h3l5 4V5z M15.5 8.5a5 5 0 010 7 M18.5 5.5a9 9 0 010 13',
  clue: 'M9 18h6 M10 21h4 M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.2 1.1 2h5c.1-.8.5-1.5 1.1-2A6 6 0 0012 3z',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 15a3 3 0 100-6 3 3 0 000 6z',
  shuffle: 'M16 3h5v5 M4 20L21 3 M21 16v5h-5 M15 15l6 6 M4 4l5 5',
  flag: 'M4 22V4 M4 4h13l-2 4 2 4H4',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12 M18 6L6 18',
  home: 'M3 11l9-8 9 8 M5 9.5V21h5v-6h4v6h5V9.5',
  decks: 'M12 3l9 5-9 5-9-5 9-5z M3 13l9 5 9-5 M3 17.5l9 5 9-5',
  stats: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  plus: 'M12 5v14 M5 12h14',
  upload: 'M12 16V4 M7 9l5-5 5 5 M4 16v4h16v-4',
  trash: 'M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z M13.5 6.5l4 4',
  play: 'M7 4.5v15l12.5-7.5L7 4.5z',
  chevron: 'M9 6l6 6-6 6',
  flame: 'M12 22c4 0 7-2.7 7-6.8 0-3.3-2.2-5.8-4-7.7-.4 2-1.5 3.3-2.6 3.7.3-3.3-1-6.4-4.1-9.2.3 3.6-1.9 6-3.3 8.1C4.1 11.6 5 13.3 5 15.2 5 19.3 8 22 12 22z',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18z M12 7v5l3 2',
  calendar: 'M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'size-5', strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={name === 'play' ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
