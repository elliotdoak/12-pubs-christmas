/**
 * Alarm sound. Browsers only allow audio after the person has tapped something, so the first tap
 * anywhere in the app quietly unlocks a shared AudioContext that the alarm can use later.
 */
/** An alarm older than this is ignored, so opening the app later doesn't set it off. */
export const ALARM_LIVE_MS = 10 * 60_000

let ctx: AudioContext | null = null

function unlock() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    // No audio on this device; the alarm still flashes and vibrates
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlock, { passive: true })
  window.addEventListener('keydown', unlock)
}

/** Two-tone siren that loops until the returned function is called. */
export function playSiren(): () => void {
  unlock()
  if (!ctx) return () => {}
  const ac = ctx
  const gain = ac.createGain()
  gain.gain.value = 0.18
  gain.connect(ac.destination)
  const osc = ac.createOscillator()
  osc.type = 'square'
  osc.connect(gain)
  const start = ac.currentTime
  // Schedule two minutes of hi-lo tones up front; stopping cuts it short
  for (let i = 0; i < 340; i++) osc.frequency.setValueAtTime(i % 2 ? 660 : 880, start + i * 0.35)
  osc.start()
  osc.stop(start + 120)
  return () => {
    try {
      osc.stop()
    } catch {
      // already stopped
    }
    gain.disconnect()
  }
}
