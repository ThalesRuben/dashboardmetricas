-- 0012_metas_kpi.sql
-- Metas por KPI × período (semana / trimestre / ano). Tabela flexível pra
-- comportar qualquer KPI futuro sem alterar schema. `quarterly_goals` continua
-- funcionando pro código legado, mas as features novas (top-level /metas,
-- banner do Dashboard, seção Settings) leem daqui.

create table public.metas_kpi (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  kpi             text not null,
  periodo         text not null check (periodo in ('semana','trimestre','ano')),
  periodo_ref     text not null,
  valor_meta      numeric not null default 0,
  valor_realizado numeric not null default 0,
  unidade         text not null default 'num' check (unidade in ('BRL','num','x','%')),
  label           text,
  ordem           int  not null default 0,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  unique (tenant_id, kpi, periodo, periodo_ref)
);

create index metas_kpi_tenant_periodo_idx
  on public.metas_kpi(tenant_id, periodo, periodo_ref);

alter table public.metas_kpi enable row level security;

create policy "metas_kpi_tenant_isolation" on public.metas_kpi
  for all using (tenant_id in (select public.current_user_tenants()));

-- Trigger pra manter atualizado_em
create or replace function public.metas_kpi_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger metas_kpi_touch
  before update on public.metas_kpi
  for each row execute function public.metas_kpi_touch_updated_at();

-- ============================================================
-- get_metas_periodo: lista as metas configuradas pro periodo_ref
-- corrente, JÁ com valor_realizado preenchido por agregação (quando dá)
-- ou mantendo o que está na linha (pra KPIs manuais como faturamento).
-- ============================================================

create or replace function public.get_metas_periodo(
  p_periodo    text,
  p_periodo_ref text
)
returns table (
  id              uuid,
  kpi             text,
  label           text,
  unidade         text,
  ordem           int,
  valor_meta      numeric,
  valor_realizado numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select
    m.id,
    m.kpi,
    m.label,
    m.unidade,
    m.ordem,
    m.valor_meta,
    case
      -- KPIs auto-computados a partir do banco — sobrescrevem o realizado manual
      when m.kpi = 'leads'
        then (select count(*) from whatsapp_threads where status = 'lead')::numeric
      when m.kpi = 'vendas'
        then (select count(*) from whatsapp_threads where status = 'venda')::numeric
      when m.kpi = 'agendamentos'
        then (select count(*) from whatsapp_threads where status = 'agendado')::numeric
      when m.kpi = 'conversas_whatsapp'
        then (select count(*) from whatsapp_threads)::numeric
      -- Demais (faturamento, ads, ROAS, etc.): valor manual da linha
      else m.valor_realizado
    end as valor_realizado
  from metas_kpi m
  where m.periodo = p_periodo
    and m.periodo_ref = p_periodo_ref
  order by m.ordem, m.label;
end;
$$;

grant execute on function public.get_metas_periodo(text, text) to anon, authenticated;

-- ============================================================
-- upsert_meta_kpi: cria ou atualiza meta. Idempotente.
-- ============================================================

create or replace function public.upsert_meta_kpi(
  p_kpi             text,
  p_periodo         text,
  p_periodo_ref     text,
  p_valor_meta      numeric,
  p_valor_realizado numeric default null,
  p_unidade         text default 'num',
  p_label           text default null,
  p_ordem           int default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tenant_id uuid;
  v_id        uuid;
begin
  -- Pega o primeiro tenant do usuário corrente (multi-tenant fica simples
  -- enquanto só temos 1 tenant ativo).
  select t into v_tenant_id from public.current_user_tenants() t limit 1;
  if v_tenant_id is null then
    raise exception 'sem tenant associado ao usuário corrente';
  end if;

  insert into metas_kpi as m (
    tenant_id, kpi, periodo, periodo_ref,
    valor_meta, valor_realizado, unidade, label, ordem
  )
  values (
    v_tenant_id, p_kpi, p_periodo, p_periodo_ref,
    p_valor_meta, coalesce(p_valor_realizado, 0),
    p_unidade, p_label, p_ordem
  )
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set
    valor_meta      = excluded.valor_meta,
    valor_realizado = coalesce(p_valor_realizado, m.valor_realizado),
    unidade         = excluded.unidade,
    label           = coalesce(excluded.label, m.label),
    ordem           = excluded.ordem
  returning m.id into v_id;

  return v_id;
end;
$$;

grant execute on function public.upsert_meta_kpi(text, text, text, numeric, numeric, text, text, int) to authenticated;
