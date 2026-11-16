import { useMemo, useState } from 'react'
import { Avatar, Knit, Screen } from '../components/ui'
import { TabBar } from '../components/TabBar'
import { AwardsBoard, AwardsShow } from '../components/Awards'
import { computeAwards } from '../lib/awards'
import { Countdown } from '../components/Countdown'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { useIntro } from '../hooks/useIntro'
import { computeScores, ordinal } from '../lib/scoring'
import { PLAYERS, SCORING, isGameDay } from '../data/crawl'

const RANK_BG = ['bg-yolk', 'bg-[#D9D9E0]', 'bg-[#E3A36B]']

const RULES: [number, string][] = [
  [SCORING.reachPub, 'each pub you reach'],
  [SCORING.challengePassed, 'challenge passed'],
  [SCORING.challengeFailed, 'challenge failed'],
  [SCORING.bestDressed, 'best dressed at Press Bar'],
  [SCORING.worstDressed, 'worst dressed at Press Bar'],
  [SCORING.photo[0], '1st photo at each pub'],
  [SCORING.photo[1], '2nd photo at the same pub'],
  [SCORING.photo[2], '3rd photo at the same pub'],
  [SCORING.sleepyJail, 'sent to Sleepy Jail'],
]

export default function Scores() {
  const { playerId } = useSession()
  const { game } = useGameCtx()
  const [open, setOpen] = useState<string | null>(null)
  const intro = useIntro()
  const ended = !!game.settings.ended_at
  const awards = useMemo(() => (ended ? computeAwards(game) : null), [ended, game])
  const [ceremony, setCeremony] = useState(false)

  const scores = computeScores(game)
  const started = game.checkins.length > 0
  const me = scores.find((s) => s.id === playerId)
  const meName = PLAYERS.find((p) => p.id === playerId)?.name ?? ''

  return (
    <Screen>
      <Knit />
      <header className="flex flex-col gap-2 px-[18px] pb-3 pt-4">
        <div className="font-pix text-[10px] text-yolk">{ended ? 'THE CRAWL IS OVER' : 'LIVE LEADERBOARD'}</div>
        <h1 className="m-0 font-pix text-[22px] leading-[28px] text-white [text-shadow:3px_3px_0_var(--color-ink)]">{ended ? 'FINAL SCORES' : 'HIGH SCORES'}</h1>
        {me && (
          <div className="flex justify-between bg-ink px-3 py-2 font-pix text-[10px] text-white">
            <span>1UP · {meName.toUpperCase()}</span>
            <span className="text-yolk">{me.pts} PTS · #{me.rank}</span>
          </div>
        )}
      </header>

      {awards && (
        <section aria-label="The awards" className="mb-6">
          <AwardsBoard result={awards} ceremony={false} />
          <div className="mx-[14px] mt-4">
            <button type="button" className="btn-big sm" onClick={() => setCeremony(true)}>WATCH THE CEREMONY AGAIN ▶</button>
          </div>
          <h2 className="m-0 mx-[14px] mt-7 font-pix text-[11px] text-yolk">FULL LEADERBOARD</h2>
        </section>
      )}
      {ceremony && <AwardsShow game={game} label="THE NIGHT IS OVER" done="CLOSE ▶" onClose={() => setCeremony(false)} />}

      {!started && !isGameDay() ? (
        <div className="panel mx-[14px] mb-4 flex flex-col items-center gap-3 p-4 text-center">
          <div className="font-pix text-[9px] text-red">LOCKED UNTIL GAME DAY</div>
          <img src="/sprites/ui/crown.svg" alt="" width={63} height={36} className="pixel anim-bob" />
          <p className="m-0 text-[16px] leading-[20px]">Points start counting at the first pub. Everyone starts on zero.</p>
          <div className="w-full rounded-none bg-red p-3">
            <Countdown />
          </div>
        </div>
      ) : (
        <ol className="mx-[14px] mb-4 flex list-none flex-col gap-2 p-0" aria-label="Leaderboard">
          {scores.map((s, i) => {
            const p = PLAYERS.find((x) => x.id === s.id)!
            const mine = s.id === playerId
            const expanded = open === s.id
            const bits = [`${s.pubs} pubs`, `${s.passed} won`, `${s.failed} lost`]
            if (s.jailed) bits.push('in jail')
            return (
              <li key={s.id} className={intro ? 'anim-pop' : undefined} style={{ animationDelay: `${i * 0.05}s` }}>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : s.id)}
                  aria-expanded={expanded}
                  className={`flex w-full items-center gap-3 border-4 border-ink px-2 py-2 text-left text-ink ${mine ? 'bg-blush' : 'bg-wool'} ${s.rank === 1 ? 'shadow-[4px_4px_0_var(--color-yolk)]' : ''}`}
                >
                  <span className={`flex h-9 w-12 shrink-0 items-center justify-center border-2 border-ink font-pix text-[10px] ${RANK_BG[s.rank - 1] ?? 'bg-white'}`}>
                    {ordinal(s.rank)}
                  </span>
                  <span className="relative shrink-0 border-2 border-ink bg-white">
                    {s.rank === 1 && <img src="/sprites/ui/crown.svg" alt="" width={21} height={12} className="pixel absolute -top-[13px] left-1/2 -translate-x-1/2" />}
                    <Avatar id={s.id} size={34} bob={s.rank === 1} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="truncate text-[17px] leading-[20px]">
                      {p.name}
                      {mine && <span className="text-red"> (YOU)</span>}
                    </b>
                    <small className="truncate text-[13px] leading-[16px] text-muted">{bits.join(' · ')}</small>
                  </span>
                  <span className="shrink-0 font-pix text-[16px] text-ink">{String(Math.max(0, s.pts)).padStart(3, '0')}</span>
                </button>
                {expanded && (
                  <ul className="m-0 list-none border-4 border-t-0 border-ink bg-white px-3 py-2 text-ink">
                    {s.items.length ? (
                      s.items.map((it, k) => (
                        <li key={k} className="flex justify-between gap-3 py-[3px] text-[15px] leading-[19px]">
                          <span>{it.label}</span>
                          <b className={`font-pix text-[11px] font-normal ${it.points < 0 ? 'text-red' : 'text-pine'}`}>{it.points > 0 ? '+' : ''}{it.points}</b>
                        </li>
                      ))
                    ) : (
                      <li className="text-[15px] text-muted">No points yet.</li>
                    )}
                  </ul>
                )}
              </li>
            )
          })}
        </ol>
      )}

      <details className="mx-[14px] mb-6 border-4 border-ink bg-ink text-white">
        <summary className="cursor-pointer px-3 py-3 font-pix text-[10px] text-yolk">HOW SCORING WORKS</summary>
        {/* Points in the heading font: the body font's bold 5 looks like a 9 at this size */}
        <ul className="m-0 flex list-none flex-col gap-[6px] px-3 pb-3 text-[17px] leading-[22px]">
          {RULES.map(([pts, what]) => (
            <li key={what} className="flex items-baseline gap-3">
              <span className="w-[44px] shrink-0 text-right font-pix text-[12px] text-yolk">{pts > 0 ? '+' : ''}{pts}</span>
              <span>{what}</span>
            </li>
          ))}
          <li className="mt-1 text-[15px] leading-[19px] text-[#D8D2C6]">
            <b className="text-yolk">No spam photos.</b> Snap the floor or the ceiling just for the points and the Game Master will take points off you.
          </li>
          <li className="text-[15px] leading-[19px] text-[#D8D2C6]">The Game Master can hand out bonus points too. Tap a player on the leaderboard to see how they got their points.</li>
        </ul>
      </details>

      <TabBar />
    </Screen>
  )
}
