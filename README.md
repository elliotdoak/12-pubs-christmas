# 12 Pubs of Christmas

The 10th anniversary crawl app, presented by DoakDigital. Glasgow, Saturday 28 November 2026, 12.30pm.

An installable web app (PWA) in an 8-bit Christmas jumper style. No app stores: players add it to their home screen, and it checks them in, keeps score and tells them when to move on.

Live at https://12pubs.elliot-doak.workers.dev

## Stack

| Layer | Choice |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS v4 |
| Installable app | `vite-plugin-pwa` (manifest, service worker, offline cache) plus `public/push-sw.js` for web push |
| Backend | Supabase free tier: Postgres, Realtime, Storage, Edge Functions, pg_cron, pg_net, Vault |
| Hosting | Cloudflare Workers static assets (free), auto-deploys from GitHub on push to `main` |

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the three values below
npm run dev
```

| Variable | Where it comes from |
|---|---|
| `VITE_SUPABASE_URL` | Supabase: Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase: Project Settings → API (the publishable key) |
| `VITE_VAPID_PUBLIC_KEY` | `npx web-push generate-vapid-keys` (public key only) |

The same three must be set as **build** variables in Cloudflare (Workers & Pages → 12pubs → Settings → Build → Variables and secrets). Vite bakes them in at build time, so runtime variables won't work.

To test on a phone on the same Wi-Fi: `npm run dev -- --host`, then open the network URL. Location, notifications and the service worker need HTTPS and a production build, so do proper phone testing on the live URL.

## What players get

### Install and join
- **Install walkthrough** for iPhone (Safari → Add to Home Screen) and Android (Chrome → Install app), then alerts and location permissions inside the installed app.
- **Pick your player and set a 4-digit PIN.** Wrong PINs lock you out for 10 minutes. The Game Master can wipe a forgotten PIN.

### Crew (home)
- **Countdown to kick-off**, which becomes a **Next Pub** tile once you've checked in: time left at your current pub, where's next and when to leave. Past kick-off with no check-in, it follows the timetable instead.
- **Your status:** installed or in browser, alerts on or off, location on or off, with a FIX link.
- **Your costume**, which opens the Hall of Fame.
- **Players list** in a collapsible panel (remembered per phone), showing who's joined.

### Map
- **Automatic check-in.** The game checks you in when you're inside a pub's radius (50 m). To stop next-door pubs (Blackfriars and O'Neills are 16 m apart) checking you in early, each pub only opens 10 minutes before the previous pub's leave time.
- **Crew check-in:** "who's with you?" lets you check in mates whose phones have died.
- **Per-player unlocks.** A pub's challenge, forfeit and rules unlock when *you* reach it. Your **next** pub is open to look ahead (marked UP NEXT), but its photos wait until you arrive.
- **Distance chip:** how far the next pub is from the one you're at.
- **Handcuffs and blindfolds** (Blackfriars and O'Neills) show who you're cuffed to, with their name and sprite.
- **Sleepy Jail:** tap the jail to see who's inside and since when.

### Scores
- **Live leaderboard** with a tap-to-expand breakdown for each player, and a "How scoring works" panel.

### Photos
- **Photo wall.** Up to 3 photos per person per pub. Pub photos also show on that pub's sheet.

### Fame
- **Hall of Fame:** every year's costume, from the real photos, tap to zoom.

### Drunk Eyes
- The pint button (top right) cycles **Tipsy → Steaming → Blootered → off**. It blurs and sways the whole app, with a hiccup message at each level. Purely for laughs, saved per phone.

## Scoring

Scores are worked out live from the game data, so changing a value in `SCORING` (`src/data/crawl.ts`) re-scores everyone instantly. Game Master bonuses are the exception: they're saved with their points at the time they're given.

| | Points |
|---|---|
| Each pub you reach | +10 |
| Challenge passed | +15 |
| Challenge failed | −15 |
| Best dressed at Press Bar | +25 (one player) |
| Worst dressed at Press Bar | −25 (one player) |
| Posting a photo at a pub | +5 (once per pub, plus once before the crawl) |
| Sent to Sleepy Jail | −40 (once, however many times you're jailed) |
| Game Master bonus | whatever the GM gives |

How each pub is judged is set by `judging` on the pub in `src/data/crawl.ts`:
- **Default:** pass or fail.
- **`'dressed'`** (Press Bar): best and worst dressed, one of each.
- **`'none'`** (Amsterdam, The Raven, Felsons): no verdict. Any pass or fail recorded there is ignored.

## Game Master page

Log in on the **GM** tab with the Game Master PIN. The page remembers which tab you were on.

| Tab | What it does |
|---|---|
| **Live** | **Leave alarm:** a full-screen siren, flash and buzz on every open phone, "Drink up, we're leaving now", with each player's next pub, plus a push notification to locked phones. Runs for 10 minutes or until stopped. **Announce:** a banner on every phone, plus a push notification. |
| **Results** | Pick a pub, then mark each player PASS or FAIL (or BEST and WORST at Press Bar; nothing at no-verdict pubs). Tap a highlighted button again to clear it. **Bonus points** for anything else, with a reason that shows on the leaderboard. |
| **Players** | Each player's current pub, when their phone was last seen, and whether alerts can reach them. Manual check-in (one player or a ticked group), undo a check-in, **jail and release** (jailing sends them a push), reset a PIN. |
| **Testing** | **Practice mode** and **Full reset** (see below). |

### Practice mode
Runs a game clock on *your phone only*, starting from kick-off, so you can rehearse the day. Jump to kick-off or to any pub's arrival time.
- With **"Move the map to match"** ticked, a jump also moves the shared check-ins. Anyone past that pub is moved back to it, and you're checked in up to it. **This changes the real game data on every phone.**
- Automatic leave reminders follow the real clock, not the practice clock.

### Full reset
Clears check-ins, results, Sleepy Jail, bonuses, photos, locations and the announcement. Optionally wipes PINs too, so everyone re-joins.

## Push notifications

Phones with alerts on get these even when the app is closed or the phone is locked:

| Alert | Sent when | Who gets it | Tapping opens |
|---|---|---|---|
| **DRINK UP! WE'RE LEAVING NOW** | GM sounds the leave alarm | Everyone | Map (and the red alarm screen, within 10 minutes) |
| **GAME MASTER** + the banner text | GM posts an announcement | Everyone | Crew |
| **YOU'RE IN SLEEPY JAIL** | GM jails a player | That player | Map |
| **10 MINS LEFT AT [PUB]** | Automatically, from the timetable on 28 November | Everyone not already further along | Crew |

Leave reminders come 10 minutes before each pub's leave time, or 5 minutes for stops of 15 minutes or less. Each pub sends once, and Supercube sends "LAST ORDERS".

**Limits worth knowing:**
- **iPhone needs iOS 16.4 or later, with the app opened from the home screen.** A Safari tab can't get alerts.
- **A notification is a normal banner and ping.** It can't play the siren or flash the screen. The full alarm only shows when the app is opened.
- **Delivery isn't guaranteed.** Low Power Mode, Focus modes and bad signal can delay or silence it. Check **GM → Players** for anyone showing "no alerts".

### How it works
1. Once alerts are allowed and a player is picked, the phone subscribes and saves the subscription against that player through `save_push`. It re-saves every time the app opens. Switching player removes it (`drop_push`).
2. The **`notify` Edge Function** (`supabase/functions/notify/index.ts`) sends the pushes with the `web-push` library. It builds every message from the database, never from the request, and removes subscriptions that Apple or Google report as gone.
3. **Who can call it:** the Game Master (checked from their sign-in) for `alarm`, `announce` and `jail`, and the **pg_cron job** (checked by a shared secret) for `leave`.
4. The **`leave-reminders` cron job** runs every minute from 12:00 to 21:59 UTC on 28 November. It calls `notify`, which sends any reminder that's due and records it in `push_sent`, so it never double-sends.
5. `public/push-sw.js`, pulled into the generated service worker, shows the notification and opens the right screen when it's tapped.

### Setting it up on a new Supabase project
1. **Keys.** Run `npx web-push generate-vapid-keys`. The public key goes in `VITE_VAPID_PUBLIC_KEY` (locally and in Cloudflare). Both keys go in the function secrets below.
2. **Cron secret.** Run `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. **Vault** (SQL editor):
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<cron secret>', 'notify_cron_secret');
   ```
4. **Edge Function secrets:**
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_SUBJECT` (a `mailto:` address)
   - `CRON_SECRET` (the same value as `notify_cron_secret`)
