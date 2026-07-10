-- 0027_demandas_prazo.sql
-- Data limite (opcional) por demanda. Usa `date` porque prazo de tarefa
-- interna é dia-a-dia, não hora-a-hora. Índice parcial pra ordenar/filtrar
-- só o que tem prazo (a maioria das linhas fica NULL).

alter table public.demandas
  add column if not exists prazo date;

create index if not exists demandas_tenant_prazo_idx
  on public.demandas(tenant_id, prazo asc)
  where prazo is not null;

notify pgrst, 'reload schema';
