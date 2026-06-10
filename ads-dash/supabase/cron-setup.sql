-- =============================================
-- CRON SETUP — dispara send-report a cada 15 min
-- Execute no SQL Editor do Supabase APÓS deployar a Edge Function
-- =============================================

-- 1. Habilita as extensões necessárias
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net  with schema extensions;

-- 2. Salva sua URL e service key para reutilizar
-- Substitua os valores entre <> pelos do seu projeto
-- (Settings → API → URL e service_role key)
do $$
begin
  perform set_config('app.supabase_url',     '<SUA_URL>',         false);
  perform set_config('app.service_role_key', '<SUA_SERVICE_KEY>', false);
  perform set_config('app.internal_api_key', '<INTERNAL_API_KEY>', false);
end $$;

-- 3. Agenda o cron a cada 15 minutos (send-report)
select cron.schedule(
  'ads-dashboard-send-reports',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/send-report',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || current_setting('app.service_role_key'),
      'x-internal-key', current_setting('app.internal_api_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- 4. Agenda o cron a cada hora (instagram-sync)
select cron.schedule(
  'ads-dashboard-instagram-sync',
  '0 * * * *',
  $$
  select net.http_post(
    url     := current_setting('app.supabase_url') || '/functions/v1/instagram-sync',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer ' || current_setting('app.service_role_key'),
      'x-internal-key', current_setting('app.internal_api_key')
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Para listar:    select * from cron.job;
-- Para remover:   select cron.unschedule('ads-dashboard-send-reports');
