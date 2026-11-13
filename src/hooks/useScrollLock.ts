import { useEffect } from 'react'

/*
 * Freeze the page behind an open sheet. Scrolling is switched off on the page itself (iPhones respect
 * overflow:hidden on the root since iOS 16), and Sheet blocks drags on its backdrop. We don't pin the
 * body with position:fixed: in the installed iPhone app that shrinks the screen by the status bar's
 * height, leaving a gap under every sheet. In Drunk Eyes the page scrolls inside #scroll-root, so that's
 * locked too. Counted, so a sheet opened from another sheet doesn't unlock early.
 */
let locks = 0
let restore: (() => void) | null = null

export function useScrollLock() {
  useEffect(() => {
    if (locks++ === 0) {
      const els = [document.documentElement, document.body, document.getElementById('scroll-root')].filter(Boolean) as HTMLElement[]
      const before = els.map((el) => el.style.overflow)
      els.forEach((el) => (el.style.overflow = 'hidden'))
      restore = () => els.forEach((el, i) => (el.style.overflow = before[i]))
    }
    return () => {
      if (--locks === 0) {
        restore?.()
        restore = null
      }
    }
  }, [])
}
