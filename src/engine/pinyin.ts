const SYLLABLE_LIST =
  'a ai an ang ao ba bai ban bang bao bei ben beng bi bian biang biao bie bin bing bo bu ca cai can cang cao ce cen ceng cha chai chan chang chao che chen cheng chi chong chou chu chuai chuan chuang chui chun chuo ci cong cou cu cuan cui cun cuo da dai dan dang dao de dei den deng di dian diao die ding diu dong dou du duan dui dun duo e ei en eng er fa fan fang fei fen feng fo fou fu ga gai gan gang gao ge gei gen geng gong gou gu gua guai guan guang gui gun guo ha hai han hang hao he hei hen heng hm hng hong hou hu hua huai huan huang hui hun huo ji jia jian jiang jiao jie jin jing jiong jiu ju juan jue jun ka kai kan kang kao ke kei ken keng kong kou ku kua kuai kuan kuang kui kun kuo la lai lan lang lao le lei leng li lia lian liang liao lie lin ling liu lo long lou lu luan lun luo lü lüe m ma mai man mang mao me mei men meng mi mian miao mie min ming miu mo mou mu n na nai nan nang nao ne nei nen neng ng ni nian niang niao nie nin ning niu nong nou nu nuan nuo nü nüe o ou pa pai pan pang pao pei pen peng pi pian piao pie pin ping po pou pu qi qia qian qiang qiao qie qin qing qiong qiu qu quan que qun r ran rang rao re ren reng ri rong rou ru ruan rui run ruo sa sai san sang sao se sen seng sha shai shan shang shao she shei shen sheng shi shou shu shua shuai shuan shuang shui shun shuo si song sou su suan sui sun suo ta tai tan tang tao te teng ti tian tiao tie ting tong tou tu tuan tui tun tuo wa wai wan wang wei wen weng wo wu xi xia xian xiang xiao xie xin xing xiong xiu xu xuan xue xun ya yan yang yao ye yi yin ying yo yong you yu yuan yue yun za zai zan zang zao ze zei zen zeng zha zhai zhan zhang zhao zhe zhei zhen zheng zhi zhong zhou zhu zhua zhuai zhuan zhuang zhui zhun zhuo zi zong zou zu zuan zui zun zuo'

export const SYLLABLES: ReadonlySet<string> = new Set(SYLLABLE_LIST.split(' '))
const MAX_SYLLABLE = 6
const RARE = new Set(['m', 'n', 'ng', 'hm', 'hng', 'r', 'o', 'e', 'ei', 'yo', 'lo'])

const TONE_MARKS: Record<string, string[]> = {
  a: ['ā', 'á', 'ǎ', 'à'],
  e: ['ē', 'é', 'ě', 'è'],
  i: ['ī', 'í', 'ǐ', 'ì'],
  o: ['ō', 'ó', 'ǒ', 'ò'],
  u: ['ū', 'ú', 'ǔ', 'ù'],
  ü: ['ǖ', 'ǘ', 'ǚ', 'ǜ'],
}

const COMBINING_TONE: Record<string, number> = { '\u0304': 1, '\u0301': 2, '\u030c': 3, '\u0300': 4 }

export type Tone = 1 | 2 | 3 | 4 | 5

/** "lu:4" / "lv4" / "hao3" / "ma5" -> "lǜ" / "hǎo" / "ma". Case is preserved. */
export function numericToMarks(syllable: string): string {
  const m = syllable.match(/^([a-zA-ZüÜ:]+)([1-5])$/)
  const base = (m ? m[1] : syllable).replace(/u:/g, 'ü').replace(/U:/g, 'Ü').replace(/v/g, 'ü').replace(/V/g, 'Ü')
  const tone = m ? Number(m[2]) : 5
  if (tone === 5) return base
  const lower = base.toLowerCase()
  let idx = lower.search(/[ae]/)
  if (idx < 0) idx = lower.indexOf('ou')
  if (idx < 0) {
    for (let i = lower.length - 1; i >= 0; i--) {
      if ('iouü'.includes(lower[i])) {
        idx = i
        break
      }
    }
  }
  if (idx < 0) return base
  const marked = TONE_MARKS[lower[idx]][tone - 1]
  const out = base[idx] === lower[idx] ? marked : marked.toUpperCase()
  return base.slice(0, idx) + out + base.slice(idx + 1)
}

export function toneOf(syllable: string): Tone {
  for (const ch of syllable.normalize('NFD')) {
    const t = COMBINING_TONE[ch]
    if (t) return t as Tone
  }
  return 5
}