5. **Extensions:** turn on `pg_cron` and `pg_net` (Database → Extensions).
6. **Migrations:** run every file in `supabase/migrations` in order.
7. **Deploy `notify`** and turn **Verify JWT off**. The cron job has no user token, so the function checks callers itself.

**To test a leave reminder,** run this in the SQL editor. It sends pub 2's reminder now, skipping the time window and the once-only check:
```sql
select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/notify',
  headers := jsonb_build_object('Content-Type', 'application/json',
    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')),
  body := '{"kind":"leave","pub":2}'::jsonb);
-- then, a few seconds later:
select status_code, content from net._http_response order by created desc limit 1;
```

**Troubleshooting:**
- **The GM screen says "PUSH FAILED",** or you get a `500`: check Edge Functions → notify → Logs.
- **`401`:** Verify JWT is still on.
- **`403` with `not_gm`** from the cron job: the Vault secret and `CRON_SECRET` don't match.

## Project layout

```
public/sprites/                 pixel art: avatars, costumes, pubs, map, logo
public/push-sw.js               push and notification-tap handlers for the service worker
src/data/crawl.ts               players, costumes, pubs (times, challenges, judging), rules, pairs, scoring
src/lib/scoring.ts              live leaderboard maths
src/lib/push.ts                 push sign-up and the GM's notify calls
src/lib/game.tsx                live game state, check-ins, practice clock
src/lib/drunk.tsx               Drunk Eyes
src/screens/                    Crew (Lobby), Map, Scores, Photos, Fame (Costumes), GM, install and join
supabase/migrations             database schema, security rules, push and cron
supabase/functions/notify       push sender
supabase/seed.sql               players and pubs
```

