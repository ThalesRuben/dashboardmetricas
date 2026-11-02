-- 0052_seed_outubro_realizado.sql
-- Fecha Outubro/2026 nas metas:
--   Faturamento: R$ 486.911,69
--   Tráfego (investimento_ads): R$ 43.000,00
--
-- Só mês. Q4 e ano NÃO são propagados aqui porque Jul/Ago/Set ainda não
-- têm realizados fechados nos migrations (foram ou vão ser gravados via UI
-- com `upsert_meta_kpi`). Rodar o rollup aqui iria sobrescrever valores
-- que o painel pode já ter calculado por acumulação.
--
-- Idempotente. Usa o primeiro tenant da tabela.

do $$
declare
  v_tenant uuid;
begin
  select id into v_tenant from public.tenants order by created_at asc nulls last, id asc limit 1;
  if v_tenant is null then
    raise exception 'Nenhum tenant encontrado em public.tenants.';
  end if;

  -- ===== OUTUBRO — faturamento realizado =====
  update public.metas_kpi set valor_realizado = 486911.69
    where tenant_id = v_tenant and kpi = 'faturamento' and periodo = 'mes' and periodo_ref = '2026-10';

  -- ===== OUTUBRO — tráfego realizado =====
  update public.metas_kpi set valor_realizado = 43000
    where tenant_id = v_tenant and kpi = 'investimento_ads' and periodo = 'mes' and periodo_ref = '2026-10';

  raise notice 'Fechamento Out/2026 aplicado no tenant %', v_tenant;
end $$;

-- Verificação rápida:
-- select kpi, periodo, periodo_ref, valor_meta_min, valor_meta, valor_meta_max, valor_realizado
-- from public.metas_kpi
-- where periodo_ref = '2026-10' and kpi in ('faturamento','investimento_ads')
-- order by kpi;
