-- 0030_ads_daily_agg_defaults.sql
-- Adiciona defaults à `ads_daily_agg` pra o frontend chamar sem passar
-- tenant_id — resolve do usuário autenticado via memberships. Mantém
-- compat: chamadas com p_tenant_id explícito continuam funcionando.

create or replace function public.ads_daily_agg(
  p_tenant_id uuid default null,
  p_from      date default (current_date - 30),
  p_to        date default current_date,
  p_source    text default null
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
  where m.tenant_id = coalesce(
      p_tenant_id,
      (select tenant_id from public.memberships where user_id = auth.uid() limit 1)
    )
    and m.date between p_from and p_to
    and (p_source is null or c.source = p_source)
  group by m.date
  order by m.date;
$$;
