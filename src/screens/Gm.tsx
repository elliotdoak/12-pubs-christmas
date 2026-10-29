import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, AvatarBox, Screen } from '../components/ui'
import { PinPad } from '../components/PinPad'
import { TabBar } from '../components/TabBar'
import { usePlayers } from '../hooks/usePlayers'
import { CLAIM_MESSAGES, claimGm, gmResetPin, releaseGm } from '../lib/api'
import { useGameCtx } from '../lib/game'
import { useSession } from '../lib/session'
import { supabase } from '../lib/supabase'
import { thumbPath } from '../lib/photos'
import { PLAYERS, PUBS, SCORING, pubByN, type PlayerId } from '../data/crawl'

export default function Gm() {
  const { isGm } = useSession()
  return <div className="min-h-dvh bg-[#121417]">{isGm ? <ControlRoom /> : <GmLogin />}</div>
}

/* ---------------- login ---------------- */

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

/* ---------------- shared bits ---------------- */

const name = (id: PlayerId) => PLAYERS.find((p) => p.id === id)?.name ?? id
const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/London' })
const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`
}

async function log(message: string) {
  await supabase?.from('gm_log').insert({ message })
}

function Btn({ children, onClick, tone = 'white', disabled, pressed, label }: {
  children: React.ReactNode; onClick: () => void; tone?: 'white' | 'pine' | 'red' | 'yolk' | 'ink'
  disabled?: boolean; pressed?: boolean; label?: string
}) {
  const c = { white: 'bg-white text-ink', pine: 'bg-pine text-white', red: 'bg-red text-white', yolk: 'bg-yolk text-ink', ink: 'bg-ink text-white' }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      className={`shrink-0 border-2 border-ink px-2 py-[6px] font-pix text-[8px] leading-[10px] disabled:opacity-35 ${c}`}
    >
      {children}
    </button>
  )
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mx-[14px] mb-4 border-4 border-ink bg-wool text-ink" aria-label={title}>
      <div className="flex items-baseline justify-between gap-2 bg-ink px-3 py-2">
        <span className="font-pix text-[10px] text-yolk">{title}</span>
        {hint && <span className="text-right text-[12px] leading-[14px] text-[#B9B2A6]">{hint}</span>}
      </div>
      {children}
    </section>
  )
}

type Tab = 'live' | 'results' | 'players' | 'testing'

/* ---------------- control room ---------------- */

function ControlRoom() {
  const { refresh, playerId } = useSession()
  const { game } = useGameCtx()
  const { players } = usePlayers(15_000)
  const [tab, setTab] = useState<Tab>('live')
  const [toast, setToast] = useState<string | null>(null)

  const flash = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2200)
  }, [])

  const joined = players?.filter((p) => p.has_pin).length ?? 0
  const out = PLAYERS.filter((p) => game.lastPub[p.id] > 0 && !game.inJail.has(p.id)).length
  const crowdPub = useMemo(() => {
    const counts = new Map<number, number>()
    for (const p of PLAYERS) {
      const n = game.lastPub[p.id]
      if (n && !game.inJail.has(p.id)) counts.set(n, (counts.get(n) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0
  }, [game.lastPub, game.inJail])

  const exit = async () => {
    await releaseGm()
    await refresh()
  }

  return (
    <Screen>
      <div className="flex items-start justify-between px-[18px] pb-3 pt-4">
        <div>
          <div className="font-pix text-[9px] text-yolk">GAME MASTER · ADMIN</div>
          <h1 className="m-0 mt-2 font-pix text-[20px] text-white">CONTROL ROOM</h1>
        </div>
        {!playerId && (
          <button type="button" onClick={exit} className="border-4 border-wool px-2 py-1 font-pix text-[9px] text-wool">EXIT</button>
        )}
      </div>

      <div className="mx-[14px] mb-3 grid grid-cols-2 gap-2">
        <Stat k="JOINED" v={`${joined}/${PLAYERS.length}`} />
        <Stat k="OUT" v={`${out}`} />
        <Stat k="SLEEPY JAIL" v={`${game.inJail.size}`} hot={game.inJail.size > 0} />
        <Stat k="CROWD AT" v={crowdPub ? `PUB ${crowdPub}` : 'PRE-GAME'} />
      </div>

      <div className="mx-[14px] mb-4 grid grid-cols-4 gap-1" role="tablist" aria-label="Control room sections">
        {(['live', 'results', 'players', 'testing'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`border-2 border-ink py-2 font-pix text-[8px] ${tab === t ? 'bg-yolk text-ink' : 'bg-ink text-wool'}`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {tab === 'live' && <LiveTab flash={flash} />}
      {tab === 'results' && <ResultsTab start={crowdPub || 1} flash={flash} />}
      {tab === 'players' && <PlayersTab flash={flash} />}
      {tab === 'testing' && <TestingTab flash={flash} onExit={exit} />}

      <div className="h-6" />
      {toast && (
        <div role="status" className="fixed bottom-28 left-1/2 z-40 -translate-x-1/2 whitespace-nowrap border-4 border-yolk bg-ink px-4 py-3 font-pix text-[10px] text-yolk">
          {toast}
        </div>
      )}
      {playerId && <TabBar />}
    </Screen>
  )
}

function Stat({ k, v, hot }: { k: string; v: string; hot?: boolean }) {
  return (
    <div className={`flex justify-between p-3 font-pix text-[9px] ${hot ? 'bg-red text-white' : 'bg-ink text-white'}`}>
      {k} <em className="not-italic text-yolk">{v}</em>
    </div>
  )
}

/* ---------------- LIVE: announcements + activity ---------------- */

interface Feed { at: string; text: string; tone: 'pine' | 'red' | 'royal' | 'muted' }

function LiveTab({ flash }: { flash: (m: string) => void }) {
  const { game } = useGameCtx()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [gmLog, setGmLog] = useState<{ message: string; created_at: string }[]>([])

  useEffect(() => {
    if (!supabase) return
    const sb = supabase
    const load = () => sb.from('gm_log').select('message,created_at').order('created_at', { ascending: false }).limit(30).then(({ data }) => data && setGmLog(data))
    load()
    const id = setInterval(load, 20_000)
    return () => clearInterval(id)
  }, [game.checkins, game.results])

  const announce = async (msg: string | null) => {
    if (!supabase) return
    setBusy(true)
    const { error } = await supabase
      .from('settings')
      .update({ announcement: msg, announced_at: msg ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq('id', 1)
    setBusy(false)
    if (error) return flash('COULD NOT SEND')
    if (msg) {
      log(`Announced: "${msg}"`)
      setText('')
    }
    game.reload()
    flash(msg ? 'SENT TO EVERYONE' : 'BANNER CLEARED')
  }

  const feed: Feed[] = useMemo(() => {
    const f: Feed[] = []
    for (const c of game.checkins) {
      const how = c.source === 'gm' ? ' (by GM)' : c.source === 'crew' && c.by_player ? ` (by ${name(c.by_player)})` : ''
      f.push({ at: c.at, text: `${name(c.player_id)} checked in at ${pubByN(c.pub_n).name}${how}`, tone: 'pine' })
    }
    for (const r of game.results) f.push({ at: r.set_at, text: `${name(r.player_id)} ${r.outcome === 'pass' ? 'passed' : 'failed'} at ${pubByN(r.pub_n).name}`, tone: r.outcome === 'pass' ? 'pine' : 'red' })
    for (const j of game.jail) {
      f.push({ at: j.since, text: `${name(j.player_id)} sent to Sleepy Jail${j.last_pub ? ` (last seen at ${pubByN(j.last_pub).name})` : ''}`, tone: 'red' })
      if (j.released_at) f.push({ at: j.released_at, text: `${name(j.player_id)} released from Sleepy Jail`, tone: 'royal' })
    }
    for (const b of game.bonuses) f.push({ at: b.created_at, text: `${name(b.player_id)} ${b.points > 0 ? '+' : ''}${b.points}: ${b.reason}`, tone: b.points < 0 ? 'red' : 'royal' })
    for (const g of gmLog) f.push({ at: g.created_at, text: g.message, tone: 'muted' })
    return f.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40)
  }, [game.checkins, game.results, game.jail, game.bonuses, gmLog])

  const current = game.settings.announcement

  return (
    <>
      <Panel title="ANNOUNCE" hint="Banner on every phone">
        <div className="flex flex-col gap-2 p-3">
          {current && (
            <div className="flex items-start gap-2 border-2 border-ink bg-yolk p-2">
              <span className="flex-1 text-[15px] leading-[19px]"><b>Showing now:</b> {current}</span>
              <Btn onClick={() => announce(null)} disabled={busy}>CLEAR</Btn>
            </div>
          )}
          <label htmlFor="ann" className="sr-only">Message to all players</label>
          <textarea
            id="ann"
            rows={2}
            maxLength={140}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Taxi rank meet-up in 10. Nobody gets left behind!"
            className="w-full resize-none border-2 border-ink bg-white p-2 text-[16px] leading-[20px] text-ink"
          />
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-muted">{text.length}/140</span>
            <button type="button" className="btn-big sm !w-auto" disabled={busy || !text.trim()} onClick={() => announce(text.trim())}>
              SEND ▶
            </button>
          </div>
          <p className="m-0 text-[13px] leading-[17px] text-muted">Shows as a banner in the app. Push notifications to locked phones come in the next build.</p>
        </div>
      </Panel>

      <Panel title="ACTIVITY" hint="Newest first">
        {feed.length ? (
          <ul className="m-0 max-h-[420px] list-none overflow-y-auto p-0">
            {feed.map((e, i) => (
              <li key={i} className="flex gap-3 border-b-2 border-dashed border-[#CFC6B6] px-3 py-2 last:border-0">
                <span className="shrink-0 font-pix text-[8px] leading-[18px] text-muted">{clock(e.at)}</span>
                <span className={`text-[15px] leading-[19px] ${e.tone === 'red' ? 'text-red' : e.tone === 'royal' ? 'text-royal' : e.tone === 'muted' ? 'text-muted' : ''}`}>{e.text}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 p-3 text-[15px] text-muted">Nothing yet. Check-ins, results and jail time appear here as they happen.</p>
        )}
      </Panel>
    </>
  )
}

/* ---------------- RESULTS: pass / fail per pub ---------------- */

function ResultsTab({ start, flash }: { start: number; flash: (m: string) => void }) {
  const { game } = useGameCtx()
  const [n, setN] = useState(start)
  const pub = pubByN(n)

  const set = async (id: PlayerId, outcome: 'pass' | 'fail') => {
    if (!supabase) return
    const current = game.result(id, n)
    const { error } = current === outcome
      ? await supabase.from('results').delete().eq('player_id', id).eq('pub_n', n)
      : await supabase.from('results').upsert({ player_id: id, pub_n: n, outcome, set_at: new Date().toISOString() }, { onConflict: 'player_id,pub_n' })
    await game.reload()
    if (error) return flash('COULD NOT SAVE')
    flash(current === outcome ? `${name(id).toUpperCase()}: CLEARED` : `${name(id).toUpperCase()} ${outcome === 'pass' ? 'PASSED' : 'FAILED'}`)
  }

  const markAll = async (outcome: 'pass') => {
    if (!supabase) return
    const ids = PLAYERS.filter((p) => game.visited[p.id].has(n) && !game.result(p.id, n)).map((p) => p.id)
    if (!ids.length) return flash('NOBODY LEFT TO MARK')
    const { error } = await supabase.from('results').upsert(ids.map((id) => ({ player_id: id, pub_n: n, outcome, set_at: new Date().toISOString() })), { onConflict: 'player_id,pub_n' })
    await game.reload()
    flash(error ? 'COULD NOT SAVE' : `${ids.length} PASSED`)
  }

  const reached = PLAYERS.filter((p) => game.visited[p.id].has(n))
  const notYet = PLAYERS.filter((p) => !game.visited[p.id].has(n))

  return (
    <>
      <div className="mx-[14px] mb-3 grid grid-cols-6 gap-1" role="tablist" aria-label="Pub">
        {PUBS.map((p) => (
          <button
            key={p.n}
            type="button"
            role="tab"
            aria-selected={p.n === n}
            aria-label={`Pub ${p.n}: ${p.name}`}
            onClick={() => setN(p.n)}
            className={`border-2 border-ink py-2 font-pix text-[10px] ${p.n === n ? 'bg-yolk text-ink' : 'bg-wool text-ink'}`}
          >
            {p.n}
          </button>
        ))}
      </div>

      <Panel title={`PUB ${n} · ${pub.name.toUpperCase()}`}>
        <div className="border-b-4 border-ink bg-white p-3">
          <div className="font-pix text-[8px] text-pine">CHALLENGE</div>
          <div className="mt-1 text-[16px] leading-[20px]">{pub.challenge}</div>
          {pub.forfeit && <div className="mt-2 text-[14px] leading-[18px] text-red">Forfeit: {pub.forfeit}</div>}
        </div>
        <ul className="m-0 list-none p-0">
          {[...reached, ...notYet].map((p) => {
            const r = game.result(p.id, n)
            const here = game.visited[p.id].has(n)
            return (
              <li key={p.id} className={`flex items-center gap-3 border-b-2 border-dashed border-[#CFC6B6] px-3 py-2 last:border-0 ${here ? '' : 'opacity-55'}`}>
                <AvatarBox id={p.id} size={36} />
                <div className="min-w-0 flex-1">
                  <b className="text-[16px]">{p.name}</b>
                  <div className="text-[13px] text-muted">{here ? (r ? (r === 'pass' ? 'Passed' : 'Failed') : 'Reached · not marked') : 'Not here yet'}</div>
                </div>
                <Btn tone={r === 'pass' ? 'pine' : 'white'} pressed={r === 'pass'} onClick={() => set(p.id, 'pass')} label={`${p.name} passed`}>PASS</Btn>
                <Btn tone={r === 'fail' ? 'red' : 'white'} pressed={r === 'fail'} onClick={() => set(p.id, 'fail')} label={`${p.name} failed`}>FAIL</Btn>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center justify-between gap-2 border-t-4 border-ink p-3">
          <span className="text-[13px] leading-[17px] text-muted">Tap a highlighted button again to clear it.</span>
          <Btn tone="pine" onClick={() => markAll('pass')}>PASS ALL UNMARKED</Btn>
        </div>
      </Panel>

      <BonusPanel n={n} flash={flash} />
    </>
  )
}

