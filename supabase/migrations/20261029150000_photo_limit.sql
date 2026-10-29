-- Max 3 photos per person per pub (and 3 "before the crawl"). Enforced in the database,
-- so it holds even if someone bypasses the app.

create or replace function public.photo_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.photos
       where player_id = new.player_id and pub_n is not distinct from new.pub_n) >= 3 then
    raise exception 'photo_limit' using hint = 'Max 3 photos per person per pub';
  end if;
  return new;
end $$;

drop trigger if exists photos_limit on public.photos;
create trigger photos_limit before insert on public.photos
  for each row execute function public.photo_limit();
