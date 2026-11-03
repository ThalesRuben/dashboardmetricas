-- 0053_seed_outubro_rollup_q4_ano.sql
-- Propaga o fechamento de Outubro/2026 (0052) pro realizado do trimestre Q4
-- e do ano, igual padrão da 0017 (jun → Q2 → ano).
--
-- Snapshot antes da 0052:
--   Faturamento ano realizado = 3.543.532,72 (= Q1+Q2+Q3 já fechados)
--   Faturamento Q3 realizado  = 1.354.033,47
--   Tráfego     ano realizado =   210.971,27 (= Q1+Q2+Q3)
--   Tráfego     Q3 realizado  =   116.273,00
--
-- Como Nov/Dez ainda não aconteceram, Q4 realizado = Outubro.
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

  -- ===== Q4 — faturamento realizado =====
  --   Out 486.911,69 (+ Nov 0 + Dez 0)
  update public.metas_kpi set valor_realizado = 486911.69
    where tenant_id = v_tenant and kpi = 'faturamento' and periodo = 'trimestre' and periodo_ref = '2026-Q4';

  -- ===== ANO — faturamento realizado =====
  --   3.543.532,72 (Q1+Q2+Q3) + 486.911,69 (Out) = 4.030.444,41
  update public.metas_kpi set valor_realizado = 4030444.41
    where tenant_id = v_tenant and kpi = 'faturamento' and periodo = 'ano' and periodo_ref = '2026';

  -- ===== Q4 — tráfego realizado =====
  update public.metas_kpi set valor_realizado = 43000
    where tenant_id = v_tenant and kpi = 'investimento_ads' and periodo = 'trimestre' and periodo_ref = '2026-Q4';

  -- ===== ANO — tráfego realizado =====
  --   210.971,27 (Q1+Q2+Q3) + 43.000 (Out) = 253.971,27
  update public.metas_kpi set valor_realizado = 253971.27
    where tenant_id = v_tenant and kpi = 'investimento_ads' and periodo = 'ano' and periodo_ref = '2026';

  raise notice 'Rollup Out/2026 → Q4/ano aplicado no tenant %', v_tenant;
end $$;

-- Verificação rápida:
-- select kpi, periodo, periodo_ref, valor_meta, valor_realizado
-- from public.metas_kpi
-- where kpi in ('faturamento','investimento_ads')
--   and periodo in ('trimestre','ano')
--   and periodo_ref in ('2026-Q4','2026')
-- order by kpi, periodo, periodo_ref;
