// Sends web pushes to phones with alerts on.
//   { kind: 'alarm' }                 GM: "Drink up, we're leaving now", with each player's next pub
//   { kind: 'announce' }              GM: the current announcement banner
//   { kind: 'jail', player: 'HA' }    GM: tells that player they're in Sleepy Jail
//   { kind: 'leave' }                 pg_cron, every minute on game day: "10 mins left at ...", once per pub
//   { kind: 'leave', pub: 2 }         test: sends pub 2's reminder now (skips the time window and the once-only check)
// Messages are always built from the database, never taken from the request.
//
// Secrets (Edge Functions > Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: address),
// CRON_SECRET (same value as the notify_cron_secret Vault secret the cron job sends).
// "Verify JWT" must be off: the cron job has no user token, so this function checks callers itself.

import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

interface Sub { endpoint: string; player_id: string; p256dh: string; auth: string }
interface Message { title: string; body: string; tag: string; url: string }
interface Pub { n: number; name: string; arrive_at: string; leave_at: string }

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

const MIN = 60_000
// Short stops (15 minutes or less) get a 5-minute warning, so it doesn't land the moment you arrive
const leadFor = (p: Pub) => (new Date(p.leave_at).getTime() - new Date(p.arrive_at).getTime() <= 15 * MIN ? 5 : 10)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const body = await req.json().catch(() => ({}))
  const kind = body.kind as string

  // Who's calling: the cron job (shared secret) or the Game Master (their sign-in token)
  const cronSecret = Deno.env.get('CRON_SECRET')
  const fromCron = !!cronSecret && req.headers.get('x-cron-secret') === cronSecret
  if (!fromCron) {
    const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    })
    const { data: { user } } = await asCaller.auth.getUser()
    if (user?.app_metadata?.role !== 'gm') return json({ ok: false, error: 'not_gm' }, 403)
  }
  if (!['alarm', 'announce', 'jail', 'leave'].includes(kind)) return json({ ok: false, error: 'bad_kind' }, 400)
  if (fromCron && kind !== 'leave') return json({ ok: false, error: 'not_gm' }, 403)

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const [{ data: pubs }, { data: checkins }] = await Promise.all([
    db.from('pubs').select('n,name,arrive_at,leave_at').order('n'),
    db.from('checkins').select('player_id,pub_n'),
  ])
  const last: Record<string, number> = {}
  for (const c of checkins ?? []) last[c.player_id] = Math.max(last[c.player_id] ?? 0, c.pub_n)
  // Same rule as the app: your next pub is the first one after your last check-in
  const nextFor = (id: string) => (pubs as Pub[] | null)?.find((p) => p.n > (last[id] ?? 0))

  let only: string[] | null = null // player ids to send to; null means everyone
  let ttl = 3600
  let messageFor: (playerId: string) => Message

  if (kind === 'announce') {
    const { data: settings } = await db.from('settings').select('announcement').eq('id', 1).single()
    if (!settings?.announcement) return json({ ok: false, error: 'no_announcement' }, 400)
    const msg: Message = { title: 'GAME MASTER', body: settings.announcement, tag: 'announce', url: '/lobby' }
    messageFor = () => msg
  } else if (kind === 'alarm') {
    ttl = 600 // the in-app alarm only lasts 10 minutes, so a late alarm push is pointless
    messageFor = (id) => {
      const next = nextFor(id)
      return {
        title: "DRINK UP! WE'RE LEAVING NOW",
        body: next ? `Next stop: pub ${next.n}, ${next.name}. Tap to see where.` : 'Finish your drink and follow the crew.',
        tag: 'alarm',
        url: '/map',
      }
    }
  } else if (kind === 'jail') {
    const player = String(body.player ?? '')
    const { data: cell } = await db.from('jail').select('player_id').eq('player_id', player).is('released_at', null).maybeSingle()
    if (!cell) return json({ ok: false, error: 'not_in_jail' }, 400)
    only = [player]
    messageFor = (id) => {
      const next = nextFor(id)
      return {
        title: "YOU'RE IN SLEEPY JAIL",
        body: next ? `Nodded off? Check in at ${next.name} to break out.` : 'Nodded off? Find the crew to break out.',
        tag: 'jail',
        url: '/map',
      }
    }
  } else {
    // Leave reminder: the pub whose warning window we're in, or the one asked for when testing
    const now = Date.now()
    const forced = body.pub ? (pubs as Pub[]).find((p) => p.n === Number(body.pub)) : undefined
    const pub = forced ?? (pubs as Pub[]).find((p) => {
      const leave = new Date(p.leave_at).getTime()
      return now >= leave - leadFor(p) * MIN && now < leave
    })
    if (!pub) return json({ ok: true, sent: 0, failed: 0, skipped: 'no_pub_due' })
    if (!forced) {
      // Once per pub: the first cron run inside the window claims it, later runs see the row and stop
      const { data: claimed } = await db.from('push_sent')
        .upsert({ key: `leave:${pub.n}:${pub.leave_at}` }, { onConflict: 'key', ignoreDuplicates: true })
        .select()
      if (!claimed?.length) return json({ ok: true, sent: 0, failed: 0, skipped: 'already_sent' })
    }
    ttl = leadFor(pub) * 60
    const next = (pubs as Pub[]).find((p) => p.n > pub.n)
    const leaveAt = new Date(pub.leave_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/London' })
    const msg: Message = next
      ? { title: `${leadFor(pub)} MINS LEFT AT ${pub.name.toUpperCase()}`, body: `We leave at ${leaveAt}. Next stop: pub ${next.n}, ${next.name}. Drink up.`, tag: 'leave', url: '/lobby' }
      : { title: `LAST ORDERS AT ${pub.name.toUpperCase()}`, body: `${leadFor(pub)} minutes until ${leaveAt}. What a day.`, tag: 'leave', url: '/lobby' }
    messageFor = () => msg
    // Anyone already checked in further along doesn't need telling to leave
    const ahead = new Set(Object.entries(last).filter(([, n]) => n > pub.n).map(([id]) => id))
    if (ahead.size) {
      const { data: everyone } = await db.from('players').select('id')
      only = ((everyone ?? []) as { id: string }[]).map((p) => p.id).filter((id) => !ahead.has(id))
    }
  }

  let q = db.from('push_subscriptions').select('endpoint,player_id,p256dh,auth')
  if (only) q = q.in('player_id', only)
  const { data } = await q
  const subs = (data ?? []) as Sub[]
  if (!subs.length) return json({ ok: true, sent: 0, failed: 0, players: 0 })

  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(messageFor(s.player_id)),
        // No push Topic header: Apple rejects some (BadWebPushTopic), and the notification tag already replaces old ones
        { TTL: ttl, urgency: 'high' },
      ),
    ),
  )

  const ok: string[] = []
  const gone: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push(subs[i].endpoint)
    else if ([404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)) gone.push(subs[i].endpoint)
    else console.error('push failed', kind, subs[i].player_id, r.reason)
  })
  // Phones that unsubscribed or reinstalled: forget them
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone)
  if (ok.length) await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).in('endpoint', ok)

  const reached = new Set(subs.filter((s) => ok.includes(s.endpoint)).map((s) => s.player_id))
  return json({ ok: true, sent: ok.length, failed: results.length - ok.length, players: reached.size })
})