**Pub times live in two places:** `src/data/crawl.ts` (used by the app) and the `pubs` table (used by leave reminders). If you change one, change the other.

## Game rules the code enforces

- **Check-in is automatic.** Geolocation checks you in within each pub's radius. Crewmates can check you in ("who's with you?"). The Game Master is the fallback.
- **Only the Game Master marks results and gives bonuses.** Database security rules enforce this, not just the UI.
- **Sleepy Jail is the Game Master's call.** The GM jails a player from GM → Players, which costs −40 and sends them a push. Checking in at any pub afterwards breaks you out, or the GM can release you.

## Build order

1. ~~Scaffold and deploy~~
2. ~~Supabase project, schema and seed data~~
3. ~~Install walkthrough, player picker, lobby countdown~~
4. ~~Map, geolocation check-in, per-player unlocks~~
5. ~~Game Master page~~
6. ~~Leaderboard, photo wall, Hall of Fame~~
7. ~~Push notifications (alarm, announcements, Sleepy Jail, leave reminders)~~
8. ~~Drunk Eyes~~, polish, test crawl

**Possible next steps:**
- A test push button in GM → Players.
- Repeating the alarm until players tap ON MY WAY.
- "The crew has moved on" alerts.
- An automatic Sleepy Jail sweep.
- A clearer "add to home screen first" message for iPhone users in Safari.

## Open questions

- [TK] Confirm the Felsons and Supercube map pins (estimated from their addresses) in `src/data/crawl.ts`
- [TK] Hammy's handcuff partner, now that Div can't make it
- [TK] Grant's costume confirmation
- [TK] Felsons leave time (7.40pm) overlaps Supercube arrival (7.30pm)
- [TK] Test push on an Android phone before game day (only iPhone has been tested)
