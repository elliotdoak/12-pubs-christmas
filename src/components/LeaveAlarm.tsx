import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { load, save } from '../lib/storage'
import { ALARM_LIVE_MS, playSiren } from '../lib/sound'
import { PUBS } from '../data/crawl'

/** Full-screen "drink up, we're leaving" alarm, set off by the Game Master. */
export function LeaveAlarm() {
  const { playerId } = useSession()
  const { game } = useGameCtx()
  const { pathname } = useLocation()
  const at = game.settings.alarm_at ?? null
  const [dismissed, setDismissed] = useState<string | null>(() => load('dismissedAlarm', null))

  const live = !!at && Date.now() - new Date(at).getTime() < ALARM_LIVE_MS
  // The GM sets it off from the control room, so it doesn't blare on that screen
  const show = live && !!playerId && dismissed !== at && pathname !== '/gm'

  useEffect(() => {
    if (!show) return
    const stop = playSiren()
    const buzz = () => navigator.vibrate?.([400, 200, 400, 200, 400])
    buzz()
    const id = setInterval(buzz, 2_500)
    return () => {
      stop()
      clearInterval(id)
      navigator.vibrate?.(0)
    }
  }, [show])

  if (!show || !at) return null

  const last = playerId ? game.lastPub[playerId] : 0
  const next = PUBS.find((p) => p.n > last)
  const go = () => {
    save('dismissedAlarm', at)
    setDismissed(at)
  }

  return (
    <div role="alertdialog" aria-modal="true" aria-labelledby="alarm-title" className="anim-alarm fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-red px-6 text-center text-white" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
      <img src="/sprites/ui/bell.svg" alt="" width={96} height={96} className="pixel anim-ring" />
      <div className="font-pix text-[12px]">GAME MASTER ALARM</div>
      <h2 id="alarm-title" className="m-0 font-pix text-[26px] leading-[36px] [text-shadow:4px_4px_0_var(--color-ink)]">
        DRINK UP!<br />WE'RE LEAVING NOW
      </h2>
      {next ? (
        <div className="w-full max-w-[360px] border-4 border-ink bg-ink px-4 py-3">
          <div className="font-pix text-[9px] text-yolk">NEXT STOP · PUB {next.n}</div>
          <div className="mt-1 font-pix text-[14px] leading-[20px] text-white">{next.name.toUpperCase()}</div>
          <div className="mt-1 text-[15px] text-[#D8D2C6]">{next.address}</div>
        </div>
      ) : (
        <p className="m-0 text-[18px]">Finish your drink and follow the crew.</p>
      )}
      <button type="button" onClick={go} className="btn-big w-full max-w-[360px]">
        ON MY WAY ▶
      </button>
    </div>
  )
}
