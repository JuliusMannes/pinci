import { looksLikePinyin, parsePinyin } from '../../engine/pinyin.ts'
import type { Dict } from './dict.ts'

/**
 * notes: pinyin or meaning came from the file · dictionary: a dictionary word found in the text ·
 * phrase: a short standalone chunk made of several words · guessed: unknown characters (names, typos)
 */
export type CandidateSource = 'notes' | 'dictionary' | 'phrase' | 'guessed'

export interface Candidate {
  hanzi: string
  syllables: string[]
  meaning: string
  dictMeaning?: string
  source: CandidateSource
  include: boolean
  count: number
  line: number
}

const HAN_RUN = /\p{Script=Han}+/gu
const NUMERIC = /^[零〇一二三四五六七八九十百千万亿两几半第]+$/u
const NUMERAL_START = /^[零〇一二三四五六七八九十百千万两]/u
const MIN_LEN = 2
const MAX_LEN = 4
const MAX_GLOSS = 60
const SEP_CHARS = String.raw`\s:=\-–—~/\\|,;()\[\]{}<>*•·.。、，；：！？!?"'“”`
const LEAD_SEP = new RegExp(`^[${SEP_CHARS}]+`, 'u')
const TRAIL_SEP = new RegExp(`[${SEP_CHARS}]+$`, 'u')
const ENDS_WITH_SEP = new RegExp(`(^|[${SEP_CHARS}])$`, 'u')
const NUMBERING = /^\s*(\d+[.)、]|[-*•])\s*/

function normalize(text: string): string {
  return (
    text
      .normalize('NFC')
      // full-width ASCII -> ASCII
      .replace(/[\uff01-\uff5e]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
      .replace(/\u3000/g, ' ')
      .replace(/[’‘]/g, "'")
      // "你 周 末 做" -> "你周末做"
      .replace(/(?:\p{Script=Han}[ \t]+){2,}\p{Script=Han}/gu, (m) => m.replace(/[ \t]+/g, ''))
  )
}

const visualWidth = (s: string) => [...s].reduce((w, c) => w + (/[\p{Script=Han}\u3000-\u303f\uff00-\uffef]/u.test(c) ? 1 : 0.5), 0)
const WRAP_WIDTH = 18

/** Re-joins sentences that were hard-wrapped mid-word (typical for PDF / Word exports). */
function unwrap(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    const prev = out[out.length - 1]
    if (prev && /\p{Script=Han}$/u.test(prev) && /^\p{Script=Han}/u.test(line) && visualWidth(prev) >= WRAP_WIDTH)
      out[out.length - 1] = prev + line
    else out.push(line)
  }
  return out
}

/** Pulls an optional pinyin prefix and an English gloss out of the text that follows a hanzi run. */
function readTrailing(text: string, expectLens: number[]): { pinyin?: string[]; gloss?: string } {
  const t = text.replace(LEAD_SEP, '')
  const tokens = [...t.matchAll(/[^\s,;|\t/()（）[\]]+/g)]
  let pinyin: string[] | undefined
  let rest = t
  for (let k = Math.min(tokens.length, 6); k >= 1; k--) {
    const end = tokens[k - 1].index! + tokens[k - 1][0].length
    const cand = t.slice(0, end).replace(/[,;|\t/()（）[\]]/g, ' ')
    if (!looksLikePinyin(cand)) continue
    const parsed = expectLens.map((n) => parsePinyin(cand, n)).find(Boolean)
    if (parsed) {
      pinyin = parsed
      rest = t.slice(end)
      break
    }
  }
  const raw = rest.trim()
  let gloss = raw.replace(LEAD_SEP, '').replace(TRAIL_SEP, '').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim()
  // Remarks in brackets "(under 10)" and lone names "Julius" are not translations.
  if (!/[a-z]/i.test(gloss) || /^[(（[].*[)）\]]$/u.test(raw) || /^[A-Z][a-z]+$/.test(gloss)) gloss = ''
  if (gloss.length > MAX_GLOSS) gloss = `${gloss.slice(0, MAX_GLOSS - 1)}…`
  return { pinyin, gloss: gloss || undefined }
}

const UNKNOWN_CHAR_COST = 16

/** Unigram segmentation: minimizes the summed frequency cost of the pieces. */
function segment(run: string, dict: Dict): string[] {
  const chars = [...run]
  const n = chars.length
  const cost = Array<number>(n + 1).fill(Infinity)
  const back = Array<number>(n + 1).fill(0)
  cost[0] = 0
  for (let i = 1; i <= n; i++) {
    for (let j = Math.max(0, i - dict.maxLen); j < i; j++) {
      const piece = chars.slice(j, i).join('')
      const pieceCost = dict.cost(piece)
      if (!Number.isFinite(pieceCost) && i - j > 1) continue
      const c = cost[j] + (Number.isFinite(pieceCost) ? pieceCost : UNKNOWN_CHAR_COST)
      if (c < cost[i]) {
        cost[i] = c
        back[i] = j
      }
    }
  }
  const out: string[] = []
  for (let i = n; i > 0; i = back[i]) out.unshift(chars.slice(back[i], i).join(''))
  return out
}

interface Hit {
  hanzi: string
  pinyin?: string[]
  gloss?: string
  kind: 'word' | 'phrase'
}

