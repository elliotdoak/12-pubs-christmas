# 12 Pubs of Christmas

The 10th anniversary crawl app, presented by DoakDigital. Glasgow, Saturday 28 November 2026, 12.30pm.

An installable web app (PWA) in an 8-bit Christmas jumper style. No app stores: players add it to their home screen.

## Stack

| Layer | Choice |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS v4 |
| Installable app | `vite-plugin-pwa` (manifest, service worker, offline cache, web push) |
| Backend | Supabase free tier: Postgres, Realtime, Storage, Edge Functions, pg_cron |
| Hosting | Cloudflare Workers static assets (free), auto-deploys from GitHub: https://12pubs.elliot-doak.workers.dev |

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your Supabase URL and anon key
npm run dev
```

To test on a phone on the same Wi-Fi: `npm run dev -- --host`, then open the network URL. Location and notifications need HTTPS, so do proper phone testing on https://12pubs.elliot-doak.workers.dev.

## Project layout

```
public/sprites/      pixel art: avatars, costumes, pubs, map, logo
src/data/crawl.ts    players, costumes, pubs, rules, pairs, scoring
src/lib/supabase.ts  Supabase client
supabase/migrations  database schema and security rules
supabase/seed.sql    players and pubs
```

## Game rules the code enforces

- **Check-in is automatic.** Geolocation checks you in within each pub's radius. Crewmates can check you in ("who's with you?"). The Game Master is the fallback.
- **Only the Game Master marks pass or fail.** Database security rules enforce this, not just the UI.
- **Sleepy Jail runs off the timetable.** Not seen at the next pub by its leave time? Jailed. The Game Master can release you.

## Build order

1. ~~Scaffold and deploy~~
2. Supabase project, schema and seed data
3. Install walkthrough, player picker, lobby countdown
4. Map, geolocation check-in, per-player unlocks
5. Game Master page
6. Leaderboard, photo wall, Hall of Fame
7. Push notifications, 5-minute alarm, Sleepy Jail sweep
8. Drunk Eyes, polish, test crawl

## Open questions

- [TK] Pub coordinates for geofencing (`lat`/`lng` in `src/data/crawl.ts` and `supabase/seed.sql`)
- [TK] Hammy's handcuff partner, now that Div can't make it
- [TK] Grant's costume confirmation
- [TK] Felsons leave time (7.40pm) overlaps Supercube arrival (7.30pm)
