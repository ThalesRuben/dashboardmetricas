-- 0001_init_tenants.sql
-- Multi-tenancy foundation: tenants + memberships + RLS helpers.
-- Toda tabela de domínio deve referenciar `tenants(id)` e ativar RLS.

create extension if not exists "pgcrypto";

create table public.tenants (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table public.memberships (
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner','admin','member','viewer')),
  created_at  timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index memberships_user_idx on public.memberships(user_id);

-- Helper: retorna os tenant_ids que o usuário autenticado pertence.
create or replace function public.current_user_tenants()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select tenant_id from public.memberships where user_id = auth.uid();
$$;

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;

create policy "tenants_visible_to_members" on public.tenants
  for select using (id in (select public.current_user_tenants()));

create policy "memberships_visible_to_self" on public.memberships
  for select using (user_id = auth.uid());

-- Tenant default p/ dev (remover em prod).
insert into public.tenants (slug, display_name)
values ('the-blonde-concept', 'The Blonde Concept')
on conflict (slug) do nothing;