/** Bonus points, e.g. best dressed at Press Bar (+20). Shown on the leaderboard breakdown. */
function BonusPanel({ n, flash }: { n: number; flash: (m: string) => void }) {
  const { game } = useGameCtx()
  const [who, setWho] = useState<PlayerId | ''>('')
  const [reason, setReason] = useState('')
  const presets: [string, number][] = n === 2 ? [['Best dressed at Press Bar', SCORING.bestDressed]] : []
  const amounts = [5, 10, 20, -5, -10]

  const award = async (points: number, why: string) => {
    if (!supabase || !who) return flash('PICK A PLAYER FIRST')
    const label = why.trim() || `Game Master bonus at ${pubByN(n).name}`
    const { error } = await supabase.from('bonuses').insert({ player_id: who, points, reason: label })
    await game.reload()
    if (error) return flash('COULD NOT AWARD')
    setReason('')
    flash(`${name(who).toUpperCase()} ${points > 0 ? '+' : ''}${points}`)
  }

  const remove = async (id: number) => {
    if (!supabase) return
    const { error } = await supabase.from('bonuses').delete().eq('id', id)
    await game.reload()
    flash(error ? 'COULD NOT REMOVE' : 'BONUS REMOVED')
  }

  return (
    <Panel title="BONUS POINTS" hint="Shows on the leaderboard">
      <div className="flex flex-col gap-2 p-3">
        <label htmlFor="bonuswho" className="sr-only">Player</label>
        <select id="bonuswho" value={who} onChange={(e) => setWho(e.target.value as PlayerId)} className="border-2 border-ink bg-white p-2 text-[16px]">
          <option value="">Pick a player…</option>
          {PLAYERS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {presets.map(([why, pts]) => (
          <Btn key={why} tone="yolk" onClick={() => award(pts, why)}>{why.toUpperCase()} +{pts}</Btn>
        ))}
        <label htmlFor="bonuswhy" className="sr-only">Reason</label>
        <input
          id="bonuswhy"
          value={reason}
          maxLength={60}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (e.g. Sing song MVP)"
          className="border-2 border-ink bg-white p-2 text-[16px]"
        />
        <div className="flex flex-wrap gap-1">
          {amounts.map((a) => (
            <Btn key={a} tone={a > 0 ? 'pine' : 'red'} onClick={() => award(a, reason)}>{a > 0 ? '+' : ''}{a}</Btn>
          ))}
        </div>
      </div>
      {game.bonuses.length > 0 && (
        <ul className="m-0 list-none border-t-4 border-ink p-0">
          {[...game.bonuses].reverse().map((b) => (
            <li key={b.id} className="flex items-center gap-2 border-b-2 border-dashed border-[#CFC6B6] px-3 py-2 last:border-0">
              <Avatar id={b.player_id} size={24} />
              <span className="min-w-0 flex-1 text-[14px] leading-[18px]"><b>{name(b.player_id)}</b> · {b.reason}</span>
              <b className={`text-[14px] ${b.points < 0 ? 'text-red' : 'text-pine'}`}>{b.points > 0 ? '+' : ''}{b.points}</b>
              <Btn onClick={() => remove(b.id)} label={`Remove ${b.reason}`}>✕</Btn>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

/* ---------------- PLAYERS: status, jail, manual check-in, PINs ---------------- */

interface Seen { player_id: PlayerId; updated_at: string; accuracy_m: number | null }

function PlayersTab({ flash }: { flash: (m: string) => void }) {
  const { game } = useGameCtx()
  const { players, reload: reloadPlayers } = usePlayers(15_000)
  const [seen, setSeen] = useState<Record<string, Seen>>({})
  const [sel, setSel] = useState<Set<PlayerId>>(new Set())
  const [bulkPub, setBulkPub] = useState<number | null>(null)
  const [confirmPin, setConfirmPin] = useState<PlayerId | null>(null)

  useEffect(() => {
    if (!supabase) return
    const sb = supabase
    const load = () =>
      sb.from('locations').select('player_id,updated_at,accuracy_m').then(({ data }) => {
        if (data) setSeen(Object.fromEntries((data as Seen[]).map((d) => [d.player_id, d])))
      })
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [])

  const toggle = (id: PlayerId) =>
    setSel((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const checkIn = async (ids: PlayerId[], n: number) => {
    if (!supabase || !ids.length) return
    const { error } = await supabase.from('checkins').upsert(
      ids.map((id) => ({ player_id: id, pub_n: n, source: 'gm', by_player: null })),
      { onConflict: 'player_id,pub_n', ignoreDuplicates: true },
    )
    // Arriving somewhere gets you out of jail
    const jailed = ids.filter((id) => game.inJail.has(id))
    if (jailed.length) await supabase.from('jail').update({ released_at: new Date().toISOString() }).in('player_id', jailed)
    await game.reload()
    flash(error ? 'COULD NOT CHECK IN' : ids.length === 1 ? `${name(ids[0]).toUpperCase()} → PUB ${n}` : `${ids.length} → PUB ${n}`)
  }

  const undo = async (id: PlayerId) => {
    const n = game.lastPub[id]
    if (!supabase || !n) return
    const { error } = await supabase.from('checkins').delete().eq('player_id', id).eq('pub_n', n)
    if (!error) log(`Undid ${name(id)}'s check-in at ${pubByN(n).name}`)
    await game.reload()
    flash(error ? 'COULD NOT UNDO' : `${name(id).toUpperCase()} BACK TO PUB ${n - 1}`)
  }

  const jail = async (id: PlayerId) => {
    if (!supabase) return
    const inJail = game.inJail.has(id)
    const { error } = inJail
      ? await supabase.from('jail').update({ released_at: new Date().toISOString() }).eq('player_id', id)
      : await supabase.from('jail').upsert({ player_id: id, last_pub: game.lastPub[id] || null, since: new Date().toISOString(), released_at: null }, { onConflict: 'player_id' })
    await game.reload()
    flash(error ? 'COULD NOT UPDATE JAIL' : inJail ? `${name(id).toUpperCase()} RELEASED` : `${name(id).toUpperCase()} JAILED`)
  }

  const resetPin = async (id: PlayerId) => {
    const res = await gmResetPin(id)
    setConfirmPin(null)
    if (!res.ok) return flash(CLAIM_MESSAGES[res.error ?? 'network'].toUpperCase())
    await reloadPlayers()
    flash(`${name(id).toUpperCase()} CAN PICK A NEW PIN`)
  }

  // Suggest the next pub for a bulk check-in: one past the furthest selected player
  const suggested = Math.min(12, Math.max(1, ...[...sel].map((id) => game.lastPub[id] + 1)))
  const target = bulkPub ?? suggested

  return (
    <>
      <Panel title="PLAYERS" hint="Tick players to check in a group">
        <ul className="m-0 list-none p-0">
          {PLAYERS.map((p) => {
            const n = game.lastPub[p.id]
            const jailed = game.inJail.has(p.id)
            const row = players?.find((r) => r.id === p.id)
            const s = seen[p.id]
            return (
              <li key={p.id} className="border-b-2 border-dashed border-[#CFC6B6] px-3 py-2 last:border-0">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={sel.has(p.id)}
                    onChange={() => toggle(p.id)}
                    aria-label={`Select ${p.name}`}
                    className="h-5 w-5 shrink-0 accent-[var(--color-pine)]"
                  />
                  <AvatarBox id={p.id} size={36} />
                  <div className="min-w-0 flex-1">
                    <b className="text-[16px]">{p.name}</b>
                    <div className={`text-[13px] leading-[17px] ${jailed ? 'text-red' : 'text-muted'}`}>
                      {jailed ? `Sleepy Jail · last pub ${n || '-'}` : n ? `Pub ${n} · ${pubByN(n).name}` : 'Not started'}
                      {row && !row.has_pin && ' · not joined'}
                    </div>
                    <div className="text-[12px] leading-[15px] text-muted">{s ? `Phone seen ${ago(s.updated_at)}` : 'Phone not seen yet'}</div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap justify-end gap-1">
                  {confirmPin === p.id ? (
                    <>
                      <span className="mr-auto self-center text-[13px]">Wipe {p.name}'s PIN?</span>
                      <Btn tone="red" onClick={() => resetPin(p.id)}>YES, RESET</Btn>
                      <Btn onClick={() => setConfirmPin(null)}>NO</Btn>
                    </>
                  ) : (
                    <>
                      {row?.has_pin && <Btn onClick={() => setConfirmPin(p.id)}>RESET PIN</Btn>}
                      <Btn tone={jailed ? 'yolk' : 'ink'} onClick={() => jail(p.id)}>{jailed ? 'RELEASE' : 'JAIL'}</Btn>
                      <Btn disabled={!n} onClick={() => undo(p.id)}>UNDO</Btn>
                      <Btn tone="pine" disabled={n >= 12} onClick={() => checkIn([p.id], n + 1)}>+1 PUB</Btn>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </Panel>

      {sel.size > 0 && (
        <div style={{ bottom: 'calc(max(14px, env(safe-area-inset-bottom)) + 76px)' }} className="sticky z-20 mx-[14px] flex items-center gap-2 border-4 border-yolk bg-ink p-2 text-white">
          <span className="font-pix text-[9px]">{sel.size} TO</span>
          <label htmlFor="bulkpub" className="sr-only">Pub</label>
          <select
            id="bulkpub"
            value={target}
            onChange={(e) => setBulkPub(Number(e.target.value))}
            className="min-w-0 flex-1 border-2 border-wool bg-ink px-1 py-1 text-[15px] text-white"
          >
            {PUBS.map((p) => <option key={p.n} value={p.n}>{p.n}. {p.name}</option>)}
          </select>
          <Btn tone="pine" onClick={async () => { await checkIn([...sel], target); setSel(new Set()); setBulkPub(null) }}>CHECK IN</Btn>
          <Btn onClick={() => { setSel(new Set()); setBulkPub(null) }} label="Clear selection">✕</Btn>
        </div>
      )}
    </>
  )
}

/* ---------------- TESTING ---------------- */

function TestingTab({ flash, onExit }: { flash: (m: string) => void; onExit: () => void }) {
  const { game, practice, setPractice } = useGameCtx()
  const [open, setOpen] = useState(false)
  const [pins, setPins] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  const counts = [
    ['check-ins', game.checkins.length],
    ['results', game.results.length],
    ['Sleepy Jail records', game.jail.length],
    ['bonus points', game.bonuses.length],
    ['photos', game.photos.length],
  ] as const

  const reset = async () => {
    if (!supabase) return
    setBusy(true)
    // Photo files first: Supabase won't let SQL delete storage files
    const files = game.photos.flatMap((p) => [p.path, thumbPath(p.path)])
    for (let i = 0; i < files.length; i += 100) await supabase.storage.from('photos').remove(files.slice(i, i + 100))
    const { data, error } = await supabase.rpc('gm_full_reset', { p_reset_pins: pins })
    setBusy(false)
    if (error || !(data as { ok?: boolean })?.ok) return flash('RESET FAILED')
    setOpen(false)
    setTyped('')
    await game.reload()
    flash(pins ? 'RESET · EVERYONE RE-JOINS' : 'GAME RESET')
  }

  return (
    <>
      <Panel title="PRACTICE MODE">
        <label className="flex items-start gap-3 p-3 text-[16px] leading-[20px]">
          <input type="checkbox" checked={practice} onChange={(e) => setPractice(e.target.checked)} className="mt-[2px] h-5 w-5 shrink-0 accent-[var(--color-pine)]" />
          Auto check-in on this phone before game day, with no time limits. Turn it off when you're done.
        </label>
      </Panel>

      <Panel title="FULL RESET" hint="Can't be undone">
        <div className="flex flex-col gap-3 p-3">
          <p className="m-0 text-[15px] leading-[19px]">
            Puts the game back to unstarted: everyone off the map, scores to zero, photos and Sleepy Jail cleared.
          </p>
          <ul className="m-0 list-none p-0 text-[14px] leading-[19px] text-muted">
            {counts.map(([label, n]) => <li key={label}>{n} {label}</li>)}
          </ul>
          {!open ? (
            <Btn tone="red" onClick={() => setOpen(true)}>RESET THE GAME…</Btn>
          ) : (
            <div className="flex flex-col gap-3 border-[3px] border-red bg-white p-3">
              <label className="flex items-start gap-3 text-[15px] leading-[19px]">
                <input type="checkbox" checked={pins} onChange={(e) => setPins(e.target.checked)} className="mt-[2px] h-5 w-5 shrink-0 accent-[var(--color-red)]" />
                Also wipe everyone's PIN. Every phone goes back to "Who are you?" and has to re-join.
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[14px]">Type <b>RESET</b> to confirm</span>
                <input
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  className="border-2 border-ink bg-white p-2 font-pix text-[12px] uppercase"
                />
              </label>
              <div className="flex gap-2">
                <Btn tone="red" disabled={busy || typed.trim().toUpperCase() !== 'RESET'} onClick={reset}>{busy ? 'RESETTING…' : 'RESET EVERYTHING'}</Btn>
                <Btn onClick={() => { setOpen(false); setTyped('') }}>CANCEL</Btn>
              </div>
            </div>
          )}
        </div>
      </Panel>

      <Panel title="THIS PHONE">
        <div className="flex items-center justify-between gap-2 p-3">
          <span className="text-[15px] leading-[19px]">Sign this phone out of Game Master.</span>
          <Btn tone="ink" onClick={onExit}>EXIT GM</Btn>
        </div>
      </Panel>
    </>
  )
}
