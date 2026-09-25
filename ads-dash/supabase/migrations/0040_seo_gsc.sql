-- 0040_seo_gsc.sql
-- Integração Google Search Console:
--   * colunas de tráfego real em seo_monitored_keywords (impressions/clicks/ctr/last_synced_at)
--   * seo_sync_log — auditoria por execução da edge function gsc-sync
-- Rodar manual no Supabase Studio (SQL Editor).

alter table public.seo_monitored_keywords
  add column if not exists impressions    integer     not null default 0,
  add column if not exists clicks         integer     not null default 0,
  add column if not exists ctr            numeric(6,4) not null default 0,
  add column if not exists last_synced_at timestamptz;

create index if not exists seo_monitored_keywords_synced_idx
  on public.seo_monitored_keywords(tenant_id, last_synced_at desc nulls last);

create table if not exists public.seo_sync_log (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  source        text not null default 'gsc' check (source in ('gsc','psi','ai')),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running' check (status in ('running','ok','error')),
  range_from    date,
  range_to      date,
  rows_upserted int  not null default 0,
  error         text,
  raw           jsonb
);

create index if not exists seo_sync_log_tenant_idx on public.seo_sync_log(tenant_id, started_at desc);

alter table public.seo_sync_log enable row level security;

drop policy if exists "seo_sync_log_tenant_isolation" on public.seo_sync_log;
create policy "seo_sync_log_tenant_isolation" on public.seo_sync_log
  for all
  using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
