import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { AvatarBox, Screen } from '../components/ui'
import { PinPad } from '../components/PinPad'
import { usePlayers } from '../hooks/usePlayers'
import { CLAIM_MESSAGES, claimGm, gmResetPin, releaseGm } from '../lib/api'
import { useSession } from '../lib/session'
import { COSTUMES, PLAYERS, pubByN, type PlayerId } from '../data/crawl'
import { TabBar } from '../components/TabBar'
import { useGameCtx } from '../lib/game'
import { supabase } from '../lib/supabase'

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

/** Manual check-ins (the fallback when a phone dies), practice mode and a test-data wipe. */
function CheckinControls({ flash }: { flash: (m: string) => void }) {
  const { game, practice, setPractice } = useGameCtx()
  const [wipe, setWipe] = useState(false)

  const bump = async (id: PlayerId, name: string) => {
    const n = game.lastPub[id] + 1
    if (!supabase || n > 12) return
    const { error } = await supabase.from('checkins').upsert(
      { player_id: id, pub_n: n, source: 'gm', by_player: null },
      { onConflict: 'player_id,pub_n', ignoreDuplicates: true },
    )
    await game.reload()
    flash(error ? 'COULD NOT CHECK IN' : `${name.toUpperCase()} → ${pubByN(n).name.toUpperCase()}`)
  }

  const undo = async (id: PlayerId, name: string) => {
    const n = game.lastPub[id]
    if (!supabase || !n) return
    const { error } = await supabase.from('checkins').delete().eq('player_id', id).eq('pub_n', n)
    await game.reload()
    flash(error ? 'COULD NOT UNDO' : `${name.toUpperCase()} BACK TO PUB ${n - 1}`)
  }

  const wipeAll = async () => {
    if (!supabase) return
    const { error } = await supabase.from('checkins').delete().gte('pub_n', 1)
    setWipe(false)
    await game.reload()
    flash(error ? 'WIPE FAILED' : 'ALL CHECK-INS WIPED')
  }

  return (
    <>
      <section className="mx-[14px] mb-6 border-4 border-ink bg-wool text-ink" aria-label="Check-ins">
        <div className="bg-ink px-3 py-2 font-pix text-[10px] text-yolk">CHECK-INS · MANUAL OVERRIDE</div>
        <ul className="m-0 list-none p-0">
          {PLAYERS.map((p) => {
            const n = game.lastPub[p.id]
            return (
              <li key={p.id} className="flex items-center gap-3 border-b-2 border-dashed border-[#CFC6B6] px-3 py-2 last:border-0">
                <AvatarBox id={p.id} size={36} />
                <div className="min-w-0 flex-1">
                  <b className="text-[16px]">{p.name}</b>
                  <div className="text-[13px] text-muted">{n ? `Pub ${n} · ${pubByN(n).name}` : 'Not started'}</div>
                </div>
                <button type="button" disabled={!n} onClick={() => undo(p.id, p.name)} className="border-2 border-ink bg-white px-2 py-1 font-pix text-[8px] disabled:opacity-40">UNDO</button>
                <button type="button" disabled={n >= 12} onClick={() => bump(p.id, p.name)} className="border-2 border-ink bg-pine px-2 py-1 font-pix text-[8px] text-white disabled:opacity-40">+1 PUB</button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="mx-[14px] mb-6 flex flex-col gap-3 border-4 border-ink bg-wool p-3 text-ink" aria-label="Testing">
        <div className="font-pix text-[10px]">TESTING</div>
        <label className="flex items-center gap-3 text-[16px]">
          <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} className="h-5 w-5 accent-[var(--color-pine)]" />
          Practice mode on this phone (auto check-in before game day, no time limits)
        </label>
        {wipe ? (
          <div className="flex items-center gap-2">
            <span className="flex-1 text-[15px]">Delete every check-in for everyone?</span>
            <button type="button" onClick={wipeAll} className="border-2 border-ink bg-red px-2 py-1 font-pix text-[8px] text-white">WIPE</button>
            <button type="button" onClick={() => setWipe(false)} className="border-2 border-ink bg-white px-2 py-1 font-pix text-[8px]">NO</button>
          </div>
        ) : (
          <button type="button" onClick={() => setWipe(true)} className="self-start border-2 border-ink bg-white px-2 py-1 font-pix text-[8px]">WIPE TEST CHECK-INS</button>
        )}
      </section>
    </>
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

      <CheckinControls flash={flash} />

      <p className="mx-[18px] mb-8 text-[14px] leading-[18px] text-[#B9B2A6]">
        Results, Sleepy Jail and announcements arrive here in the next builds.
      </p>

      {toast && (
        <div role="status" className="fixed bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap border-4 border-yolk bg-ink px-4 py-3 font-pix text-[10px] text-yolk">
          {toast}
        </div>
      )}
      {playerId && <TabBar />}
    </Screen>
  )
}
