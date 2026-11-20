import type { Word } from '../src/engine/types.ts'
import { wordKey } from '../src/engine/types.ts'
import { buildIndex } from '../src/engine/match.ts'
import { mulberry32 } from '../src/engine/rng.ts'
import type { GameContext } from '../src/engine/game.ts'

export function w(hanzi: string, pinyin: string, meaning = ''): Word {
  const syllables = pinyin.split(' ')
  return { key: wordKey(hanzi, syllables), hanzi, syllables, meaning, values: syllables.map(() => 1) }
}

export const POOL: Word[] = [
  w('老师', 'lǎo shī', 'teacher'),
  w('老板', 'lǎo bǎn', 'boss'),
  w('电脑', 'diàn nǎo', 'computer'),
  w('电视', 'diàn shì', 'television'),
  w('世界', 'shì jiè', 'world'),
  w('学生', 'xué sheng', 'student'),
  w('学校', 'xué xiào', 'school'),
  w('朋友', 'péng you', 'friend'),
  w('中国', 'zhōng guó', 'China'),
  w('天气', 'tiān qì', 'weather'),
  w('起床', 'qǐ chuáng', 'get up'),
  w('睡觉', 'shuì jiào', 'sleep'),
  w('喜欢', 'xǐ huan', 'like'),
  w('医生', 'yī shēng', 'doctor'),
  w('医院', 'yī yuàn', 'hospital'),
  w('图书馆', 'tú shū guǎn', 'library'),
  w('图书', 'tú shū', 'books'),
  w('飞机', 'fēi jī', 'airplane'),
  w('机场', 'jī chǎng', 'airport'),
  w('明天', 'míng tiān', 'tomorrow'),
  w('今天', 'jīn tiān', 'today'),
  w('昨天', 'zuó tiān', 'yesterday'),
]

export function ctxFor(pool: Word[], seed = 1): GameContext {
  return { pool, indexes: { pinyin: buildIndex(pool, 'pinyin'), hanzi: buildIndex(pool, 'hanzi') }, rng: mulberry32(seed) }
}
