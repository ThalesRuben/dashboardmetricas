-- 0005_seo.sql
-- Schema da feature `seo`: snapshots agregados + palavras-chave monitoradas + histórico de pesquisa.
-- Multi-tenant via tenant_id + RLS. Prefixo seo_.

create type seo_dificuldade  as enum ('baixa', 'média', 'alta');
create type seo_oportunidade as enum ('baixa', 'média', 'alta');
create type seo_intent       as enum ('informacional', 'comercial', 'transacional', 'navegacional', 'local');

-- Helper: primeiro tenant do usuário autenticado (usado como default em INSERTs do front).
create or replace function public.current_user_first_tenant()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select tenant_id from public.memberships where user_id = auth.uid() limit 1;
$$;

-- ============================================================
-- seo_snapshots
--   Score + resumo + sugestoes + auditoria em um payload jsonb.
--   Uma linha por (tenant_id, date). Sempre lê a mais recente.
-- ============================================================
create table public.seo_snapshots (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null default public.current_user_first_tenant() references public.tenants(id) on delete cascade,
  date       date not null default current_date,
  score      smallint not null default 0,
  payload    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, date)
);

create index seo_snapshots_tenant_date_idx on public.seo_snapshots(tenant_id, date desc);

alter table public.seo_snapshots enable row level security;
create policy "seo_snapshots_tenant_isolation" on public.seo_snapshots
  for all
  using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- seo_monitored_keywords
--   Termos sob acompanhamento de ranking — base da tabela "Palavras-chave monitoradas"
--   e destino do botão "+ monitorar" da pesquisa.
-- ============================================================
create table public.seo_monitored_keywords (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null default public.current_user_first_tenant() references public.tenants(id) on delete cascade,
  termo            text not null,
  posicao          smallint,
  posicao_anterior smallint,
  volume           integer not null default 0,
  dificuldade      seo_dificuldade  not null default 'média',
  oportunidade     seo_oportunidade not null default 'média',
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, termo)
);

create index seo_monitored_keywords_tenant_idx on public.seo_monitored_keywords(tenant_id, ativo);

alter table public.seo_monitored_keywords enable row level security;
create policy "seo_monitored_keywords_tenant_isolation" on public.seo_monitored_keywords
  for all
  using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- seo_research_history
--   Cache + auditoria das pesquisas feitas no widget "Pesquisar palavras-chave".
--   Payload contém volume, dificuldade, cpc, intent, ideias[], perguntas[].
-- ============================================================
create table public.seo_research_history (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null default public.current_user_first_tenant() references public.tenants(id) on delete cascade,
  termo       text not null,
  volume      integer not null default 0,
  dificuldade seo_dificuldade not null default 'média',
  intent      seo_intent      not null default 'informacional',
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index seo_research_history_tenant_created_idx on public.seo_research_history(tenant_id, created_at desc);
create index seo_research_history_termo_idx on public.seo_research_history(tenant_id, termo);

alter table public.seo_research_history enable row level security;
create policy "seo_research_history_tenant_isolation" on public.seo_research_history
  for all
  using (tenant_id in (select public.current_user_tenants()))
  with check (tenant_id in (select public.current_user_tenants()));
