-- 0016_seed_metas_h1_ads_real.sql
-- Atualiza os valores realizados de tráfego (investimento_ads) do H1/2026
-- com os gastos reais informados pelo salão:
--
--   Janeiro:   R$  8.300,00
--   Fevereiro: R$  5.844,54
--   Março:     R$ 17.018,61
--   Abril:     R$ 18.854,49
--   Maio:      R$ 21.130,88
--   Junho:     R$ 23.549,75
--
-- Q1 (não tinha meta planejada) vira "fechado real": min=base=max=realizado.
-- Q2 mantém a meta planejada e apenas grava o valor_realizado.
-- Ano é recomputado no padrão faturamento: Q1 real + Q2/Q3/Q4 planejados.
--
-- Idempotente: roda quantas vezes quiser. Usa o primeiro tenant da tabela.

do $$
declare
  v_tenant uuid;
begin
  select id into v_tenant from public.tenants order by created_at asc nulls last, id asc limit 1;
  if v_tenant is null then
    raise exception 'Nenhum tenant encontrado em public.tenants.';
  end if;

  -- ===== TRÁFEGO Q1 — MESES (fechado real: min=base=max=realizado) =====
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'investimento_ads', 'mes', '2026-01',  8300.00,  8300.00,  8300.00,  8300.00, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-02',  5844.54,  5844.54,  5844.54,  5844.54, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-03', 17018.61, 17018.61, 17018.61, 17018.61, 'BRL', 'Investimento em Ads', 6)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      valor_realizado = excluded.valor_realizado,
      unidade = excluded.unidade,
      label = excluded.label,
      ordem = excluded.ordem;

  -- ===== TRÁFEGO Q1 — TRIMESTRE (fechado real) =====
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'investimento_ads', 'trimestre', '2026-Q1', 31163.15, 31163.15, 31163.15, 31163.15, 'BRL', 'Investimento em Ads', 6)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      valor_realizado = excluded.valor_realizado,
      unidade = excluded.unidade,
      label = excluded.label,
      ordem = excluded.ordem;

  -- ===== TRÁFEGO Q2 — MESES (mantém plano, grava realizado) =====
  update public.metas_kpi set valor_realizado = 18854.49
    where tenant_id = v_tenant and kpi = 'investimento_ads' and periodo = 'mes' and periodo_ref = '2026-04';
  update public.metas_kpi set valor_realizado = 21130.88
    where tenant_id = v_tenant and kpi = 'investimento_ads' and periodo = 'mes' and periodo_ref = '2026-05';
  update public.metas_kpi set valor_realizado = 23549.75
    where tenant_id = v_tenant and kpi = 'investimento_ads' and periodo = 'mes' and periodo_ref = '2026-06';

  -- ===== TRÁFEGO Q2 — TRIMESTRE (mantém plano, grava realizado = 63.535,12) =====
  update public.metas_kpi set valor_realizado = 63535.12
    where tenant_id = v_tenant and kpi = 'investimento_ads' and periodo = 'trimestre' and periodo_ref = '2026-Q2';

  -- ===== TRÁFEGO — ANO (recompoe padrão faturamento: Q1 real + Q2..Q4 planejados) =====
  --   base = 31.163,15 + 90.000 + 165.000 + 225.000 = 511.163,15
  --   min  = 31.163,15 + 82.000 + 150.000 + 210.000 = 473.163,15
  --   max  = 31.163,15 + 98.000 + 180.000 + 240.000 = 549.163,15
  --   realizado = 31.163,15 (Q1) + 63.535,12 (Q2 real) = 94.698,27
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'investimento_ads', 'ano', '2026', 511163.15, 473163.15, 549163.15, 94698.27, 'BRL', 'Investimento em Ads', 6)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      valor_realizado = excluded.valor_realizado,
      unidade = excluded.unidade,
      label = excluded.label,
      ordem = excluded.ordem;

  raise notice 'Realizado de tráfego H1/2026 aplicado no tenant %', v_tenant;
end $$;

-- Verificação rápida:
-- select periodo, periodo_ref, valor_meta_min, valor_meta, valor_meta_max, valor_realizado
-- from public.metas_kpi
-- where kpi = 'investimento_ads' and periodo_ref like '2026%'
-- order by periodo, periodo_ref;
