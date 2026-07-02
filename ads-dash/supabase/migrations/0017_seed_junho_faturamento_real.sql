-- 0017_seed_junho_faturamento_real.sql
-- Fecha Junho/2026 no faturamento (R$ 407.389,58) e propaga o realizado
-- pro trimestre Q2 e pro ano. Mantém o plano de Q2 (500k base pra Jun) —
-- mesmo padrão que Abr/Mai (plan + realizado, sem colapsar min/base/max).
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

  -- ===== JUNHO — faturamento realizado =====
  update public.metas_kpi set valor_realizado = 407389.58
    where tenant_id = v_tenant and kpi = 'faturamento' and periodo = 'mes' and periodo_ref = '2026-06';

  -- ===== Q2 — trimestre faturamento realizado =====
  --   Abr 372.926,64 + Mai 428.256,98 + Jun 407.389,58 = 1.208.573,20
  update public.metas_kpi set valor_realizado = 1208573.20
    where tenant_id = v_tenant and kpi = 'faturamento' and periodo = 'trimestre' and periodo_ref = '2026-Q2';

  -- ===== ANO — faturamento realizado =====
  --   Q1 980.926,05 + Q2 1.208.573,20 = 2.189.499,25
  update public.metas_kpi set valor_realizado = 2189499.25
    where tenant_id = v_tenant and kpi = 'faturamento' and periodo = 'ano' and periodo_ref = '2026';

  raise notice 'Fechamento Jun/2026 aplicado no tenant %', v_tenant;
end $$;

-- Verificação rápida:
-- select periodo, periodo_ref, valor_meta_min, valor_meta, valor_meta_max, valor_realizado
-- from public.metas_kpi
-- where kpi = 'faturamento' and periodo_ref like '2026%'
-- order by periodo, periodo_ref;
