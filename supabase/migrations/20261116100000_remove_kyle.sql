-- Kyle can no longer make it. Remove him and anything recorded against him.
-- Reece (Kyle's handcuff partner) pairs up with Hammy (Div's old partner) instead.

-- Check-ins Kyle made for other people stay; they just lose the "checked in by" name
update public.checkins set by_player = null where by_player = 'KY';
update public.photos   set tagged = array_remove(tagged, 'KY') where 'KY' = any(tagged);

delete from public.push_subscriptions where player_id = 'KY';
delete from public.checkins  where player_id = 'KY';
delete from public.results   where player_id = 'KY';
delete from public.locations where player_id = 'KY';
delete from public.jail      where player_id = 'KY';
delete from public.photos    where player_id = 'KY';
delete from public.bonuses   where player_id = 'KY';

-- Sign Kyle's phone out of his player (it goes back to "Who are you?")
update auth.users set raw_app_meta_data = raw_app_meta_data - 'player_id'
 where raw_app_meta_data ->> 'player_id' = 'KY';

delete from public.players where id = 'KY';

update public.players set pair_group = 2 where id = 'RE';
