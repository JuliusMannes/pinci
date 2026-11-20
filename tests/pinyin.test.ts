import { describe, expect, it } from 'vitest'
import { cedictToSyllables, looksLikePinyin, numericToMarks, parsePinyin, stripTones, toneOf } from '../src/engine/pinyin.ts'

describe('pinyin', () => {
  it('converts tone numbers to marks', () => {
    expect(numericToMarks('hao3')).toBe('hǎo')
    expect(numericToMarks('lu:4')).toBe('lǜ')
    expect(numericToMarks('lv4')).toBe('lǜ')
    expect(numericToMarks('gou3')).toBe('gǒu')
    expect(numericToMarks('gui4')).toBe('guì')
    expect(numericToMarks('liu2')).toBe('liú')
    expect(numericToMarks('ma5')).toBe('ma')
    expect(numericToMarks('Xin1')).toBe('Xīn')
    expect(numericToMarks('er4')).toBe('èr')
  })

  it('reads tones and strips them', () => {
    expect(toneOf('shī')).toBe(1)
    expect(toneOf('lǚ')).toBe(3)
    expect(toneOf('de')).toBe(5)
    expect(stripTones('lǚxíng')).toBe('lüxing')
  })

  it('parses many pinyin formats', () => {
    expect(parsePinyin('lǎo shī')).toEqual(['lǎo', 'shī'])
    expect(parsePinyin('lǎoshī')).toEqual(['lǎo', 'shī'])
    expect(parsePinyin('lao3 shi1')).toEqual(['lǎo', 'shī'])
    expect(parsePinyin('lao3shi1')).toEqual(['lǎo', 'shī'])
    expect(parsePinyin("Xī'ān")).toEqual(['xī', 'ān'])
    expect(parsePinyin('xian', 2)).toEqual(['xi', 'an'])
    expect(parsePinyin('túshūguǎn')).toEqual(['tú', 'shū', 'guǎn'])
    expect(parsePinyin('yīhuìr', 3)).toEqual(['yī', 'huì', 'r'])
    expect(parsePinyin('hello world')).toBeNull()
  })

  it('detects pinyin vs english glosses', () => {
    expect(looksLikePinyin('shūfu')).toBe(true)
    expect(looksLikePinyin('shu1 fu5')).toBe(true)
    expect(looksLikePinyin('comfortable')).toBe(false)
    expect(looksLikePinyin('AC')).toBe(false)
  })

  it('converts cedict readings', () => {
    expect(cedictToSyllables('Xin1 jia1 po1')).toEqual(['xīn', 'jiā', 'pō'])
    expect(cedictToSyllables('yi1 hui4 r5')).toEqual(['yī', 'huì', 'r'])
  })
})
