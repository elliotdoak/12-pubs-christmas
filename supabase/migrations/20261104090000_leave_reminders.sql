-- Leave reminders: on game day, pg_cron pings the notify Edge Function every minute. The function
-- works out whether a pub's "10 mins left" warning is due and sends it once, recording it in push_sent.
--
-- Before running this, add two Vault secrets (SQL editor):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<long random string>', 'notify_cron_secret');
-- and set the same random string as the CRON_SECRET Edge Function secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- One row per reminder sent, so overlapping cron runs never double-send
create table if not exists public.push_sent (
  key      text primary key,
  sent_at  timestamptz not null default now()
);
alter table public.push_sent enable row level security;
-- No policies: only the Edge Function (service role) uses it

-- Every minute from 12:00 to 21:59 UTC on 28 November (Glasgow is on GMT, so UTC is local time).
-- Re-running this replaces the job of the same name.
select cron.schedule(
  'leave-reminders',
  '* 12-21 28 11 *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'notify_cron_secret')
    ),
    body := '{"kind":"leave"}'::jsonb
  );
  $$
);
