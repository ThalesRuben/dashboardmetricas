-- 0044_seo_suggest_cron.sql
-- Agenda seo-suggest pra rodar semanalmente às quintas 07h UTC (04h BRT).
-- Depois do seo-audit (quarta) pra ter dados fresquinhos de auditoria no snapshot.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'seo-suggest-weekly') then
    perform cron.unschedule('seo-suggest-weekly');
  end if;
end $$;

select cron.schedule(
  'seo-suggest-weekly',
  '0 7 * * 4',   -- quinta-feira 07:00 UTC (04:00 BRT)
  $sql$
    select net.http_post(
      url     := 'https://wvygpfeaifhkzxyrfzte.supabase.co/functions/v1/seo-suggest',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $sql$
);
