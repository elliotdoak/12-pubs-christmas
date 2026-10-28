import { useEffect, useRef, useState } from 'react'

/** Scale factor so a fixed-width design (e.g. the 390px map) fills its container's width. */
export function useScale<T extends HTMLElement>(designWidth: number) {
  const ref = useRef<T>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setScale(e.contentRect.width / designWidth))
    ro.observe(el)
    return () => ro.disconnect()
  }, [designWidth])
  return { ref, scale }
}
