-- 12 Pubs of Christmas: initial schema
-- Identity: each phone signs in anonymously, then an Edge Function (claim-player) checks the
-- player's PIN and writes { player_id, role } into the user's app_metadata. RLS reads those claims.
-- app_metadata can only be set server-side, so players cannot promote themselves to Game Master.

create or replace function public.my_player() returns text
language sql stable as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'player_id', '')
$$;

create or replace function public.is_gm() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'gm'
$$;

-- ---------- reference data ----------
create table public.players (
  id          text primary key,              -- 'KY', 'RE' ...
  name        text not null,
  costume     text not null,
  pin_hash    text,                          -- bcrypt, set by the GM; never exposed to clients
  pair_group  int
);

create table public.pubs (
  n           int primary key check (n between 1 and 12),
  name        text not null,
  arrive_at   timestamptz not null,
  leave_at    timestamptz not null,
  challenge   text not null,
  forfeit     text,
  lat         double precision,
  lng         double precision,
  radius_m    int not null default 50
);

-- ---------- live game state ----------
create table public.checkins (
  player_id   text not null references public.players(id),
  pub_n       int  not null references public.pubs(n),
  at          timestamptz not null default now(),
  source      text not null check (source in ('geo', 'crew', 'gm')),
  by_player   text references public.players(id),   -- who did it (self, a crewmate, or null for GM)
  accuracy_m  real,
  primary key (player_id, pub_n)
);

-- Pass/fail is Game Master only. No player-facing write path exists.
create table public.results (
  player_id   text not null references public.players(id),
  pub_n       int  not null references public.pubs(n),
  outcome     text not null check (outcome in ('pass', 'fail')),
  set_at      timestamptz not null default now(),
  primary key (player_id, pub_n)
);

create table public.locations (
  player_id   text primary key references public.players(id),
  lat         double precision not null,
  lng         double precision not null,
  accuracy_m  real,
  updated_at  timestamptz not null default now()
);

create table public.jail (
  player_id   text primary key references public.players(id),
  last_pub    int references public.pubs(n),
  since       timestamptz not null default now(),
  released_at timestamptz
);

create table public.photos (
  id          uuid primary key default gen_random_uuid(),
  player_id   text not null references public.players(id),
  pub_n       int references public.pubs(n),
  path        text not null,                 -- storage path in the 'photos' bucket
  caption     text,
  tagged      text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table public.bonuses (
  id          bigint generated always as identity primary key,
  player_id   text not null references public.players(id),
  points      int not null,
  reason      text not null,
  created_at  timestamptz not null default now()
);

create table public.push_subscriptions (
  endpoint    text primary key,
  player_id   text not null references public.players(id),
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now()
);

create table public.gm_log (
  id          bigint generated always as identity primary key,
  message     text not null,
  created_at  timestamptz not null default now()
);

-- ---------- leaderboard ----------
create view public.leaderboard with (security_invoker = true) as
select
  p.id, p.name,
  (select count(*) from public.checkins c where c.player_id = p.id) as pubs,
  (select count(*) from public.results r where r.player_id = p.id and r.outcome = 'pass') as passed,
  (select count(*) from public.results r where r.player_id = p.id and r.outcome = 'fail') as failed,
  (select count(*) from public.photos ph where ph.player_id = p.id) as photos,
  coalesce((select sum(points) from public.bonuses b where b.player_id = p.id), 0) as bonus,
  exists (select 1 from public.jail j where j.player_id = p.id and j.released_at is null) as in_jail
from public.players p;

-- ---------- row level security ----------
alter table public.players enable row level security;
alter table public.pubs enable row level security;
alter table public.checkins enable row level security;
alter table public.results enable row level security;
alter table public.locations enable row level security;
alter table public.jail enable row level security;
alter table public.photos enable row level security;
alter table public.bonuses enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.gm_log enable row level security;

-- Hide PIN hashes from every client
-- (a column-level revoke does not override a table-level grant, so re-grant only the safe columns)
revoke select on public.players from anon, authenticated;
grant select (id, name, costume, pair_group) on public.players to authenticated;

create policy "read players"   on public.players   for select to authenticated using (true);
create policy "read pubs"      on public.pubs      for select to authenticated using (true);
create policy "read checkins"  on public.checkins  for select to authenticated using (true);
create policy "read results"   on public.results   for select to authenticated using (true);
create policy "read locations" on public.locations for select to authenticated using (true);
create policy "read jail"      on public.jail      for select to authenticated using (true);
create policy "read photos"    on public.photos    for select to authenticated using (true);
create policy "read bonuses"   on public.bonuses   for select to authenticated using (true);

-- Check-ins: yourself, a crewmate ("who's with you?"), or the GM
create policy "check in" on public.checkins for insert to authenticated
  with check (is_gm() or (my_player() is not null and by_player = my_player() and source in ('geo', 'crew')));
create policy "gm edits checkins" on public.checkins for update to authenticated using (is_gm()) with check (is_gm());
create policy "gm deletes checkins" on public.checkins for delete to authenticated using (is_gm());

-- Results: Game Master only
create policy "gm sets results" on public.results for all to authenticated using (is_gm()) with check (is_gm());

-- Locations: your own pin only
create policy "share my location" on public.locations for insert to authenticated with check (player_id = my_player());
create policy "move my location"  on public.locations for update to authenticated using (player_id = my_player()) with check (player_id = my_player());

-- Jail, bonuses, log: GM (the jail sweep runs with the service role, which bypasses RLS)
create policy "gm jail"    on public.jail    for all to authenticated using (is_gm()) with check (is_gm());
create policy "gm bonuses" on public.bonuses for all to authenticated using (is_gm()) with check (is_gm());
create policy "gm log"     on public.gm_log  for all to authenticated using (is_gm()) with check (is_gm());

-- Photos: post as yourself; delete your own, or GM deletes any
create policy "post photo"   on public.photos for insert to authenticated with check (player_id = my_player());
create policy "delete photo" on public.photos for delete to authenticated using (player_id = my_player() or is_gm());

-- Push subscriptions: your own device only
create policy "my push" on public.push_subscriptions for all to authenticated
  using (player_id = my_player()) with check (player_id = my_player());

-- ---------- realtime ----------
alter publication supabase_realtime add table public.checkins, public.results, public.locations, public.jail, public.photos, public.bonuses;
