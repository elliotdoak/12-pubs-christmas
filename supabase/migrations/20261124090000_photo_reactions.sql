-- Emoji reactions on the photo wall, WhatsApp style: one reaction per person per photo.
-- Picking another emoji replaces yours; picking the same one again takes it off.
create table if not exists public.photo_reactions (
  photo_id    uuid not null references public.photos(id) on delete cascade,
  player_id   text not null references public.players(id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),
  primary key (photo_id, player_id)
);

alter table public.photo_reactions enable row level security;
create policy "crew reads reactions" on public.photo_reactions for select to authenticated using (true);
create policy "react as yourself" on public.photo_reactions for insert to authenticated
  with check (player_id = public.my_player());
create policy "change your reaction" on public.photo_reactions for update to authenticated
  using (player_id = public.my_player()) with check (player_id = public.my_player());
create policy "remove your reaction" on public.photo_reactions for delete to authenticated
  using (player_id = public.my_player());

alter publication supabase_realtime add table public.photo_reactions;
