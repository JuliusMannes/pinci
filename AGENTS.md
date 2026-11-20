# Pīncí 拼词 — agent notes

Mobile-first PWA (iPhone target) for reviewing Chinese vocabulary by assembling words from syllable tiles.

## Commands
- `npm run dev` — Vite dev server on all interfaces (open the LAN URL on the phone; service worker only works on localhost/HTTPS)
- `npm test` — Vitest (engine, pinyin, importer incl. the real tutoring-notes fixture)
- `npm run typecheck` — `tsc --noEmit` (TypeScript 7)
- `npm run build` / `npm run preview` — production build with service worker (vite-plugin-pwa, generateSW)
- `npm run data` — rebuilds `public/data/**` and `src/data/hsk-index.json` from `.cache/` (downloads HSK + CC-CEDICT on first run)
- `npm run icons` — re-renders `public/icons/*` (macOS only: uses `qlmanage` + `sips`; ImageMagick on this machine is broken)

Verify changes with: `npm run typecheck && npm test && npm run build`.

## Layout
- `src/engine/` — pure, framework-free game logic (board generation classic/path, matching, solver, scoring, Leitner SRS, `gameReducer`). Imports use explicit `.ts` extensions so `scripts/` can run them with Node's type stripping.
- `src/data/` — HSK deck loading, CC-CEDICT dictionary, notes importer (`import/parser.ts`), PDF text extraction (pdf.js legacy build, lazy).
- `src/db/` — Dexie (IndexedDB): imported decks/words, progress, round history.
- `src/store/` — zustand: persisted settings (`pinci-settings` in localStorage) and in-memory navigation.
- `src/ui/` — React screens/components; Tailwind v4 (CSS-first theme in `src/index.css`), Motion (`motion/react`).

## Conventions
- Tiles match on lowercase tone-marked pinyin (pinyin display) or hanzi (hanzi/both display). Words are 2–4 characters, one syllable per character.
- Word identity / progress key: `${hanzi}|${syllables.join(' ')}`.
- This laptop's `~/.npmrc` (company-managed) enforces `min-release-age=21` and a company registry mirror. Never override it (no `--before`, no `--registry`). Install with `npm install --omit-lockfile-registry-resolved …` so the lockfile has no mirror URLs and GitHub Actions can `npm ci` from public npm.
- Headless UI checks: drive `/Applications/Google Chrome.app` via CDP. `confirm()` dialogs can leave headless pages `visibilityState: hidden`.
