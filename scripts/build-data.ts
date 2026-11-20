/**
 * Builds the bundled vocabulary data:
 *  - public/data/hsk/<deck>.json   playable (2–4 character) words per HSK version/level
 *  - public/data/chars.json        per-character tile points + most common reading
 *  - public/data/cedict.txt        trimmed CC-CEDICT used by the importer
 *  - src/data/hsk-index.json       deck metadata (ids, word counts)
 *
 * Sources (downloaded into .cache/ on first run):
 *  - https://github.com/drkameleon/complete-hsk-vocabulary (complete.json)
 *  - https://www.mdbg.net/chinese/dictionary?page=cc-cedict
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { cedictToSyllables, parsePinyin, stripTones } from '../src/engine/pinyin.ts'

const HSK_URL = 'https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.json'
const CEDICT_URL = 'https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz'
const ROOT = new URL('..', import.meta.url).pathname
const CACHE = `${ROOT}.cache`
const HAN = /^\p{Script=Han}+$/u

async function cached(name: string, url: string, gz = false): Promise<string> {
  const path = `${CACHE}/${name}`
  if (!existsSync(path)) {
    mkdirSync(CACHE, { recursive: true })
    console.log(`downloading ${url}`)
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer())
    writeFileSync(path, gz ? gunzipSync(buf) : buf)
  }
  return readFileSync(path, 'utf8')
}

const cleanMeaning = (senses: string[], max = 90) => {
  const out = senses
    .map((s) =>
      s
        .replace(/\[[a-zA-Z0-9:, ]+\]/g, '')
        .replace(/\p{Script=Han}+\|(\p{Script=Han}+)/gu, '$1')
        .trim(),
    )
    .filter((s) => s && !/^(CL:|old variant|variant of|archaic variant|Japanese variant|see also|also written|also pr\.)/i.test(s))
    .slice(0, 3)
    .join('; ')
  return out.length > max ? `${out.slice(0, max - 1).replace(/[;,\s]+\S*$/, '')}…` : out
}

interface Reading {
  syllables: string[]
  meaning: string
  proper: boolean
}

function parseCedict(text: string): Map<string, Reading[]> {
  const dict = new Map<string, Reading[]>()
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue
    const m = line.match(/^\S+ (\S+) \[([^\]]+)\] \/(.*)\/\s*$/)
    if (!m) continue
    const [, simp, py, senses] = m
    if (!HAN.test(simp) || [...simp].length > 8) continue
    const syllables = cedictToSyllables(py)
    if (syllables.length !== [...simp].length) continue
    const meaning = cleanMeaning(senses.split('/'))
    if (!meaning) continue
    const proper = /^[A-Z]/.test(py)
    const list = dict.get(simp) ?? []
    if (!list.some((r) => r.syllables.join(' ') === syllables.join(' '))) list.push({ syllables, meaning, proper })
    dict.set(simp, list)
  }
  for (const list of dict.values()) list.sort((a, b) => Number(a.proper) - Number(b.proper))
  return dict
}

const flat = (s: string) => stripTones(s.toLowerCase()).replace(/[\s'’·-]/g, '')
const flatMarked = (s: string) => s.toLowerCase().normalize('NFC').replace(/[\s'’·-]/g, '')

interface HskEntry {
  simplified: string
  frequency: number
  level: string[]
  forms: { transcriptions: { pinyin: string; numeric: string }; meanings: string[] }[]
}

const VERSIONS = { old: 'hsk2', new: 'hsk3', newest: 'hsk2026' } as const

/** Everyday readings for polyphonic characters / particles where data-derived guesses go wrong. */
const COMMON_READINGS: Record<string, string> = {
  几: 'jǐ', 吗: 'ma', 呢: 'ne', 了: 'le', 的: 'de', 得: 'de', 地: 'de', 着: 'zhe', 过: 'guò', 弹: 'tán',
  还: 'hái', 都: 'dōu', 行: 'xíng', 长: 'cháng', 重: 'zhòng', 乐: 'lè', 觉: 'jué', 好: 'hǎo', 只: 'zhǐ',
  种: 'zhǒng', 少: 'shǎo', 便: 'biàn', 发: 'fā', 和: 'hé', 为: 'wèi', 没: 'méi', 要: 'yào', 看: 'kàn',
  教: 'jiāo', 数: 'shù', 假: 'jià', 空: 'kōng', 相: 'xiāng', 调: 'diào', 差: 'chà', 干: 'gàn', 量: 'liàng',
  中: 'zhōng', 当: 'dāng', 应: 'yīng', 分: 'fēn', 场: 'chǎng', 啊: 'a', 吧: 'ba', 呀: 'ya', 么: 'me',
  哪: 'nǎ', 那: 'nà', 这: 'zhè', 一: 'yī', 不: 'bù', 上: 'shàng', 下: 'xià', 说: 'shuō', 听: 'tīng',
  打: 'dǎ', 大: 'dà', 传: 'chuán', 处: 'chù', 系: 'xì', 背: 'bèi', 难: 'nán', 藏: 'cáng', 睡: 'shuì',
  卡: 'kǎ', 吐: 'tǔ', 喝: 'hē', 似: 'sì', 正: 'zhèng', 朝: 'cháo', 曾: 'céng',
}
const POINTS_BY_LEVEL = [0, 1, 2, 3, 4, 5, 6, 8]
export const UNKNOWN_CHAR_POINTS = 8

