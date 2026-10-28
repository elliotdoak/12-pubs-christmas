-- Game Master live settings: the announcement banner.
-- One row only (id = 1). Everyone can read it; only the Game Master can change it.

create table if not exists public.settings (
  id           int primary key default 1 check (id = 1),
  announcement text check (char_length(announcement) <= 140),
  announced_at timestamptz,
  updated_at   timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

alter table public.settings enable row level security;
create policy "read settings" on public.settings for select to authenticated using (true);
create policy "gm updates settings" on public.settings for update to authenticated using (public.is_gm()) with check (public.is_gm());

alter publication supabase_realtime add table public.settings;
