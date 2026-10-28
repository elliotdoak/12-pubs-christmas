import { useState } from 'react'
import { Sheet } from './Sheet'
import { Avatar } from './ui'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { PAIRS, PLAYERS, type Pub, type PlayerId } from '../data/crawl'

/** Shown right after this phone checks you in: tick anyone with you who hasn't been checked in yet. */
export function CrewSheet({ pub }: { pub: Pub }) {
  const { playerId } = useSession()
  const { game, dismissCheckin, checkInCrew } = useGameCtx()
  const others = PLAYERS.filter((p) => p.id !== playerId && !game.visited[p.id].has(pub.n))
  // Handcuff partners are definitely with you at Blackfriars and O'Neills
  const cuffed = pub.n === 3 || pub.n === 4 ? PAIRS.find((g) => playerId && g.includes(playerId)) ?? [] : []
  const [sel, setSel] = useState<Set<PlayerId>>(() => new Set(cuffed.filter((id) => id !== playerId && others.some((o) => o.id === id))))
  const [busy, setBusy] = useState(false)

  const toggle = (id: PlayerId) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const done = async () => {
    setBusy(true)
    await checkInCrew(pub.n, [...sel])
    setBusy(false)
    dismissCheckin()
  }

  return (
    <Sheet label={`Checked in at ${pub.name}`} onClose={dismissCheckin}>
      <div className="flex flex-col items-center gap-2 bg-pine px-4 py-5 text-center text-white">
        <div className="font-pix text-[10px] text-yolk">PUB {pub.n} UNLOCKED!</div>
        <h2 className="m-0 font-pix text-[16px] leading-[22px] [text-shadow:3px_3px_0_var(--color-ink)]">{pub.name.toUpperCase()}</h2>
        <p className="m-0 text-[16px]">You're checked in. Its challenge is now open.</p>
      </div>

      {others.length > 0 ? (
        <div className="p-4">
          <h3 className="m-0 font-pix text-[12px]">WHO'S WITH YOU?</h3>
          <p className="m-0 mb-3 mt-1 text-[15px] leading-[19px] text-muted">
            Tick anyone here whose phone hasn't checked them in. Saves them from Sleepy Jail.
          </p>
          <div className="grid grid-cols-4 gap-2" role="group" aria-label="Crew with you">
            {others.map((p) => {
              const on = sel.has(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(p.id)}
                  className={`relative flex flex-col items-center gap-1 border-[3px] p-1 ${on ? 'border-ink bg-yolk' : 'border-ink bg-white'}`}
                >
                  <Avatar id={p.id} size={36} />
                  <span className="text-[13px] font-bold">{p.name}</span>
                  {on && <span className="absolute -right-2 -top-2 border-2 border-ink bg-pine px-1 font-pix text-[8px] text-white">✓</span>}
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="m-4 text-[16px]">Everyone else is already here. Nice.</p>
      )}

      <div className="flex flex-col gap-2 px-4">
        <button type="button" className="btn-big" disabled={busy} onClick={done}>
          {sel.size ? `CHECK IN ${sel.size} MORE ▶` : 'JUST ME ▶'}
        </button>
      </div>
    </Sheet>
  )
}
