import { useEffect, useRef, type ReactNode } from 'react'

/** Bottom sheet with a scrim, focus on open and Escape to close. */
export function Sheet({ label, onClose, children }: { label: string; onClose?: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
    if (!onClose) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-ink/70" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        className="anim-slideup max-h-[88dvh] w-full max-w-[430px] overflow-y-auto border-4 border-b-0 border-ink bg-wool text-ink outline-none"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        {children}
      </div>
    </div>
  )
}

export function SheetClose({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 border-4 border-ink bg-ink px-2 py-1 font-pix text-[12px] text-white">
      ✕
    </button>
  )
}
