-- 0013_metas_cenarios_mes.sql
-- Estende `metas_kpi` com cenários mín/máx (além do base já existente em
-- `valor_meta`) e adiciona `periodo='mes'` pra quebra mensal dentro do
-- trimestre. Atualiza `get_metas_periodo` pra retornar os 3 cenários e
-- filtrar realizado dos KPIs auto pela janela do período.

-- ------------------------------------------------------------
-- 1) Cenários: mín e máx (base continua em valor_meta — compat).
-- ------------------------------------------------------------
alter table public.metas_kpi
  add column if not exists valor_meta_min numeric,
  add column if not exists valor_meta_max numeric;

-- ------------------------------------------------------------
-- 2) Habilita periodo='mes'. Ref no formato 'YYYY-MM' (ex: '2026-04').
-- ------------------------------------------------------------
alter table public.metas_kpi
  drop constraint if exists metas_kpi_periodo_check;

alter table public.metas_kpi
  add constraint metas_kpi_periodo_check
  check (periodo in ('semana','mes','trimestre','ano'));

-- ------------------------------------------------------------
-- 3) get_metas_periodo: agora retorna mín/base/máx e calcula realizado
--    dos KPIs auto-computados restringindo pela janela do período.
-- ------------------------------------------------------------
drop function if exists public.get_metas_periodo(text, text);

create or replace function public.get_metas_periodo(
  p_periodo     text,
  p_periodo_ref text
)
returns table (
  id                 uuid,
  kpi                text,
  label              text,
  unidade            text,
  ordem              int,
  valor_meta         numeric,
  valor_meta_min     numeric,
  valor_meta_max     numeric,
  valor_realizado    numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz;
  v_fim    timestamptz;
  v_ano    int;
  v_mes    int;
  v_q      int;
  v_w      int;
begin
  -- Resolve [inicio, fim) do periodo_ref.
  if p_periodo = 'ano' then
    v_ano := p_periodo_ref::int;
    v_inicio := make_timestamptz(v_ano, 1, 1, 0, 0, 0);
    v_fim    := make_timestamptz(v_ano + 1, 1, 1, 0, 0, 0);
  elsif p_periodo = 'trimestre' then
    v_ano := split_part(p_periodo_ref, '-Q', 1)::int;
    v_q   := split_part(p_periodo_ref, '-Q', 2)::int;
    v_inicio := make_timestamptz(v_ano, (v_q - 1) * 3 + 1, 1, 0, 0, 0);
    v_fim    := v_inicio + interval '3 months';
  elsif p_periodo = 'mes' then
    v_ano := split_part(p_periodo_ref, '-', 1)::int;
    v_mes := split_part(p_periodo_ref, '-', 2)::int;
    v_inicio := make_timestamptz(v_ano, v_mes, 1, 0, 0, 0);
    v_fim    := v_inicio + interval '1 month';
  else -- semana ISO: ref 'YYYY-Www'
    v_ano := split_part(p_periodo_ref, '-W', 1)::int;
    v_w   := split_part(p_periodo_ref, '-W', 2)::int;
    -- Segunda-feira da semana ISO p_periodo_ref.
    v_inicio := (
      to_timestamp(v_ano::text || '-01-04', 'YYYY-MM-DD')
      - ((extract(isodow from to_timestamp(v_ano::text || '-01-04', 'YYYY-MM-DD'))::int - 1) || ' days')::interval
      + ((v_w - 1) || ' weeks')::interval
    )::timestamptz;
    v_fim := v_inicio + interval '7 days';
  end if;

  return query
  select
    m.id,
    m.kpi,
    m.label,
    m.unidade,
    m.ordem,
    m.valor_meta,
    m.valor_meta_min,
    m.valor_meta_max,
    case
      when m.kpi = 'leads' then (
        select count(*)::numeric from whatsapp_threads
        where status = 'lead'
          and coalesce(criado_em, atualizado_em) >= v_inicio
          and coalesce(criado_em, atualizado_em) <  v_fim
      )
      when m.kpi = 'vendas' then (
        select count(*)::numeric from whatsapp_threads
        where status = 'venda'
          and coalesce(criado_em, atualizado_em) >= v_inicio
          and coalesce(criado_em, atualizado_em) <  v_fim
      )
      when m.kpi = 'agendamentos' then (
        select count(*)::numeric from whatsapp_threads
        where status = 'agendado'
          and coalesce(criado_em, atualizado_em) >= v_inicio
          and coalesce(criado_em, atualizado_em) <  v_fim
      )
      when m.kpi = 'conversas_whatsapp' then (
        select count(*)::numeric from whatsapp_threads
        where coalesce(criado_em, atualizado_em) >= v_inicio
          and coalesce(criado_em, atualizado_em) <  v_fim
      )
      else m.valor_realizado
    end as valor_realizado
  from metas_kpi m
  where m.periodo = p_periodo
    and m.periodo_ref = p_periodo_ref
  order by m.ordem, m.label;
end;
$$;

grant execute on function public.get_metas_periodo(text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 4) upsert_meta_kpi: aceita mín/máx opcionais. Compat: se omitidos,
--    preserva o valor existente.
-- ------------------------------------------------------------
drop function if exists public.upsert_meta_kpi(text, text, text, numeric, numeric, text, text, int);

create or replace function public.upsert_meta_kpi(
  p_kpi             text,
  p_periodo         text,
  p_periodo_ref     text,
  p_valor_meta      numeric,
  p_valor_realizado numeric default null,
  p_unidade         text    default 'num',
  p_label           text    default null,
  p_ordem           int     default 0,
  p_valor_meta_min  numeric default null,
  p_valor_meta_max  numeric default null
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
  select t into v_tenant_id from public.current_user_tenants() t limit 1;
  if v_tenant_id is null then
    raise exception 'sem tenant associado ao usuário corrente';
  end if;

  insert into metas_kpi as m (
    tenant_id, kpi, periodo, periodo_ref,
    valor_meta, valor_meta_min, valor_meta_max,
    valor_realizado, unidade, label, ordem
  )
  values (
    v_tenant_id, p_kpi, p_periodo, p_periodo_ref,
    p_valor_meta, p_valor_meta_min, p_valor_meta_max,
    coalesce(p_valor_realizado, 0),
    p_unidade, p_label, p_ordem
  )
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set
    valor_meta      = excluded.valor_meta,
    valor_meta_min  = coalesce(excluded.valor_meta_min, m.valor_meta_min),
    valor_meta_max  = coalesce(excluded.valor_meta_max, m.valor_meta_max),
    valor_realizado = coalesce(p_valor_realizado, m.valor_realizado),
    unidade         = excluded.unidade,
    label           = coalesce(excluded.label, m.label),
    ordem           = excluded.ordem
  returning m.id into v_id;

  return v_id;
end;
$$;

grant execute on function public.upsert_meta_kpi(text, text, text, numeric, numeric, text, text, int, numeric, numeric) to authenticated;
