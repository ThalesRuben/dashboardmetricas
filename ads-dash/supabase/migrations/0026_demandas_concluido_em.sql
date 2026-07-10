-- 0026_demandas_concluido_em.sql
-- Adiciona `concluido_em` pra medir throughput da equipe.
-- Backfill dos "feito" atuais usa `atualizado_em` como aproximação.
-- Trigger mantém a coluna em dia ao mover cards pra/de "feito".

alter table public.demandas
  add column if not exists concluido_em timestamptz;

update public.demandas
   set concluido_em = atualizado_em
 where status = 'feito'
   and concluido_em is null;

create index if not exists demandas_tenant_concluido_idx
  on public.demandas(tenant_id, concluido_em desc)
  where concluido_em is not null;

create or replace function public.demandas_set_concluido_em()
returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    if NEW.status = 'feito' and NEW.concluido_em is null then
      NEW.concluido_em := now();
    end if;
  elsif TG_OP = 'UPDATE' then
    if OLD.status is distinct from 'feito' and NEW.status = 'feito' then
      NEW.concluido_em := now();
    elsif OLD.status = 'feito' and NEW.status is distinct from 'feito' then
      NEW.concluido_em := null;
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists demandas_set_concluido on public.demandas;
create trigger demandas_set_concluido
  before insert or update on public.demandas
  for each row execute function public.demandas_set_concluido_em();

notify pgrst, 'reload schema';
