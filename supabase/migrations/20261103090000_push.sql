-- Web push: each phone that turns on alerts saves its push subscription against its player.
-- Phones write through save_push / drop_push only; the notify Edge Function reads the table with
-- the service role. The Game Master sees who is reachable through push_coverage().

-- The table itself came with the initial schema; this adds what the sender needs.
-- Safe to run more than once.
alter table public.push_subscriptions add column if not exists user_agent text;
alter table public.push_subscriptions add column if not exists updated_at timestamptz not null default now();
alter table public.push_subscriptions add column if not exists last_ok_at timestamptz;

-- Clients now go through save_push / drop_push only, so the direct-access policy goes
drop policy if exists "my push" on public.push_subscriptions;

create or replace function public.save_push(p_endpoint text, p_p256dh text, p_auth text, p_ua text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare me text := public.my_player();
begin
  if me is null then return jsonb_build_object('ok', false, 'error', 'no_player'); end if;
  insert into public.push_subscriptions (endpoint, player_id, p256dh, auth, user_agent)
  values (p_endpoint, me, p_p256dh, p_auth, left(p_ua, 300))
  on conflict (endpoint) do update
    set player_id = excluded.player_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- Called before switching player, so the old player stops getting this phone's alerts
create or replace function public.drop_push(p_endpoint text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.push_subscriptions where endpoint = p_endpoint and player_id = public.my_player();
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.push_coverage() returns table (player_id text, phones int, last_ok_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select s.player_id, count(*)::int, max(s.last_ok_at)
    from public.push_subscriptions s
   where public.is_gm()
   group by s.player_id
$$;

revoke all on function public.save_push(text, text, text, text) from public, anon;
revoke all on function public.drop_push(text) from public, anon;
revoke all on function public.push_coverage() from public, anon;
grant execute on function public.save_push(text, text, text, text) to authenticated;
grant execute on function public.drop_push(text) to authenticated;
grant execute on function public.push_coverage() to authenticated;
