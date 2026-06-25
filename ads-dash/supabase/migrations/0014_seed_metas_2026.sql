-- 0014_seed_metas_2026.sql
-- Seed das metas reais de 2026: faturamento + tráfego (investimento_ads),
-- por trimestre, mês e ano, com cenários mín / base / máx.
--
-- Idempotente: roda quantas vezes quiser. Pega o primeiro tenant da tabela
-- `tenants` (use o tenant ativo do salão).
--
-- Pré-requisito: 0013_metas_cenarios_mes.sql (este arquivo redeclara as
-- alterações como IF NOT EXISTS pra ser seguro mesmo sem o 0013 aplicado).

-- ------------------------------------------------------------
-- Garante schema (idempotente — replica os ALTERs do 0013).
-- ------------------------------------------------------------
alter table public.metas_kpi
  add column if not exists valor_meta_min numeric,
  add column if not exists valor_meta_max numeric;

alter table public.metas_kpi
  drop constraint if exists metas_kpi_periodo_check;

alter table public.metas_kpi
  add constraint metas_kpi_periodo_check
  check (periodo in ('semana','mes','trimestre','ano'));

-- ------------------------------------------------------------
-- Seed.
-- ------------------------------------------------------------
do $$
declare
  v_tenant uuid;
begin
  -- Pega o primeiro tenant disponível (salão tem 1 tenant ativo).
  select id into v_tenant from public.tenants order by created_at asc nulls last, id asc limit 1;
  if v_tenant is null then
    raise exception 'Nenhum tenant encontrado em public.tenants. Crie um tenant antes do seed.';
  end if;

  -- ===== FATURAMENTO — TRIMESTRES =====
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'faturamento', 'trimestre', '2026-Q1',   980926.05,  980926.05,  980926.05,  980926.05, 'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'trimestre', '2026-Q2',  1380000,    1300000,    1440000,    0,          'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'trimestre', '2026-Q3',  1870000,    1760000,    1950000,    0,          'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'trimestre', '2026-Q4',  2250000,    2180000,    2400000,    0,          'BRL', 'Faturamento', 1)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      valor_realizado = excluded.valor_realizado,
      unidade = excluded.unidade,
      label = excluded.label,
      ordem = excluded.ordem;

  -- ===== FATURAMENTO — MESES =====
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    -- Q1 (fechado real)
    (v_tenant, 'faturamento', 'mes', '2026-01',  315559.55,  315559.55,  315559.55,  315559.55, 'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'mes', '2026-02',  294542.23,  294542.23,  294542.23,  294542.23, 'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'mes', '2026-03',  370824.27,  370824.27,  370824.27,  370824.27, 'BRL', 'Faturamento', 1),
    -- Q2 (Abr/Mai realizados)
    (v_tenant, 'faturamento', 'mes', '2026-04',  420000,     400000,     430000,     372926.64, 'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'mes', '2026-05',  460000,     430000,     480000,     428256.98, 'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'mes', '2026-06',  500000,     470000,     530000,     0,         'BRL', 'Faturamento', 1),
    -- Q3
    (v_tenant, 'faturamento', 'mes', '2026-07',  600000,     560000,     620000,     0,         'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'mes', '2026-08',  620000,     590000,     650000,     0,         'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'mes', '2026-09',  650000,     610000,     680000,     0,         'BRL', 'Faturamento', 1),
    -- Q4
    (v_tenant, 'faturamento', 'mes', '2026-10',  750000,     700000,     770000,     0,         'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'mes', '2026-11',  750000,     730000,     800000,     0,         'BRL', 'Faturamento', 1),
    (v_tenant, 'faturamento', 'mes', '2026-12',  750000,     750000,     830000,     0,         'BRL', 'Faturamento', 1)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      valor_realizado = excluded.valor_realizado,
      unidade = excluded.unidade,
      label = excluded.label,
      ordem = excluded.ordem;

  -- ===== FATURAMENTO — ANO =====
  -- Soma dos 4 trimestres: base = 980926.05 + 1380000 + 1870000 + 2250000
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'faturamento', 'ano', '2026',
       6480926.05,   -- base = Q1 real + Q2 base + Q3 base + Q4 base
       6220926.05,   -- mín  = Q1 real + soma dos mín
       6770926.05,   -- máx  = Q1 real + soma dos máx
       980926.05,    -- realizado = Q1 fechado (será incrementado conforme Q2/Q3/Q4 forem rodando)
       'BRL', 'Faturamento', 1)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      valor_realizado = excluded.valor_realizado,
      unidade = excluded.unidade,
      label = excluded.label,
      ordem = excluded.ordem;

  -- ===== TRÁFEGO (investimento_ads) — TRIMESTRES =====
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'investimento_ads', 'trimestre', '2026-Q2',   90000,  82000,  98000, 0, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'trimestre', '2026-Q3',  165000, 150000, 180000, 0, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'trimestre', '2026-Q4',  225000, 210000, 240000, 0, 'BRL', 'Investimento em Ads', 6)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      unidade = excluded.unidade,
      label = excluded.label,
      ordem = excluded.ordem;

  -- ===== TRÁFEGO — MESES =====
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    -- Q2
    (v_tenant, 'investimento_ads', 'mes', '2026-04', 27000, 25000, 30000, 0, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-05', 30000, 27000, 33000, 0, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-06', 33000, 30000, 35000, 0, 'BRL', 'Investimento em Ads', 6),
    -- Q3
    (v_tenant, 'investimento_ads', 'mes', '2026-07', 55000, 50000, 60000, 0, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-08', 55000, 50000, 60000, 0, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-09', 55000, 50000, 60000, 0, 'BRL', 'Investimento em Ads', 6),
    -- Q4
    (v_tenant, 'investimento_ads', 'mes', '2026-10', 75000, 70000, 80000, 0, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-11', 75000, 70000, 80000, 0, 'BRL', 'Investimento em Ads', 6),
    (v_tenant, 'investimento_ads', 'mes', '2026-12', 75000, 70000, 80000, 0, 'BRL', 'Investimento em Ads', 6)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      unidade = excluded.unidade,
      label = excluded.label,
      ordem = excluded.ordem;

  -- ===== TRÁFEGO — ANO =====
  -- Soma Q2+Q3+Q4 (Q1 não tinha tráfego definido)
  insert into public.metas_kpi (tenant_id, kpi, periodo, periodo_ref, valor_meta, valor_meta_min, valor_meta_max, valor_realizado, unidade, label, ordem) values
    (v_tenant, 'investimento_ads', 'ano', '2026',  480000, 442000, 518000, 0, 'BRL', 'Investimento em Ads', 6)
  on conflict (tenant_id, kpi, periodo, periodo_ref) do update
  set valor_meta = excluded.valor_meta,
      valor_meta_min = excluded.valor_meta_min,
      valor_meta_max = excluded.valor_meta_max,
      unidade = excluded.unidade,
      label = excluded.label,
      ordem = excluded.ordem;

  raise notice 'Metas 2026 aplicadas no tenant %', v_tenant;
end $$;

-- Verificação rápida:
-- select periodo, periodo_ref, kpi, valor_meta_min, valor_meta, valor_meta_max, valor_realizado
-- from public.metas_kpi
-- where periodo_ref like '2026%' order by periodo, periodo_ref, ordem;
