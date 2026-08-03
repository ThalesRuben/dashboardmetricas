-- Multi-conta Instagram — tabela lista as contas ativas de cada tenant
-- que a edge function `instagram-sync` deve sincronizar.
--
-- Antes: edge function lia IG_BUSINESS_ACCOUNT_ID fixo do env (uma conta).
-- Agora: itera pelas linhas ativas dessa tabela.
--
-- IG_ACCESS_TOKEN continua sendo global (do env do Supabase), porque todas
-- as contas cadastradas precisam estar sob o MESMO Meta Business Manager
-- (senão o business_discovery e insights não funcionam com o mesmo token).

create table if not exists public.instagram_accounts (
  ig_user_id  text primary key,
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  username    text not null,
  active      boolean not null default true,
  added_at    timestamptz not null default now()
);

create index if not exists instagram_accounts_tenant_active_idx
  on public.instagram_accounts(tenant_id, active);

alter table public.instagram_accounts enable row level security;

drop policy if exists "leitura por membros do tenant" on public.instagram_accounts;
create policy "leitura por membros do tenant"
  on public.instagram_accounts
  for select
  to anon, authenticated
  using (tenant_id in (select public.current_user_tenants()));

-- Backfill: as 2 contas atuais do tenant TBC
insert into public.instagram_accounts (ig_user_id, tenant_id, username, active)
values
  ('17841401839429140', '31cc6350-d721-477d-bac6-3d5d8c907582', '@fabiooliver.o',    true),
  ('17841448604076875', '31cc6350-d721-477d-bac6-3d5d8c907582', '@theblonde.concept', true)
on conflict (ig_user_id) do update
set username = excluded.username,
    active   = excluded.active;

notify pgrst, 'reload schema';
