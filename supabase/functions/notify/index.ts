// Sends a web push to every phone with alerts on. Game Master only.
//   POST { kind: 'alarm' }     "Drink up, we're leaving now", with each player's next pub
//   POST { kind: 'announce' }  the current announcement banner
// The message is always read from the database, never taken from the request.
//
// Secrets (supabase secrets set ...): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto: address)

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

webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT')!, Deno.env.get('VAPID_PUBLIC_KEY')!, Deno.env.get('VAPID_PRIVATE_KEY')!)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const url = Deno.env.get('SUPABASE_URL')!
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: { user } } = await asCaller.auth.getUser()
  if (user?.app_metadata?.role !== 'gm') return json({ ok: false, error: 'not_gm' }, 403)

  const { kind } = await req.json().catch(() => ({}))
  if (kind !== 'alarm' && kind !== 'announce') return json({ ok: false, error: 'bad_kind' }, 400)

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const [{ data: settings }, { data: subs }] = await Promise.all([
    db.from('settings').select('announcement').eq('id', 1).single(),
    db.from('push_subscriptions').select('endpoint,player_id,p256dh,auth'),
  ])
  if (!subs?.length) return json({ ok: true, sent: 0, failed: 0 })

  let messageFor: (playerId: string) => Message
  if (kind === 'announce') {
    if (!settings?.announcement) return json({ ok: false, error: 'no_announcement' }, 400)
    const msg: Message = { title: 'GAME MASTER', body: settings.announcement, tag: 'announce', url: '/lobby' }
    messageFor = () => msg
  } else {
    // Same rule as the in-app alarm: next pub is the first one after your last check-in
    const [{ data: pubs }, { data: checkins }] = await Promise.all([
      db.from('pubs').select('n,name').order('n'),
      db.from('checkins').select('player_id,pub_n'),
    ])
    const last: Record<string, number> = {}
    for (const c of checkins ?? []) last[c.player_id] = Math.max(last[c.player_id] ?? 0, c.pub_n)
    messageFor = (id) => {
      const next = pubs?.find((p) => p.n > (last[id] ?? 0))
      return {
        title: "DRINK UP! WE'RE LEAVING NOW",
        body: next ? `Next stop: pub ${next.n}, ${next.name}. Tap to see where.` : 'Finish your drink and follow the crew.',
        tag: 'alarm',
        url: '/map',
      }
    }
  }

  const results = await Promise.allSettled(
    (subs as Sub[]).map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(messageFor(s.player_id)),
        // The in-app alarm only lasts 10 minutes, so a late alarm push is pointless
        { TTL: kind === 'alarm' ? 600 : 3600, urgency: 'high', topic: kind },
      ),
    ),
  )

  const ok: string[] = []
  const gone: string[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') ok.push(subs[i].endpoint)
    else if ([404, 410].includes((r.reason as { statusCode?: number })?.statusCode ?? 0)) gone.push(subs[i].endpoint)
    else console.error('push failed', subs[i].player_id, r.reason)
  })
  // Phones that unsubscribed or reinstalled: forget them
  if (gone.length) await db.from('push_subscriptions').delete().in('endpoint', gone)
  if (ok.length) await db.from('push_subscriptions').update({ last_ok_at: new Date().toISOString() }).in('endpoint', ok)

  const reached = new Set(subs.filter((s) => ok.includes(s.endpoint)).map((s) => s.player_id))
  return json({ ok: true, sent: ok.length, failed: results.length - ok.length, players: reached.size })
})
