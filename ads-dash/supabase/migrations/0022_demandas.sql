-- 0022_demandas.sql
-- Kanban de demandas internas (estilo Trello/ClickUp) por tenant.
-- Colunas fixas: backlog / fazendo / feito. `ordem` mantém a posição dentro
-- da coluna (menor = topo). Prioridade opcional pra visual do card.

create table public.demandas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  titulo        text not null,
  descricao     text,
  status        text not null default 'backlog'
                check (status in ('backlog','fazendo','feito')),
  prioridade    text not null default 'media'
                check (prioridade in ('baixa','media','alta')),
  ordem         int  not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index demandas_tenant_status_idx
  on public.demandas(tenant_id, status, ordem);

alter table public.demandas enable row level security;

create policy "demandas_tenant_isolation" on public.demandas
  for all using (tenant_id in (select public.current_user_tenants()));

create or replace function public.demandas_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger demandas_touch
  before update on public.demandas
  for each row execute function public.demandas_touch_updated_at();

notify pgrst, 'reload schema';
