import { buildDict, type Dict } from './import/dict.ts'
import { loadChars } from './hsk.ts'

let dictPromise: Promise<Dict> | null = null

/** Lazily loads the ~7 MB CC-CEDICT extract (cached by the service worker after first use). */
export function loadDictionary(): Promise<Dict> {
  dictPromise ??= Promise.all([fetch(`${import.meta.env.BASE_URL}data/cedict.txt`).then((r) => r.text()), loadChars()])
    .then(([text, chars]) => buildDict(text, chars))
    .catch((e) => {
      dictPromise = null
      throw e
    })
  return dictPromise
}
