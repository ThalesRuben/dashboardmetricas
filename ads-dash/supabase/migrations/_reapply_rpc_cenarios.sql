-- Reaplica a função get_metas_periodo do 0013 (cenários mín/máx + realizado
-- auto por janela do período). Idempotente. Não toca em dados.

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
  else
    v_ano := split_part(p_periodo_ref, '-W', 1)::int;
    v_w   := split_part(p_periodo_ref, '-W', 2)::int;
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

-- Força o PostgREST a recarregar o schema (caso contrário o cache pode manter
-- a assinatura antiga da função por alguns minutos).
notify pgrst, 'reload schema';

-- Verificação: deve incluir valor_meta_min e valor_meta_max nas colunas
select kpi, valor_meta_min, valor_meta, valor_meta_max, valor_realizado
from public.get_metas_periodo('trimestre', '2026-Q2');
