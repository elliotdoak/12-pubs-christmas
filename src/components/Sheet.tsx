import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useScrollLock } from '../hooks/useScrollLock'

/** For full-screen overlays that render conditionally (the leave alarm). */
export function ScrollLock() {
  useScrollLock()
  return null
}

/** Bottom sheet with a scrim, focus on open and Escape to close. The page behind can't scroll. */
export function Sheet({ label, onClose, children }: { label: string; onClose?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const scrim = useRef<HTMLDivElement>(null)
  useScrollLock()
  // Drags on the dark backdrop must not reach the page. React's touch handlers are passive and can't
  // cancel a swipe, so this one is attached by hand. Swipes inside the sheet still scroll the sheet.
  useEffect(() => {
    const el = scrim.current
    if (!el) return
    const block = (e: TouchEvent) => {
      if (!ref.current?.contains(e.target as Node)) e.preventDefault()
    }
    el.addEventListener('touchmove', block, { passive: false })
    return () => el.removeEventListener('touchmove', block)
  }, [])
  useEffect(() => {
    ref.current?.focus()
    if (!onClose) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return createPortal(
    <div ref={scrim} className="fixed inset-0 z-30 flex items-end justify-center bg-ink/70" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="anim-slideup max-h-[88dvh] w-full max-w-[430px] overflow-y-auto overscroll-contain border-4 border-b-0 border-ink bg-wool text-ink outline-none"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>
    </div>,
    document.getElementById('overlay-root') ?? document.body,
  )
}

export function SheetClose({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 border-4 border-ink bg-ink px-2 py-1 font-pix text-[12px] text-white">
      ✕
    </button>
  )
}
