-- 0023_demandas_anon.sql
-- MVP "paciente 1": app privado com login estático (sem sessão Supabase real).
-- Libera CRUD anônimo em `public.demandas` e faz o `tenant_id` ser preenchido
-- server-side via `paciente_1_tenant_id()` — o front não precisa (nem consegue,
-- sob anon) resolver o tenant, já que RLS de `tenants` bloqueia leitura anon.
-- Quando o app virar multi-tenant com Supabase Auth real, remover essas
-- policies e voltar ao isolamento por tenant_id (0022).

create or replace function public.paciente_1_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.tenants where slug = 'the-blonde-concept' limit 1;
$$;

alter table public.demandas
  alter column tenant_id set default public.paciente_1_tenant_id();

create policy "demandas_anon_all"
  on public.demandas for all
  using (true) with check (true);

notify pgrst, 'reload schema';
