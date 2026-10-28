import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvatarBox, Screen } from '../components/ui'
import { PinPad } from '../components/PinPad'
import { usePlayers } from '../hooks/usePlayers'
import { CLAIM_MESSAGES, claimGm, gmResetPin, releaseGm } from '../lib/api'
import { useSession } from '../lib/session'
import { COSTUMES, type PlayerId } from '../data/crawl'

export default function Gm() {
  const { isGm } = useSession()
  return <div className="min-h-dvh bg-[#121417]">{isGm ? <ControlRoom /> : <GmLogin />}</div>
}

function GmLogin() {
  const { refresh } = useSession()
  const onComplete = useCallback(
    async (pin: string) => {
      const res = await claimGm(pin)
      if (!res.ok) return CLAIM_MESSAGES[res.error ?? 'network'].toUpperCase()
      await refresh()
      return null
    },
    [refresh],
  )

  return (
    <Screen>
      <div className="flex items-center justify-between px-[18px] py-3">
        <Link to="/" className="font-pix text-[10px] text-white no-underline">◀ BACK</Link>
        <span className="font-pix text-[10px] text-yolk">ORGANISERS ONLY</span>
      </div>
      <div className="flex flex-1 flex-col items-center gap-4 px-[18px] pt-8">
        <h1 className="m-0 font-pix text-[20px] text-yolk">GAME MASTER</h1>
        <p className="m-0 text-[17px]">Enter the 4-digit PIN</p>
        <PinPad onComplete={onComplete} />
      </div>
    </Screen>
  )
}

function ControlRoom() {
  const { refresh, playerId } = useSession()
  const { players, reload } = usePlayers(15_000)
  const [confirm, setConfirm] = useState<PlayerId | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2000)
  }

  const reset = async (id: PlayerId, name: string) => {
    const res = await gmResetPin(id)
    setConfirm(null)
    if (!res.ok) return flash(CLAIM_MESSAGES[res.error ?? 'network'].toUpperCase())
    await reload()
    flash(`${name.toUpperCase()} CAN PICK A NEW PIN`)
  }

  const exit = async () => {
    await releaseGm()
    await refresh()
  }

  const joined = players?.filter((p) => p.has_pin).length ?? 0

  return (
    <Screen>
      <div className="flex items-start justify-between px-[18px] pb-3 pt-4">
        <div>
          <div className="font-pix text-[9px] text-yolk">GAME MASTER · ADMIN</div>
          <h1 className="m-0 mt-2 font-pix text-[20px] text-white">CONTROL ROOM</h1>
        </div>
        <div className="flex gap-2">
          {playerId && (
            <Link to="/lobby" className="border-4 border-wool px-2 py-1 font-pix text-[9px] text-wool no-underline">LOBBY</Link>
          )}
          <button type="button" onClick={exit} className="border-4 border-wool px-2 py-1 font-pix text-[9px] text-wool">EXIT</button>
        </div>
      </div>

      <div className="mx-[14px] mb-3 grid grid-cols-2 gap-2">
        <div className="bg-ink p-3 font-pix text-[9px] text-white">JOINED <em className="not-italic text-yolk">{joined}/{players?.length ?? 10}</em></div>
        <div className="bg-ink p-3 font-pix text-[9px] text-white">GAME <em className="not-italic text-yolk">PRE-GAME</em></div>
      </div>

      <section className="mx-[14px] mb-6 border-4 border-ink bg-wool text-ink" aria-label="Players">
        <div className="bg-ink px-3 py-2 font-pix text-[10px] text-yolk">PLAYERS · PINS</div>
        <ul className="m-0 list-none p-0">
          {players?.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b-2 border-dashed border-[#CFC6B6] px-3 py-2 last:border-0">
              <AvatarBox id={p.id} size={40} />
              <div className="min-w-0 flex-1">
                <b className="text-[16px]">{p.name}</b>
                <div className="text-[13px] text-muted">{COSTUMES[p.costume].name}</div>
              </div>
              {confirm === p.id ? (
                <div className="flex gap-1">
                  <button type="button" onClick={() => reset(p.id, p.name)} className="border-2 border-ink bg-red px-2 py-1 font-pix text-[8px] text-white">RESET</button>
                  <button type="button" onClick={() => setConfirm(null)} className="border-2 border-ink bg-white px-2 py-1 font-pix text-[8px]">NO</button>
                </div>
              ) : p.has_pin ? (
                <button type="button" onClick={() => setConfirm(p.id)} className="border-2 border-ink bg-white px-2 py-1 font-pix text-[8px]">
                  RESET PIN
                </button>
              ) : (
                <span className="tag bg-white text-muted">NOT JOINED</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <p className="mx-[18px] mb-8 text-[14px] leading-[18px] text-[#B9B2A6]">
        Check-ins, results, Sleepy Jail and announcements arrive here in the next builds.
      </p>

      {toast && (
        <div role="status" className="fixed bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap border-4 border-yolk bg-ink px-4 py-3 font-pix text-[10px] text-yolk">
          {toast}
        </div>
      )}
    </Screen>
  )
}
