import { useEffect } from 'react'

/*
 * Freeze the page behind an open sheet. iPhone Safari ignores overflow:hidden on the body for touch
 * scrolling, so the body is pinned with position:fixed at its current offset and put back on close.
 * In Drunk Eyes the page scrolls inside #scroll-root instead, so that gets locked too.
 * Counted, so a sheet opened from another sheet doesn't unlock early.
 */
let locks = 0
let restore: (() => void) | null = null

export function useScrollLock() {
  useEffect(() => {
    if (locks++ === 0) {
      const y = window.scrollY
      const body = document.body.style
      const before = body.cssText
      Object.assign(body, { position: 'fixed', top: `-${y}px`, left: '0', right: '0', overflow: 'hidden' })
      const inner = document.getElementById('scroll-root')
      const innerBefore = inner?.style.overflowY ?? ''
      if (inner) inner.style.overflowY = 'hidden'
      restore = () => {
        body.cssText = before
        if (inner) inner.style.overflowY = innerBefore
        window.scrollTo(0, y)
      }
    }
    return () => {
      if (--locks === 0) {
        restore?.()
        restore = null
      }
    }
  }, [])
}
