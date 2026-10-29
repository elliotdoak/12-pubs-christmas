-- Game Master "full reset": put the game back to unstarted in one go.
-- Clears check-ins, results, Sleepy Jail, bonus points, photos, locations, announcements,
-- the activity log and PIN lockouts. Optionally wipes PINs too, so everyone re-joins.
-- Photo files in storage are removed by the app first (Supabase blocks deleting them from SQL).

alter table public.settings add column if not exists reset_at timestamptz;

create or replace function public.gm_full_reset(p_reset_pins boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_gm() then return jsonb_build_object('ok', false, 'error', 'not_gm'); end if;

  delete from public.checkins where true;
  delete from public.results where true;
  delete from public.jail where true;
  delete from public.bonuses where true;
  delete from public.photos where true;
  delete from public.locations where true;
  delete from public.gm_log where true;
  delete from private.pin_attempts where true;

  if p_reset_pins then
    update public.players set pin_hash = null where true;
    -- Sign every phone out of its player (Game Master role is kept)
    update auth.users set raw_app_meta_data = raw_app_meta_data - 'player_id'
     where raw_app_meta_data ? 'player_id';
  end if;

  update public.settings
     set announcement = null, announced_at = null, reset_at = now(), updated_at = now()
   where id = 1;

  insert into public.gm_log (message)
  values (case when p_reset_pins then 'Full reset, including PINs' else 'Full reset' end);
  return jsonb_build_object('ok', true);
end $$;

revoke all on function public.gm_full_reset(boolean) from public, anon;
grant execute on function public.gm_full_reset(boolean) to authenticated;
