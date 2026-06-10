-- =============================================
-- ADS DASHBOARD — SUPABASE SCHEMA
-- Execute no SQL Editor do seu projeto Supabase
-- =============================================

-- 1. Tabela de perfis de usuário (vinculada ao auth.users)
create table if not exists public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text,
  role        text not null default 'viewer' check (role in ('admin','editor','viewer')),
  created_at  timestamptz default now()
);

-- Trigger: cria perfil automaticamente ao registrar novo usuário
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name', 'viewer');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Tabela de métricas diárias (usada pelo useMetrics hook)
create table if not exists public.daily_metrics (
  id          bigint generated always as identity primary key,
  period      text not null,              -- 'hoje' | 'semana' | 'mes'
  date        date not null default current_date,
  payload     jsonb not null,             -- objeto completo de métricas
  source      text default 'manual',     -- 'manual' | 'api' | 'connector'
  created_at  timestamptz default now()
);

-- 3. Tabela de campanhas
create table if not exists public.campaigns (
  id            bigint generated always as identity primary key,
  nome          text not null,
  plataforma    text not null check (plataforma in ('Meta','Google')),
  tipo          text not null check (tipo in ('CTWA','API Conv.')),
  status        text not null default 'ativo',
  ativo         boolean default true,
  created_at    timestamptz default now()
);

-- 4. Tabela de métricas por campanha (por dia)
create table if not exists public.campaign_metrics (
  id              bigint generated always as identity primary key,
  campaign_id     bigint references public.campaigns(id) on delete cascade,
  date            date not null default current_date,
  investido       numeric(10,2) default 0,
  impressoes      integer default 0,
  cliques         integer default 0,
  mensagens       integer default 0,
  agendamentos    integer default 0,
  vendas          integer default 0,
  receita         numeric(10,2) default 0,
  created_at      timestamptz default now()
);

-- 5. Tabela de alertas
create table if not exists public.alerts (
  id          bigint generated always as identity primary key,
  tipo        text not null check (tipo in ('danger','warning','success','info')),
  mensagem    text not null,
  lido        boolean default false,
  created_at  timestamptz default now()
);

-- 5.5 Métricas orgânicas do Instagram — snapshot da conta (1 linha por dia)
create table if not exists public.instagram_account_metrics (
  id                bigint generated always as identity primary key,
  date              date not null default current_date,
  ig_user_id        text,                -- id do Instagram Business Account
  username          text,
  seguidores        integer default 0,
  seguindo          integer default 0,
  total_posts       integer default 0,
  alcance_dia       integer default 0,
  impressoes_dia    integer default 0,
  visitas_perfil    integer default 0,
  cliques_site      integer default 0,
  engajamento_taxa  numeric(5,2) default 0,    -- %
  payload           jsonb,                       -- response bruto da Graph API
  source            text default 'manual',
  created_at        timestamptz default now(),
  unique (date, ig_user_id)
);

-- 5.6 Posts/Reels/Stories individuais
create table if not exists public.instagram_posts (
  id                bigint generated always as identity primary key,
  ig_post_id        text unique,
  ig_user_id        text,
  tipo              text not null check (tipo in ('IMAGE','VIDEO','CAROUSEL_ALBUM','REEL','STORY')),
  caption           text,
  media_url         text,
  thumbnail_url     text,
  permalink         text,
  publicado_em      timestamptz,
  curtidas          integer default 0,
  comentarios       integer default 0,
  salvamentos       integer default 0,
  compartilhamentos integer default 0,
  alcance           integer default 0,
  impressoes        integer default 0,
  plays             integer default 0,         -- Reels
  exits             integer default 0,         -- Stories
  replies           integer default 0,         -- Stories
  engajamento_taxa  numeric(5,2) default 0,
  raw               jsonb,
  fetched_at        timestamptz default now()
);

create index if not exists idx_ig_account_date on public.instagram_account_metrics(date desc);
create index if not exists idx_ig_posts_pub    on public.instagram_posts(publicado_em desc);

-- 5.7 Concorrentes monitorados
create table if not exists public.competitors (
  id          bigint generated always as identity primary key,
  nome        text not null,
  handle      text,                       -- @ do Instagram
  segmento    text,                       -- 'Salão de beleza', 'Barbearia'...
  website     text,
  cor         text default '#888888',     -- cor no gráfico comparativo
  tipo        text not null default 'concorrente' check (tipo in ('concorrente','referencia')),
  ativo       boolean not null default true,
  created_at  timestamptz default now()
);

