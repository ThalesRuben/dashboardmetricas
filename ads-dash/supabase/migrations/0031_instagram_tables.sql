-- Instagram sync — tabelas que a edge function `instagram-sync` popula.
-- Executado originalmente via SQL Editor em 23/07/2026; migration criada
-- depois pra versionar o schema.

create table if not exists public.instagram_account_metrics (
  date            date    not null,
  ig_user_id      text    not null,
  username        text,
  seguidores      integer,
  seguindo        integer,
  total_posts     integer,
  alcance_dia     integer,
  impressoes_dia  integer,
  visitas_perfil  integer,
  cliques_site    integer,
  payload         jsonb,
  source          text,
  constraint instagram_account_metrics_pkey primary key (date, ig_user_id)
);

create table if not exists public.instagram_posts (
  ig_post_id        text primary key,
  ig_user_id        text,
  tipo              text,
  caption           text,
  media_url         text,
  thumbnail_url     text,
  permalink         text,
  publicado_em      timestamptz,
  curtidas          integer,
  comentarios       integer,
  salvamentos       integer,
  compartilhamentos integer,
  alcance           integer,
  impressoes        integer,
  plays             integer,
  engajamento_taxa  numeric,
  raw               jsonb,
  fetched_at        timestamptz
);

alter table public.instagram_account_metrics enable row level security;
alter table public.instagram_posts           enable row level security;

-- SELECT liberado pra anon E authenticated: a rota /instagram é PrivateRoute,
-- então o JWT chega como authenticated. Edge function escreve com service_role,
-- que bypassa RLS — não precisa policy de INSERT/UPDATE.
drop policy if exists "anon pode ler metricas da conta" on public.instagram_account_metrics;
create policy "anon pode ler metricas da conta"
  on public.instagram_account_metrics
  for select
  to anon, authenticated
  using (true);

drop policy if exists "anon pode ler posts" on public.instagram_posts;
create policy "anon pode ler posts"
  on public.instagram_posts
  for select
  to anon, authenticated
  using (true);
