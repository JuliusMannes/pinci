import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildDict } from '../src/data/import/dict.ts'
import { parseNotes, type Candidate } from '../src/data/import/parser.ts'

const root = new URL('..', import.meta.url).pathname
const dict = buildDict(readFileSync(`${root}public/data/cedict.txt`, 'utf8'), JSON.parse(readFileSync(`${root}public/data/chars.json`, 'utf8')))
const find = (cs: Candidate[], hanzi: string) => cs.find((c) => c.hanzi === hanzi)

describe('parseNotes: structured formats', () => {
  it('reads hanzi-only lists', () => {
    const cs = parseNotes('老师\n学生\n\n医生', dict)
    expect(cs.map((c) => c.hanzi)).toEqual(['老师', '学生', '医生'])
    expect(find(cs, '老师')).toMatchObject({ syllables: ['lǎo', 'shī'], source: 'dictionary', include: true })
  })

  it('reads hanzi + pinyin + meaning in many separators', () => {
    const text = [
      '1. 老师 lǎoshī teacher',
      '学生\txue2sheng5\tstudent',
      '医生, yī shēng, doctor',
      '电脑 - computer',
      '朋友：friend',
      'péngyou 朋友',
      '* 图书馆 (túshūguǎn) library',
    ].join('\n')
    const cs = parseNotes(text, dict)
    expect(find(cs, '老师')).toMatchObject({ syllables: ['lǎo', 'shī'], meaning: 'teacher', source: 'notes' })
    expect(find(cs, '学生')).toMatchObject({ syllables: ['xué', 'sheng'], meaning: 'student' })
    expect(find(cs, '医生')).toMatchObject({ meaning: 'doctor' })
    expect(find(cs, '电脑')).toMatchObject({ meaning: 'computer', syllables: ['diàn', 'nǎo'] })
    expect(find(cs, '朋友')).toMatchObject({ meaning: 'friend', count: 2 })
    expect(find(cs, '图书馆')).toMatchObject({ syllables: ['tú', 'shū', 'guǎn'], meaning: 'library' })
  })

  it('splits lists on Chinese punctuation and skips numbers', () => {
    const cs = parseNotes('老师、学生，医生；三十三 / 八百一十三', dict)
    expect(cs.map((c) => c.hanzi)).toEqual(['老师', '学生', '医生'])
  })
})

describe('parseNotes: messy tutoring notes', () => {
  const cs = parseNotes(readFileSync(`${root}tests/fixtures/amber-notes.txt`, 'utf8'), dict)

  it('picks up inline glosses', () => {
    expect(find(cs, '舒服')).toMatchObject({ meaning: 'comfortable', source: 'notes', include: true })
    expect(find(cs, '起床')).toMatchObject({ meaning: 'get up' })
    expect(find(cs, '空调')).toMatchObject({ meaning: 'AC' })
    expect(find(cs, '夏天')).toMatchObject({ meaning: 'summer' })
    expect(find(cs, '老公')).toMatchObject({ meaning: 'husband' })
    expect(find(cs, '老婆')).toMatchObject({ meaning: 'wife' })
    expect(find(cs, '技术')).toMatchObject({ meaning: 'skill' })
  })

  it('segments full sentences into dictionary words', () => {
    for (const w of ['篮球', '运动员', '女朋友', '新加坡', '小笼包', '兄弟姐妹', '周末', '工程师', '退休'])
      expect(find(cs, w), w).toBeDefined()
  })

  it('ignores whole-sentence translations and remarks', () => {
    expect(find(cs, '怎么样')?.meaning).not.toMatch(/recently/)
    expect(find(cs, '什么')?.meaning).not.toMatch(/weekend/)
    expect(find(cs, '你几岁了')?.meaning ?? '').not.toMatch(/under/)
  })

  it('does not produce bogus segmentations or numbers', () => {
    for (const w of ['你妈', '妈的', '我去', '二十八', '三十三', '八度', '三度']) expect(find(cs, w), w).toBeUndefined()
    for (const w of ['一样', '一会儿', '十分']) expect(find(cs, w), w).toBeDefined()
  })

  it('leaves names and phrases unchecked', () => {
    expect(find(cs, '林慧')).toMatchObject({ source: 'guessed', include: false })
    expect(find(cs, '弹钢琴')).toMatchObject({ source: 'phrase', include: false })
  })

  it('uses everyday readings for characters', () => {
    expect(find(cs, '今天周几')?.syllables).toEqual(['jīn', 'tiān', 'zhōu', 'jǐ'])
  })
})
