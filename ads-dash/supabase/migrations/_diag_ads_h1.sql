-- ============================================================
-- DIAGNÓSTICO + RE-APLICAÇÃO do realizado de tráfego H1/2026
-- Rode tudo no SQL Editor. Vai imprimir 4 blocos NOTICE + retornar
-- o estado final via SELECT no fim.
-- ============================================================

-- 1) Quantos tenants existem?
do $$
declare
  n_tenants int;
  v_tenant  uuid;
begin
  select count(*) into n_tenants from public.tenants;
  select id into v_tenant from public.tenants order by created_at asc nulls last, id asc limit 1;
  raise notice '[DIAG] tenants=%, primeiro=%', n_tenants, v_tenant;
end $$;

-- 2) Estado atual do investimento_ads em 2026 (todos os tenants)
do $$
declare
  n_meses     int;
  n_trim      int;
  n_ano       int;
  soma_meses  numeric;
begin
  select count(*), coalesce(sum(valor_realizado), 0)
    into n_meses, soma_meses
    from public.metas_kpi
    where kpi = 'investimento_ads' and periodo = 'mes' and periodo_ref like '2026%';
  select count(*) into n_trim from public.metas_kpi
    where kpi = 'investimento_ads' and periodo = 'trimestre' and periodo_ref like '2026%';
  select count(*) into n_ano from public.metas_kpi
    where kpi = 'investimento_ads' and periodo = 'ano' and periodo_ref = '2026';
  raise notice '[DIAG] investimento_ads: meses=% (soma realizado=%), trimestres=%, ano=%',
    n_meses, soma_meses, n_trim, n_ano;
end $$;

-- 3) Aplica (idempotente) — mesmo bloco da 0016 + updates da 0017 pro tráfego
do $$
declare
  v_tenant uuid;
begin
  select id into v_tenant from public.tenants order by created_at asc nulls last, id asc limit 1;
  if v_tenant is null then
    raise exception 'Nenhum tenant';
  end if;

  -- Q1 meses (fechado real)
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

  -- Q1 trimestre
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

  -- Q2 meses realizado (garante que rows existem — usa upsert em vez de UPDATE)
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'investimento_ads', 'mes', '2026-04', 27000, 25000, 30000, 18854.49, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-05', 30000, 27000, 33000, 21130.88, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-06', 33000, 30000, 35000, 23549.75, 'BRL', 'Investimento em Ads', 6)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_realizado = excluded.valor_realizado;

  -- Q2 trimestre realizado
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'investimento_ads', 'trimestre', '2026-Q2', 90000, 82000, 98000, 63535.12, 'BRL', 'Investimento em Ads', 6)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_realizado = excluded.valor_realizado;

  -- Ano
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'investimento_ads', 'ano', '2026', 511163.15, 473163.15, 549163.15, 94698.27, 'BRL', 'Investimento em Ads', 6)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      valor_realizado = excluded.valor_realizado;

  raise notice '[APLICADO] Realizado tráfego H1/2026 no tenant %', v_tenant;
end $$;

-- 4) Estado final
select periodo, periodo_ref, valor_meta_min, valor_meta, valor_meta_max, valor_realizado
from public.metas_kpi
where kpi = 'investimento_ads' and periodo_ref like '2026%'
order by periodo, periodo_ref;
