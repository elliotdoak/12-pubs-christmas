import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Footer, Screen, TopBar } from '../components/ui'
import { usePlayers } from '../hooks/usePlayers'
import { useSession } from '../lib/session'
import type { PlayerId } from '../data/crawl'

export default function Who() {
  const nav = useNavigate()
  const { playerId } = useSession()
  const { players, error } = usePlayers()
  const [pick, setPick] = useState<PlayerId | null>(null)

  return (
    <Screen>
      <TopBar back={playerId ? '/lobby' : undefined} step="LAST STEP" />
      <div className="flex flex-col gap-2 px-[18px] pb-4">
        <div className="font-pix text-[10px] text-yolk">PLAYER SELECT</div>
        <h1 className="m-0 font-pix text-[22px] leading-[28px] text-yolk [text-shadow:3px_3px_0_var(--color-ink)]">WHO ARE YOU?</h1>
        <p className="m-0 text-[16px] leading-[20px]">Tap your name. You'll set a 4-digit PIN so nobody else can play as you.</p>
      </div>

      <div className="grid grid-cols-3 gap-[10px] px-[14px] pb-4" role="radiogroup" aria-label="Players">
        {!players && !error && <p className="col-span-3 font-pix text-[10px]">LOADING…</p>}
        {error && <p className="col-span-3 text-[16px] text-yolk">{error}</p>}
        {players?.map((p, n) => {
          const sel = pick === p.id
          const me = playerId === p.id
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={sel}
              onClick={() => setPick(p.id)}
              className={`anim-pop relative flex flex-col items-center gap-1 border-[3px] px-1 pb-2 pt-3 ${
                sel ? 'border-yolk bg-wool shadow-[0_0_0_3px_var(--color-ink)]' : p.has_pin && !me ? 'border-ink bg-[#E89AA6]' : 'border-ink bg-wool'
              } text-ink`}
              style={{ animationDelay: `${n * 0.04}s` }}
            >
              <div className="flex h-[52px] w-[52px] items-center justify-center border-2 border-ink bg-white">
                <Avatar id={p.id} size={44} bob={sel} />
              </div>
              <span className="text-[16px] font-bold leading-[20px]">{p.name}</span>
              <span className={`font-pix text-[7px] ${me ? 'text-pine' : p.has_pin ? 'text-red-dark' : 'text-muted'}`}>
                {me ? 'YOU' : p.has_pin ? 'JOINED · PIN' : 'FREE'}
              </span>
            </button>
          )
        })}
      </div>

      <Footer>
        <button type="button" className="btn-big" disabled={!pick} onClick={() => pick && nav(`/pin/${pick}`)}>
          THAT'S ME ▶
        </button>
        <div className="text-center text-[14px] leading-[18px] text-white">
          Joined on another phone? Pick your name and enter your PIN.
        </div>
      </Footer>
    </Screen>
  )
}