async function main() {
  const [hskText, cedictText] = await Promise.all([cached('complete.json', HSK_URL), cached('cedict.u8', CEDICT_URL, true)])
  const dict = parseCedict(cedictText)
  const hsk = JSON.parse(hskText) as HskEntry[]

  const decks = new Map<string, [string, string, string][]>()
  const charLevel = new Map<string, number>()
  const charReadings = new Map<string, Map<string, number>>()
  let skipped = 0

  for (const e of hsk) {
    const hanzi = e.simplified
    if (!HAN.test(hanzi)) continue
    const chars = [...hanzi]
    const form = e.forms[0]
    const hskPinyin = form.transcriptions.pinyin
    const readings = (dict.get(hanzi) ?? []).filter((r) => r.syllables.length === chars.length)
    const syllables =
      readings.find((r) => flatMarked(r.syllables.join('')) === flatMarked(hskPinyin))?.syllables ??
      parsePinyin(hskPinyin, chars.length) ??
      readings.find((r) => flat(r.syllables.join('')) === flat(hskPinyin))?.syllables ??
      readings[0]?.syllables
    if (!syllables || syllables.length !== chars.length) {
      skipped++
      continue
    }
    const meaning = cleanMeaning(form.meanings) || readings[0]?.meaning || ''
    // Make the HSK reading the dictionary's preferred one.
    const all = dict.get(hanzi) ?? []
    const at = all.findIndex((r) => r.syllables.join(' ') === syllables.join(' '))
    if (at > 0) all.unshift(...all.splice(at, 1))
    else if (at < 0) all.unshift({ syllables, meaning, proper: false })
    dict.set(hanzi, all)

    const newLevel = Math.min(...e.level.filter((l) => l.startsWith('new-')).map((l) => Number(l.split('-')[1])))
    const oldLevel = Math.min(...e.level.filter((l) => l.startsWith('old-')).map((l) => Number(l.split('-')[1])))
    const level = Number.isFinite(newLevel) ? newLevel : Number.isFinite(oldLevel) ? oldLevel : 7
    chars.forEach((ch, i) => {
      charLevel.set(ch, Math.min(charLevel.get(ch) ?? 99, level))
      const m = charReadings.get(ch) ?? new Map<string, number>()
      // A character's own HSK entry is the strongest signal for its everyday reading.
      m.set(syllables[i], (m.get(syllables[i]) ?? 0) + (chars.length === 1 ? 1000 : 1))
      charReadings.set(ch, m)
    })

    if (chars.length < 2 || chars.length > 4) continue
    for (const l of e.level) {
      const [v, n] = l.split('-') as [keyof typeof VERSIONS, string]
      const id = `${VERSIONS[v]}-${n}`
      const list = decks.get(id) ?? []
      list.push([hanzi, syllables.join(' '), meaning])
      decks.set(id, list)
    }
  }

  mkdirSync(`${ROOT}public/data/hsk`, { recursive: true })
  mkdirSync(`${ROOT}src/data`, { recursive: true })
  const index: { id: string; version: string; level: number; count: number }[] = []
  for (const [id, words] of [...decks].sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))) {
    writeFileSync(`${ROOT}public/data/hsk/${id}.json`, JSON.stringify(words))
    const [version, level] = id.split('-')
    index.push({ id, version, level: Number(level), count: words.length })
  }
  writeFileSync(`${ROOT}src/data/hsk-index.json`, JSON.stringify(index, null, 2) + '\n')

  const chars: Record<string, [number, string]> = {}
  for (const [ch, level] of charLevel) {
    const reading = COMMON_READINGS[ch] ?? [...charReadings.get(ch)!].sort((a, b) => b[1] - a[1])[0][0]
    chars[ch] = [POINTS_BY_LEVEL[Math.min(level, 7)], reading]
  }
  writeFileSync(`${ROOT}public/data/chars.json`, JSON.stringify(chars))

  const rank = new Map<string, number>()
  for (const e of hsk) if (HAN.test(e.simplified)) rank.set(e.simplified, Math.min(rank.get(e.simplified) ?? Infinity, e.frequency))
  const lines: string[] = []
  for (const [simp, list] of dict)
    list.forEach((r, i) => lines.push(`${simp}\t${r.syllables.join(' ')}\t${r.meaning}${i === 0 && rank.has(simp) ? `\t${rank.get(simp)}` : ''}`))
  writeFileSync(`${ROOT}public/data/cedict.txt`, lines.join('\n') + '\n')

  console.log(`hsk decks: ${index.map((d) => `${d.id}:${d.count}`).join(' ')}`)
  console.log(`skipped ${skipped} hsk entries, ${Object.keys(chars).length} chars, ${lines.length} dictionary lines`)
}

await main()
