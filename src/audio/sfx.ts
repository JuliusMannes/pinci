import { useSettings } from '../store/settings.ts'

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (!useSettings.getState().sound) return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Short filtered noise burst + body resonance: a wooden tile "clack". */
function clack(ac: AudioContext, at: number, pitch = 1, gain = 0.35) {
  const len = 0.06
  const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * len), ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 4)
  const src = ac.createBufferSource()
  src.buffer = buf
  const bp = ac.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 1800 * pitch
  bp.Q.value = 3
  const g = ac.createGain()
  g.gain.value = gain
  src.connect(bp).connect(g).connect(ac.destination)
  src.start(at)

  const osc = ac.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(420 * pitch, at)
  osc.frequency.exponentialRampToValueAtTime(260 * pitch, at + 0.08)
  const og = ac.createGain()
  og.gain.setValueAtTime(gain * 0.5, at)
  og.gain.exponentialRampToValueAtTime(0.001, at + 0.1)
  osc.connect(og).connect(ac.destination)
  osc.start(at)
  osc.stop(at + 0.12)
}

function bell(ac: AudioContext, freq: number, at: number, dur = 0.6, gain = 0.18) {
  for (const [mult, g] of [
    [1, 1],
    [2.76, 0.25],
    [5.4, 0.08],
  ] as const) {
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq * mult
    const env = ac.createGain()
    env.gain.setValueAtTime(0.0001, at)
    env.gain.exponentialRampToValueAtTime(gain * g, at + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
    osc.connect(env).connect(ac.destination)
    osc.start(at)
    osc.stop(at + dur + 0.05)
  }
}

// Major pentatonic, rising with the combo streak.
const PENTA = [0, 2, 4, 7, 9]
const noteFor = (step: number) => 523.25 * Math.pow(2, (PENTA[step % 5] + 12 * Math.floor(step / 5)) / 12)

export const sfx = {
  select(index = 0) {
    const ac = audio()
    if (ac) clack(ac, ac.currentTime, 1 + index * 0.06)
  },
  match(streak: number) {
    const ac = audio()
    if (!ac) return
    const t = ac.currentTime
    clack(ac, t, 1.2, 0.3)
    bell(ac, noteFor(Math.min(streak, 9)), t + 0.03)
    bell(ac, noteFor(Math.min(streak, 9) + 2), t + 0.12, 0.7, 0.12)
  },
  miss() {
    const ac = audio()
    if (!ac) return
    const t = ac.currentTime
    const osc = ac.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(180, t)
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.18)
    const g = ac.createGain()
    g.gain.setValueAtTime(0.3, t)
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22)
    osc.connect(g).connect(ac.destination)
    osc.start(t)
    osc.stop(t + 0.25)
    clack(ac, t, 0.6, 0.25)
  },
  win() {
    const ac = audio()
    if (!ac) return
    const t = ac.currentTime
    ;[0, 1, 2, 3, 4, 5, 7].forEach((s, i) => bell(ac, noteFor(s), t + i * 0.09, 1.2, 0.14))
  },
  shuffle() {
    const ac = audio()
    if (!ac) return
    for (let i = 0; i < 6; i++) clack(ac, ac.currentTime + i * 0.035 + Math.random() * 0.02, 0.8 + Math.random() * 0.5, 0.18)
  },
}
