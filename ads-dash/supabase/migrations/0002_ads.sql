-- 0002_ads.sql
-- Schema da feature `ads`: campanhas + métricas diárias + metas.
-- Multi-tenant via tenant_id + RLS.

-- ============================================================
-- ads_campaigns
-- ============================================================
create table public.ads_campaigns (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  source             text not null check (source in ('meta', 'google')),
  external_id        text not null,
  name               text not null,
  status             text not null default 'active' check (status in ('active','paused','archived')),
  daily_budget_cents bigint not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (tenant_id, source, external_id)
);

create index ads_campaigns_tenant_idx on public.ads_campaigns(tenant_id);

alter table public.ads_campaigns enable row level security;
create policy "ads_campaigns_tenant_isolation" on public.ads_campaigns
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- ads_daily_metrics
-- ============================================================
create table public.ads_daily_metrics (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  campaign_id   uuid references public.ads_campaigns(id) on delete cascade,
  date          date not null,
  investido     numeric(14,2) not null default 0,
  receita       numeric(14,2) not null default 0,
  impressoes    bigint not null default 0,
  cliques       bigint not null default 0,
  mensagens     bigint not null default 0,
  agendamentos  bigint not null default 0,
  vendas        bigint not null default 0,
  roas          numeric(8,2) generated always as (case when investido > 0 then (receita / investido) else 0 end) stored,
  roi           numeric(8,2) generated always as (case when investido > 0 then (((receita - investido) / investido) * 100) else 0 end) stored,
  ctr           numeric(6,2) generated always as (case when impressoes > 0 then ((cliques::numeric / impressoes) * 100) else 0 end) stored,
  ctr_meta      numeric(6,2) not null default 0,
  ctr_google    numeric(6,2) not null default 0,
  created_at    timestamptz not null default now(),
  unique (tenant_id, campaign_id, date)
);

create index ads_daily_metrics_tenant_date_idx on public.ads_daily_metrics(tenant_id, date desc);

alter table public.ads_daily_metrics enable row level security;
create policy "ads_daily_metrics_tenant_isolation" on public.ads_daily_metrics
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- ads_daily_metrics_raw
--   Captura inputs manuais antes de virar linha normalizada.
--   Usado por IntegrationPage e webhooks.
-- ============================================================
create table public.ads_daily_metrics_raw (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  period      text not null,
  payload     jsonb not null,
  source      text not null default 'manual',
  ingested_at timestamptz not null default now()
);

create index ads_daily_metrics_raw_tenant_idx on public.ads_daily_metrics_raw(tenant_id, ingested_at desc);

alter table public.ads_daily_metrics_raw enable row level security;
create policy "ads_daily_metrics_raw_tenant_isolation" on public.ads_daily_metrics_raw
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- ads_goals
-- ============================================================
create table public.ads_goals (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  key           text not null,
  target_value  numeric(14,2) not null,
  period_start  date,
  period_end    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (tenant_id, key)
);

alter table public.ads_goals enable row level security;
create policy "ads_goals_tenant_isolation" on public.ads_goals
  for all using (tenant_id in (select public.current_user_tenants()));