/**
 * Turns free-form notes (lesson transcripts, vocab lists, CSV, Anki exports…) into word candidates.
 * Handles: one word per line, "hanzi pinyin meaning", "hanzi：meaning", "pinyin hanzi", tone numbers,
 * full sentences with inline glosses ("你几点起床 get up?"), spaced-out characters, numbering, mixed punctuation.
 */
export function parseNotes(input: string, dict: Dict): Candidate[] {
  const byHanzi = new Map<string, Candidate>()
  const lines = unwrap(normalize(input).split(/\r?\n/))

  lines.forEach((line, lineNo) => {
    const runs = [...line.matchAll(HAN_RUN)]
    runs.forEach((m, r) => {
      const run = m[0]
      const start = m.index!
      const end = start + run.length
      const nextStart = r + 1 < runs.length ? runs[r + 1].index! : line.length
      const runLen = [...run].length
      const pieces = segment(run, dict)
      const last = pieces[pieces.length - 1]
      const trailing = line.slice(end, nextStart)
      let { pinyin, gloss } = readTrailing(trailing, [...new Set([runLen, [...last].length])])
      if (r === 0 && !pinyin) {
        const lead = line.slice(0, start).replace(NUMBERING, '').replace(TRAIL_SEP, '')
        if (looksLikePinyin(lead)) pinyin = parsePinyin(lead, runLen) ?? undefined
      }
      const inRange = runLen >= MIN_LEN && runLen <= MAX_LEN
      const hits: Hit[] = []

      if (pinyin?.length === runLen && inRange) {
        hits.push({ hanzi: run, pinyin, gloss, kind: dict.lookup(run) ? 'word' : 'phrase' })
      } else {
        const before = line.slice(0, start)
        const standalone =
          (ENDS_WITH_SEP.test(before) || NUMBERING.test(before)) && (!/[\p{L}\d]/u.test(trailing) || !!gloss)
        const isPhrase = standalone && inRange && !dict.lookup(run) && pieces.some((p) => [...p].length === 1)
        const glossWords = gloss ? gloss.split(/\s+/).filter((w) => /[a-z]/i.test(w)).length : 0
        const lastIsChar = [...last].length === 1
        if (isPhrase) {
          // A one-word gloss right after the phrase usually explains just its last word ("我去找 find").
          const forLast = glossWords === 1 && (lastIsChar || !!dict.lookup(last))
          hits.push({ hanzi: run, gloss: forLast ? undefined : gloss, kind: 'phrase' })
          if (!forLast || lastIsChar) gloss = undefined
        } else if (glossWords >= 3 && pieces.length > 1) {
          // Whole-sentence translation, not a word gloss.
          gloss = undefined
        }
        pieces.forEach((p, i) => {
          if (!dict.lookup(p)) return
          const isLast = i === pieces.length - 1
          hits.push({
            hanzi: p,
            pinyin: isLast && pinyin?.length === [...p].length ? pinyin : undefined,
            gloss: isLast ? gloss : undefined,
            kind: 'word',
          })
        })
      }
      for (const h of hits) addHit(byHanzi, h, lineNo + 1, dict)
    })
  })
  return [...byHanzi.values()].sort((a, b) => a.line - b.line)
}

function readingOf(hanzi: string, dict: Dict): string[] | undefined {
  const out: string[] = []
  for (const piece of segment(hanzi, dict)) {
    const known = [...piece].length > 1 ? dict.lookup(piece)?.[0]?.syllables : undefined
    const r = known ?? [dict.charReading(piece)]
    if (r.some((s) => !s)) return undefined
    out.push(...(r as string[]))
  }
  return out
}

function addHit(map: Map<string, Candidate>, h: Hit, line: number, dict: Dict) {
  const chars = [...h.hanzi]
  if (chars.length < MIN_LEN || chars.length > MAX_LEN || NUMERIC.test(h.hanzi)) return
  // "二十八度" -> "八度 (octave)": number-led chunks are only kept when they're everyday words (一样, 十分…).
  if (NUMERAL_START.test(h.hanzi) && !dict.isCommon(h.hanzi) && !h.gloss && !h.pinyin) return
  const entry = dict.lookup(h.hanzi)?.[0]
  const existing = map.get(h.hanzi)
  if (existing) {
    existing.count++
    if (h.gloss && existing.source !== 'notes') {
      existing.meaning = h.gloss
      existing.source = 'notes'
      existing.include = true
    }
    if (h.pinyin) existing.syllables = h.pinyin
    return
  }
  const syllables = h.pinyin ?? entry?.syllables ?? readingOf(h.hanzi, dict)
  if (!syllables || syllables.length !== chars.length) return
  const containsWord = segment(h.hanzi, dict).some((p) => [...p].length > 1)
  const source: Candidate['source'] =
    h.gloss || h.pinyin ? 'notes' : entry ? 'dictionary' : h.kind === 'phrase' && containsWord ? 'phrase' : 'guessed'
  map.set(h.hanzi, {
    hanzi: h.hanzi,
    syllables,
    meaning: h.gloss ?? entry?.meaning ?? '',
    dictMeaning: entry?.meaning,
    source,
    include: source === 'notes' || source === 'dictionary',
    count: 1,
    line,
  })
}
