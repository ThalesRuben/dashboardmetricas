-- 0035_whatsapp_crm.sql
-- Mini-CRM sobre whatsapp_threads: notas internas, tags, follow-ups e vendas.
-- Todas as tabelas usam tenant_id herdado da thread + RLS por current_user_tenants().

-- ============================================================
-- crm_notas — anotações internas do time sobre um lead/thread.
-- ============================================================
create table public.crm_notas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  thread_id     uuid not null references public.whatsapp_threads(id) on delete cascade,
  autor_id      uuid references auth.users(id) on delete set null,
  texto         text not null,
  criado_em     timestamptz not null default now()
);

create index crm_notas_thread_idx on public.crm_notas(thread_id, criado_em desc);

alter table public.crm_notas enable row level security;
create policy "crm_notas_tenant_isolation" on public.crm_notas
  for all using (tenant_id in (select public.current_user_tenants()));

-- Default de tenant/autor pra front nunca precisar mandar
alter table public.crm_notas
  alter column tenant_id set default public.current_user_first_tenant(),
  alter column autor_id  set default auth.uid();

-- ============================================================
-- crm_tags — biblioteca de tags por tenant (ex: "corte", "VIP", "coloração").
-- ============================================================
create table public.crm_tags (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  nome          text not null,
  cor           text not null default '#5dcaa5',
  criado_em     timestamptz not null default now(),
  unique (tenant_id, nome)
);

alter table public.crm_tags enable row level security;
create policy "crm_tags_tenant_isolation" on public.crm_tags
  for all using (tenant_id in (select public.current_user_tenants()));

alter table public.crm_tags
  alter column tenant_id set default public.current_user_first_tenant();

-- ============================================================
-- crm_thread_tags — join thread ↔ tag.
-- ============================================================
create table public.crm_thread_tags (
  thread_id     uuid not null references public.whatsapp_threads(id) on delete cascade,
  tag_id        uuid not null references public.crm_tags(id) on delete cascade,
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  criado_em     timestamptz not null default now(),
  primary key (thread_id, tag_id)
);

create index crm_thread_tags_thread_idx on public.crm_thread_tags(thread_id);
create index crm_thread_tags_tag_idx    on public.crm_thread_tags(tag_id);

alter table public.crm_thread_tags enable row level security;
create policy "crm_thread_tags_tenant_isolation" on public.crm_thread_tags
  for all using (tenant_id in (select public.current_user_tenants()));

alter table public.crm_thread_tags
  alter column tenant_id set default public.current_user_first_tenant();

-- ============================================================
-- crm_followups — próximo retorno a fazer com o lead.
-- Uma thread pode ter vários; a UI filtra por `feito = false` pra "pendentes".
-- ============================================================
create table public.crm_followups (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  thread_id     uuid not null references public.whatsapp_threads(id) on delete cascade,
  responsavel_id uuid references auth.users(id) on delete set null,
  data          timestamptz not null,       -- quando fazer o retorno
  motivo        text,
  feito         boolean not null default false,
  feito_em      timestamptz,
  criado_em     timestamptz not null default now()
);

create index crm_followups_pendentes_idx
  on public.crm_followups(tenant_id, data) where feito = false;
create index crm_followups_thread_idx on public.crm_followups(thread_id, data);

alter table public.crm_followups enable row level security;
create policy "crm_followups_tenant_isolation" on public.crm_followups
  for all using (tenant_id in (select public.current_user_tenants()));

alter table public.crm_followups
  alter column tenant_id set default public.current_user_first_tenant();

-- ============================================================
-- crm_vendas — registro de venda fechada a partir de uma thread.
-- Alimenta receita do dashboard (ticket_medio, receita_total).
-- ============================================================
create table public.crm_vendas (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  thread_id     uuid not null references public.whatsapp_threads(id) on delete cascade,
  registrado_por uuid references auth.users(id) on delete set null,
  servico       text not null,
  valor_cents   bigint not null check (valor_cents >= 0),
  data          date not null default (now() at time zone 'America/Sao_Paulo')::date,
  observacao    text,
  criado_em     timestamptz not null default now()
);

create index crm_vendas_tenant_data_idx on public.crm_vendas(tenant_id, data desc);
create index crm_vendas_thread_idx      on public.crm_vendas(thread_id);

alter table public.crm_vendas enable row level security;
create policy "crm_vendas_tenant_isolation" on public.crm_vendas
  for all using (tenant_id in (select public.current_user_tenants()));

alter table public.crm_vendas
  alter column tenant_id set default public.current_user_first_tenant(),
  alter column registrado_por set default auth.uid();

-- ============================================================
-- RPCs de conveniência
-- ============================================================

-- Muda o status de uma thread (usado pelo drag do kanban).
-- Só recebe o novo status; RLS garante que o user só mexe nas threads do tenant dele.
create or replace function public.crm_set_thread_status(
  p_thread_id uuid,
  p_status text
) returns void language plpgsql security invoker as $$
begin
  if p_status not in ('lead','aberta','agendado','venda','arquivada') then
    raise exception 'status invalido: %', p_status;
  end if;
  update public.whatsapp_threads
     set status = p_status::whatsapp_thread_status,
         ultima_atividade = greatest(ultima_atividade, now())
   where id = p_thread_id;
end;
$$;

grant execute on function public.crm_set_thread_status(uuid, text) to authenticated;

-- Resumo do CRM por período: totais por status + valor total de vendas + ticket médio.
-- Usado pelos KPIs da nova aba.
create or replace function public.crm_summary(
  p_from timestamptz default null,
  p_to   timestamptz default null
) returns table (
  leads         int,
  em_atendimento int,
  agendados     int,
  vendas_qtd    int,
  vendas_valor_cents bigint,
  ticket_medio_cents bigint,
  followups_pendentes int,
  followups_atrasados int
) language sql stable security invoker as $$
  with periodo as (
    select
      coalesce(p_from, now() - interval '30 days') as pfrom,
      coalesce(p_to, now())                        as pto
  ),
  threads_scope as (
    select t.*
      from public.whatsapp_threads t, periodo p
     where t.tenant_id in (select public.current_user_tenants())
       and t.ultima_atividade between p.pfrom and p.pto
  ),
  vendas_scope as (
    select v.*
      from public.crm_vendas v, periodo p
     where v.tenant_id in (select public.current_user_tenants())
       and v.data between p.pfrom::date and p.pto::date
  )
  select
    (select count(*)::int from threads_scope where status = 'lead'),
    (select count(*)::int from threads_scope where status = 'aberta'),
    (select count(*)::int from threads_scope where status = 'agendado'),
    (select count(*)::int from vendas_scope),
    coalesce((select sum(valor_cents)::bigint from vendas_scope), 0),
    coalesce((select (avg(valor_cents))::bigint from vendas_scope), 0),
    (select count(*)::int
       from public.crm_followups
      where feito = false
        and tenant_id in (select public.current_user_tenants())),
    (select count(*)::int
       from public.crm_followups
      where feito = false
        and data < now()
        and tenant_id in (select public.current_user_tenants()));
$$;

grant execute on function public.crm_summary(timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';
