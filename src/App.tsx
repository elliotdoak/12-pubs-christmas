import { EVENT, PLAYERS, sprite } from './data/crawl'
import { useCountdown } from './hooks/useCountdown'

// Placeholder home screen to prove the setup end to end.
// Next up: install walkthrough, player picker, lobby countdown.
export default function App() {
  const t = useCountdown(EVENT.startsAt)
  const units: [string, number][] = [
    ['DAYS', t.days],
    ['HRS', t.hours],
    ['MINS', t.minutes],
    ['SECS', t.seconds],
  ]

  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col">
      <div className="knit-band" aria-hidden="true" />

      <header className="flex flex-col items-center gap-3 px-4 pt-8 text-center">
        <img src="/sprites/logo.svg" alt="" width={48} height={48} className="pixel" />
        <p className="font-pix text-[10px] text-gold">{EVENT.presentedBy.toUpperCase()} PRESENTS</p>
        <h1 className="font-pix text-lg leading-relaxed">12 PUBS OF CHRISTMAS</h1>
        <p className="font-pix text-[10px] text-cream/70">{EVENT.edition.toUpperCase()} · SAT 28 NOV · 12.30PM</p>
      </header>

      <section aria-label="Countdown to the crawl" className="mx-4 mt-8 grid grid-cols-4 gap-2">
        {units.map(([label, v]) => (
          <div key={label} className="border-4 border-ink bg-red py-3 text-center shadow-[4px_4px_0_var(--color-ink)]">
            <div className="font-pix text-xl text-gold" aria-live={label === 'SECS' ? 'off' : 'polite'}>
              {String(v).padStart(2, '0')}
            </div>
            <div className="mt-2 font-pix text-[8px]">{label}</div>
          </div>
        ))}
      </section>

      <section aria-label="Players" className="mx-4 mt-8 grid grid-cols-4 gap-3 pb-10">
        {PLAYERS.map((p) => (
          <figure key={p.id} className="flex flex-col items-center gap-1">
            <img src={sprite.avatar(p.id)} alt="" width={48} height={48} className="pixel" />
            <figcaption className="font-pix text-[8px]">{p.name.toUpperCase()}</figcaption>
          </figure>
        ))}
      </section>

      <div className="knit-band mt-auto" aria-hidden="true" />
    </main>
  )
}
