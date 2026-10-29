import { Link } from 'react-router-dom'
import { at, isPractice, niceTime, pubByN, PUBS, startsAt } from '../data/crawl'
import { useCountdown } from '../hooks/useCountdown'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'

/** Before the crawl: countdown to kick-off. Once you've checked in: time left at your current pub, and where's next. */
export function Countdown() {
  const { playerId } = useSession()
  const { game } = useGameCtx()
  const last = playerId ? game.lastPub[playerId] ?? 0 : 0
  const target = last ? at(pubByN(last).leave) : startsAt()
  const t = useCountdown(new Date(target).toISOString())

  if (last) return <NextPub last={last} t={t} />

  const units: [string, number][] = [
    ['DAYS', t.days],
    ['HRS', t.hours],
    ['MINS', t.minutes],
    ['SECS', t.seconds],
  ]
  return (
    <div className="flex flex-col items-center gap-3">
      {isPractice() && <div className="tag bg-yolk text-ink">PRACTICE · GAME CLOCK RUNNING</div>}
      <div className="font-pix text-[10px] text-white">{t.done ? "IT'S GAME DAY" : 'GAME STARTS IN'}</div>
      <Units units={units} label={`${t.days} days, ${t.hours} hours, ${t.minutes} minutes until the crawl`} />
    </div>
  )
}

type T = ReturnType<typeof useCountdown>

function NextPub({ last, t }: { last: number; t: T }) {
  const here = pubByN(last)
  const next = PUBS.find((p) => p.n > last)

  const units: [string, number][] = [
    ['HRS', t.hours + t.days * 24],
    ['MINS', t.minutes],
    ['SECS', t.seconds],
  ]
  return (
    <Link to="/map" className="flex flex-col gap-3 no-underline" aria-label={next ? `Leave ${here.name} at ${niceTime(here.leave)}. Next pub: ${next.name}, get there by ${niceTime(next.arrive)}.` : `Final pub: ${here.name}, until ${niceTime(here.leave)}.`}>
      {isPractice() && <div className="tag self-center bg-yolk text-ink">PRACTICE · GAME CLOCK RUNNING</div>}
      {!t.done && <div className="self-center text-center font-pix text-[10px] leading-[14px] text-white">{next ? `TIME LEFT AT ${here.name.toUpperCase()}` : 'LAST ORDERS IN'}</div>}
      {t.done ? (
        <div className="anim-blink border-4 border-ink bg-red-dark py-3 text-center font-pix text-[11px] text-yolk">{next ? 'TIME TO LEAVE!' : "THAT'S A WRAP"}</div>
      ) : (
        <Units units={units} label={`${units[0][1]} hours, ${t.minutes} minutes left at ${here.name}`} />
      )}
      {next ? (
      <div className="flex flex-col gap-1 border-4 border-ink bg-ink px-[14px] py-3 shadow-[4px_4px_0_var(--color-red-dark)]">
        <span className="font-pix text-[9px] text-yolk">NEXT PUB · PUB {next.n} OF 12</span>
        <span className="font-pix text-[15px] leading-[22px] text-white">{next.name.toUpperCase()}</span>
        <span className="text-[15px] leading-[19px] text-[#D8D2C6]">{next.address}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <span className="bg-yolk px-2 py-1 font-pix text-[10px] text-ink">GET THERE BY {niceTime(next.arrive).toUpperCase()}</span>
          <span className="text-[14px] text-[#D8D2C6]">Leave {here.name} at {niceTime(here.leave)}</span>
        </span>
      </div>
      ) : (
        <div className="flex flex-col items-center gap-1 border-4 border-ink bg-ink p-3 text-center shadow-[4px_4px_0_var(--color-red-dark)]">
          <span className="font-pix text-[10px] text-yolk">FINAL LEVEL REACHED</span>
          <span className="font-pix text-[14px] leading-[20px] text-white">{here.name.toUpperCase()}</span>
          <span className="text-[15px] text-[#D8D2C6]">Until {niceTime(here.leave)}. Legend.</span>
        </div>
      )}
    </Link>
  )
}

function Units({ units, label }: { units: [string, number][]; label: string }) {
  return (
    <div className={`grid w-full gap-2 ${units.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} role="timer" aria-label={label}>
      {units.map(([l, v]) => (
        <div key={l} className="flex flex-col items-center gap-2 border-4 border-ink bg-ink py-3 shadow-[inset_0_0_0_2px_var(--color-yolk),4px_4px_0_var(--color-red-dark)]">
          <b className="font-pix text-[22px] font-normal leading-none text-yolk">{String(v).padStart(2, '0')}</b>
          <span className="font-pix text-[8px] text-white">{l}</span>
        </div>
      ))}
    </div>
  )
}
