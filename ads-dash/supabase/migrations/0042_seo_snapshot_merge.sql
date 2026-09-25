-- 0042_seo_snapshot_merge.sql
-- RPC de merge parcial em seo_snapshots.payload — permite que múltiplas syncs
-- (gsc-sync, seo-audit, futura seo-suggest) escrevam no mesmo snapshot diário
-- sem sobrescrever as chaves umas das outras.
--
-- Uso:
--   select public.seo_snapshot_merge(
--     p_tenant_id := '31cc6350-...'::uuid,
--     p_date      := current_date,
--     p_patch     := '{"auditoria":[...]}'::jsonb,
--     p_score     := null   -- opcional; se null, preserva score existente
--   );

create or replace function public.seo_snapshot_merge(
  p_tenant_id uuid,
  p_date      date,
  p_patch     jsonb,
  p_score     integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.seo_snapshots as s (tenant_id, date, score, payload)
  values (p_tenant_id, p_date, coalesce(p_score, 0), coalesce(p_patch, '{}'::jsonb))
  on conflict (tenant_id, date) do update
    set payload = s.payload || excluded.payload,
        score   = coalesce(p_score, s.score);
end
$$;

grant execute on function public.seo_snapshot_merge(uuid, date, jsonb, integer) to service_role;
