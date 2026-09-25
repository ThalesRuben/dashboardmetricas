-- 0043_seo_audit_cron.sql
-- Agenda seo-audit pra rodar semanalmente (quarta às 07h UTC = 04h BRT).
-- Auditoria on-page muda pouco, não vale rodar diário — semanal já pega mudanças.

do $$
begin
  if exists (select 1 from cron.job where jobname = 'seo-audit-weekly') then
    perform cron.unschedule('seo-audit-weekly');
  end if;
end $$;

select cron.schedule(
  'seo-audit-weekly',
  '0 7 * * 3',   -- quarta-feira 07:00 UTC (04:00 BRT)
  $sql$
    select net.http_post(
      url     := 'https://wvygpfeaifhkzxyrfzte.supabase.co/functions/v1/seo-audit',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $sql$
);
