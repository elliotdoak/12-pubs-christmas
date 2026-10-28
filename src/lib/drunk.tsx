import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { load, save } from './storage'

export const DRUNK_LEVELS = ['OFF', 'TIPSY', 'STEAMING', 'BLOOTERED'] as const
export type DrunkLevel = 0 | 1 | 2 | 3

interface DrunkCtx {
  level: DrunkLevel
  cycle: () => void
}

const Ctx = createContext<DrunkCtx | null>(null)

/**
 * Drunk Eyes: blurs and sways the whole app. Purely for laughs, saved per phone.
 * The wrapper is always rendered (only its classes change) so toggling never resets the screen.
 * CSS filters and transforms turn an element into the containing block for position:fixed children,
 * so when it's on, the filtered box is pinned to the screen and an inner box does the scrolling.
 * That keeps sheets and the tab bar where they belong.
 */
export function DrunkProvider({ children }: { children: ReactNode }) {
  const [level, setLevel] = useState<DrunkLevel>(() => load('drunk', 0 as DrunkLevel))
  const [hic, setHic] = useState(0)

  const cycle = () => {
    const next = ((level + 1) % 4) as DrunkLevel
    setLevel(next)
    save('drunk', next)
    if (next) setHic((h) => h + 1)
    navigator.vibrate?.(next ? [30, 60, 30] : 20)
  }

  // At BLOOTERED, the odd spontaneous hiccup
  useEffect(() => {
    if (level !== 3) return
    const id = setInterval(() => setHic((h) => h + 1), 20_000 + Math.random() * 15_000)
    return () => clearInterval(id)
  }, [level])

  return (
    <Ctx.Provider value={{ level, cycle }}>
      <DrunkFilters />
      {/* Outer box takes the filter (and so anchors fixed children to the screen); inner box scrolls */}
      <div className={level ? `drunk d${level} fixed inset-0 overflow-hidden` : ''}>
        <div className={level ? 'h-full overflow-y-auto overscroll-none' : ''}>{children}</div>
      </div>
      {level === 3 && <div className="drunk-vignette" aria-hidden="true" />}
      {hic > 0 && level > 0 && (
        <div key={hic} className="drunk-hic" aria-hidden="true">
          {hic === 1 ? 'woah steady big man!' : hic === 2 ? 'Christ you are so drunk!!' : 'Thats it, someone phone him a taxi'}
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useDrunk() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useDrunk must be used inside DrunkProvider')
  return v
}

/** Double-vision filter for BLOOTERED: a blurred copy drifting beside the original. */
function DrunkFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <filter id="double-vision" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feGaussianBlur in="SourceGraphic" stdDeviation="0.9" result="b" />
          <feOffset in="b" dx="7" dy="1" result="o">
            <animate attributeName="dx" values="8;16;4;18;8" dur="3.6s" repeatCount="indefinite" />
            <animate attributeName="dy" values="1;-3;2;-1;1" dur="5.2s" repeatCount="indefinite" />
          </feOffset>
          <feComponentTransfer in="o" result="oa">
            <feFuncA type="linear" slope="0.55" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="oa" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}