-- 5.8 Snapshots periódicos dos concorrentes (dados públicos inseridos manualmente)
create table if not exists public.competitor_snapshots (
  id              bigint generated always as identity primary key,
  competitor_id   bigint references public.competitors(id) on delete cascade,
  date            date not null default current_date,
  seguidores      integer default 0,        -- seguidores no Instagram
  total_posts     integer default 0,
  engajamento_taxa numeric(5,2) default 0,   -- % estimado
  posts_semana    numeric(4,1) default 0,    -- frequência de publicação
  -- presença em outras redes (monitoramento multi-canal)
  seguidores_tiktok    integer default 0,
  seguidores_youtube   integer default 0,
  seguidores_facebook  integer default 0,
  -- reputação (Reclame Aqui / avaliações públicas)
  reclame_aqui_nota          numeric(3,1) default 0,   -- 0 a 10
  reclame_aqui_reclamacoes   integer default 0,
  reclame_aqui_resolvidas_pct numeric(5,1) default 0,  -- % resolvidas
  observacoes     text,
  created_at      timestamptz default now(),
  unique (competitor_id, date)
);

create index if not exists idx_comp_snap_date on public.competitor_snapshots(competitor_id, date desc);

-- 5.9 Conteúdos validados dos concorrentes (posts que comprovadamente performaram)
create table if not exists public.competitor_content (
  id              bigint generated always as identity primary key,
  competitor_id   bigint references public.competitors(id) on delete cascade,
  tipo            text not null check (tipo in ('REEL','IMAGE','CAROUSEL','STORY')),
  tema            text not null,                  -- "Antes e depois — progressiva"
  tag             text,                           -- categoria: antes-depois, tutorial, promo, bastidor, depoimento, tendencia, dica
  permalink       text,
  data_publicado  date,
  curtidas        integer default 0,
  comentarios     integer default 0,
  engajamento_taxa numeric(5,2) default 0,
  formato_nota    text,                           -- por que funcionou (observação livre)
  -- Taxonomia rica de análise (o "como" do conteúdo)
  gancho          text,                           -- tipo de hook nos primeiros segundos
  emocao          text,                           -- emoção evocada
  audio           text,                           -- estratégia de áudio/música
  ritmo_edicao    text,                           -- ritmo de edição
  validado        boolean not null default true,
  created_at      timestamptz default now()
);

create index if not exists idx_comp_content on public.competitor_content(competitor_id, engajamento_taxa desc);

-- 5.91 Métricas orgânicas do TikTok — snapshot da conta
create table if not exists public.tiktok_account_metrics (
  id                bigint generated always as identity primary key,
  date              date not null default current_date,
  username          text,
  seguidores        integer default 0,
  curtidas_total    bigint default 0,
  total_videos      integer default 0,
  visualizacoes_dia integer default 0,
  engajamento_taxa  numeric(5,2) default 0,
  payload           jsonb,
  source            text default 'manual',
  created_at        timestamptz default now(),
  unique (date, username)
);

create table if not exists public.tiktok_videos (
  id               bigint generated always as identity primary key,
  tiktok_video_id  text unique,
  caption          text,
  thumbnail_url    text,
  permalink        text,
  publicado_em     timestamptz,
  visualizacoes    integer default 0,
  curtidas         integer default 0,
  comentarios      integer default 0,
  compartilhamentos integer default 0,
  engajamento_taxa numeric(5,2) default 0,
  raw              jsonb,
  fetched_at       timestamptz default now()
);

-- 5.92 Métricas orgânicas do YouTube — snapshot do canal
create table if not exists public.youtube_channel_metrics (
  id                bigint generated always as identity primary key,
  date              date not null default current_date,
  channel_name      text,
  inscritos         integer default 0,
  visualizacoes_dia integer default 0,
  horas_assistidas  numeric(10,1) default 0,
  total_videos      integer default 0,
  engajamento_taxa  numeric(5,2) default 0,
  payload           jsonb,
  source            text default 'manual',
  created_at        timestamptz default now(),
  unique (date, channel_name)
);

create table if not exists public.youtube_videos (
  id               bigint generated always as identity primary key,
  youtube_video_id text unique,
  titulo           text,
  thumbnail_url    text,
  permalink        text,
  publicado_em     timestamptz,
  visualizacoes    integer default 0,
  curtidas         integer default 0,
  comentarios      integer default 0,
  retencao_media   numeric(5,2) default 0,    -- % de retenção
  duracao_seg      integer default 0,
  raw              jsonb,
  fetched_at       timestamptz default now()
);

-- 6.0 Tabela de agendamentos de relatórios por e-mail
create table if not exists public.report_schedules (
  id              bigint generated always as identity primary key,
  nome            text not null,                       -- "Relatório semanal — Salão Bella"
  destinatarios   text[] not null default '{}',        -- array de e-mails
  whatsapp        text[] not null default '{}',        -- array de números no formato 5531999999999
  canais          text[] not null default array['email'],  -- 'email' | 'whatsapp'
  periodicidade   text not null check (periodicidade in ('diario','semanal','mensal')),
  hora_envio      text not null default '08:00',       -- 'HH:MM' (horário local — America/Sao_Paulo)
  dia_semana      smallint,                            -- 0-6 (apenas 'semanal'); 1 = segunda
  dia_mes         smallint,                            -- 1-28 (apenas 'mensal')
  formato         text not null default 'pdf' check (formato in ('pdf','csv')),
  metricas        text[] not null default array['roas','roi','ctr','mensagens','vendas','campanhas'],
  periodo_dados   text not null default 'hoje' check (periodo_dados in ('hoje','semana','mes')),
  ativo           boolean not null default true,
  ultimo_envio    timestamptz,
  proximo_envio   timestamptz,
  created_at      timestamptz default now()
);

