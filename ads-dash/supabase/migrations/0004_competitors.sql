-- 0004_competitors.sql
-- Schema da feature `competitors`: marcas concorrentes + snapshots + conteúdos validados.

-- ============================================================
-- competitors_brands
-- ============================================================
create table public.competitors_brands (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  nome        text not null,
  handle      text not null,
  platform    text not null default 'instagram',
  segmento    text not null,
  website     text,
  niche       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, platform, handle)
);

create index competitors_brands_tenant_idx on public.competitors_brands(tenant_id);

alter table public.competitors_brands enable row level security;
create policy "competitors_brands_tenant_isolation" on public.competitors_brands
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- competitors_snapshots
-- ============================================================
create table public.competitors_snapshots (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  brand_id     uuid not null references public.competitors_brands(id) on delete cascade,
  date         date not null,
  followers    bigint not null default 0,
  engagement   numeric(6,2) not null default 0,
  posts_count  bigint not null default 0,
  unique (brand_id, date)
);

create index competitors_snapshots_brand_date_idx on public.competitors_snapshots(brand_id, date desc);

alter table public.competitors_snapshots enable row level security;
create policy "competitors_snapshots_tenant_isolation" on public.competitors_snapshots
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- competitors_content — peças que comprovadamente performaram.
-- ============================================================
create table public.competitors_content (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  brand_id     uuid not null references public.competitors_brands(id) on delete cascade,
  external_id  text not null,
  caption      text,
  tags         text[] not null default '{}',                -- keys de CONTENT_TAGS
  dimensions   jsonb not null default '{}'::jsonb,           -- CONTENT_DIMENSIONS keys -> option key
  score        numeric(6,2) not null default 0,
  posted_at    timestamptz not null,
  collected_at timestamptz not null default now(),
  unique (tenant_id, brand_id, external_id)
);

create index competitors_content_brand_posted_idx on public.competitors_content(brand_id, posted_at desc);
create index competitors_content_tags_gin_idx on public.competitors_content using gin(tags);
create index competitors_content_dimensions_gin_idx on public.competitors_content using gin(dimensions);

alter table public.competitors_content enable row level security;
create policy "competitors_content_tenant_isolation" on public.competitors_content
  for all using (tenant_id in (select public.current_user_tenants()));
