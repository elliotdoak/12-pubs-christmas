-- 12 Pubs of Christmas: player PINs and Game Master login
--
-- How identity works:
--   1. Every phone signs in anonymously (Supabase Auth).
--   2. The player picks their name and enters a 4-digit PIN.
--      First time: that PIN becomes theirs. After that (new phone, reinstall): it must match.
--   3. claim_player() writes { player_id } into the user's app_metadata. The app refreshes its
--      session and every RLS policy can then trust my_player().
--   4. The Game Master does the same with the GM PIN via claim_gm(), which adds { role: 'gm' }.
-- app_metadata can only be written server-side, so nobody can fake either claim.
--
-- After running this file, set the Game Master PIN once in the SQL Editor:
--   select private.set_gm_pin('1234');   -- use your own 4 digits

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.settings (
  key   text primary key,
  value text not null
);

-- Failed PIN attempts, for lockouts (5 wrong in 10 minutes locks that name for 10 minutes)
create table if not exists private.pin_attempts (
  id        bigint generated always as identity primary key,
  target    text not null,          -- player id, or 'GM'
  user_id   uuid,
  at        timestamptz not null default now()
);

-- Public "has this player joined?" flag, without exposing the hash
alter table public.players
  add column if not exists has_pin boolean generated always as (pin_hash is not null) stored;
grant select (has_pin) on public.players to authenticated;

-- ---------- helpers ----------
create or replace function private.set_claims(p_claims jsonb) returns void
language sql security definer set search_path = '' as $$
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || p_claims
   where id = auth.uid();
$$;

create or replace function private.locked(p_target text) returns boolean
language sql security definer set search_path = '' as $$
  select count(*) >= 5 from private.pin_attempts
   where target = p_target and at > now() - interval '10 minutes';
$$;

create or replace function private.set_gm_pin(p_pin text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_pin !~ '^\d{4}$' then raise exception 'PIN must be 4 digits'; end if;
  insert into private.settings (key, value)
  values ('gm_pin_hash', extensions.crypt(p_pin, extensions.gen_salt('bf')))
  on conflict (key) do update set value = excluded.value;
end $$;

-- ---------- player: claim (set or check PIN) ----------
create or replace function public.claim_player(p_player text, p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  if p_pin !~ '^\d{4}$' then return jsonb_build_object('ok', false, 'error', 'bad_format'); end if;
  if private.locked(p_player) then return jsonb_build_object('ok', false, 'error', 'locked'); end if;

  select pin_hash into v_hash from public.players where id = p_player;
  if not found then return jsonb_build_object('ok', false, 'error', 'no_player'); end if;

  if v_hash is null then
    update public.players set pin_hash = extensions.crypt(p_pin, extensions.gen_salt('bf')) where id = p_player;
  elsif v_hash <> extensions.crypt(p_pin, v_hash) then
    insert into private.pin_attempts (target, user_id) values (p_player, auth.uid());
    return jsonb_build_object('ok', false, 'error', case when private.locked(p_player) then 'locked' else 'wrong_pin' end);
  end if;

  perform private.set_claims(jsonb_build_object('player_id', p_player));
  return jsonb_build_object('ok', true, 'new_pin', v_hash is null);
end $$;

-- ---------- player: sign out of a name on this phone ----------
create or replace function public.release_player() returns void
language sql security definer set search_path = '' as $$
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'player_id'
   where id = auth.uid();
$$;

-- ---------- Game Master ----------
create or replace function public.claim_gm(p_pin text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'no_session'); end if;
  if private.locked('GM') then return jsonb_build_object('ok', false, 'error', 'locked'); end if;
  select value into v_hash from private.settings where key = 'gm_pin_hash';
  if v_hash is null then return jsonb_build_object('ok', false, 'error', 'gm_pin_not_set'); end if;
  if p_pin !~ '^\d{4}$' or v_hash <> extensions.crypt(p_pin, v_hash) then
    insert into private.pin_attempts (target, user_id) values ('GM', auth.uid());
    return jsonb_build_object('ok', false, 'error', case when private.locked('GM') then 'locked' else 'wrong_pin' end);
  end if;
  perform private.set_claims(jsonb_build_object('role', 'gm'));
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.release_gm() returns void
language sql security definer set search_path = '' as $$
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'role'
   where id = auth.uid();
$$;

-- GM wipes a player's PIN (forgotten PIN, or someone grabbed the wrong name).
-- The player then sets a new PIN next time they pick their name.
create or replace function public.gm_reset_pin(p_player text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_gm() then return jsonb_build_object('ok', false, 'error', 'not_gm'); end if;
  update public.players set pin_hash = null where id = p_player;
  delete from private.pin_attempts where target = p_player;
  insert into public.gm_log (message) values ('PIN reset for ' || p_player);
  return jsonb_build_object('ok', true);
end $$;

-- ---------- who can call what ----------
revoke all on function private.set_claims(jsonb), private.locked(text), private.set_gm_pin(text) from public, anon, authenticated;
revoke all on function public.claim_player(text, text), public.release_player(), public.claim_gm(text),
                    public.release_gm(), public.gm_reset_pin(text) from public, anon;
grant execute on function public.claim_player(text, text), public.release_player(), public.claim_gm(text),
                    public.release_gm(), public.gm_reset_pin(text) to authenticated;
