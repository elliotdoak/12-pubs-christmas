import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Called once 4 digits are in. Resolve to an error to shake and clear, '' to clear quietly, or null to leave as is. */
  onComplete: (pin: string) => Promise<string | null>
  disabled?: boolean
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '◀']

export function PinPad({ onComplete, disabled }: Props) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  const cb = useRef(onComplete)
  useEffect(() => {
    cb.current = onComplete
  })

  useEffect(() => {
    if (pin.length !== 4) return
    let live = true
    setBusy(true)
    cb.current(pin).then((msg) => {
      if (!live) return
      setBusy(false)
      if (msg !== null) {
        // '' = clear quietly (e.g. "now confirm it"); text = shake and show the error
        setErr(msg || null)
        if (msg) setShake((s) => s + 1)
        setPin('')
      }
    })
    return () => {
      live = false
    }
  }, [pin])

  const press = (k: string) => {
    if (busy || disabled) return
    setErr(null)
    if (k === 'C') setPin('')
    else if (k === '◀') setPin((p) => p.slice(0, -1))
    else setPin((p) => (p.length < 4 ? p + k : p))
  }

  // Hardware keyboards (desktop testing)
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key)
      else if (e.key === 'Backspace') press('◀')
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  return (
    <div className="flex flex-col items-center gap-5">
      <div key={shake} className={`flex gap-4 ${shake ? 'anim-shake' : ''}`} aria-label={`${pin.length} of 4 digits entered`} role="status">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={`block h-5 w-5 border-4 border-ink ${i < pin.length ? 'bg-yolk' : 'bg-wool'}`} />
        ))}
      </div>
      <div className="min-h-[40px] max-w-[300px] text-center font-pix text-[10px] leading-[16px] text-yolk" role="alert">
        {busy ? 'CHECKING…' : err}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {KEYS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => press(k)}
            disabled={busy || disabled}
            aria-label={k === 'C' ? 'Clear' : k === '◀' ? 'Delete' : k}
            className="h-16 w-20 border-4 border-ink bg-wool font-pix text-[18px] text-ink shadow-[4px_4px_0_var(--color-ink)] active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-60"
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}
