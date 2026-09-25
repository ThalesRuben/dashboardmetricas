-- 0041_seo_gsc_cron.sql
-- Agenda sync diário da edge function gsc-sync via pg_cron + pg_net.
--
-- Pré-requisito: extensões pg_cron e pg_net habilitadas no projeto
--   Dashboard → Database → Extensions → pg_cron (enable) e pg_net (enable).
--   Já vêm pré-instaladas no Supabase, só precisam ser habilitadas na UI.
--
-- Horário: 06:00 UTC = 03:00 BRT (Brasil não usa horário de verão desde 2019).
--
-- Como conferir depois:
--   select * from cron.job where jobname = 'gsc-sync-daily';
--   select * from cron.job_run_details where jobid = (
--     select jobid from cron.job where jobname = 'gsc-sync-daily'
--   ) order by start_time desc limit 10;
--
-- Como desagendar (se um dia quiser parar):
--   select cron.unschedule('gsc-sync-daily');

-- Remove job antigo se existir (idempotência p/ re-rodar essa migration)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'gsc-sync-daily') then
    perform cron.unschedule('gsc-sync-daily');
  end if;
end $$;

-- Agenda: todo dia às 06:00 UTC (03:00 BRT)
select cron.schedule(
  'gsc-sync-daily',
  '0 6 * * *',
  $sql$
    select net.http_post(
      url     := 'https://wvygpfeaifhkzxyrfzte.supabase.co/functions/v1/gsc-sync',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := '{"days":28}'::jsonb
    );
  $sql$
);
