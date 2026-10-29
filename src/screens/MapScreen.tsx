import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Screen } from '../components/ui'
import { TabBar } from '../components/TabBar'
import { PubSheet } from '../components/PubSheet'
import { CrewSheet } from '../components/CrewSheet'
import { JailSheet } from '../components/JailSheet'
import { useScale } from '../hooks/useScale'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { fmtDistance } from '../lib/geo'
import { JAIL, PLAYERS, PUBS, clockTime, gameNow, gateTime, isGameDay, niceTime, sprite, type PlayerId } from '../data/crawl'

const MAP_W = 390
const MAP_H = 624
const ART_W = 72
const ART_H = 58

/** Decorative pints dotted on the map (map coordinates, top-left). */
const DRINKS = [
  { src: '/sprites/map/stout.svg', left: 46, top: 350 },
  { src: '/sprites/map/lager.svg', left: 236, top: 228 },
]
const DRINK = 44

export default function MapScreen() {
  const { playerId } = useSession()
  const { game, geo, active, practice, justCheckedIn } = useGameCtx()
  const { ref, scale } = useScale<HTMLDivElement>(MAP_W)
  const [open, setOpen] = useState<number | null>(null)
  const [jailOpen, setJailOpen] = useState(false)
  const now = useClock()

  const myLast = playerId ? game.lastPub[playerId] : 0
  const visited = playerId ? game.visited[playerId] : new Set<number>()
  const next = PUBS.find((p) => p.n > myLast)
  const out = PLAYERS.filter((p) => game.lastPub[p.id] > 0 && !game.inJail.has(p.id)).length

  // Group players by the pub they're at (their highest check-in)
  const atPub = new Map<number, PlayerId[]>()
  for (const p of PLAYERS) {
    const n = game.lastPub[p.id]
    if (!n || game.inJail.has(p.id)) continue
    atPub.set(n, [...(atPub.get(n) ?? []), p.id])
  }
  const jailed = PLAYERS.filter((p) => game.inJail.has(p.id)).map((p) => p.id)

  return (
    <Screen>
      <header className="flex shrink-0 flex-col gap-[10px] px-[18px] pb-3 pt-4">
        <div className="font-pix text-[10px] text-yolk">GLASGOW · LEVEL MAP</div>
        <h1 className="m-0 font-pix text-[18px] leading-[24px] text-white [text-shadow:3px_3px_0_var(--color-ink)]">
          {myLast === 12 ? 'FINAL LEVEL!' : myLast ? `PUB ${myLast} CLEARED` : 'READY PLAYER ONE'}
        </h1>
        <div className="flex gap-2">
          <Hud k="PUB" v={`${String(myLast).padStart(2, '0')}/12`} />
          <Hud k="CREW" v={`${out} OUT`} />
          <Hud k="TIME" v={now} />
        </div>
        <GeoChip status={geo.status} active={active} practice={practice} nearest={geo.decision?.nearest ?? null} reason={geo.decision?.reason} />
      </header>

      <div ref={ref} className="relative w-full overflow-hidden border-t-4 border-ink bg-wool" style={{ height: MAP_H * scale }}>
        <div className="absolute left-0 top-0 origin-top-left" style={{ width: MAP_W, height: MAP_H, transform: `scale(${scale})` }}>
          <img src="/sprites/map/ground.svg" alt="" className="pixel absolute left-0 top-0" width={MAP_W} height={MAP_H} />
          <img src="/sprites/map/route.svg" alt="" className="pixel absolute left-0 top-0" width={MAP_W} height={MAP_H} />

          {DRINKS.map((d) => (
            <img key={d.src} src={d.src} alt="" width={DRINK} height={DRINK} className="pixel pointer-events-none absolute" style={{ left: d.left, top: d.top }} />
          ))}

          {PUBS.map((p) => {
            const [x, y] = p.map
            const done = visited.has(p.n)
            const here = p.n === myLast
            const isNext = p.n === next?.n
            return (
              <button
                key={p.n}
                type="button"
                onClick={() => setOpen(p.n)}
                aria-label={`Pub ${p.n}: ${p.name}${done ? ', unlocked' : ', locked'}`}
                className="absolute p-0"
                style={{ left: x - ART_W / 2, top: y + 12 - ART_H, width: ART_W, height: ART_H }}
              >
                <img src={sprite.pub(p.n)} alt="" width={ART_W} height={ART_H} className={`pixel ${done ? '' : 'opacity-90'}`} />
                <span
                  className={`absolute -left-2 -top-2 flex h-[22px] min-w-[22px] items-center justify-center border-[3px] border-ink px-[2px] font-pix text-[9px] ${
                    here ? 'anim-flash bg-red text-white' : done ? 'bg-pine text-yolk' : isNext ? 'bg-yolk text-ink' : p.n === 12 ? 'bg-yolk text-ink' : 'bg-white text-ink'
                  }`}
                >
                  {done && !here ? '✓' : p.n}
                </span>
              </button>
            )
          })}

          {[...atPub.entries()].map(([n, ids]) => {
            const [x, y] = PUBS[n - 1].map
            return (
              <div key={n} className="pointer-events-none absolute flex flex-wrap justify-center gap-[2px]" style={{ left: Math.min(Math.max(x - 52, 2), MAP_W - 106), top: y + 16, width: 104 }}>
                {ids.map((id, i) => (
                  <div key={id} className={`relative ${id === playerId ? 'z-10' : ''}`}>
                    {id === playerId && <span className="absolute -top-[13px] left-1/2 -translate-x-1/2 bg-red px-[2px] font-pix text-[6px] text-white">YOU</span>}
                    <div className={`anim-hop border-2 bg-white ${id === playerId ? 'border-red' : 'border-ink'}`} style={{ animationDelay: `${i * 0.12}s` }}>
                      <Avatar id={id} size={20} />
                    </div>
                  </div>
                ))}
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => setJailOpen(true)}
            aria-label={`Sleepy Jail: ${jailed.length} inside. See who and when.`}
            className="absolute p-0 text-left"
            style={{ left: JAIL.left, top: JAIL.top, width: JAIL.width }}
          >
            <img src="/sprites/map/jail.svg" alt="" width={JAIL.width} height={60} className="pixel" />
            <span className="absolute -top-[14px] left-1/2 -translate-x-1/2 whitespace-nowrap bg-ink px-1 font-pix text-[7px] text-yolk">SLEEPY JAIL</span>
            <div className="absolute left-[14px] right-[14px] top-[26px] flex flex-wrap justify-center gap-[2px]">
              {jailed.map((id) => (
                <div key={id} className="bg-white/80 opacity-90 grayscale-[40%]">
                  <Avatar id={id} size={16} />
                </div>
              ))}
            </div>
          </button>
        </div>
      </div>

      {next && (
        <button type="button" onClick={() => setOpen(next.n)} className="relative mx-3 my-3 flex flex-col gap-1 border-4 border-white bg-ink px-[14px] py-[10px] text-left shadow-[0_0_0_4px_var(--color-ink)]">
          <span className="font-pix text-[9px] text-yolk">NEXT LEVEL · PUB {next.n} · {niceTime(next.arrive).toUpperCase()}</span>
          <span className="font-pix text-[13px] leading-[20px] text-white">{next.name.toUpperCase()}</span>
          <span className="text-[15px] leading-[19px] text-[#D8D2C6]">{next.address}</span>
          <span className="anim-blink absolute bottom-3 right-[14px] h-2 w-[10px] bg-yolk [clip-path:polygon(0_0,100%_0,50%_100%)]" />
        </button>
      )}

      <TabBar />

      {open !== null && <PubSheet n={open} onClose={() => setOpen(null)} />}
      {jailOpen && <JailSheet onClose={() => setJailOpen(false)} />}
      {justCheckedIn && <CrewSheet pub={justCheckedIn} />}
    </Screen>
  )
}

function Hud({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex flex-1 justify-between bg-ink px-2 py-[7px] font-pix text-[9px] leading-[12px] text-white">
      {k} <em className="not-italic text-yolk">{v}</em>
    </div>
  )
}

function GeoChip({ status, active, practice, nearest, reason }: {
  status: string; active: boolean; practice: boolean
  nearest: { pub: { name: string; n: number }; m: number } | null; reason?: string
}) {
  let dot = 'bg-muted'
  let text: string
  if (!active) {
    text = isGameDay() ? 'Pick your player to start tracking' : 'Auto check-in switches on on game day'
  } else if (status === 'denied') {
    dot = 'bg-red'
    text = 'Location is off. Turn it on in Settings so the game can check you in.'
  } else if (status === 'unsupported') {
    text = "This phone can't share location. The Game Master will check you in."
  } else if (status === 'waiting' || !nearest) {
    dot = 'bg-yolk anim-blink'
    text = reason === 'done' ? 'All 12 pubs cleared. Legend.' : 'Finding you…'
  } else {
    dot = 'bg-[#3BD16F] anim-blink'
    text =
      reason === 'too_early' ? `At ${nearest.pub.name}? Check-in opens at ${clockTime(gateTime(nearest.pub.n))}.`
      : reason === 'poor_signal' ? `Weak GPS. ${nearest.pub.name} is about ${fmtDistance(nearest.m)} away.`
      : `${nearest.pub.name} is ${fmtDistance(nearest.m)} away`
  }
  return (
    <div className="flex items-center gap-2 border-2 border-ink bg-red-dark px-2 py-[6px] text-[14px] leading-[18px]" role="status">
      <i className={`block h-[10px] w-[10px] shrink-0 ${dot}`} />
      <span className="flex-1">{text}</span>
      {practice && <Link to="/gm" className="tag bg-yolk text-ink no-underline">PRACTICE</Link>}
    </div>
  )
}

function useClock() {
  const fmt = () => new Date(gameNow()).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
  const [t, setT] = useState(fmt)
  useEffect(() => {
    const id = setInterval(() => setT(fmt()), 15_000)
    return () => clearInterval(id)
  }, [])
  return t
}
