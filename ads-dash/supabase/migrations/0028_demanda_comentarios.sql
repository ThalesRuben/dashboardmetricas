-- 0028_demanda_comentarios.sql
-- Comentários por demanda (thread simples, sem edição).
-- tenant_id e autor_id são auto-preenchidos via defaults; front nunca envia.

create table if not exists public.demanda_comentarios (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade
              default public.current_user_first_tenant(),
  demanda_id  uuid not null references public.demandas(id) on delete cascade,
  autor_id    uuid references auth.users(id) on delete set null
              default auth.uid(),
  texto       text not null check (length(trim(texto)) > 0),
  criado_em   timestamptz not null default now()
);

create index if not exists demanda_comentarios_demanda_idx
  on public.demanda_comentarios(demanda_id, criado_em asc);

create index if not exists demanda_comentarios_tenant_idx
  on public.demanda_comentarios(tenant_id);

alter table public.demanda_comentarios enable row level security;

create policy "demanda_comentarios_tenant_isolation" on public.demanda_comentarios
  for select using (tenant_id in (select public.current_user_tenants()));

create policy "demanda_comentarios_insert_tenant" on public.demanda_comentarios
  for insert with check (tenant_id in (select public.current_user_tenants()));

-- Só autor pode remover o próprio comentário.
create policy "demanda_comentarios_delete_por_autor" on public.demanda_comentarios
  for delete using (autor_id = auth.uid());

notify pgrst, 'reload schema';
