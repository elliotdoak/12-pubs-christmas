-- Div can no longer make it. Remove him and anything recorded against him.
delete from public.push_subscriptions where player_id = 'DV';
delete from public.checkins  where player_id = 'DV' or by_player = 'DV';
delete from public.results   where player_id = 'DV';
delete from public.locations where player_id = 'DV';
delete from public.jail      where player_id = 'DV';
delete from public.photos    where player_id = 'DV';
delete from public.bonuses   where player_id = 'DV';
delete from public.players   where id = 'DV';
