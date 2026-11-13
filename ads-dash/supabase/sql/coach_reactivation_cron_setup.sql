-- Setup do pg_cron pra rodar coach-reactivation-cron 2x/dia.
-- EXECUTAR MANUALMENTE no Supabase SQL Editor.
--
-- Pré-requisitos: project ref = wvygpfeaifhkzxyrfzte (DASH-TBC)

-- 1) Habilita as extensões (idempotente)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) (OPCIONAL) Grava o anon key num local seguro pra usar nos jobs.
--    Usamos vault pra não deixar em claro na definição do cron.
--    Se sua org não usa vault, substitua direto no corpo dos jobs abaixo.
--
--    Pra setar: no Dashboard → Settings → Vault, criar segredo "ads_dash_anon_key"
--    com o valor do anon key. Ou usar este SQL se já tiver o helper:
--
-- select vault.create_secret('<ANON_KEY_AQUI>', 'ads_dash_anon_key');

-- 3) Agenda 2 jobs — 9h e 14h BRT (= 12h e 17h UTC)
--    Se já existirem, roda unschedule primeiro.
select cron.unschedule('coach-reactivation-manha') where exists (
  select 1 from cron.job where jobname = 'coach-reactivation-manha'
);
select cron.unschedule('coach-reactivation-tarde') where exists (
  select 1 from cron.job where jobname = 'coach-reactivation-tarde'
);

-- Manhã — 12h UTC (9h BRT)
select cron.schedule(
  'coach-reactivation-manha',
  '0 12 * * *',
  $$
  select net.http_post(
    url     := 'https://wvygpfeaifhkzxyrfzte.supabase.co/functions/v1/coach-reactivation-cron',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ads_dash_anon_key'),
      'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'ads_dash_anon_key')
    ),
    body    := '{"dry_run": false}'::jsonb
  );
  $$
);

-- Tarde — 17h UTC (14h BRT)
select cron.schedule(
  'coach-reactivation-tarde',
  '0 17 * * *',
  $$
  select net.http_post(
    url     := 'https://wvygpfeaifhkzxyrfzte.supabase.co/functions/v1/coach-reactivation-cron',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'ads_dash_anon_key'),
      'apikey',        (select decrypted_secret from vault.decrypted_secrets where name = 'ads_dash_anon_key')
    ),
    body    := '{"dry_run": false}'::jsonb
  );
  $$
);

-- 4) Confere
select jobname, schedule, active from cron.job where jobname like 'coach-reactivation-%';
