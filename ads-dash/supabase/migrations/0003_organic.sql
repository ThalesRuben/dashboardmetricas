-- 0003_organic.sql
-- Schema compartilhado entre features organic/{instagram,tiktok,youtube,whatsapp}.
-- Uma linha em organic_accounts por (tenant_id, platform). Posts e métricas referenciam essa account.

create type organic_platform as enum ('instagram', 'tiktok', 'youtube', 'whatsapp', 'facebook');
create type organic_media_type as enum ('image', 'video', 'reel', 'short', 'live', 'carousel', 'story', 'text');

-- ============================================================
-- organic_accounts — uma conta por (tenant, plataforma).
-- ============================================================
create table public.organic_accounts (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  platform    organic_platform not null,
  handle      text not null,
  followers   bigint not null default 0,
  following   bigint not null default 0,
  bio         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (tenant_id, platform)
);

create index organic_accounts_tenant_idx on public.organic_accounts(tenant_id);

alter table public.organic_accounts enable row level security;
create policy "organic_accounts_tenant_isolation" on public.organic_accounts
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- organic_account_snapshots — histórico de followers/following por dia.
-- ============================================================
create table public.organic_account_snapshots (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  account_id  uuid not null references public.organic_accounts(id) on delete cascade,
  date        date not null,
  followers   bigint not null,
  following   bigint not null,
  unique (account_id, date)
);

create index organic_account_snapshots_acct_date_idx on public.organic_account_snapshots(account_id, date desc);

alter table public.organic_account_snapshots enable row level security;
create policy "organic_account_snapshots_tenant_isolation" on public.organic_account_snapshots
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- organic_posts — posts publicados em qualquer plataforma.
-- ============================================================
create table public.organic_posts (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  account_id    uuid not null references public.organic_accounts(id) on delete cascade,
  platform      organic_platform not null,
  external_id   text not null,
  media_type    organic_media_type not null,
  caption       text,
  permalink     text,
  thumbnail_url text,
  posted_at     timestamptz not null,
  created_at    timestamptz not null default now(),
  unique (tenant_id, platform, external_id)
);

create index organic_posts_acct_posted_idx on public.organic_posts(account_id, posted_at desc);
create index organic_posts_tenant_platform_idx on public.organic_posts(tenant_id, platform);

alter table public.organic_posts enable row level security;
create policy "organic_posts_tenant_isolation" on public.organic_posts
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- organic_post_metrics — métricas diárias por post.
-- ============================================================
create table public.organic_post_metrics (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  post_id       uuid not null references public.organic_posts(id) on delete cascade,
  date          date not null,
  impressoes    bigint not null default 0,
  reach         bigint not null default 0,
  likes         bigint not null default 0,
  comments      bigint not null default 0,
  shares        bigint not null default 0,
  saves         bigint not null default 0,
  plays         bigint not null default 0,
  engagement    numeric(8,2) not null default 0,
  collected_at  timestamptz not null default now(),
  unique (post_id, date)
);

create index organic_post_metrics_post_date_idx on public.organic_post_metrics(post_id, date desc);
create index organic_post_metrics_tenant_date_idx on public.organic_post_metrics(tenant_id, date desc);

alter table public.organic_post_metrics enable row level security;
create policy "organic_post_metrics_tenant_isolation" on public.organic_post_metrics
  for all using (tenant_id in (select public.current_user_tenants()));