/** Removes tone marks but keeps ü. */
export function stripTones(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300\u0301\u0304\u030c]/g, '')
    .normalize('NFC')
}

/** Lowercase, NFC, ü normalized — canonical form used for tiles. */
export function normalizeSyllable(s: string): string {
  return s.normalize('NFC').toLowerCase().trim()
}

const HAS_TONE_MARK = /[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/i
const PINYIN_CHARS = /^[a-zA-ZüÜāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜĀÁǍÀĒÉĚÈĪÍǏÌŌÓǑÒŪÚǓÙ:'’\-\s1-5]+$/

/** Split a single toneless-or-marked run like "lǎoshī" into syllables. Optionally force a syllable count. */
function segmentRun(run: string, expected?: number): string[] | null {
  const plain = stripTones(run.toLowerCase())
  if (plain.length !== run.length) return null
  const n = plain.length
  // Cheapest split of plain[i:]: each syllable costs 1, interjection-like syllables cost extra.
  type Split = { lens: number[]; cost: number }
  const memo = new Map<string, Split | null>()
  const solve = (i: number, left: number | undefined): Split | null => {
    if (i === n) return left === undefined || left === 0 ? { lens: [], cost: 0 } : null
    if (left !== undefined && left <= 0) return null
    const key = `${i}:${left}`
    if (memo.has(key)) return memo.get(key)!
    let best: Split | null = null
    for (let len = Math.min(MAX_SYLLABLE, n - i); len >= 1; len--) {
      const syl = plain.slice(i, i + len)
      if (!SYLLABLES.has(syl)) continue
      const rest = solve(i + len, left === undefined ? undefined : left - 1)
      const cost = rest ? rest.cost + 1 + (RARE.has(syl) ? 10 : 0) : Infinity
      if (rest && (!best || cost < best.cost)) best = { lens: [len, ...rest.lens], cost }
    }
    memo.set(key, best)
    return best
  }
  const lens = solve(0, expected)?.lens
  if (!lens) return null
  const out: string[] = []
  let i = 0
  for (const len of lens) {
    out.push(run.slice(i, i + len))
    i += len
  }
  return out
}

/**
 * Parse a pinyin string in any common format into lowercase, tone-marked syllables.
 * Accepts "lǎo shī", "lǎoshī", "lao3 shi1", "lao3shi1", "Xī'ān". Returns null if it isn't pinyin.
 */
export function parsePinyin(input: string, expected?: number): string[] | null {
  const text = input.normalize('NFC').trim().replace(/u:/gi, 'ü').replace(/v/gi, 'ü')
  if (!text || !PINYIN_CHARS.test(text)) return null
  const tokens = text.split(/[\s'’\-]+/).filter(Boolean)
  const pieces: { raw: string; numeric: boolean }[] = []
  for (const tok of tokens) {
    if (/\d/.test(tok)) {
      const parts = tok.match(/[a-zA-Zü]+[1-5]?/g)
      if (!parts || parts.join('') !== tok) return null
      for (const p of parts) pieces.push({ raw: p, numeric: true })
    } else pieces.push({ raw: tok, numeric: false })
  }
  const result: string[] = []
  for (let k = 0; k < pieces.length; k++) {
    const { raw, numeric } = pieces[k]
    if (numeric) {
      const base = raw.replace(/[1-5]$/, '').toLowerCase()
      if (SYLLABLES.has(base)) {
        result.push(normalizeSyllable(numericToMarks(raw)))
        continue
      }
      const seg = segmentRun(base)
      if (!seg) return null
      const tone = raw.match(/[1-5]$/)?.[0] ?? ''
      seg.forEach((s, j) => result.push(normalizeSyllable(j === seg.length - 1 ? numericToMarks(s + tone) : s)))
      continue
    }
    const seg = segmentRun(raw, expected !== undefined && pieces.length === 1 ? expected : undefined)
    if (!seg) return null
    result.push(...seg.map(normalizeSyllable))
  }
  if (expected !== undefined && result.length !== expected) {
    const joined = segmentRun(tokens.join(''), expected)
    if (joined && !/\d/.test(text)) return joined.map(normalizeSyllable)
    return null
  }
  return result
}

export function looksLikePinyin(s: string): boolean {
  const t = s.trim()
  if (!t || !PINYIN_CHARS.test(t)) return false
  if (HAS_TONE_MARK.test(t) || /[a-z][1-5]/i.test(t)) return parsePinyin(t) !== null
  return false
}

export function cedictToSyllables(numeric: string): string[] {
  return numeric
    .split(/\s+/)
    .filter(Boolean)
    .map((s) => normalizeSyllable(numericToMarks(s)))
}
