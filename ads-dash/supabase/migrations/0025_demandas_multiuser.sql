-- 0025_demandas_multiuser.sql
-- Move o kanban de demandas do padrão "paciente 1 / login estático" pra
-- Supabase Auth real. Aposenta a policy anon (0023) e adiciona `criado_por`
-- + `responsavel_id` pra separar demandas entre os 5 membros da equipe.
-- Também expõe `demandas_team_members()` pra popular dropdowns no front.

-- 1) Remove policy anon (0023) — volta ao isolamento por tenant.
drop policy if exists "demandas_anon_all" on public.demandas;

-- 2) Default de tenant_id passa a resolver via auth.uid() (memberships),
--    não mais via helper fixo do paciente 1.
alter table public.demandas
  alter column tenant_id set default public.current_user_first_tenant();

-- 3) Colunas de autoria — quem criou (auto via auth.uid()) e quem é o
--    responsável (opcional, definido no modal).
alter table public.demandas
  add column if not exists criado_por uuid references auth.users(id) on delete set null,
  add column if not exists responsavel_id uuid references auth.users(id) on delete set null;

alter table public.demandas
  alter column criado_por set default auth.uid();

create index if not exists demandas_responsavel_idx
  on public.demandas(responsavel_id);

-- 4) Membros do tenant do usuário autenticado — pra dropdown "Responsável"
--    e filtro por pessoa. `security definer` pra ler profiles/memberships
--    sem depender das policies deles; a função filtra por tenant_id.
create or replace function public.demandas_team_members()
returns table (id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(p.full_name, '')::text as full_name
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.tenant_id in (select public.current_user_tenants())
  order by full_name;
$$;

notify pgrst, 'reload schema';

-- ============ verificação ============
select
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='demandas' and column_name='criado_por')
    as has_criado_por,
  (select count(*) from information_schema.columns
    where table_schema='public' and table_name='demandas' and column_name='responsavel_id')
    as has_responsavel_id,
  (select count(*) from pg_policies
    where schemaname='public' and tablename='demandas' and policyname='demandas_anon_all')
    as anon_policy_ainda_existe,
  (select pg_get_expr(adbin, adrelid) from pg_attrdef d
    join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
    join pg_class c on c.oid=d.adrelid
    where c.relname='demandas' and a.attname='tenant_id')
    as tenant_id_default;
