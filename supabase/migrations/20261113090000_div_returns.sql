-- Div is back as a player, but he can't make the crawl: he's at the hospital waiting on his newborn.
-- `away` marks players who aren't on the crawl. The app shows them in the hospital on the map and leaves
-- them out of scoring and check-ins; the notify function skips them for the alarm and leave reminders.
-- Safe to run more than once.

alter table public.players add column if not exists away text;
grant select (away) on public.players to authenticated;

insert into public.players (id, name, costume, pair_group, away)
values ('DV', 'Div', 'mystery', null, 'hospital')
on conflict (id) do update set away = excluded.away, costume = excluded.costume;
