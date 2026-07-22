-- 0029_ads_sync_infra.sql
-- Infraestrutura de sync de Meta Ads (Google Ads no futuro):
--   ads_sync_log        auditoria por execução da edge function
--   ads_daily_agg RPC   série por dia agregada por tenant/plataforma p/ Dashboard

create table public.ads_sync_log (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  source       text not null check (source in ('meta','google')),
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       text not null default 'running' check (status in ('running','ok','error')),
  range_from   date,
  range_to     date,
  rows_upserted int not null default 0,
  error        text,
  raw          jsonb
);

create index ads_sync_log_tenant_idx on public.ads_sync_log(tenant_id, started_at desc);

alter table public.ads_sync_log enable row level security;
create policy "ads_sync_log_tenant_isolation" on public.ads_sync_log
  for all using (tenant_id in (select public.current_user_tenants()));

-- RPC agregada: soma métricas por dia (todas as campanhas) no range escolhido.
-- Usada por useDailyMetrics no lugar do gerador mock.
create or replace function public.ads_daily_agg(
  p_tenant_id uuid,
  p_from      date,
  p_to        date,
  p_source    text default null   -- 'meta' | 'google' | null (ambos)
)
returns table (
  date          date,
  investido     numeric,
  receita       numeric,
  impressoes    bigint,
  cliques       bigint,
  mensagens     bigint,
  agendamentos  bigint,
  vendas        bigint,
  ctr_meta      numeric,
  ctr_google    numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    m.date,
    sum(m.investido)::numeric        as investido,
    sum(m.receita)::numeric          as receita,
    sum(m.impressoes)::bigint        as impressoes,
    sum(m.cliques)::bigint           as cliques,
    sum(m.mensagens)::bigint         as mensagens,
    sum(m.agendamentos)::bigint      as agendamentos,
    sum(m.vendas)::bigint            as vendas,
    coalesce(avg(nullif(m.ctr_meta,0)),   0)::numeric as ctr_meta,
    coalesce(avg(nullif(m.ctr_google,0)), 0)::numeric as ctr_google
  from public.ads_daily_metrics m
  left join public.ads_campaigns c on c.id = m.campaign_id
  where m.tenant_id = p_tenant_id
    and m.date between p_from and p_to
    and (p_source is null or c.source = p_source)
  group by m.date
  order by m.date;
$$;