-- 6.1 Log de envios
create table if not exists public.report_sends (
  id              bigint generated always as identity primary key,
  schedule_id     bigint references public.report_schedules(id) on delete cascade,
  status          text not null check (status in ('ok','error','pending')),
  erro            text,
  destinatarios   text[],
  enviado_em      timestamptz default now()
);

-- 6. Tabela de configuração de metas
create table if not exists public.goals (
  id          bigint generated always as identity primary key,
  key         text unique not null,
  label       text not null,
  value       numeric not null,
  unit        text,
  enabled     boolean default true,
  updated_at  timestamptz default now()
);

-- Seeds: metas padrão
insert into public.goals (key, label, value, unit, enabled) values
  ('roas',         'ROAS mínimo',              3.5,  'x',     true),
  ('ctr',          'CTR mínimo',               2.5,  '%',     true),
  ('mensagens',    'Mensagens por dia',        100,  'msgs',  true),
  ('agendamentos', 'Agendamentos por semana',   50,  'agend', false),
  ('vendas',       'Vendas aprovadas/dia',      25,  'vnd',   true),
  ('budget',       'Alerta de orçamento',       80,  '%',     true)
on conflict (key) do nothing;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

alter table public.profiles                    enable row level security;
alter table public.daily_metrics               enable row level security;
alter table public.campaigns                   enable row level security;
alter table public.campaign_metrics            enable row level security;
alter table public.alerts                      enable row level security;
alter table public.goals                       enable row level security;
alter table public.report_schedules            enable row level security;
alter table public.report_sends                enable row level security;
alter table public.instagram_account_metrics   enable row level security;
alter table public.instagram_posts             enable row level security;
alter table public.competitors                 enable row level security;
alter table public.competitor_snapshots        enable row level security;
alter table public.competitor_content          enable row level security;
alter table public.tiktok_account_metrics      enable row level security;
alter table public.tiktok_videos               enable row level security;
alter table public.youtube_channel_metrics     enable row level security;
alter table public.youtube_videos              enable row level security;

-- Perfis: usuário vê/edita apenas o próprio
create policy "profiles_select" on public.profiles for select using (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Métricas, campanhas, alertas, metas: usuários autenticados lêem
create policy "metrics_select"   on public.daily_metrics    for select using (auth.role() = 'authenticated');
create policy "campaigns_select" on public.campaigns        for select using (auth.role() = 'authenticated');
create policy "camp_m_select"    on public.campaign_metrics for select using (auth.role() = 'authenticated');
create policy "alerts_select"    on public.alerts           for select using (auth.role() = 'authenticated');
create policy "goals_select"     on public.goals            for select using (auth.role() = 'authenticated');

-- Somente admins/editors inserem e atualizam métricas
create policy "metrics_insert" on public.daily_metrics for insert with check (auth.role() = 'authenticated');
create policy "goals_update"   on public.goals for update using (auth.role() = 'authenticated');

-- Agendamentos de e-mail: usuários autenticados gerenciam
create policy "schedules_select" on public.report_schedules for select using (auth.role() = 'authenticated');
create policy "schedules_insert" on public.report_schedules for insert with check (auth.role() = 'authenticated');
create policy "schedules_update" on public.report_schedules for update using (auth.role() = 'authenticated');
create policy "schedules_delete" on public.report_schedules for delete using (auth.role() = 'authenticated');
create policy "sends_select"     on public.report_sends     for select using (auth.role() = 'authenticated');

-- Instagram orgânico: usuários autenticados leem
create policy "ig_account_select" on public.instagram_account_metrics for select using (auth.role() = 'authenticated');
create policy "ig_account_insert" on public.instagram_account_metrics for insert with check (auth.role() = 'authenticated');
create policy "ig_posts_select"   on public.instagram_posts            for select using (auth.role() = 'authenticated');
create policy "ig_posts_insert"   on public.instagram_posts            for insert with check (auth.role() = 'authenticated');
create policy "ig_posts_update"   on public.instagram_posts            for update using (auth.role() = 'authenticated');

-- Concorrentes: usuários autenticados gerenciam tudo
create policy "competitors_all"   on public.competitors          for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "comp_snap_all"     on public.competitor_snapshots for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "comp_content_all"  on public.competitor_content   for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- Redes sociais orgânicas: usuários autenticados leem/escrevem
create policy "tiktok_acc_all"  on public.tiktok_account_metrics  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "tiktok_vid_all"  on public.tiktok_videos           for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "yt_chan_all"     on public.youtube_channel_metrics for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "yt_vid_all"      on public.youtube_videos          for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
