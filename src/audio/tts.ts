let voice: SpeechSynthesisVoice | null | undefined

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices()
  const zh = voices.filter((v) => /^zh[-_](CN|Hans)/i.test(v.lang) || v.lang === 'zh')
  return zh.find((v) => v.localService) ?? zh[0] ?? voices.find((v) => v.lang.startsWith('zh')) ?? null
}

export const ttsAvailable = () => typeof speechSynthesis !== 'undefined'

export function speak(text: string) {
  if (!ttsAvailable()) return
  if (voice === undefined || voice === null) voice = pickVoice()
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = voice?.lang ?? 'zh-CN'
  if (voice) u.voice = voice
  u.rate = 0.85
  speechSynthesis.speak(u)
}

if (ttsAvailable()) speechSynthesis.addEventListener?.('voiceschanged', () => (voice = pickVoice()))
