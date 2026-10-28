import { useEffect, useRef, useState } from 'react'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { load, save } from '../lib/storage'

/** The Game Master's announcement, pinned to the top of every screen until dismissed. */
export function Announcement() {
  const { playerId, isGm } = useSession()
  const { game } = useGameCtx()
  const { announcement, announced_at } = game.settings
  const [dismissed, setDismissed] = useState<string | null>(() => load('dismissedAnnouncement', null))
  const lastSeen = useRef<string | null>(null)

  const show = !!announcement && !!announced_at && dismissed !== announced_at && (!!playerId || isGm)

  // Buzz once when a new one lands
  useEffect(() => {
    if (show && announced_at !== lastSeen.current) {
      lastSeen.current = announced_at
      navigator.vibrate?.([120, 60, 120])
    }
  }, [show, announced_at])

  if (!show) return null

  const close = () => {
    save('dismissedAnnouncement', announced_at)
    setDismissed(announced_at)
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-2" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 8px)' }}>
      <div role="alert" className="anim-pop pointer-events-auto flex w-full max-w-[414px] items-start gap-3 border-4 border-ink bg-yolk p-3 text-ink shadow-[4px_4px_0_var(--color-ink)]">
        <div className="min-w-0 flex-1">
          <div className="font-pix text-[9px] text-red">
            GAME MASTER · {new Date(announced_at!).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })}
          </div>
          <p className="m-0 mt-1 text-[17px] font-bold leading-[21px]">{announcement}</p>
        </div>
        <button type="button" onClick={close} aria-label="Dismiss announcement" className="shrink-0 border-[3px] border-ink bg-ink px-2 py-1 font-pix text-[11px] text-white">
          ✕
        </button>
      </div>
    </div>
  )
}
