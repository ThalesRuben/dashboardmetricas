-- seed.sql — dados de dev/local apenas. Não rodar em produção.
-- Rodado automaticamente por `supabase db reset`.

-- Tenant default já é criado pela migration 0001.

-- Adicionar seeds por domínio conforme as migrations forem chegando:
-- ex: insert into ads_campaigns (tenant_id, source, name, ...) values (...);

-- ============================================================
-- seo: snapshot + keywords monitoradas iniciais
-- ============================================================
do $$
declare
  tnt uuid := (select id from public.tenants where slug = 'the-blonde-concept' limit 1);
begin
  if tnt is null then return; end if;

  insert into public.seo_snapshots (tenant_id, date, score, payload)
  values (
    tnt,
    current_date,
    68,
    jsonb_build_object(
      'score', 68,
      'score_delta', 4,
      'resumo', jsonb_build_object('trafego_organico_mes', 3120, 'trafego_delta', 12.4),
      'sugestoes', '[]'::jsonb,
      'auditoria', '[]'::jsonb
    )
  )
  on conflict (tenant_id, date) do nothing;

  insert into public.seo_monitored_keywords
    (tenant_id, termo, posicao, posicao_anterior, volume, dificuldade, oportunidade) values
    (tnt, 'salão de beleza loiro',        4,  7,  2400, 'média', 'alta'),
    (tnt, 'mechas iluminadas preço',      8,  8,  1300, 'baixa', 'alta'),
    (tnt, 'progressiva sem formol',       12, 18, 3100, 'alta',  'alta'),
    (tnt, 'corte feminino moderno',       6,  5,  1800, 'média', 'média'),
    (tnt, 'cronograma capilar caseiro',   21, 25, 5400, 'média', 'alta'),
    (tnt, 'salão de beleza perto de mim', 3,  4,  8200, 'alta',  'média'),
    (tnt, 'penteado de noiva',            15, 14, 2700, 'média', 'média')
  on conflict (tenant_id, termo) do nothing;
end $$;
