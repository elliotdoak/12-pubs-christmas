import { Sheet, SheetClose } from './Sheet'
import { Avatar } from './ui'
import { useGameCtx } from '../lib/game'
import { PLAYERS, SCORING, clockTime, gameNow, pubByN } from '../data/crawl'

const name = (id: string) => PLAYERS.find((p) => p.id === id)?.name ?? id

/** Times are stored in real time; in practice mode show them on the game clock instead. */
const onGameClock = (iso: string) => new Date(iso).getTime() + (gameNow() - Date.now())

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`
}

export function JailSheet({ onClose }: { onClose: () => void }) {
  const { game } = useGameCtx()
  const rows = [...game.jail].sort((a, b) => b.since.localeCompare(a.since))
  const inside = rows.filter((j) => game.inJail.has(j.player_id))
  const out = rows.filter((j) => !game.inJail.has(j.player_id))

  return (
    <Sheet label="Sleepy Jail" onClose={onClose}>
      <div className="flex items-start gap-3 p-4 pb-3">
        <img src="/sprites/map/jail.svg" alt="" width={52} height={30} className="pixel mt-1 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-pix text-[9px] text-red">{inside.length} BEHIND BARS</div>
          <h2 className="m-0 mt-1 font-pix text-[15px] leading-[20px]">SLEEPY JAIL</h2>
        </div>
        <SheetClose onClose={onClose} />
      </div>

      <p className="m-0 mx-4 text-[15px] leading-[19px] text-muted">
        Fall asleep and you're in. {SCORING.sleepyJail} points. Check in at the next pub to break out.
      </p>

      <div className="mx-4 mt-3 border-[3px] border-ink bg-white">
        <div className="border-b-[3px] border-ink bg-ink px-3 py-2 font-pix text-[9px] text-yolk">INMATES</div>
        {inside.length ? (
          <ul className="m-0 list-none p-0">
            {inside.map((j) => (
              <li key={j.player_id} className="flex items-center gap-3 border-b-2 border-dashed border-[#CFC6B6] px-3 py-2 last:border-0">
                <div className="border-2 border-ink bg-wool grayscale-[40%]"><Avatar id={j.player_id} size={36} /></div>
                <div className="min-w-0 flex-1">
                  <b className="text-[17px]">{name(j.player_id)}</b>
                  <div className="text-[14px] leading-[18px] text-muted">
                    {j.last_pub ? `Nodded off after Pub ${j.last_pub} · ${pubByN(j.last_pub).name}` : 'Nodded off before Pub 1'}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-pix text-[10px] text-red">{clockTime(onGameClock(j.since)).toUpperCase()}</div>
                  <div className="text-[12px] text-muted">{ago(j.since)}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 p-3 text-center text-[16px]">Cells are empty. Everyone's still standing.</p>
        )}
      </div>

      {out.length > 0 && (
        <div className="mx-4 mt-3 border-[3px] border-dashed border-ink">
          <div className="px-3 pt-2 font-pix text-[9px] text-muted">DONE THEIR TIME</div>
          <ul className="m-0 list-none p-0">
            {out.map((j) => (
              <li key={j.player_id} className="flex items-center gap-3 px-3 py-2">
                <Avatar id={j.player_id} size={28} />
                <span className="flex-1 text-[15px]">{name(j.player_id)}</span>
                <span className="text-[13px] text-muted">
                  In at {clockTime(onGameClock(j.since))} · {j.released_at ? 'released' : 'escaped'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Sheet>
  )
}
