-- Leave alarm: the Game Master sets alarm_at and every open phone sounds a "we're leaving" alarm.
alter table public.settings add column if not exists alarm_at timestamptz;
