import { isPractice, startsAt } from '../data/crawl'
import { useCountdown } from '../hooks/useCountdown'

export function Countdown() {
  const t = useCountdown(new Date(startsAt()).toISOString())
  const units: [string, number][] = [
    ['DAYS', t.days],
    ['HRS', t.hours],
    ['MINS', t.minutes],
    ['SECS', t.seconds],
  ]
  return (
    <div className="flex flex-col items-center gap-3">
      {isPractice() && <div className="tag bg-yolk text-ink">PRACTICE · TODAY IS GAME DAY</div>}
      <div className="font-pix text-[10px] text-white">{t.done ? "IT'S GAME DAY" : 'GAME STARTS IN'}</div>
      <div
        className="grid w-full grid-cols-4 gap-2"
        role="timer"
        aria-label={`${t.days} days, ${t.hours} hours, ${t.minutes} minutes until the crawl`}
      >
        {units.map(([label, v]) => (
          <div key={label} className="flex flex-col items-center gap-2 border-4 border-ink bg-ink py-3 shadow-[inset_0_0_0_2px_var(--color-yolk),4px_4px_0_var(--color-red-dark)]">
            <b className="font-pix text-[22px] font-normal leading-none text-yolk">{String(v).padStart(2, '0')}</b>
            <span className="font-pix text-[8px] text-white">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
