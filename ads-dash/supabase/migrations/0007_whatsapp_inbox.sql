-- 0007_whatsapp_inbox.sql
-- Inbox de atendimento em tempo real. n8n recebe mensagens da Cloud API
-- e posta na edge function `inbox-ingest`, que escreve nestas tabelas.
-- Front se inscreve em whatsapp_msgs via Supabase Realtime.

-- ============================================================
-- whatsapp_contatos — um contato por (tenant, telefone).
-- ============================================================
create table public.whatsapp_contatos (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  phone       text not null,
  nome        text,
  metadata    jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (tenant_id, phone)
);

create index whatsapp_contatos_tenant_idx on public.whatsapp_contatos(tenant_id);

alter table public.whatsapp_contatos enable row level security;
create policy "whatsapp_contatos_tenant_isolation" on public.whatsapp_contatos
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- whatsapp_threads — uma conversa por contato.
-- Status segue o que já existe no front (lead/aberta/agendado/venda).
-- ============================================================
create type whatsapp_thread_status as enum ('lead','aberta','agendado','venda','arquivada');

create table public.whatsapp_threads (
  id                      uuid primary key default gen_random_uuid(),
  tenant_id               uuid not null references public.tenants(id) on delete cascade,
  contato_id              uuid not null references public.whatsapp_contatos(id) on delete cascade,
  atendente_id            uuid references auth.users(id) on delete set null,
  status                  whatsapp_thread_status not null default 'aberta',
  origem                  text not null default 'whatsapp',
  nao_lidas               int  not null default 0,
  ultima_atividade        timestamptz not null default now(),
  ultima_msg_cliente_em   timestamptz,
  criado_em               timestamptz not null default now()
);

create index whatsapp_threads_tenant_atv_idx
  on public.whatsapp_threads(tenant_id, ultima_atividade desc);
create index whatsapp_threads_contato_idx on public.whatsapp_threads(contato_id);

alter table public.whatsapp_threads enable row level security;
create policy "whatsapp_threads_tenant_isolation" on public.whatsapp_threads
  for all using (tenant_id in (select public.current_user_tenants()));

-- ============================================================
-- whatsapp_msgs — mensagens individuais.
-- msg_id_externo serve pra dedup quando o n8n reentrega.
-- ============================================================
create type whatsapp_msg_autor  as enum ('cliente','atendente');
create type whatsapp_msg_status as enum ('enviada','entregue','lida','erro');

create table public.whatsapp_msgs (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  thread_id       uuid not null references public.whatsapp_threads(id) on delete cascade,
  autor           whatsapp_msg_autor not null,
  texto           text not null,
  msg_id_externo  text,
  status          whatsapp_msg_status not null default 'enviada',
  metadata        jsonb not null default '{}'::jsonb,
  hora            timestamptz not null default now(),
  unique (tenant_id, msg_id_externo)
);

create index whatsapp_msgs_thread_hora_idx
  on public.whatsapp_msgs(thread_id, hora);
create index whatsapp_msgs_tenant_hora_idx
  on public.whatsapp_msgs(tenant_id, hora desc);

alter table public.whatsapp_msgs enable row level security;
create policy "whatsapp_msgs_tenant_isolation" on public.whatsapp_msgs
  for all using (tenant_id in (select public.current_user_tenants()));

-- Realtime publication — Supabase precisa disso explicitamente.
alter publication supabase_realtime add table public.whatsapp_msgs;
alter publication supabase_realtime add table public.whatsapp_threads;
